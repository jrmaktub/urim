use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};
use pyth_sdk_solana::state::SolanaPriceAccount;

declare_id!("5KqMaQLoKhBYcHD1qWZVcQqu5pmTvMitDUEqmKsqBTQg");

// =============================================================================
// IMPORTANT ADDRESSES - DOCUMENTED FOR REFERENCE
// =============================================================================
//
// PYTH PRICE FEED PROGRAM (same on devnet & mainnet):
//   pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT
//
// PYTH SOL/USD PRICE FEED ACCOUNTS:
//   Devnet:  J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix
//   Mainnet: H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG
//
// USDC MINT:
//   Devnet:  4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU (Circle's official)
//   Mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
//
// URIM TOKEN (pump.fun - MAINNET ONLY):
//   F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump
//
// HERMES API (for off-chain price fetching):
//   https://hermes.pyth.network
//   SOL/USD Price Feed ID: ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d
//
// =============================================================================

// Fee: 0.5% charged ON TOP of bet (user pays bet + fee)
pub const FEE_BPS: u64 = 50; // 0.5% = 50 basis points

// URIM users get 10% discount on fees (0.45% instead of 0.5%)
pub const URIM_FEE_BPS: u64 = 45; // FEE_BPS * 90% = 45 basis points

// Default round duration: 15 minutes
pub const DEFAULT_ROUND_DURATION: i64 = 900; // 15 * 60 seconds

// Minimum bet in USD cents (1 USD = 100 cents)
pub const MIN_BET_USD_CENTS: u64 = 100; // $1.00 minimum

// USDC has 6 decimals
pub const USDC_DECIMALS: u8 = 6;
// URIM has 6 decimals (pump.fun tokens)
pub const URIM_DECIMALS: u8 = 6;

// Maximum staleness for Pyth price (5 minutes for production safety)
pub const MAX_PRICE_AGE_SECS: u64 = 300;

#[program]
pub mod urim_solana {
    use super::*;

    /// Initialize the platform (admin-only, one-time)
    pub fn initialize(ctx: Context<Initialize>, treasury: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.treasury = treasury;
        config.paused = false;
        config.current_round_id = 0;
        config.bump = ctx.bumps.config;

        msg!("Platform initialized by admin: {}", config.admin);
        Ok(())
    }

    /// Start a new round using Pyth price feed - ADMIN ONLY
    /// Reads current SOL/USD price from Pyth on-chain oracle
    pub fn start_round(
        ctx: Context<StartRoundWithPyth>,
        duration_seconds: i64, // 0 = use default (900s = 15min)
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(!config.paused, ErrorCode::PlatformPaused);

        // Get price from Pyth on-chain price feed
        let price_account_info = &ctx.accounts.pyth_price_feed;
        let price_feed = SolanaPriceAccount::account_info_to_feed(price_account_info)
            .map_err(|_| ErrorCode::PythPriceStale)?;

        let current_price = price_feed.get_price_no_older_than(
            Clock::get()?.unix_timestamp,
            MAX_PRICE_AGE_SECS,
        ).ok_or(ErrorCode::PythPriceStale)?;

        // Convert Pyth price to our format (cents, 2 decimals)
        let locked_price = convert_pyth_price_to_cents(current_price.price, current_price.expo)?;
        require!(locked_price > 0, ErrorCode::InvalidPrice);

        let clock = Clock::get()?;
        let round = &mut ctx.accounts.round;

        // Use provided duration or default
        let duration = if duration_seconds > 0 {
            duration_seconds
        } else {
            DEFAULT_ROUND_DURATION
        };

        round.round_id = config.current_round_id;
        round.locked_price = locked_price;
        round.final_price = 0;
        round.created_at = clock.unix_timestamp;
        round.lock_time = clock.unix_timestamp;
        round.end_time = clock.unix_timestamp + duration;
        // USDC pools
        round.up_pool = 0;
        round.down_pool = 0;
        round.total_fees = 0;
        // URIM pools
        round.up_pool_urim = 0;
        round.down_pool_urim = 0;
        round.total_fees_urim = 0;
        // USD value pools (unified)
        round.up_pool_usd = 0;
        round.down_pool_usd = 0;
        round.total_fees_usd = 0;
        round.resolved = false;
        round.outcome = Outcome::Pending;
        round.bump = ctx.bumps.round;
        round.vault_bump = ctx.bumps.vault;
        round.urim_vault_bump = ctx.bumps.urim_vault;

        config.current_round_id += 1;

        msg!(
            "Round {} started: Locked ${}.{:02} (from Pyth), duration {}s, ends at {}",
            round.round_id,
            locked_price / 100,
            locked_price % 100,
            duration,
            round.end_time
        );

        Ok(())
    }

