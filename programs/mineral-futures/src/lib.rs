use anchor_lang::prelude::*;

declare_id!("9zakGc9vksLmWz62R84BG9KNHP4xjNAPJ6L91eFhRxUq");

// ─── Constants ──────────────────────────────────────────────────────────────

pub const TAKER_FEE_BPS: u64 = 5; // 0.05% on open AND close
pub const URIM_DISCOUNT_NUMERATOR: u64 = 9;
pub const URIM_DISCOUNT_DENOMINATOR: u64 = 10; // 10% off → 0.045%
pub const BPS_DENOMINATOR: u64 = 10_000;
pub const MAX_LEVERAGE: u8 = 10;
pub const LIQUIDATOR_REWARD_BPS: u64 = 200; // 2%

// Position size limit: max 20% of vault per position
pub const MAX_POSITION_VAULT_BPS: u64 = 2000;

// Funding rate interval: 8 hours in seconds
pub const FUNDING_INTERVAL: i64 = 28800;
// Max funding rate per interval: 0.1% (10 bps) — prevents runaway rates
pub const MAX_FUNDING_RATE_BPS: i64 = 10;

// URIM token mint: F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump
pub const URIM_MINT: [u8; 32] = [
    209, 239, 121, 124, 80, 5, 197, 151, 121, 230, 98, 211, 161, 101, 188,
    188, 62, 226, 36, 219, 57, 208, 13, 114, 44, 230, 161, 179, 215, 101,
    30, 63,
];

// SPL Token program ID
pub const SPL_TOKEN_PROGRAM: [u8; 32] = [
    6, 221, 246, 225, 215, 101, 161, 86, 46, 83, 67, 242, 209, 36, 175, 67,
    41, 26, 31, 111, 6, 37, 47, 8, 52, 211, 193, 89, 205, 136, 175, 153,
];

// Minimum URIM balance for discount: 1 token (6 decimals)
pub const MIN_URIM_BALANCE: u64 = 1_000_000;

