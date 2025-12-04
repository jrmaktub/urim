use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

declare_id!("6MWu89uSo4RiFNaVRcuEd2PqzyQRoGdG91Unyd5Aj5kM");

// URIM token on Solana
pub const URIM_MINT: Pubkey = pubkey!("F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump");

// USDC on Solana mainnet
pub const USDC_MINT: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Pyth SOL/USD price feed ID (mainnet)
pub const SOL_USD_FEED_ID: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

// Fee: 0.5% charged on EVERY BET (not on winnings)
pub const FEE_BPS: u64 = 50; // 0.5%

// Market durations (in seconds)
pub const DURATION_TURBO: i64 = 900;    // 15 minutes
pub const DURATION_STANDARD: i64 = 3600; // 1 hour
pub const DURATION_PRECISION: i64 = 14400; // 4 hours

// Minimum bet to prevent spam (6 decimals for both USDC and assuming URIM)
pub const MIN_BET_AMOUNT: u64 = 1_000_000; // 1 token (adjust if needed)

// Price boundary percentages (in basis points: 100 = 1%)
pub const BOUNDARY_SAFE: u64 = 300;      // 3%
pub const BOUNDARY_BALANCED: u64 = 1000; // 10%
pub const BOUNDARY_MOONSHOT: u64 = 2000; // 20%

#[program]
pub mod urim_solana {
    use super::*;

    /// Initialize the global config (admin-only, one-time)
    pub fn initialize(ctx: Context<Initialize>, treasury_urim: Pubkey, treasury_usdc: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.treasury_urim = treasury_urim;
        config.treasury_usdc = treasury_usdc;
        config.paused = false;
        config.total_fees_collected_urim = 0;
        config.total_fees_collected_usdc = 0;
        config.current_round_id = 0;
        config.bump = ctx.bumps.config;

        msg!("Platform initialized by admin: {}", config.admin);
        Ok(())
    }

    /// Start a new round - ADMIN ONLY
    /// Creates markets for BOTH URIM and USDC
    pub fn start_round(
        ctx: Context<StartRound>,
        duration_type: DurationType,
        boundary_type: BoundaryType,
        vault_urim_bump: u8,
        vault_usdc_bump: u8,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(!config.paused, ErrorCode::PlatformPaused);

        // Get current SOL price from Pyth
        let price_update = &ctx.accounts.price_update;
        let feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID)?;
        let price_data = price_update.get_price_no_older_than(
            &Clock::get()?,
            60,
            &feed_id,
        )?;

        // Convert Pyth price to whole dollars
        let current_price = if price_data.exponent >= 0 {
            price_data.price as u64 * 10u64.pow(price_data.exponent as u32)
        } else {
            price_data.price as u64 / 10u64.pow((-price_data.exponent) as u32)
        };

        // Calculate target price based on boundary
        let boundary_bps = match boundary_type {
            BoundaryType::Safe => BOUNDARY_SAFE,
            BoundaryType::Balanced => BOUNDARY_BALANCED,
            BoundaryType::Moonshot => BOUNDARY_MOONSHOT,
        };

        let target_price = current_price + (current_price * boundary_bps / 10000);

        // Set duration
        let duration = match duration_type {
            DurationType::Turbo => DURATION_TURBO,
            DurationType::Standard => DURATION_STANDARD,
            DurationType::Precision => DURATION_PRECISION,
        };

        let clock = Clock::get()?;
        let round = &mut ctx.accounts.round;

        round.round_id = config.current_round_id;
        round.start_price = current_price;
        round.target_price = target_price;
        round.created_at = clock.unix_timestamp;
        round.end_time = clock.unix_timestamp + duration;
        round.yes_pool_urim = 0;
        round.no_pool_urim = 0;
        round.yes_pool_usdc = 0;
        round.no_pool_usdc = 0;
        round.resolved = false;
        round.outcome = false;
        round.final_price = 0;
        round.total_fees_urim = 0;
        round.total_fees_usdc = 0;
        round.duration_type = duration_type;
        round.boundary_type = boundary_type;
        round.bump = ctx.bumps.round;
        round.vault_urim_bump = vault_urim_bump;
        round.vault_usdc_bump = vault_usdc_bump;

        // Increment round counter
        config.current_round_id += 1;

        msg!(
            "Round {} started: Current ${} -> Target ${} in {}s ({}% boundary)",
            round.round_id,
            current_price,
            target_price,
            duration,
            boundary_bps / 100
        );