    /// Start round with manual price (for testing/backup) - ADMIN ONLY
    /// Use when Pyth price is unavailable or for controlled testing
    pub fn start_round_manual(
        ctx: Context<StartRound>,
        locked_price: u64,
        duration_seconds: i64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(!config.paused, ErrorCode::PlatformPaused);
        require!(locked_price > 0, ErrorCode::InvalidPrice);

        let clock = Clock::get()?;
        let round = &mut ctx.accounts.round;

        let duration = if duration_seconds > 0 {
            duration_seconds
        } else {
            DEFAULT_ROUND_DURATION
        };

        round.round_id = config.current_round_id;
        round.locked_price = locked_price;
        round.final_price = 0;
        round.created_at = clock.unix_timestamp;
        round.lock_time = clock.unix_timestamp;
        round.end_time = clock.unix_timestamp + duration;
        // USDC pools
        round.up_pool = 0;
        round.down_pool = 0;
        round.total_fees = 0;
        // URIM pools
        round.up_pool_urim = 0;
        round.down_pool_urim = 0;
        round.total_fees_urim = 0;
        // USD value pools (unified)
        round.up_pool_usd = 0;
        round.down_pool_usd = 0;
        round.total_fees_usd = 0;
        round.resolved = false;
        round.outcome = Outcome::Pending;
        round.bump = ctx.bumps.round;
        round.vault_bump = ctx.bumps.vault;
        round.urim_vault_bump = ctx.bumps.urim_vault;

        config.current_round_id += 1;

        msg!(
            "Round {} started (MANUAL): Locked ${}.{:02}, duration {}s",
            round.round_id,
            locked_price / 100,
            locked_price % 100,
            duration
        );

        Ok(())
    }

    /// Place a USDC bet on UP or DOWN
    /// User pays: bet_amount + 0.5% fee
    /// USDC is pegged to $1.00, so 1 USDC = 100 cents
    pub fn place_bet(ctx: Context<PlaceBet>, amount: u64, bet_up: bool) -> Result<()> {
        let config = &ctx.accounts.config;
        let round = &mut ctx.accounts.round;
        let clock = Clock::get()?;

        require!(!config.paused, ErrorCode::PlatformPaused);
        require!(!round.resolved, ErrorCode::RoundResolved);
        require!(clock.unix_timestamp < round.end_time, ErrorCode::BettingClosed);

        // USDC: 1 token (with 6 decimals) = $1.00 = 100 cents
        // amount is in 6-decimal format, so 1_000_000 = 1 USDC = 100 cents
        let usd_value_cents = amount / 10_000; // Convert to cents (amount / 1_000_000 * 100)
        require!(usd_value_cents >= MIN_BET_USD_CENTS, ErrorCode::BetTooSmall);

        // Calculate fee (0.5% of bet amount, charged ON TOP)
        let fee = (amount * FEE_BPS) / 10000;
        let fee_usd_cents = (usd_value_cents * FEE_BPS) / 10000;
        let total_charge = amount + fee;

        // Transfer from user to USDC vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            total_charge,
        )?;

        // Update pools (both token amounts and USD values)
        if bet_up {
            round.up_pool += amount; // USDC amount
            round.up_pool_usd += usd_value_cents;
        } else {
            round.down_pool += amount; // USDC amount
            round.down_pool_usd += usd_value_cents;
        }
        round.total_fees += fee;
        round.total_fees_usd += fee_usd_cents;

        // Record user bet
        let user_bet = &mut ctx.accounts.user_bet;

        if user_bet.amount == 0 {
            user_bet.user = ctx.accounts.user.key();
            user_bet.round_id = round.round_id;
            user_bet.bet_up = bet_up;
            user_bet.token_type = TokenType::USDC;
            user_bet.claimed_usdc = false;
            user_bet.claimed_urim = false;
            user_bet.bump = ctx.bumps.user_bet;
        } else {
            require!(user_bet.bet_up == bet_up, ErrorCode::CannotSwitchSides);
            require!(user_bet.token_type == TokenType::USDC, ErrorCode::CannotMixTokens);
        }

        user_bet.amount += amount;
        user_bet.usd_value += usd_value_cents;

        msg!(
            "Round {}: {} bet {} USDC (${}.{:02}) on {} (fee: {})",
            round.round_id,
            ctx.accounts.user.key(),
            amount / 1_000_000,
            usd_value_cents / 100,
            usd_value_cents % 100,
            if bet_up { "UP" } else { "DOWN" },
            fee
        );

