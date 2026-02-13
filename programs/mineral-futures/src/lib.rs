use anchor_lang::prelude::*;

declare_id!("BxCSsWy14b1yUGi8h5mEDJc9tH4AEbqVwGC8b4tcVvmz");

// Fee constants (Binance-style)
pub const TAKER_FEE_BPS: u64 = 5; // 0.05%
pub const URIM_DISCOUNT_BPS: u64 = 1; // 10% discount = 0.005% effective (1 bps off)
pub const LIQUIDATION_THRESHOLD_BPS: u64 = 8000; // 80% loss triggers liquidation
pub const BPS_DENOMINATOR: u64 = 10_000;

#[program]
pub mod mineral_futures {
    use super::*;

    /// Initialize a new commodity futures market.
    /// Called by the agent authority to create markets for each mineral.
    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        commodity: String,
        initial_price: u64, // price in USD cents (e.g. 68 = $0.68)
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

        emit!(MarketInitialized {
            commodity: commodity.clone(),
            initial_price,
            authority: ctx.accounts.authority.key(),
        });

        msg!("Market initialized: {} at price {} USD cents", commodity, initial_price);
        Ok(())
    }

    /// Update the mark price for a market. Only callable by the market authority (the agent).
    /// The agent fetches real prices from Metals-API and posts them here.
    pub fn update_price(
        ctx: Context<UpdatePrice>,
        new_price: u64,
    ) -> Result<()> {
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

        msg!("Price updated: {} -> {} USD cents", old_price, new_price);
        Ok(())
    }

    /// Open a long or short position on a commodity.
    /// User deposits SOL as collateral. Position size = collateral (1x, no leverage for simplicity).
    pub fn open_position(
        ctx: Context<OpenPosition>,
        direction: u8, // 0 = Long, 1 = Short
        nonce: i64,    // unique nonce (use unix timestamp client-side) to allow multiple positions
        use_urim_discount: bool,
    ) -> Result<()> {
        require!(direction == 0 || direction == 1, FuturesError::InvalidDirection);

        let collateral = ctx.accounts.position.to_account_info().lamports()
            .checked_sub(Rent::get()?.minimum_balance(Position::SIZE))
            .unwrap_or(0);

        // Collateral is sent via the init instruction (payer deposits)
        // We just record the entry state
        let market = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;
        let clock = Clock::get()?;

        // Calculate fee
        let effective_fee_bps = if use_urim_discount {
            TAKER_FEE_BPS.saturating_sub(URIM_DISCOUNT_BPS)
        } else {
            TAKER_FEE_BPS
        };

        let collateral_amount = ctx.accounts.vault.lamports()
            .checked_sub(Rent::get()?.minimum_balance(0))
            .unwrap_or(0);

        let fee = collateral_amount
            .checked_mul(effective_fee_bps)
            .unwrap_or(0)
            .checked_div(BPS_DENOMINATOR)
            .unwrap_or(0);

        position.owner = ctx.accounts.trader.key();
        position.market = ctx.accounts.market.key();
        position.direction = direction;
        position.collateral = collateral_amount.saturating_sub(fee);
        position.entry_price = market.mark_price;
        position.opened_at = nonce;
        position.fee_paid = fee;
        position.is_open = true;
        position.bump = ctx.bumps.position;

        // Capture keys before mutable borrow
        let market_key = ctx.accounts.market.key();
        let commodity_bytes = ctx.accounts.market.commodity;

        // Track open interest
        let market = &mut ctx.accounts.market;
        if direction == 0 {
            market.open_interest_long = market.open_interest_long.saturating_add(position.collateral);
        } else {
            market.open_interest_short = market.open_interest_short.saturating_add(position.collateral);
        }
        market.total_fees_collected = market.total_fees_collected.saturating_add(fee);

        emit!(PositionOpened {
            trader: ctx.accounts.trader.key(),
            market: market_key,
            direction,
            collateral: position.collateral,
            entry_price: position.entry_price,
            fee_paid: fee,
        });

        msg!(
            "Position opened: {} {} @ {} cents, collateral={} lamports, fee={} lamports",
            if direction == 0 { "LONG" } else { "SHORT" },
            std::str::from_utf8(&commodity_bytes).unwrap_or("???").trim_matches('\0'),
            position.entry_price,
            position.collateral,
            fee
        );
        Ok(())
    }

    /// Close an open position. Calculates PnL and pays out from vault.
    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        let position = &ctx.accounts.position;
        let market = &ctx.accounts.market;

        require!(position.is_open, FuturesError::PositionAlreadyClosed);
        require!(position.owner == ctx.accounts.trader.key(), FuturesError::Unauthorized);

        let current_price = market.mark_price;
        let entry_price = position.entry_price;
        let collateral = position.collateral;

        // Calculate PnL in basis points
        // Long PnL = (current - entry) / entry * collateral
        // Short PnL = (entry - current) / entry * collateral
        let pnl: i64 = if position.direction == 0 {
            // Long
            let price_change = (current_price as i64).saturating_sub(entry_price as i64);
            price_change
                .checked_mul(collateral as i64)
                .unwrap_or(0)
                .checked_div(entry_price as i64)
                .unwrap_or(0)
        } else {
            // Short
            let price_change = (entry_price as i64).saturating_sub(current_price as i64);
            price_change
                .checked_mul(collateral as i64)
                .unwrap_or(0)
                .checked_div(entry_price as i64)
                .unwrap_or(0)
        };

        let payout = if pnl >= 0 {
            collateral.saturating_add(pnl as u64)
        } else {
            collateral.saturating_sub(pnl.unsigned_abs())
        };

        // Transfer payout from vault to trader
        let vault_balance = ctx.accounts.vault.lamports();
        let actual_payout = payout.min(vault_balance);

        if actual_payout > 0 {
            **ctx.accounts.vault.try_borrow_mut_lamports()? -= actual_payout;
            **ctx.accounts.trader.try_borrow_mut_lamports()? += actual_payout;
        }

        // Update open interest
        let market = &mut ctx.accounts.market;
        if position.direction == 0 {
            market.open_interest_long = market.open_interest_long.saturating_sub(collateral);
        } else {
            market.open_interest_short = market.open_interest_short.saturating_sub(collateral);
        }

        // Mark position closed
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
        });

        msg!(
            "Position closed: PnL={} lamports, payout={} lamports",
            pnl,
            actual_payout
        );
        Ok(())
    }

    /// Liquidate an underwater position. Permissionless — anyone can call this.
    /// The agent monitors positions and calls this automatically.
    pub fn liquidate(ctx: Context<Liquidate>) -> Result<()> {
        let position = &ctx.accounts.position;
        let market = &ctx.accounts.market;

        require!(position.is_open, FuturesError::PositionAlreadyClosed);

        let current_price = market.mark_price;
        let entry_price = position.entry_price;
        let collateral = position.collateral;

        // Calculate loss in bps
        let loss_bps: u64 = if position.direction == 0 {
            // Long: losing if price dropped
            if current_price >= entry_price {
                return err!(FuturesError::NotLiquidatable);
            }
            let loss = entry_price.saturating_sub(current_price);
            loss.checked_mul(BPS_DENOMINATOR)
                .unwrap_or(u64::MAX)
                .checked_div(entry_price)
                .unwrap_or(u64::MAX)
        } else {
            // Short: losing if price rose
            if current_price <= entry_price {
                return err!(FuturesError::NotLiquidatable);
            }
            let loss = current_price.saturating_sub(entry_price);
            loss.checked_mul(BPS_DENOMINATOR)
                .unwrap_or(u64::MAX)
                .checked_div(entry_price)
                .unwrap_or(u64::MAX)
        };

        require!(loss_bps >= LIQUIDATION_THRESHOLD_BPS, FuturesError::NotLiquidatable);

        // Liquidator gets 2% of collateral as reward
        let liquidator_reward = collateral
            .checked_mul(200)
            .unwrap_or(0)
            .checked_div(BPS_DENOMINATOR)
            .unwrap_or(0);

        let vault_balance = ctx.accounts.vault.lamports();
        let actual_reward = liquidator_reward.min(vault_balance);

        if actual_reward > 0 {
            **ctx.accounts.vault.try_borrow_mut_lamports()? -= actual_reward;
            **ctx.accounts.liquidator.try_borrow_mut_lamports()? += actual_reward;
        }

        // Update open interest
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
            loss_bps,
            liquidator_reward: actual_reward,
        });

        msg!(
            "Position liquidated! loss={}bps, liquidator_reward={} lamports",
            loss_bps,
            actual_reward
        );
        Ok(())
    }
}