        Ok(())
    }

    /// Place or add to bet (supports BOTH URIM and USDC)
    /// Fee is charged IMMEDIATELY on bet placement (0.5% of bet amount)
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        amount: u64,
        bet_yes: bool,
        use_urim: bool, // true = URIM, false = USDC
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let round = &mut ctx.accounts.round;
        let clock = Clock::get()?;

        require!(!config.paused, ErrorCode::PlatformPaused);
        require!(!round.resolved, ErrorCode::RoundResolved);
        require!(clock.unix_timestamp < round.end_time, ErrorCode::RoundClosed);
        require!(amount >= MIN_BET_AMOUNT, ErrorCode::BetTooSmall);

        // Verify correct token mint
        let expected_mint = if use_urim { URIM_MINT } else { USDC_MINT };
        require!(
            ctx.accounts.vault.mint == expected_mint,
            ErrorCode::InvalidToken
        );
        require!(
            ctx.accounts.user_token_account.mint == expected_mint,
            ErrorCode::InvalidToken
        );

        // Calculate fee IMMEDIATELY (0.5% of bet amount)
        let fee = amount * FEE_BPS / 10000;
        let amount_after_fee = amount - fee;

        // Transfer FULL amount (including fee) to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            amount
        )?;

        // Update pools based on token type
        if use_urim {
            if bet_yes {
                round.yes_pool_urim += amount_after_fee;
            } else {
                round.no_pool_urim += amount_after_fee;
            }
            round.total_fees_urim += fee;
        } else {
            if bet_yes {
                round.yes_pool_usdc += amount_after_fee;
            } else {
                round.no_pool_usdc += amount_after_fee;
            }
            round.total_fees_usdc += fee;
        }

        // Record or update user bet
        let user_bet = &mut ctx.accounts.user_bet;

        if user_bet.amount == 0 {
            // First bet
            user_bet.user = ctx.accounts.user.key();
            user_bet.round = round.key();
            user_bet.round_id = round.round_id;
            user_bet.bet_yes = bet_yes;
            user_bet.use_urim = use_urim;
            user_bet.claimed = false;
            user_bet.bump = ctx.bumps.user_bet;
        } else {
            // Adding to existing bet - must be same side AND same token
            require!(user_bet.bet_yes == bet_yes, ErrorCode::CannotSwitchSides);
            require!(user_bet.use_urim == use_urim, ErrorCode::CannotSwitchTokens);
        }

        user_bet.amount += amount_after_fee;

        msg!(
            "Round {}: Bet {} {} (fee: {}) on {}",
            round.round_id,
            amount_after_fee,
            if use_urim { "URIM" } else { "USDC" },
            fee,
            if bet_yes { "YES" } else { "NO" }
        );

        Ok(())
    }

    /// Resolve round using Pyth oracle
    pub fn resolve_round(ctx: Context<ResolveRound>) -> Result<()> {
        let config = &ctx.accounts.config;
        let round = &mut ctx.accounts.round;
        let clock = Clock::get()?;

        require!(!config.paused, ErrorCode::PlatformPaused);
        require!(!round.resolved, ErrorCode::RoundResolved);
        require!(clock.unix_timestamp >= round.end_time, ErrorCode::RoundNotEnded);

        // Get final SOL price from Pyth
        let price_update = &ctx.accounts.price_update;
        let feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID)?;
        let price_data = price_update.get_price_no_older_than(
            &clock,
            60,
            &feed_id,
        )?;

        let final_price = if price_data.exponent >= 0 {
            price_data.price as u64 * 10u64.pow(price_data.exponent as u32)
        } else {
            price_data.price as u64 / 10u64.pow((-price_data.exponent) as u32)
        };

        round.resolved = true;
        round.outcome = final_price >= round.target_price;
        round.final_price = final_price;

        msg!(
            "Round {} resolved: ${} vs ${} = {}",
            round.round_id,
            final_price,
            round.target_price,
            if round.outcome { "YES" } else { "NO" }
        );

        Ok(())
    }

    /// Claim winnings (NO FEE - fee was already charged on bet placement)
    /// Pays out in same token user bet with (URIM or USDC)
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let config = &ctx.accounts.config;
        let round = &ctx.accounts.round;
        let user_bet = &mut ctx.accounts.user_bet;

        require!(!config.paused, ErrorCode::PlatformPaused);
        require!(round.resolved, ErrorCode::RoundNotResolved);
        require!(!user_bet.claimed, ErrorCode::AlreadyClaimed);
        require!(user_bet.bet_yes == round.outcome, ErrorCode::NotWinner);

        // Get pools for user's token type
        let (winning_pool, losing_pool) = if user_bet.use_urim {
            let wp = if round.outcome { round.yes_pool_urim } else { round.no_pool_urim };
            let lp = if round.outcome { round.no_pool_urim } else { round.yes_pool_urim };
            (wp, lp)
        } else {
            let wp = if round.outcome { round.yes_pool_usdc } else { round.no_pool_usdc };
            let lp = if round.outcome { round.no_pool_usdc } else { round.yes_pool_usdc };
            (wp, lp)
        };

        // Calculate payout (NO FEE - already charged on bet)
        let payout = if winning_pool == 0 {
            // Edge case: only you won with this token
            user_bet.amount
        } else {
            // Proportional share: your_bet + (your_bet / winning_pool) * losing_pool
            let winnings_share = (user_bet.amount as u128)
                .checked_mul(losing_pool as u128)
                .unwrap()
                .checked_div(winning_pool as u128)
                .unwrap() as u64;

            user_bet.amount + winnings_share
        };

        // Verify correct vault token type
        let expected_mint = if user_bet.use_urim { URIM_MINT } else { USDC_MINT };
        require!(
            ctx.accounts.vault.mint == expected_mint,
            ErrorCode::InvalidToken
        );

        // Transfer winnings to user
        let round_id_bytes = round.round_id.to_le_bytes();
        let (token_seed, vault_bump) = if user_bet.use_urim {
            (b"vault_urim" as &[u8], round.vault_urim_bump)
        } else {
            (b"vault_usdc" as &[u8], round.vault_usdc_bump)
        };

        let seeds = &[
            token_seed,
            round_id_bytes.as_ref(),
            &[vault_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer
            ),
            payout
        )?;

        user_bet.claimed = true;

        msg!(
            "Round {}: Claimed {} {}",
            round.round_id,
            payout,
            if user_bet.use_urim { "URIM" } else { "USDC" }
        );

        Ok(())
    }

    /// Collect accumulated fees to treasury (admin-only)
    /// Call separately for URIM and USDC vaults
    pub fn collect_fees(
        ctx: Context<CollectFees>,
        collect_urim: bool,
    ) -> Result<()> {
        let round = &ctx.accounts.round;

        require!(round.resolved, ErrorCode::RoundNotResolved);

        let fee_amount = if collect_urim {
            require!(round.total_fees_urim > 0, ErrorCode::NoFeesToCollect);
            round.total_fees_urim
        } else {
            require!(round.total_fees_usdc > 0, ErrorCode::NoFeesToCollect);
            round.total_fees_usdc
        };

        // Verify correct vault and treasury token types
        let expected_mint = if collect_urim { URIM_MINT } else { USDC_MINT };
        require!(ctx.accounts.vault.mint == expected_mint, ErrorCode::InvalidToken);
        require!(ctx.accounts.treasury.mint == expected_mint, ErrorCode::InvalidToken);

        // Transfer fees to treasury
        let round_id_bytes = round.round_id.to_le_bytes();
        let (token_seed, vault_bump) = if collect_urim {
            (b"vault_urim" as &[u8], round.vault_urim_bump)
        } else {
            (b"vault_usdc" as &[u8], round.vault_usdc_bump)
        };

        let seeds = &[
            token_seed,
            round_id_bytes.as_ref(),
            &[vault_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer
            ),
            fee_amount
        )?;

        msg!(
            "Collected {} {} fees from round {}",
            fee_amount,
            if collect_urim { "URIM" } else { "USDC" },
            round.round_id
        );

        Ok(())
    }

    /// Emergency pause (admin-only)
    pub fn pause(ctx: Context<AdminControl>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.paused = true;
        msg!("Platform PAUSED by admin");
        Ok(())
    }

    /// Unpause (admin-only)
    pub fn unpause(ctx: Context<AdminControl>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.paused = false;
        msg!("Platform UNPAUSED by admin");
        Ok(())
    }

    /// Emergency withdraw (admin-only) - ONLY for unresolved rounds after timeout
    pub fn emergency_withdraw(
        ctx: Context<EmergencyWithdraw>,
        amount: u64,
        withdraw_urim: bool,
    ) -> Result<()> {
        let round = &ctx.accounts.round;
        let clock = Clock::get()?;

        require!(!round.resolved, ErrorCode::RoundAlreadyResolved);
        require!(
            clock.unix_timestamp > round.end_time + 86400,
            ErrorCode::TooEarlyForEmergency
        );

        let expected_mint = if withdraw_urim { URIM_MINT } else { USDC_MINT };
        require!(ctx.accounts.vault.mint == expected_mint, ErrorCode::InvalidToken);

        let round_id_bytes = round.round_id.to_le_bytes();
        let (token_seed, vault_bump) = if withdraw_urim {
            (b"vault_urim" as &[u8], round.vault_urim_bump)
        } else {
            (b"vault_usdc" as &[u8], round.vault_usdc_bump)
        };

        let seeds = &[
            token_seed,
            round_id_bytes.as_ref(),
            &[vault_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer
            ),
            amount
        )?;

        msg!(
            "EMERGENCY: Withdrawn {} {} from round {}",
            amount,
            if withdraw_urim { "URIM" } else { "USDC" },
            round.round_id
        );

        Ok(())
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

    pub price_update: Account<'info, PriceUpdateV2>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub round: Account<'info, Round>,

    #[account(
        init,
        payer = user,
        space = 8 + UserBet::SIZE,
        seeds = [b"bet", round.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_bet: Account<'info, UserBet>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveRound<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub round: Account<'info, Round>,

    pub price_update: Account<'info, PriceUpdateV2>,

    pub resolver: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub round: Account<'info, Round>,

    #[account(mut)]
    pub user_bet: Account<'info, UserBet>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for vault
    pub vault_authority: AccountInfo<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub round: Account<'info, Round>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: PDA authority
    pub vault_authority: AccountInfo<'info>,

    #[account(mut)]
    pub treasury: Account<'info, TokenAccount>,

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

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin
    )]
    pub config: Account<'info, Config>,

    pub round: Account<'info, Round>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: PDA authority
    pub vault_authority: AccountInfo<'info>,

    #[account(mut)]
    pub treasury: Account<'info, TokenAccount>,

    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// ============================================================================
