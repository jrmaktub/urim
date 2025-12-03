use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

declare_id!("FdbThb8m8S3wcqowZwXxQGcunGM8pr5ib3i5mt3jKZbB");

// URIM token on Solana
pub const URIM_MINT: &str = "F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump";
// USDC on Solana mainnet
pub const USDC_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// Pyth SOL/USD price feed ID (hex format)
pub const SOL_USD_FEED_ID: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

pub const FEE_BPS: u64 = 50; // 0.5%
pub const MARKET_DURATION: i64 = 10800; // 3 hours in seconds

#[program]
pub mod urim_solana {
    use super::*;

    pub fn create_market(
        ctx: Context<CreateMarket>,
        market_id: u64,
        target_price: u64,
        vault_bump: u8,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;

        market.market_id = market_id;
        market.creator = ctx.accounts.creator.key();
        market.target_price = target_price;
        market.created_at = clock.unix_timestamp;
        market.end_time = clock.unix_timestamp + MARKET_DURATION;
        market.yes_pool = 0;
        market.no_pool = 0;
        market.resolved = false;
        market.outcome = false;
        market.final_price = 0;
        market.bump = ctx.bumps.market;
        market.vault_bump = vault_bump;

        msg!("Market {} created: SOL > {} by {}", market_id, target_price, market.end_time);
        Ok(())
    }

    pub fn place_bet(
        ctx: Context<PlaceBet>,
        amount: u64,
        bet_yes: bool,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;

        require!(!market.resolved, ErrorCode::MarketResolved);
        require!(clock.unix_timestamp < market.end_time, ErrorCode::MarketClosed);
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Transfer tokens to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

        // Update pools
        if bet_yes {
            market.yes_pool += amount;
        } else {
            market.no_pool += amount;
        }

        // Record or update user bet
        let user_bet = &mut ctx.accounts.user_bet;

        // If first bet, initialize
        if user_bet.amount == 0 {
            user_bet.user = ctx.accounts.user.key();
            user_bet.market = market.key();
            user_bet.bet_yes = bet_yes;
            user_bet.claimed = false;
            user_bet.bump = ctx.bumps.user_bet;
        } else {
            // User adding to existing bet - must be same side
            require!(user_bet.bet_yes == bet_yes, ErrorCode::CannotSwitchSides);
        }

        user_bet.amount += amount;

        msg!("Bet placed: {} on {} (total: {})", amount, if bet_yes { "YES" } else { "NO" }, user_bet.amount);
        Ok(())
    }

    pub fn resolve_market(ctx: Context<ResolveMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;

        require!(!market.resolved, ErrorCode::MarketResolved);
        require!(clock.unix_timestamp >= market.end_time, ErrorCode::MarketNotEnded);

        // Get SOL/USD price from Pyth
        let price_update = &ctx.accounts.price_update;
        let feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID)?;
        let price = price_update.get_price_no_older_than(
            &Clock::get()?,
            60, // Max age 60 seconds
            &feed_id,
        )?;

        // Pyth returns price with exponent, convert to whole dollars
        // e.g., price.price = 150_000_000, exponent = -8 means $150.00
        let final_price = if price.exponent >= 0 {
            price.price as u64 * 10u64.pow(price.exponent as u32)
        } else {
            price.price as u64 / 10u64.pow((-price.exponent) as u32)
        };

        market.resolved = true;
        market.outcome = final_price >= market.target_price;
        market.final_price = final_price;

        msg!("Market resolved: price {} vs target {}, outcome: {}",
            final_price, market.target_price, market.outcome);
        Ok(())
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let market = &ctx.accounts.market;
        let user_bet = &mut ctx.accounts.user_bet;

        require!(market.resolved, ErrorCode::MarketNotResolved);
        require!(!user_bet.claimed, ErrorCode::AlreadyClaimed);
        require!(user_bet.bet_yes == market.outcome, ErrorCode::NotWinner);

        let winning_pool = if market.outcome { market.yes_pool } else { market.no_pool };
        let losing_pool = if market.outcome { market.no_pool } else { market.yes_pool };

        // Handle edge case: if nobody bet on winning side, return stake only
        let payout = if winning_pool == 0 {
            user_bet.amount
        } else {
            // Calculate winnings: stake + proportional share of losing pool
            let winnings_share = (user_bet.amount as u128)
                .checked_mul(losing_pool as u128)
                .unwrap()
                .checked_div(winning_pool as u128)
                .unwrap() as u64;

            let gross = user_bet.amount + winnings_share;
            let fee = gross * FEE_BPS / 10000;
            gross - fee
        };

        // Transfer winnings using vault PDA as authority
        let market_id_bytes = market.market_id.to_le_bytes();
        let seeds = &[
            b"vault",
            market_id_bytes.as_ref(),
            &[market.vault_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new_with_signer(cpi_program, cpi_accounts, signer), payout)?;

        user_bet.claimed = true;

        msg!("Claimed {}", payout);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Market::SIZE,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserBet::SIZE,
        seeds = [b"bet", market.key().as_ref(), user.key().as_ref()],
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
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    pub resolver: Signer<'info>,

    /// Pyth price update account
    pub price_update: Account<'info, PriceUpdateV2>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub user_bet: Account<'info, UserBet>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for the vault
    #[account(
        seeds = [b"vault", market.market_id.to_le_bytes().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault_authority: AccountInfo<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Market {
    pub market_id: u64,
    pub creator: Pubkey,
    pub target_price: u64,
    pub created_at: i64,
    pub end_time: i64,
    pub yes_pool: u64,
    pub no_pool: u64,
    pub resolved: bool,
    pub outcome: bool,
    pub final_price: u64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Market {
    pub const SIZE: usize = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 8 + 1 + 1;
}

#[account]
pub struct UserBet {
    pub user: Pubkey,
    pub market: Pubkey,
    pub amount: u64,
    pub bet_yes: bool,
    pub claimed: bool,
    pub bump: u8,
}

impl UserBet {
    pub const SIZE: usize = 32 + 32 + 8 + 1 + 1 + 1;
}

#[error_code]
pub enum ErrorCode {
    #[msg("Market already resolved")]
    MarketResolved,
    #[msg("Market not yet ended")]
    MarketNotEnded,
    #[msg("Market closed for betting")]
    MarketClosed,
    #[msg("Market not resolved yet")]
    MarketNotResolved,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Not a winner")]
    NotWinner,
    #[msg("Cannot switch bet sides")]
    CannotSwitchSides,
}