        Ok(())
    }

    /// Place a URIM bet on UP or DOWN
    /// User provides: amount in URIM tokens, urim_price_scaled (price with 8 decimals)
    /// User pays: bet_amount + 0.5% fee
    ///
    /// Price format: urim_price_scaled = price_usd * 100_000_000
    /// Example: URIM at $0.00001251 => urim_price_scaled = 1251
    pub fn place_bet_urim(
        ctx: Context<PlaceBetUrim>,
        amount: u64,
        bet_up: bool,
        urim_price_scaled: u64, // URIM price with 8 decimals (e.g., 1251 = $0.00001251)
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let round = &mut ctx.accounts.round;
        let clock = Clock::get()?;

        require!(!config.paused, ErrorCode::PlatformPaused);
        require!(!round.resolved, ErrorCode::RoundResolved);
        require!(clock.unix_timestamp < round.end_time, ErrorCode::BettingClosed);
        require!(urim_price_scaled > 0, ErrorCode::InvalidPrice);

        // Calculate USD value with 8-decimal price precision
        // amount is in 6-decimal format (micro-tokens)
        // urim_price_scaled is price_usd * 10^8
        // usd = (amount / 10^6) * (urim_price_scaled / 10^8) = amount * urim_price_scaled / 10^14
        // usd_cents = usd * 100 = amount * urim_price_scaled / 10^12
        let usd_value_cents = (amount as u128)
            .checked_mul(urim_price_scaled as u128)
            .unwrap()
            .checked_div(1_000_000_000_000) // 10^12
            .unwrap() as u64;

        require!(usd_value_cents >= MIN_BET_USD_CENTS, ErrorCode::BetTooSmall);

        // Calculate fee with 10% discount for URIM users (0.45% instead of 0.5%)
        let fee = (amount * URIM_FEE_BPS) / 10000;
        let fee_usd_cents = (usd_value_cents * URIM_FEE_BPS) / 10000;
        let total_charge = amount + fee;

        // Transfer from user to URIM vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.urim_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            total_charge,
        )?;

        // Update pools (track URIM in separate pools, but USD in unified pool)
        if bet_up {
            round.up_pool_urim += amount; // URIM amount
            round.up_pool_usd += usd_value_cents;
        } else {
            round.down_pool_urim += amount; // URIM amount
            round.down_pool_usd += usd_value_cents;
        }
        round.total_fees_urim += fee;
        round.total_fees_usd += fee_usd_cents;

        // Record user bet
        let user_bet = &mut ctx.accounts.user_bet;

        if user_bet.amount == 0 {
            user_bet.user = ctx.accounts.user.key();
            user_bet.round_id = round.round_id;
            user_bet.bet_up = bet_up;
            user_bet.token_type = TokenType::URIM;
            user_bet.urim_price_at_bet = urim_price_scaled; // Store for reference
            user_bet.claimed_usdc = false;
            user_bet.claimed_urim = false;
            user_bet.bump = ctx.bumps.user_bet;
        } else {
            require!(user_bet.bet_up == bet_up, ErrorCode::CannotSwitchSides);
            require!(user_bet.token_type == TokenType::URIM, ErrorCode::CannotMixTokens);
        }

        user_bet.amount += amount;
        user_bet.usd_value += usd_value_cents;

        msg!(
            "Round {}: {} bet {} URIM (${}.{:02}, price_scaled={}) on {}",
            round.round_id,
            ctx.accounts.user.key(),
            amount / 1_000_000,
            usd_value_cents / 100,
            usd_value_cents % 100,
            urim_price_scaled,
            if bet_up { "UP" } else { "DOWN" }
        );

        Ok(())
    }

    /// Resolve round using Pyth price feed - ADMIN ONLY
    pub fn resolve_round(ctx: Context<ResolveRoundWithPyth>) -> Result<()> {
        let config = &ctx.accounts.config;
        let round = &mut ctx.accounts.round;
        let clock = Clock::get()?;

        require!(!config.paused, ErrorCode::PlatformPaused);
        require!(!round.resolved, ErrorCode::RoundResolved);
        require!(clock.unix_timestamp >= round.end_time, ErrorCode::RoundNotEnded);

        // Get price from Pyth
        let price_account_info = &ctx.accounts.pyth_price_feed;
        let price_feed = SolanaPriceAccount::account_info_to_feed(price_account_info)
            .map_err(|_| ErrorCode::PythPriceStale)?;

        let current_price = price_feed.get_price_no_older_than(
            clock.unix_timestamp,
            MAX_PRICE_AGE_SECS,
        ).ok_or(ErrorCode::PythPriceStale)?;

        let final_price = convert_pyth_price_to_cents(current_price.price, current_price.expo)?;
        require!(final_price > 0, ErrorCode::InvalidPrice);

        round.resolved = true;
        round.final_price = final_price;

        // Determine outcome
        if final_price > round.locked_price {
            round.outcome = Outcome::Up;
        } else if final_price < round.locked_price {
            round.outcome = Outcome::Down;
        } else {
            round.outcome = Outcome::Draw;
        }

        msg!(
            "Round {} resolved (PYTH): ${}.{:02} -> ${}.{:02} = {:?}",
            round.round_id,
            round.locked_price / 100,
            round.locked_price % 100,
            final_price / 100,
            final_price % 100,
            round.outcome
        );

        Ok(())
    }

    /// Resolve round with manual price (for testing/backup) - ADMIN ONLY
    pub fn resolve_round_manual(ctx: Context<ResolveRound>, final_price: u64) -> Result<()> {
        let config = &ctx.accounts.config;
        let round = &mut ctx.accounts.round;
        let clock = Clock::get()?;

        require!(!config.paused, ErrorCode::PlatformPaused);
        require!(!round.resolved, ErrorCode::RoundResolved);
        require!(clock.unix_timestamp >= round.end_time, ErrorCode::RoundNotEnded);
        require!(final_price > 0, ErrorCode::InvalidPrice);

        round.resolved = true;
        round.final_price = final_price;

        if final_price > round.locked_price {
            round.outcome = Outcome::Up;
        } else if final_price < round.locked_price {
            round.outcome = Outcome::Down;
        } else {
            round.outcome = Outcome::Draw;
        }

        msg!(
            "Round {} resolved (MANUAL): ${}.{:02} -> ${}.{:02} = {:?}",
            round.round_id,
            round.locked_price / 100,
            round.locked_price % 100,
            final_price / 100,
            final_price % 100,
            round.outcome
        );

        Ok(())
    }

    /// EMERGENCY: Force resolve round - ADMIN ONLY (bypasses timing)
    pub fn emergency_resolve(ctx: Context<ResolveRound>, final_price: u64, outcome: u8) -> Result<()> {
        let round = &mut ctx.accounts.round;

        require!(!round.resolved, ErrorCode::RoundResolved);

        round.resolved = true;
        round.final_price = final_price;

        round.outcome = match outcome {
            1 => Outcome::Up,
            2 => Outcome::Down,
            _ => Outcome::Draw,
        };

        msg!(
            "EMERGENCY RESOLVE: Round {} -> {:?} (price: {})",
            round.round_id,
            round.outcome,
            final_price
        );

        Ok(())
    }

    /// PERMISSIONLESS: Anyone can resolve a round after it ends
    /// Uses Pyth price feed - fully automated, no admin needed
    /// Frontend or backend can call this automatically when round ends
    pub fn resolve_round_permissionless(ctx: Context<ResolveRoundPermissionless>) -> Result<()> {
        let config = &ctx.accounts.config;
        let round = &mut ctx.accounts.round;
        let clock = Clock::get()?;

        require!(!config.paused, ErrorCode::PlatformPaused);
        require!(!round.resolved, ErrorCode::RoundResolved);
        require!(clock.unix_timestamp >= round.end_time, ErrorCode::RoundNotEnded);

        // Get price from Pyth
        let price_account_info = &ctx.accounts.pyth_price_feed;
        let price_feed = SolanaPriceAccount::account_info_to_feed(price_account_info)
            .map_err(|_| ErrorCode::PythPriceStale)?;

        let current_price = price_feed.get_price_no_older_than(
            clock.unix_timestamp,
            MAX_PRICE_AGE_SECS,
        ).ok_or(ErrorCode::PythPriceStale)?;

        let final_price = convert_pyth_price_to_cents(current_price.price, current_price.expo)?;
        require!(final_price > 0, ErrorCode::InvalidPrice);

        round.resolved = true;
        round.final_price = final_price;

        // Determine outcome
        if final_price > round.locked_price {
            round.outcome = Outcome::Up;
        } else if final_price < round.locked_price {
            round.outcome = Outcome::Down;
        } else {
            round.outcome = Outcome::Draw;
        }

        msg!(
            "Round {} resolved (PERMISSIONLESS): ${}.{:02} -> ${}.{:02} = {:?}",
            round.round_id,
            round.locked_price / 100,
            round.locked_price % 100,
            final_price / 100,
            final_price % 100,
            round.outcome
        );

        Ok(())
    }

    /// EMERGENCY: Withdraw all funds from vault - ADMIN ONLY
    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
        let round = &ctx.accounts.round;
        let vault_balance = ctx.accounts.vault.amount;

        require!(vault_balance > 0, ErrorCode::NoFundsToWithdraw);

        let round_id_bytes = round.round_id.to_le_bytes();
        let seeds = &[
            b"vault".as_ref(),
            round_id_bytes.as_ref(),
            &[round.vault_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            ),
            vault_balance,
        )?;

        msg!(
            "EMERGENCY WITHDRAW: {} from round {} vault to treasury",
            vault_balance,
            round.round_id
        );

        Ok(())
    }

    /// EMERGENCY: Withdraw all URIM funds from vault - ADMIN ONLY
    pub fn emergency_withdraw_urim(ctx: Context<EmergencyWithdrawUrim>) -> Result<()> {
        let round = &ctx.accounts.round;
        let vault_balance = ctx.accounts.urim_vault.amount;

        require!(vault_balance > 0, ErrorCode::NoFundsToWithdraw);

        let round_id_bytes = round.round_id.to_le_bytes();
        let seeds = &[
            b"urim_vault".as_ref(),
            round_id_bytes.as_ref(),
            &[round.urim_vault_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.urim_vault.to_account_info(),
            to: ctx.accounts.urim_treasury.to_account_info(),
            authority: ctx.accounts.urim_vault.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            ),
            vault_balance,
        )?;

        msg!(
            "EMERGENCY WITHDRAW URIM: {} from round {} vault to treasury",
            vault_balance,
            round.round_id
        );

        Ok(())
    }

    /// Claim USDC winnings (or refund if draw)
    /// Any winner can claim their share of the USDC loser pool
    /// USDC bettors also get their original bet back
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let round = &ctx.accounts.round;
        let user_bet = &mut ctx.accounts.user_bet;

        require!(round.resolved, ErrorCode::RoundNotResolved);
        require!(!user_bet.claimed_usdc, ErrorCode::AlreadyClaimed);

        let payout = calculate_payout_usdc(round, user_bet)?;
        require!(payout > 0, ErrorCode::NoPayout);

        let round_id_bytes = round.round_id.to_le_bytes();
        let seeds = &[
            b"vault".as_ref(),
            round_id_bytes.as_ref(),
            &[round.vault_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            ),
            payout,
        )?;

        user_bet.claimed_usdc = true;

        msg!(
            "Round {}: {} claimed {} USDC",
            round.round_id,
            user_bet.user,
            payout / 1_000_000
        );

        Ok(())
    }

    /// Claim URIM winnings (or refund if draw)
    /// Any winner can claim their share of the URIM loser pool
    /// URIM bettors also get their original bet back
    pub fn claim_urim(ctx: Context<ClaimUrim>) -> Result<()> {
        let round = &ctx.accounts.round;
        let user_bet = &mut ctx.accounts.user_bet;

        require!(round.resolved, ErrorCode::RoundNotResolved);
        require!(!user_bet.claimed_urim, ErrorCode::AlreadyClaimed);

        let payout = calculate_payout_urim(round, user_bet)?;
        require!(payout > 0, ErrorCode::NoPayout);

        let round_id_bytes = round.round_id.to_le_bytes();
        let seeds = &[
            b"urim_vault".as_ref(),
            round_id_bytes.as_ref(),
            &[round.urim_vault_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.urim_vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.urim_vault.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            ),
            payout,
        )?;

        user_bet.claimed_urim = true;

        msg!(
            "Round {}: {} claimed {} URIM",
            round.round_id,
            user_bet.user,
            payout / 1_000_000
        );

        Ok(())
    }

    /// Claim ALL winnings from BOTH vaults in a single transaction
    /// This is the recommended claim method for better UX
    /// Winners get: their bet back + share of USDC loser pool + share of URIM loser pool
    pub fn claim_all(ctx: Context<ClaimAll>) -> Result<()> {
        let round = &ctx.accounts.round;
        let user_bet = &mut ctx.accounts.user_bet;

        require!(round.resolved, ErrorCode::RoundNotResolved);

        // Calculate payouts from both vaults
        let usdc_payout = if !user_bet.claimed_usdc {
            calculate_payout_usdc(round, user_bet)?
        } else {
            0
        };

        let urim_payout = if !user_bet.claimed_urim {
            calculate_payout_urim(round, user_bet)?
        } else {
            0
        };

        // Must have at least one payout
        require!(usdc_payout > 0 || urim_payout > 0, ErrorCode::NoPayout);

        // Transfer USDC if there's a payout
        if usdc_payout > 0 {
            let round_id_bytes = round.round_id.to_le_bytes();
            let seeds = &[
                b"vault".as_ref(),
                round_id_bytes.as_ref(),
                &[round.vault_bump],
            ];
            let signer = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user_usdc_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            };
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    cpi_accounts,
                    signer,
                ),
                usdc_payout,
            )?;

            user_bet.claimed_usdc = true;
        }

        // Transfer URIM if there's a payout
        if urim_payout > 0 {
            let round_id_bytes = round.round_id.to_le_bytes();
            let seeds = &[
                b"urim_vault".as_ref(),
                round_id_bytes.as_ref(),
                &[round.urim_vault_bump],
            ];
            let signer = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.urim_vault.to_account_info(),
                to: ctx.accounts.user_urim_account.to_account_info(),
                authority: ctx.accounts.urim_vault.to_account_info(),
            };
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    cpi_accounts,
                    signer,
                ),
                urim_payout,
            )?;

            user_bet.claimed_urim = true;
        }

        msg!(
            "Round {}: {} claimed {} USDC + {} URIM (claim_all)",
            round.round_id,
            user_bet.user,
            usdc_payout / 1_000_000,
            urim_payout / 1_000_000
        );

        Ok(())
    }

    /// Collect USDC fees to treasury - ADMIN ONLY
    pub fn collect_fees(ctx: Context<CollectFees>) -> Result<()> {
        let round = &mut ctx.accounts.round;

        require!(round.resolved, ErrorCode::RoundNotResolved);
        require!(round.total_fees > 0, ErrorCode::NoFeesToCollect);

        let fee_amount = round.total_fees;

        let round_id_bytes = round.round_id.to_le_bytes();
        let seeds = &[
            b"vault".as_ref(),
            round_id_bytes.as_ref(),
            &[round.vault_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            ),
            fee_amount,
        )?;

        round.total_fees = 0;

        msg!("Collected {} USDC fees from round {}", fee_amount / 1_000_000, round.round_id);

        Ok(())
    }

    /// Collect URIM fees to treasury - ADMIN ONLY
    pub fn collect_fees_urim(ctx: Context<CollectFeesUrim>) -> Result<()> {
        let round = &mut ctx.accounts.round;

        require!(round.resolved, ErrorCode::RoundNotResolved);
        require!(round.total_fees_urim > 0, ErrorCode::NoFeesToCollect);

        let fee_amount = round.total_fees_urim;

        let round_id_bytes = round.round_id.to_le_bytes();
        let seeds = &[
            b"urim_vault".as_ref(),
            round_id_bytes.as_ref(),
            &[round.urim_vault_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.urim_vault.to_account_info(),
            to: ctx.accounts.urim_treasury.to_account_info(),
            authority: ctx.accounts.urim_vault.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            ),
            fee_amount,
        )?;

        round.total_fees_urim = 0;

        msg!("Collected {} URIM fees from round {}", fee_amount / 1_000_000, round.round_id);

        Ok(())
    }

    /// Emergency pause - ADMIN ONLY
    pub fn pause(ctx: Context<AdminControl>) -> Result<()> {
        ctx.accounts.config.paused = true;
        msg!("Platform PAUSED");
        Ok(())
    }

    /// Unpause - ADMIN ONLY
    pub fn unpause(ctx: Context<AdminControl>) -> Result<()> {
        ctx.accounts.config.paused = false;
        msg!("Platform UNPAUSED");
        Ok(())
    }

    /// Update treasury address - ADMIN ONLY
    pub fn update_treasury(ctx: Context<AdminControl>, new_treasury: Pubkey) -> Result<()> {
        ctx.accounts.config.treasury = new_treasury;
        msg!("Treasury updated to: {}", new_treasury);
        Ok(())
    }
}