// ─── Account Structs ───────────────────────────────────────────────────────────

#[account]
pub struct Market {
    pub commodity: [u8; 16],          // e.g. "ANTIMONY\0\0\0\0\0\0\0\0"
    pub mark_price: u64,              // USD cents (e.g. 68 = $0.68/unit)
    pub last_price_update: i64,       // unix timestamp
    pub open_interest_long: u64,      // total collateral in long positions (lamports)
    pub open_interest_short: u64,     // total collateral in short positions (lamports)
    pub total_fees_collected: u64,    // cumulative fees (lamports)
    pub authority: Pubkey,            // agent wallet that can update prices
    pub bump: u8,
}

impl Market {
    pub const SIZE: usize = 8  // discriminator
        + 16                   // commodity
        + 8                    // mark_price
        + 8                    // last_price_update
        + 8                    // open_interest_long
        + 8                    // open_interest_short
        + 8                    // total_fees_collected
        + 32                   // authority
        + 1;                   // bump
}

#[account]
pub struct Position {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub direction: u8,         // 0 = Long, 1 = Short
    pub collateral: u64,       // lamports locked (after fee)
    pub entry_price: u64,      // mark price when opened
    pub opened_at: i64,        // unix timestamp
    pub fee_paid: u64,         // lamports paid as fee
    pub is_open: bool,
    pub bump: u8,
}