#[program]
pub mod mineral_futures {
    use super::*;

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        commodity: String,
        initial_price: u64,
    ) -> Result<()> {
        require!(commodity.len() <= 16, FuturesError::CommodityNameTooLong);
        require!(initial_price > 0, FuturesError::InvalidPrice);

        let market = &mut ctx.accounts.market;
        let mut commodity_bytes = [0u8; 16];
        let bytes = commodity.as_bytes();
        commodity_bytes[..bytes.len()].copy_from_slice(bytes);

        market.commodity = commodity_bytes;
        market.mark_price = initial_price;
        market.last_price_update = Clock::get()?.unix_timestamp;
        market.open_interest_long = 0;
        market.open_interest_short = 0;
        market.total_fees_collected = 0;
        market.authority = ctx.accounts.authority.key();
        market.bump = ctx.bumps.market;
        market.vault_bump = ctx.bumps.vault;
        market.funding_rate_cumulative = 0;
        market.last_funding_time = Clock::get()?.unix_timestamp;
        market.is_paused = false;

        emit!(MarketInitialized {
            commodity: commodity.clone(),
            initial_price,
            authority: ctx.accounts.authority.key(),
        });
        Ok(())
    }

    pub fn update_price(ctx: Context<UpdatePrice>, new_price: u64) -> Result<()> {
        require!(new_price > 0, FuturesError::InvalidPrice);

        let market = &mut ctx.accounts.market;
        let old_price = market.mark_price;
        market.mark_price = new_price;
        market.last_price_update = Clock::get()?.unix_timestamp;

        emit!(PriceUpdated {
            commodity: market.commodity,
            old_price,
            new_price,
            timestamp: market.last_price_update,
        });
        Ok(())
    }

    /// Open a leveraged long/short position. Fee on open (0.05%, or 0.045% w/ URIM).
    pub fn open_position(
        ctx: Context<OpenPosition>,
        direction: u8,
        nonce: i64,
        collateral_lamports: u64,
        leverage: u8,
        use_urim_discount: bool,
    ) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(!market.is_paused, FuturesError::MarketPaused);
        require!(direction == 0 || direction == 1, FuturesError::InvalidDirection);
        require!(collateral_lamports > 0, FuturesError::ZeroCollateral);
        require!(leverage >= 1 && leverage <= MAX_LEVERAGE, FuturesError::InvalidLeverage);

        // Position size limit: notional can't exceed 20% of vault (only enforced when OI exists)
        let total_oi = market.open_interest_long.saturating_add(market.open_interest_short);
        if total_oi > 0 {
            let vault_balance = ctx.accounts.vault.to_account_info().lamports();
            let notional = collateral_lamports.saturating_mul(leverage as u64);
            let max_notional = vault_balance
                .checked_mul(MAX_POSITION_VAULT_BPS)
                .unwrap_or(0)
                .checked_div(BPS_DENOMINATOR)
                .unwrap_or(0);
            require!(notional <= max_notional, FuturesError::PositionTooLarge);
        }

        // On-chain URIM token verification
        let verified_urim = if use_urim_discount {
            verify_urim_balance(&ctx.remaining_accounts, &ctx.accounts.trader.key())?
        } else {
            false
        };

        // Transfer collateral → vault
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.trader.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx, collateral_lamports)?;

        // Fee: 0.05% standard, 0.045% with verified URIM
        let base_fee = collateral_lamports
            .checked_mul(TAKER_FEE_BPS)
            .unwrap_or(0)
            .checked_div(BPS_DENOMINATOR)
            .unwrap_or(0);

        let fee = if verified_urim {
            base_fee
                .checked_mul(URIM_DISCOUNT_NUMERATOR)
                .unwrap_or(base_fee)
                .checked_div(URIM_DISCOUNT_DENOMINATOR)
                .unwrap_or(base_fee)
        } else {
            base_fee
        };

        let net_collateral = collateral_lamports.saturating_sub(fee);

        // Fee → authority treasury
        if fee > 0 {
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= fee;
            **ctx
                .accounts
                .authority
                .to_account_info()
                .try_borrow_mut_lamports()? += fee;
        }

        let position = &mut ctx.accounts.position;
        position.owner = ctx.accounts.trader.key();
        position.market = ctx.accounts.market.key();
        position.direction = direction;
        position.collateral = net_collateral;
        position.entry_price = market.mark_price;
        position.opened_at = nonce;
        position.fee_paid = fee;
        position.leverage = leverage;
        position.is_open = true;
        position.bump = ctx.bumps.position;
        position.entry_funding_rate = market.funding_rate_cumulative;

        let market_key = ctx.accounts.market.key();
        let market = &mut ctx.accounts.market;
        if direction == 0 {
            market.open_interest_long = market.open_interest_long.saturating_add(net_collateral);
        } else {
            market.open_interest_short = market.open_interest_short.saturating_add(net_collateral);
        }
        market.total_fees_collected = market.total_fees_collected.saturating_add(fee);

        emit!(PositionOpened {
            trader: ctx.accounts.trader.key(),
            market: market_key,
            direction,
            collateral: net_collateral,
            entry_price: position.entry_price,
            fee_paid: fee,
            leverage,
            urim_discount: verified_urim,
        });
        Ok(())
    }

    /// Close position. Fee on close (0.05%). Funding rate settlement included.
    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        let position = &ctx.accounts.position;
        let market = &ctx.accounts.market;

        require!(position.is_open, FuturesError::PositionAlreadyClosed);
        require!(
            position.owner == ctx.accounts.trader.key(),
            FuturesError::Unauthorized
        );

        let current_price = market.mark_price;
        let entry_price = position.entry_price;
        let collateral = position.collateral;
        let leverage = position.leverage as u64;

        // PnL with leverage
        let pnl: i64 = if position.direction == 0 {
            let price_change = (current_price as i64).saturating_sub(entry_price as i64);
            price_change
                .saturating_mul(collateral as i64)
                .checked_div(entry_price as i64)
                .unwrap_or(0)
                .saturating_mul(leverage as i64)
        } else {
            let price_change = (entry_price as i64).saturating_sub(current_price as i64);
            price_change
                .saturating_mul(collateral as i64)
                .checked_div(entry_price as i64)
                .unwrap_or(0)
                .saturating_mul(leverage as i64)
        };

        // Funding rate settlement: difference between current cumulative and entry
        let funding_delta =
            market.funding_rate_cumulative - position.entry_funding_rate;
        // Longs pay positive funding, shorts receive it (and vice versa)
        let funding_payment: i64 = if position.direction == 0 {
            // Long pays funding_delta * collateral / BPS_DENOMINATOR
            -(funding_delta
                .saturating_mul(collateral as i64)
                .checked_div(BPS_DENOMINATOR as i64)
                .unwrap_or(0))
        } else {
            // Short receives funding_delta
            funding_delta
                .saturating_mul(collateral as i64)
                .checked_div(BPS_DENOMINATOR as i64)
                .unwrap_or(0)
        };

        let total_pnl = pnl.saturating_add(funding_payment);

        // Payout before close fee
        let raw_payout: u64 = if total_pnl >= 0 {
            collateral.saturating_add(total_pnl as u64)
        } else {
            collateral.saturating_sub(total_pnl.unsigned_abs().min(collateral))
        };

        // Close fee: 0.05% of payout
        let close_fee = raw_payout
            .checked_mul(TAKER_FEE_BPS)
            .unwrap_or(0)
            .checked_div(BPS_DENOMINATOR)
            .unwrap_or(0);

        let payout = raw_payout.saturating_sub(close_fee);

        // Pay from vault, protect rent-exempt minimum
        let vault_balance = ctx.accounts.vault.to_account_info().lamports();
        let rent_min = Rent::get()?.minimum_balance(8);
        let available = vault_balance.saturating_sub(rent_min);
        let actual_payout = payout.min(available);

        if actual_payout > 0 {
            **ctx
                .accounts
                .vault
                .to_account_info()
                .try_borrow_mut_lamports()? -= actual_payout;
            **ctx
                .accounts
                .trader
                .to_account_info()
                .try_borrow_mut_lamports()? += actual_payout;
        }

        // Close fee stays in vault (part of protocol revenue, withdrawable by authority)

        // Update OI
        let market = &mut ctx.accounts.market;
        if position.direction == 0 {
            market.open_interest_long = market.open_interest_long.saturating_sub(collateral);
        } else {
            market.open_interest_short = market.open_interest_short.saturating_sub(collateral);
        }
        market.total_fees_collected = market.total_fees_collected.saturating_add(close_fee);

        let position = &mut ctx.accounts.position;
        position.is_open = false;

        emit!(PositionClosed {
            trader: ctx.accounts.trader.key(),
            market: ctx.accounts.market.key(),
            direction: position.direction,
            collateral,
            entry_price,
            exit_price: current_price,
            pnl: total_pnl,
            payout: actual_payout,
            leverage: position.leverage,
            close_fee,
        });
        Ok(())
    }

    /// Liquidate underwater position. Permissionless. 2% reward to liquidator.
    pub fn liquidate(ctx: Context<Liquidate>) -> Result<()> {
        let position = &ctx.accounts.position;
        let market = &ctx.accounts.market;

        require!(position.is_open, FuturesError::PositionAlreadyClosed);

        let current_price = market.mark_price;
        let entry_price = position.entry_price;
        let collateral = position.collateral;
        let leverage = position.leverage as u64;

        let threshold_bps = 9000u64.checked_div(leverage).unwrap_or(9000);

        let price_move_bps: u64 = if position.direction == 0 {
            if current_price >= entry_price {
                return err!(FuturesError::NotLiquidatable);
            }
            entry_price
                .saturating_sub(current_price)
                .checked_mul(BPS_DENOMINATOR)
                .unwrap_or(u64::MAX)
                .checked_div(entry_price)
                .unwrap_or(u64::MAX)
        } else {
            if current_price <= entry_price {
                return err!(FuturesError::NotLiquidatable);
            }
            current_price
                .saturating_sub(entry_price)
                .checked_mul(BPS_DENOMINATOR)
                .unwrap_or(u64::MAX)
                .checked_div(entry_price)
                .unwrap_or(u64::MAX)
        };

        require!(price_move_bps >= threshold_bps, FuturesError::NotLiquidatable);

        let liquidator_reward = collateral
            .checked_mul(LIQUIDATOR_REWARD_BPS)
            .unwrap_or(0)
            .checked_div(BPS_DENOMINATOR)
            .unwrap_or(0);

        let vault_balance = ctx.accounts.vault.to_account_info().lamports();
        let rent_min = Rent::get()?.minimum_balance(8);
        let available = vault_balance.saturating_sub(rent_min);
        let actual_reward = liquidator_reward.min(available);

        if actual_reward > 0 {
            **ctx
                .accounts
                .vault
                .to_account_info()
                .try_borrow_mut_lamports()? -= actual_reward;
            **ctx
                .accounts
                .liquidator
                .to_account_info()
                .try_borrow_mut_lamports()? += actual_reward;
        }

        let market = &mut ctx.accounts.market;
        if position.direction == 0 {
            market.open_interest_long = market.open_interest_long.saturating_sub(collateral);
        } else {
            market.open_interest_short = market.open_interest_short.saturating_sub(collateral);
        }

        let position = &mut ctx.accounts.position;
        position.is_open = false;

        emit!(PositionLiquidated {
            trader: position.owner,
            market: ctx.accounts.market.key(),
            liquidator: ctx.accounts.liquidator.key(),
            collateral,
            price_move_bps,
            leverage: position.leverage,
            liquidator_reward: actual_reward,
        });
        Ok(())
    }

    /// Apply funding rate. Permissionless — anyone can crank every 8 hours.
    /// Rate based on OI imbalance: longs pay shorts if more longs, vice versa.
    pub fn apply_funding(ctx: Context<ApplyFunding>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let now = Clock::get()?.unix_timestamp;

        require!(
            now - market.last_funding_time >= FUNDING_INTERVAL,
            FuturesError::FundingTooEarly
        );

        let oi_long = market.open_interest_long as i64;
        let oi_short = market.open_interest_short as i64;
        let total_oi = oi_long + oi_short;

        let rate: i64 = if total_oi > 0 {
            let imbalance = oi_long.saturating_sub(oi_short);
            imbalance
                .saturating_mul(MAX_FUNDING_RATE_BPS)
                .checked_div(total_oi)
                .unwrap_or(0)
        } else {
            0
        };

        market.funding_rate_cumulative = market.funding_rate_cumulative.saturating_add(rate);
        market.last_funding_time = now;

        let market_key = market.key();
        let cumulative = market.funding_rate_cumulative;

        emit!(FundingApplied {
            market: market_key,
            rate,
            cumulative,
            timestamp: now,
        });
        Ok(())
    }

    /// Pause market — authority only. Blocks new positions.
    pub fn pause_market(ctx: Context<PauseMarket>) -> Result<()> {
        ctx.accounts.market.is_paused = true;
        msg!("Market paused");
        Ok(())
    }

    /// Unpause market — authority only.
    pub fn unpause_market(ctx: Context<PauseMarket>) -> Result<()> {
        ctx.accounts.market.is_paused = false;
        msg!("Market unpaused");
        Ok(())
    }

    /// Withdraw accumulated fees/profits from vault. Authority only.
    /// Cannot withdraw below total open interest + rent-exempt minimum.
    pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
        let market = &ctx.accounts.market;
        let vault_balance = ctx.accounts.vault.to_account_info().lamports();
        let rent_min = Rent::get()?.minimum_balance(8);

        // Safety: vault must retain enough to cover all open positions + rent
        let total_oi = market
            .open_interest_long
            .saturating_add(market.open_interest_short);
        let min_vault = total_oi.saturating_add(rent_min);
        let withdrawable = vault_balance.saturating_sub(min_vault);

        require!(amount > 0 && amount <= withdrawable, FuturesError::NothingToWithdraw);

        **ctx
            .accounts
            .vault
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;
        **ctx
            .accounts
            .authority
            .to_account_info()
            .try_borrow_mut_lamports()? += amount;

        emit!(FeesWithdrawn {
            market: ctx.accounts.market.key(),
            authority: ctx.accounts.authority.key(),
            amount,
            vault_remaining: vault_balance - amount,
        });
        Ok(())
    }
}