/// Convert Pyth price to cents (2 decimal places)
/// Pyth prices are i64 with variable exponents
fn convert_pyth_price_to_cents(price: i64, exponent: i32) -> Result<u64> {
    if price <= 0 {
        return Err(ErrorCode::InvalidPrice.into());
    }

    // We want price in cents (2 decimal places)
    // If exponent is -8, price 23456789012 means $234.56789012
    // We want 23456 (cents)

    let price_u64 = price as u64;

    // Target exponent is -2 (cents)
    let exp_diff = exponent + 2; // How many places to shift

    let cents = if exp_diff < 0 {
        // Need to divide (price has more decimals than we want)
        let divisor = 10u64.pow((-exp_diff) as u32);
        price_u64 / divisor
    } else if exp_diff > 0 {
        // Need to multiply (price has fewer decimals than we want)
        let multiplier = 10u64.pow(exp_diff as u32);
        price_u64 * multiplier
    } else {
        price_u64
    };

    Ok(cents)
}

/// Calculate USDC payout for a user from the USDC vault
/// MIXED POOL: Winners get share of USDC loser pool based on USD value contribution
/// - USDC bettors on winning side: get bet back + USD share of USDC losers
/// - URIM bettors on winning side: get USD share of USDC losers only
fn calculate_payout_usdc(round: &Round, user_bet: &UserBet) -> Result<u64> {
    match round.outcome {
        Outcome::Pending => Ok(0),
        Outcome::Draw => {
            // Refund only if user bet in USDC
            if user_bet.token_type == TokenType::USDC {
                Ok(user_bet.amount)
            } else {
                Ok(0)
            }
        }
        Outcome::Up => {
            if user_bet.bet_up {
                // User is on winning side - calculate their share
                let winning_usd_pool = round.up_pool_usd; // Total USD value on UP
                let losing_usdc_pool = round.down_pool; // USDC tokens on DOWN (losers)

                if winning_usd_pool == 0 {
                    // Edge case: no winning bets, refund if USDC
                    return if user_bet.token_type == TokenType::USDC {
                        Ok(user_bet.amount)
                    } else {
                        Ok(0)
                    };
                }

                // User's share of USDC loser pool based on their USD value contribution
                let winnings_usdc = (user_bet.usd_value as u128)
                    .checked_mul(losing_usdc_pool as u128)
                    .unwrap()
                    .checked_div(winning_usd_pool as u128)
                    .unwrap() as u64;

                // If user bet USDC, they also get their original bet back
                if user_bet.token_type == TokenType::USDC {
                    Ok(user_bet.amount + winnings_usdc)
                } else {
                    Ok(winnings_usdc)
                }
            } else {
                Ok(0) // Lost - no payout
            }
        }
        Outcome::Down => {
            if !user_bet.bet_up {
                let winning_usd_pool = round.down_pool_usd;
                let losing_usdc_pool = round.up_pool;

                if winning_usd_pool == 0 {
                    return if user_bet.token_type == TokenType::USDC {
                        Ok(user_bet.amount)
                    } else {
                        Ok(0)
                    };
                }

                let winnings_usdc = (user_bet.usd_value as u128)
                    .checked_mul(losing_usdc_pool as u128)
                    .unwrap()
                    .checked_div(winning_usd_pool as u128)
                    .unwrap() as u64;

                if user_bet.token_type == TokenType::USDC {
                    Ok(user_bet.amount + winnings_usdc)
                } else {
                    Ok(winnings_usdc)
                }
            } else {
                Ok(0)
            }
        }
    }
}