// STATE
// ============================================================================

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub treasury_urim: Pubkey,
    pub treasury_usdc: Pubkey,
    pub paused: bool,
    pub total_fees_collected_urim: u64,
    pub total_fees_collected_usdc: u64,
    pub current_round_id: u64,
    pub bump: u8,
}

impl Config {
    pub const SIZE: usize = 32 + 32 + 32 + 1 + 8 + 8 + 8 + 1;
}

#[account]
pub struct Round {
    pub round_id: u64,
    pub start_price: u64,
    pub target_price: u64,
    pub created_at: i64,
    pub end_time: i64,
    pub yes_pool_urim: u64,
    pub no_pool_urim: u64,
    pub yes_pool_usdc: u64,
    pub no_pool_usdc: u64,
    pub resolved: bool,
    pub outcome: bool,
    pub final_price: u64,
    pub total_fees_urim: u64,
    pub total_fees_usdc: u64,
    pub duration_type: DurationType,
    pub boundary_type: BoundaryType,
    pub bump: u8,
    pub vault_urim_bump: u8,
    pub vault_usdc_bump: u8,
}

impl Round {
    pub const SIZE: usize = 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 1;
}

#[account]
pub struct UserBet {
    pub user: Pubkey,
    pub round: Pubkey,
    pub round_id: u64,
    pub amount: u64,
    pub bet_yes: bool,
    pub use_urim: bool, // true = URIM, false = USDC
    pub claimed: bool,
    pub bump: u8,
}

impl UserBet {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 1 + 1 + 1 + 1;
}

// ============================================================================
// ENUMS
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum DurationType {
    Turbo,
    Standard,
    Precision,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BoundaryType {
    Safe,
    Balanced,
    Moonshot,
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
    #[msg("Round closed for betting")]
    RoundClosed,
    #[msg("Round not resolved yet")]
    RoundNotResolved,
    #[msg("Bet amount too small")]
    BetTooSmall,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Not a winner")]
    NotWinner,
    #[msg("Cannot switch bet sides")]
    CannotSwitchSides,
    #[msg("Cannot switch token types")]
    CannotSwitchTokens,
    #[msg("Invalid token")]
    InvalidToken,
    #[msg("No fees to collect")]
    NoFeesToCollect,
    #[msg("Too early for emergency withdrawal")]
    TooEarlyForEmergency,
    #[msg("Round already resolved")]
    RoundAlreadyResolved,
}