// ─── URIM verification helper ───────────────────────────────────────────────

/// Verify trader holds >= 1 URIM token by deserializing their SPL token account.
/// The token account must be passed in remaining_accounts[0].
fn verify_urim_balance(remaining_accounts: &[AccountInfo], trader: &Pubkey) -> Result<bool> {
    if remaining_accounts.is_empty() {
        return Ok(false);
    }

    let token_account = &remaining_accounts[0];

    // Must be owned by SPL Token program
    if token_account.owner.to_bytes() != SPL_TOKEN_PROGRAM {
        return Ok(false);
    }

    let data = token_account.try_borrow_data()?;
    // SPL Token account layout: 165 bytes
    // [0..32] = mint, [32..64] = owner, [64..72] = amount (little-endian u64)
    if data.len() < 72 {
        return Ok(false);
    }

    // Check mint matches URIM
    if data[0..32] != URIM_MINT {
        return Ok(false);
    }

    // Check owner matches trader
    if data[32..64] != trader.to_bytes() {
        return Ok(false);
    }

    // Check balance >= 1 URIM
    let amount = u64::from_le_bytes(data[64..72].try_into().unwrap());
    Ok(amount >= MIN_URIM_BALANCE)
}

// ─── Account Structs ────────────────────────────────────────────────────────