/// Calculate URIM payout for a user from the URIM vault
/// MIXED POOL: Winners get share of URIM loser pool based on USD value contribution
/// - URIM bettors on winning side: get bet back + USD share of URIM losers
/// - USDC bettors on winning side: get USD share of URIM losers only
fn calculate_payout_urim(round: &Round, user_bet: &UserBet) -> Result<u64> {
    match round.outcome {
        Outcome::Pending => Ok(0),
        Outcome::Draw => {
            // Refund only if user bet in URIM
            if user_bet.token_type == TokenType::URIM {
                Ok(user_bet.amount)
            } else {
                Ok(0)
            }
        }
        Outcome::Up => {
            if user_bet.bet_up {
                let winning_usd_pool = round.up_pool_usd;
                let losing_urim_pool = round.down_pool_urim;

                if winning_usd_pool == 0 {
                    return if user_bet.token_type == TokenType::URIM {
                        Ok(user_bet.amount)
                    } else {
                        Ok(0)
                    };
                }

                let winnings_urim = (user_bet.usd_value as u128)
                    .checked_mul(losing_urim_pool as u128)
                    .unwrap()
                    .checked_div(winning_usd_pool as u128)
                    .unwrap() as u64;

                if user_bet.token_type == TokenType::URIM {
                    Ok(user_bet.amount + winnings_urim)
                } else {
                    Ok(winnings_urim)
                }
            } else {
                Ok(0)
            }
        }
        Outcome::Down => {
            if !user_bet.bet_up {
                let winning_usd_pool = round.down_pool_usd;
                let losing_urim_pool = round.up_pool_urim;

                if winning_usd_pool == 0 {
                    return if user_bet.token_type == TokenType::URIM {
                        Ok(user_bet.amount)
                    } else {
                        Ok(0)
                    };
                }

                let winnings_urim = (user_bet.usd_value as u128)
                    .checked_mul(losing_urim_pool as u128)
                    .unwrap()
                    .checked_div(winning_usd_pool as u128)
                    .unwrap() as u64;

                if user_bet.token_type == TokenType::URIM {
                    Ok(user_bet.amount + winnings_urim)
                } else {
                    Ok(winnings_urim)
                }
            } else {
                Ok(0)
            }
        }
    }
}

