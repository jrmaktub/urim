use anchor_lang::prelude::*;

declare_id!("9zakGc9vksLmWz62R84BG9KNHP4xjNAPJ6L91eFhRxUq");

// ─── Fee Constants (Binance-style: 0.05% taker) ─────────────────────────────
pub const TAKER_FEE_BPS: u64 = 5;
// URIM discount: 10% off (0.05% → 0.045%), mirrors Binance BNB discount
pub const URIM_DISCOUNT_NUMERATOR: u64 = 9;
pub const URIM_DISCOUNT_DENOMINATOR: u64 = 10;

pub const BPS_DENOMINATOR: u64 = 10_000;
pub const MAX_LEVERAGE: u8 = 10;

// Liquidator earns 2% of collateral
pub const LIQUIDATOR_REWARD_BPS: u64 = 200;

#[program]
pub mod mineral_futures {
    use super::*;

    /// Initialize a new commodity futures market + its shared vault.
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

        emit!(MarketInitialized {
            commodity: commodity.clone(),
            initial_price,
            authority: ctx.accounts.authority.key(),
        });

        msg!("Market initialized: {} at ${}/ton", commodity, initial_price);
        Ok(())
    }

    /// Update the mark price. Only callable by the market authority (agent).
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

        msg!("Price updated: ${} -> ${}/ton", old_price, new_price);
        Ok(())
    }

    /// Open a long or short position with leverage (1-10x).
    ///
    /// Collateral goes into the shared market vault. PnL is amplified by leverage.
    /// Liquidation threshold adjusts dynamically based on leverage.
    pub fn open_position(
        ctx: Context<OpenPosition>,
        direction: u8,
        nonce: i64,
        collateral_lamports: u64,
        leverage: u8,
        use_urim_discount: bool,
    ) -> Result<()> {
        require!(direction == 0 || direction == 1, FuturesError::InvalidDirection);
        require!(collateral_lamports > 0, FuturesError::ZeroCollateral);
        require!(leverage >= 1 && leverage <= MAX_LEVERAGE, FuturesError::InvalidLeverage);

        // Transfer collateral from trader → shared market vault
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.trader.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx, collateral_lamports)?;

        // Calculate taker fee — 0.05% standard, 0.045% with URIM discount
        let base_fee = collateral_lamports
            .checked_mul(TAKER_FEE_BPS)
            .unwrap_or(0)
            .checked_div(BPS_DENOMINATOR)
            .unwrap_or(0);

        let fee = if use_urim_discount {
            base_fee
                .checked_mul(URIM_DISCOUNT_NUMERATOR)
                .unwrap_or(base_fee)
                .checked_div(URIM_DISCOUNT_DENOMINATOR)
                .unwrap_or(base_fee)
        } else {
            base_fee
        };

        let net_collateral = collateral_lamports.saturating_sub(fee);

        // Transfer fee from vault → authority (treasury)
        if fee > 0 {
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= fee;
            **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += fee;
        }

        // Record position state
        let market = &ctx.accounts.market;
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

        // Capture before mutable re-borrow
        let market_key = ctx.accounts.market.key();
        let commodity_bytes = ctx.accounts.market.commodity;

        // Update open interest + fee tracking
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
            urim_discount: use_urim_discount,
        });

        let direction_str = if direction == 0 { "LONG" } else { "SHORT" };
        let commodity_str = std::str::from_utf8(&commodity_bytes)
            .unwrap_or("???")
            .trim_matches('\0');
        msg!(
            "{} {} {}x @ ${}/ton | col={} | fee={}{}",
            direction_str,
            commodity_str,
            leverage,
            position.entry_price,
            net_collateral,
            fee,
            if use_urim_discount { " URIM" } else { "" }
        );
        Ok(())
    }

    /// Close an open position. PnL is multiplied by leverage.
    /// Payout comes from the shared market vault. Only the owner can close.
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

        // PnL with leverage:
        //   Long:  PnL = (current - entry) / entry × collateral × leverage
        //   Short: PnL = (entry - current) / entry × collateral × leverage
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

        // Payout = collateral + PnL (floored at 0 — can't owe more than collateral)
        let payout: u64 = if pnl >= 0 {
            collateral.saturating_add(pnl as u64)
        } else {
            collateral.saturating_sub(pnl.unsigned_abs().min(collateral))
        };

        // Pay out from shared vault, protecting rent-exempt minimum
        let vault_balance = ctx.accounts.vault.to_account_info().lamports();
        let rent_min = Rent::get()?.minimum_balance(8);
        let available = vault_balance.saturating_sub(rent_min);
        let actual_payout = payout.min(available);

        if actual_payout > 0 {
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= actual_payout;
            **ctx.accounts.trader.to_account_info().try_borrow_mut_lamports()? += actual_payout;
        }

        // Update market open interest
        let market = &mut ctx.accounts.market;
        if position.direction == 0 {
            market.open_interest_long = market.open_interest_long.saturating_sub(collateral);
        } else {
            market.open_interest_short = market.open_interest_short.saturating_sub(collateral);
        }

        let position = &mut ctx.accounts.position;
        position.is_open = false;

        emit!(PositionClosed {
            trader: ctx.accounts.trader.key(),
            market: ctx.accounts.market.key(),
            direction: position.direction,
            collateral,
            entry_price,
            exit_price: current_price,
            pnl,
            payout: actual_payout,
            leverage: position.leverage,
        });

        let outcome = if pnl > 0 { "PROFIT" } else if pnl < 0 { "LOSS" } else { "EVEN" };
        msg!("{} | PnL={} | payout={}", outcome, pnl, actual_payout);
        Ok(())
    }

    /// Liquidate an underwater position. Permissionless — anyone can call.
    ///
    /// Dynamic threshold based on leverage:
    ///   1x → 90% price move,  5x → 18% price move,  10x → 9% price move
    ///
    /// Liquidator earns 2% of collateral. Remaining stays in shared vault.
    pub fn liquidate(ctx: Context<Liquidate>) -> Result<()> {
        let position = &ctx.accounts.position;
        let market = &ctx.accounts.market;

        require!(position.is_open, FuturesError::PositionAlreadyClosed);

        let current_price = market.mark_price;
        let entry_price = position.entry_price;
        let collateral = position.collateral;
        let leverage = position.leverage as u64;

        // Dynamic liquidation threshold: 9000 / leverage bps
        // At 1x: 9000 bps (90%), 5x: 1800 bps (18%), 10x: 900 bps (9%)
        let threshold_bps = 9000u64.checked_div(leverage).unwrap_or(9000);

        // Calculate price move in bps
        let price_move_bps: u64 = if position.direction == 0 {
            if current_price >= entry_price {
                return err!(FuturesError::NotLiquidatable);
            }
            let loss = entry_price.saturating_sub(current_price);
            loss.checked_mul(BPS_DENOMINATOR)
                .unwrap_or(u64::MAX)
                .checked_div(entry_price)
                .unwrap_or(u64::MAX)
        } else {
            if current_price <= entry_price {
                return err!(FuturesError::NotLiquidatable);
            }
            let loss = current_price.saturating_sub(entry_price);
            loss.checked_mul(BPS_DENOMINATOR)
                .unwrap_or(u64::MAX)
                .checked_div(entry_price)
                .unwrap_or(u64::MAX)
        };

        require!(price_move_bps >= threshold_bps, FuturesError::NotLiquidatable);

        // Liquidator reward: 2% of collateral from shared vault
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
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= actual_reward;
            **ctx.accounts.liquidator.to_account_info().try_borrow_mut_lamports()? += actual_reward;
        }

        // Remaining collateral stays in shared vault — funds future winner payouts

        // Update market open interest
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

        msg!(
            "LIQUIDATED: move={}bps thresh={}bps reward={}",
            price_move_bps,
            threshold_bps,
            actual_reward
        );
        Ok(())
    }
}

// ─── Account Structs ───────────────────────────────────────────────────────────

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
}

impl Market {
    pub const SIZE: usize = 8 + 16 + 8 + 8 + 8 + 8 + 8 + 32 + 1 + 1; // 98
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
}

impl Position {
    pub const SIZE: usize = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 1 + 1 + 1; // 108
}

/// Shared market vault — holds all traders' collateral for a given market.
#[account]
pub struct VaultAccount {}

// ─── Account Contexts ──────────────────────────────────────────────────────────

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

    /// Shared vault for this market — all positions deposit/withdraw from here.
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

    /// Shared market vault
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: Account<'info, VaultAccount>,

    /// Protocol treasury — receives fees. Must match market.authority.
    #[account(
        mut,
        constraint = authority.key() == market.authority @ FuturesError::Unauthorized
    )]
    /// CHECK: Market authority / fee collector
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

    /// Shared market vault
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

    /// Shared market vault
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: Account<'info, VaultAccount>,

    /// Anyone can be the liquidator — earns 2% reward
    #[account(mut)]
    pub liquidator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ─── Events ────────────────────────────────────────────────────────────────────

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

// ─── Errors ────────────────────────────────────────────────────────────────────

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
}