#[account]
pub struct Market {
    pub commodity: [u8; 16],
    pub mark_price: u64,
    pub last_price_update: i64,
    pub open_interest_long: u64,
    pub open_interest_short: u64,
    pub total_fees_collected: u64,
    pub authority: Pubkey,
    pub bump: u8,
    pub vault_bump: u8,
    pub funding_rate_cumulative: i64,
    pub last_funding_time: i64,
    pub is_paused: bool,
}

impl Market {
    // 8 + 16 + 8 + 8 + 8 + 8 + 8 + 32 + 1 + 1 + 8 + 8 + 1 = 115
    pub const SIZE: usize = 8 + 16 + 8 + 8 + 8 + 8 + 8 + 32 + 1 + 1 + 8 + 8 + 1;
}

#[account]
pub struct Position {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub direction: u8,
    pub collateral: u64,
    pub entry_price: u64,
    pub opened_at: i64,
    pub fee_paid: u64,
    pub leverage: u8,
    pub is_open: bool,
    pub bump: u8,
    pub entry_funding_rate: i64,
}

impl Position {
    // 8 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 8 = 116
    pub const SIZE: usize = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 8;
}

#[account]
pub struct VaultAccount {}

// ─── Account Contexts ───────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(commodity: String)]
pub struct InitializeMarket<'info> {
    #[account(
        init,
        payer = authority,
        space = Market::SIZE,
        seeds = [b"market", commodity.as_bytes()],
        bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = authority,
        space = 8,
        seeds = [b"vault", market.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(
        mut,
        has_one = authority @ FuturesError::Unauthorized,
    )]
    pub market: Account<'info, Market>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(direction: u8, nonce: i64, collateral_lamports: u64, leverage: u8)]