// ============================================================================
// ACCOUNTS
// ============================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Config::SIZE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Start round WITH Pyth price oracle
#[derive(Accounts)]
pub struct StartRoundWithPyth<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = admin,
        space = 8 + Round::SIZE,
        seeds = [b"round", config.current_round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub round: Account<'info, Round>,

    #[account(
        init,
        payer = admin,
        seeds = [b"vault", config.current_round_id.to_le_bytes().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = vault,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = admin,
        seeds = [b"urim_vault", config.current_round_id.to_le_bytes().as_ref()],
        bump,
        token::mint = urim_mint,
        token::authority = urim_vault,
    )]
    pub urim_vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub urim_mint: Account<'info, Mint>,

    /// CHECK: Pyth price feed account - validated by Pyth SDK
    pub pyth_price_feed: AccountInfo<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Start round WITHOUT Pyth (manual price)
#[derive(Accounts)]
pub struct StartRound<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = admin,
        space = 8 + Round::SIZE,
        seeds = [b"round", config.current_round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub round: Account<'info, Round>,

    #[account(
        init,
        payer = admin,
        seeds = [b"vault", config.current_round_id.to_le_bytes().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = vault,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = admin,
        seeds = [b"urim_vault", config.current_round_id.to_le_bytes().as_ref()],
        bump,
        token::mint = urim_mint,
        token::authority = urim_vault,
    )]
    pub urim_vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub urim_mint: Account<'info, Mint>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Place bet with USDC