impl Position {
    pub const SIZE: usize = 8  // discriminator
        + 32                   // owner
        + 32                   // market
        + 1                    // direction
        + 8                    // collateral
        + 8                    // entry_price
        + 8                    // opened_at
        + 8                    // fee_paid
        + 1                    // is_open
        + 1;                   // bump
}

// ─── Contexts ──────────────────────────────────────────────────────────────────

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
#[instruction(direction: u8, nonce: i64)]
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

    /// Vault PDA holds all collateral for this market
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA vault, lamports transferred in by trader
    pub vault: AccountInfo<'info>,

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
        bump,
    )]
    /// CHECK: PDA vault
    pub vault: AccountInfo<'info>,

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
        bump,
    )]
    /// CHECK: PDA vault
    pub vault: AccountInfo<'info>,

    /// Anyone can be the liquidator and earn the reward
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
}

#[event]
pub struct PositionLiquidated {
    pub trader: Pubkey,
    pub market: Pubkey,
    pub liquidator: Pubkey,
    pub collateral: u64,
    pub loss_bps: u64,
    pub liquidator_reward: u64,
}

// ─── Errors ────────────────────────────────────────────────────────────────────

#[error_code]
pub enum FuturesError {
    #[msg("Invalid price: must be greater than zero")]
    InvalidPrice,
    #[msg("Invalid direction: must be 0 (Long) or 1 (Short)")]
    InvalidDirection,
    #[msg("Commodity name too long: max 16 characters")]
    CommodityNameTooLong,
    #[msg("Unauthorized: only the market authority can perform this action")]
    Unauthorized,
    #[msg("Position is already closed")]
    PositionAlreadyClosed,
    #[msg("Position is not liquidatable: loss threshold not reached")]
    NotLiquidatable,
    #[msg("Invalid market account for this position")]
    InvalidMarket,
}