pub struct OpenPosition<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = trader,
        space = Position::SIZE,
        seeds = [
            b"position",
            trader.key().as_ref(),
            market.key().as_ref(),
            &nonce.to_le_bytes(),
        ],
        bump,
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: Account<'info, VaultAccount>,

    /// CHECK: Market authority / fee collector
    #[account(
        mut,
        constraint = authority.key() == market.authority @ FuturesError::Unauthorized
    )]
    pub authority: AccountInfo<'info>,

    #[account(mut)]
    pub trader: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [
            b"position",
            trader.key().as_ref(),
            market.key().as_ref(),
            &position.opened_at.to_le_bytes(),
        ],
        bump = position.bump,
        has_one = market @ FuturesError::InvalidMarket,
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    pub trader: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [
            b"position",
            position.owner.as_ref(),
            market.key().as_ref(),
            &position.opened_at.to_le_bytes(),
        ],
        bump = position.bump,
        has_one = market @ FuturesError::InvalidMarket,
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    pub liquidator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApplyFunding<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct PauseMarket<'info> {
    #[account(
        mut,
        has_one = authority @ FuturesError::Unauthorized,
    )]
    pub market: Account<'info, Market>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(
        has_one = authority @ FuturesError::Unauthorized,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ─── Events ─────────────────────────────────────────────────────────────────