#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub round: Account<'info, Round>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserBet::SIZE,
        seeds = [b"bet", round.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_bet: Account<'info, UserBet>,

    #[account(
        mut,
        seeds = [b"vault", round.round_id.to_le_bytes().as_ref()],
        bump = round.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Place bet with URIM
#[derive(Accounts)]
pub struct PlaceBetUrim<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub round: Account<'info, Round>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserBet::SIZE,
        seeds = [b"bet", round.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_bet: Account<'info, UserBet>,

    #[account(
        mut,
        seeds = [b"urim_vault", round.round_id.to_le_bytes().as_ref()],
        bump = round.urim_vault_bump,
    )]
    pub urim_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Resolve round WITH Pyth price oracle
#[derive(Accounts)]
pub struct ResolveRoundWithPyth<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub round: Account<'info, Round>,

    /// CHECK: Pyth price feed account - validated by Pyth SDK
    pub pyth_price_feed: AccountInfo<'info>,

    pub admin: Signer<'info>,
}

/// Resolve round WITHOUT Pyth (manual price)
#[derive(Accounts)]
pub struct ResolveRound<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub round: Account<'info, Round>,

    pub admin: Signer<'info>,
}

/// PERMISSIONLESS resolve - anyone can call after round ends
#[derive(Accounts)]
pub struct ResolveRoundPermissionless<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub round: Account<'info, Round>,

    /// CHECK: Pyth price feed account - validated by Pyth SDK
    pub pyth_price_feed: AccountInfo<'info>,
    // No admin signer required - anyone can call this
}

/// Claim USDC winnings
#[derive(Accounts)]
pub struct Claim<'info> {
    pub round: Account<'info, Round>,

    #[account(
        mut,
        constraint = user_bet.user == user.key() @ ErrorCode::NotYourBet
    )]
    pub user_bet: Account<'info, UserBet>,

    #[account(
        mut,
        seeds = [b"vault", round.round_id.to_le_bytes().as_ref()],
        bump = round.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

/// Claim URIM winnings
#[derive(Accounts)]
pub struct ClaimUrim<'info> {
    pub round: Account<'info, Round>,

    #[account(
        mut,
        constraint = user_bet.user == user.key() @ ErrorCode::NotYourBet
    )]
    pub user_bet: Account<'info, UserBet>,

    #[account(
        mut,
        seeds = [b"urim_vault", round.round_id.to_le_bytes().as_ref()],
        bump = round.urim_vault_bump,
    )]
    pub urim_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

/// Claim ALL winnings from both vaults in one transaction
#[derive(Accounts)]
pub struct ClaimAll<'info> {
    pub round: Account<'info, Round>,

    #[account(
        mut,
        constraint = user_bet.user == user.key() @ ErrorCode::NotYourBet
    )]
    pub user_bet: Account<'info, UserBet>,

    #[account(
        mut,
        seeds = [b"vault", round.round_id.to_le_bytes().as_ref()],
        bump = round.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"urim_vault", round.round_id.to_le_bytes().as_ref()],
        bump = round.urim_vault_bump,
    )]
    pub urim_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_urim_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

/// Collect USDC fees
#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin,
        has_one = treasury
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub round: Account<'info, Round>,

    #[account(
        mut,
        seeds = [b"vault", round.round_id.to_le_bytes().as_ref()],
        bump = round.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury: Account<'info, TokenAccount>,

    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

/// Collect URIM fees
#[derive(Accounts)]
pub struct CollectFeesUrim<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub round: Account<'info, Round>,

    #[account(
        mut,
        seeds = [b"urim_vault", round.round_id.to_le_bytes().as_ref()],
        bump = round.urim_vault_bump,
    )]
    pub urim_vault: Account<'info, TokenAccount>,

    /// URIM treasury token account (can be different from USDC treasury)
    #[account(mut)]
    pub urim_treasury: Account<'info, TokenAccount>,

    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin,
        has_one = treasury
    )]
    pub config: Account<'info, Config>,

    pub round: Account<'info, Round>,

    #[account(
        mut,
        seeds = [b"vault", round.round_id.to_le_bytes().as_ref()],
        bump = round.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury: Account<'info, TokenAccount>,

    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct EmergencyWithdrawUrim<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin
    )]
    pub config: Account<'info, Config>,

    pub round: Account<'info, Round>,

    #[account(
        mut,
        seeds = [b"urim_vault", round.round_id.to_le_bytes().as_ref()],
        bump = round.urim_vault_bump,
    )]
    pub urim_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub urim_treasury: Account<'info, TokenAccount>,

    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminControl<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin
    )]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

// ============================================================================
// STATE
// ============================================================================

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub paused: bool,
    pub current_round_id: u64,
    pub bump: u8,
}

impl Config {
    pub const SIZE: usize = 32 + 32 + 1 + 8 + 1;
}

#[account]
pub struct Round {
    pub round_id: u64,
    pub locked_price: u64,      // SOL/USD price at start (in cents)
    pub final_price: u64,       // SOL/USD price at end (in cents)
    pub created_at: i64,
    pub lock_time: i64,
    pub end_time: i64,
    // USDC pools (in USDC micro-units, 6 decimals)
    pub up_pool: u64,           // USDC bet on UP
    pub down_pool: u64,         // USDC bet on DOWN
    pub total_fees: u64,        // USDC fees collected
    // URIM pools (in URIM micro-units, 6 decimals)
    pub up_pool_urim: u64,      // URIM bet on UP
    pub down_pool_urim: u64,    // URIM bet on DOWN
    pub total_fees_urim: u64,   // URIM fees collected
    // USD value pools (unified, in cents for parimutuel math)
    pub up_pool_usd: u64,       // Total USD value bet on UP
    pub down_pool_usd: u64,     // Total USD value bet on DOWN
    pub total_fees_usd: u64,    // Total USD value of fees
    pub resolved: bool,
    pub outcome: Outcome,
    pub bump: u8,
    pub vault_bump: u8,         // USDC vault
    pub urim_vault_bump: u8,    // URIM vault
}

impl Round {
    // 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 1 = 130
    pub const SIZE: usize = 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 1;
}

#[account]
pub struct UserBet {
    pub user: Pubkey,
    pub round_id: u64,
    pub amount: u64,            // Token amount (USDC or URIM in micro-units)
    pub usd_value: u64,         // USD value in cents at bet time
    pub bet_up: bool,
    pub claimed_usdc: bool,     // Has claimed from USDC vault
    pub claimed_urim: bool,     // Has claimed from URIM vault
    pub token_type: TokenType,  // USDC or URIM
    pub urim_price_at_bet: u64, // URIM price in cents when bet was placed (0 for USDC)
    pub bump: u8,
}

impl UserBet {
    // 32 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 8 + 1 = 69
    pub const SIZE: usize = 32 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 8 + 1;
}

// ============================================================================
// ENUMS
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum Outcome {
    #[default]
    Pending,
    Up,
    Down,
    Draw,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum TokenType {
    #[default]
    USDC,
    URIM,
}

// ============================================================================
// ERRORS
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Platform is paused")]
    PlatformPaused,
    #[msg("Round already resolved")]
    RoundResolved,
    #[msg("Round not yet ended")]
    RoundNotEnded,
    #[msg("Betting is closed")]
    BettingClosed,
    #[msg("Round not resolved yet")]
    RoundNotResolved,
    #[msg("Bet amount too small (min $1.00 USD value)")]
    BetTooSmall,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("No payout available")]
    NoPayout,
    #[msg("Cannot switch bet sides")]
    CannotSwitchSides,
    #[msg("Cannot mix token types - use same token for additional bets")]
    CannotMixTokens,
    #[msg("No fees to collect")]
    NoFeesToCollect,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Not your bet")]
    NotYourBet,
    #[msg("No funds to withdraw")]
    NoFundsToWithdraw,
    #[msg("Pyth price is stale or unavailable")]
    PythPriceStale,
    #[msg("Wrong claim instruction - use claim() for USDC or claim_urim() for URIM")]
    WrongClaimInstruction,
}