#[event]
pub struct MarketInitialized {
    pub commodity: String,
    pub initial_price: u64,
    pub authority: Pubkey,
}

#[event]
pub struct PriceUpdated {
    pub commodity: [u8; 16],
    pub old_price: u64,
    pub new_price: u64,
    pub timestamp: i64,
}

#[event]
pub struct PositionOpened {
    pub trader: Pubkey,
    pub market: Pubkey,
    pub direction: u8,
    pub collateral: u64,
    pub entry_price: u64,
    pub fee_paid: u64,
    pub leverage: u8,
    pub urim_discount: bool,
}

#[event]
pub struct PositionClosed {
    pub trader: Pubkey,
    pub market: Pubkey,
    pub direction: u8,
    pub collateral: u64,
    pub entry_price: u64,
    pub exit_price: u64,
    pub pnl: i64,
    pub payout: u64,
    pub leverage: u8,
    pub close_fee: u64,
}

#[event]
pub struct PositionLiquidated {
    pub trader: Pubkey,
    pub market: Pubkey,
    pub liquidator: Pubkey,
    pub collateral: u64,
    pub price_move_bps: u64,
    pub leverage: u8,
    pub liquidator_reward: u64,
}

#[event]
pub struct FundingApplied {
    pub market: Pubkey,
    pub rate: i64,
    pub cumulative: i64,
    pub timestamp: i64,
}

#[event]
pub struct FeesWithdrawn {
    pub market: Pubkey,
    pub authority: Pubkey,
    pub amount: u64,
    pub vault_remaining: u64,
}

// ─── Errors ─────────────────────────────────────────────────────────────────

#[error_code]
pub enum FuturesError {
    #[msg("Invalid price: must be > 0")]
    InvalidPrice,
    #[msg("Invalid direction: must be 0 (Long) or 1 (Short)")]
    InvalidDirection,
    #[msg("Commodity name too long: max 16 chars")]
    CommodityNameTooLong,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Position already closed")]
    PositionAlreadyClosed,
    #[msg("Not liquidatable: threshold not reached")]
    NotLiquidatable,
    #[msg("Invalid market")]
    InvalidMarket,
    #[msg("Zero collateral")]
    ZeroCollateral,
    #[msg("Invalid leverage: must be 1-10")]
    InvalidLeverage,
    #[msg("Market is paused")]
    MarketPaused,
    #[msg("Position too large for vault")]
    PositionTooLarge,
    #[msg("Funding interval not reached")]
    FundingTooEarly,
    #[msg("Nothing to withdraw")]
    NothingToWithdraw,
}
