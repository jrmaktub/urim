use anchor_lang::prelude::*;

declare_id!("9zakGc9vksLmWz62R84BG9KNHP4xjNAPJ6L91eFhRxUq");

// ─── Fee Constants (Binance-style) ────────────────────────────────────────────
// Taker fee: 0.05% = 5 bps
pub const TAKER_FEE_BPS: u64 = 5;
// URIM discount: 10% off the taker fee. We compute as fee * 9 / 10.
// Example: 0.05% fee → URIM holders pay 0.045%
pub const URIM_DISCOUNT_NUMERATOR: u64 = 9;
pub const URIM_DISCOUNT_DENOMINATOR: u64 = 10;

// Liquidation at 80% loss
pub const LIQUIDATION_THRESHOLD_BPS: u64 = 8000;
pub const BPS_DENOMINATOR: u64 = 10_000;

// Liquidator earns 2% of collateral
pub const LIQUIDATOR_REWARD_BPS: u64 = 200;

#[program]
pub mod mineral_futures {
    use super::*;

    /// Initialize a new commodity futures market.
    /// Called once by the agent authority per commodity.
    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        commodity: String,
        initial_price: u64, // USD per metric ton (integer, e.g. 21834 = $21,834/ton)
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

        msg!("Market initialized: {} at ${}/ton", commodity, initial_price);
        Ok(())
    }

    /// Update the mark price for a market. Only callable by the market authority (the agent).
    /// Agent fetches real prices from Metals-API and posts them here every 3 hours.
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

        msg!("Price updated: ${} -> ${}/ton", old_price, new_price);
        Ok(())
    }

    /// Open a long or short position on a commodity.
    ///
    /// Flow:
    ///   1. This instruction initializes the per-position vault (owned by the program).
    ///   2. Trader's collateral is deposited via the `init` payer mechanism (lamports
    ///      sent from trader to vault by including `collateral_lamports` in the tx).
    ///      Actually: client passes `collateral_lamports` arg; program transfers it
    ///      from trader to vault inside the instruction via CPI to system program.
    ///   3. Fee is deducted from vault → authority (treasury).
    ///   4. Net collateral recorded in Position.
    ///
    /// use_urim_discount: pass true if user holds ≥$10 URIM (checked client-side).
    ///   Effect: taker fee reduced by 10% (0.05% → 0.045%).
    pub fn open_position(
        ctx: Context<OpenPosition>,
        direction: u8,              // 0 = Long, 1 = Short
        nonce: i64,                 // unix timestamp — makes each position PDA unique
        collateral_lamports: u64,   // SOL collateral to deposit (lamports)
        use_urim_discount: bool,
    ) -> Result<()> {
        require!(direction == 0 || direction == 1, FuturesError::InvalidDirection);
        require!(collateral_lamports > 0, FuturesError::ZeroCollateral);

        // Transfer collateral from trader → program-owned vault via CPI
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.trader.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx, collateral_lamports)?;

        // Calculate taker fee — 0.05% standard, 0.045% with URIM discount (10% off)
        let base_fee = collateral_lamports
            .checked_mul(TAKER_FEE_BPS)
            .unwrap_or(0)
            .checked_div(BPS_DENOMINATOR)
            .unwrap_or(0);

        let fee = if use_urim_discount {
            // 10% off: fee * 9 / 10
            base_fee
                .checked_mul(URIM_DISCOUNT_NUMERATOR)
                .unwrap_or(base_fee)
                .checked_div(URIM_DISCOUNT_DENOMINATOR)
                .unwrap_or(base_fee)
        } else {
            base_fee
        };

        let net_collateral = collateral_lamports.saturating_sub(fee);

        // Transfer fee from vault → protocol authority (treasury)
        // Vault is owned by this program so lamport mutation is allowed
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
        position.is_open = true;
        position.bump = ctx.bumps.position;

        // Capture before mutable re-borrow of market
        let market_key = ctx.accounts.market.key();
        let commodity_bytes = ctx.accounts.market.commodity;

        // Update open interest + fee tracking on market
        let market = &mut ctx.accounts.market;
        if direction == 0 {
            market.open_interest_long = market
                .open_interest_long
                .saturating_add(net_collateral);
        } else {
            market.open_interest_short = market
                .open_interest_short
                .saturating_add(net_collateral);
        }
        market.total_fees_collected = market.total_fees_collected.saturating_add(fee);

        emit!(PositionOpened {
            trader: ctx.accounts.trader.key(),
            market: market_key,
            direction,
            collateral: net_collateral,
            entry_price: position.entry_price,
            fee_paid: fee,
            urim_discount: use_urim_discount,
        });

        let direction_str = if direction == 0 { "LONG" } else { "SHORT" };
        let commodity_str = std::str::from_utf8(&commodity_bytes)
            .unwrap_or("???")
            .trim_matches('\0');
        msg!(
            "Position opened: {} {} @ ${}/ton | collateral={} lamports | fee={} lamports{}",
            direction_str,
            commodity_str,
            position.entry_price,
            net_collateral,
            fee,
            if use_urim_discount { " (URIM 10% discount applied)" } else { "" }
        );
        Ok(())
    }

    /// Close an open position. Calculates PnL and pays out from per-position vault.
    /// Only the position owner can close their own position.
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

        // PnL calculation (integer, lamport-scaled):
        //   Long:  PnL = (current - entry) / entry × collateral
        //   Short: PnL = (entry - current) / entry × collateral
        let pnl: i64 = if position.direction == 0 {
            // Long
            let price_change = (current_price as i64).saturating_sub(entry_price as i64);
            price_change
                .saturating_mul(collateral as i64)
                .checked_div(entry_price as i64)
                .unwrap_or(0)
        } else {
            // Short
            let price_change = (entry_price as i64).saturating_sub(current_price as i64);
            price_change
                .saturating_mul(collateral as i64)
                .checked_div(entry_price as i64)
                .unwrap_or(0)
        };

        // Payout = collateral + PnL (floored at 0 — trader can't owe more than collateral)
        let payout: u64 = if pnl >= 0 {
            collateral.saturating_add(pnl as u64)
        } else {
            collateral.saturating_sub(pnl.unsigned_abs().min(collateral))
        };

        // Pay out from the per-position vault (program-owned, so lamport mutation allowed)
        let vault_balance = ctx.accounts.vault.to_account_info().lamports();
        let actual_payout = payout.min(vault_balance);

        if actual_payout > 0 {
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= actual_payout;
            **ctx.accounts.trader.to_account_info().try_borrow_mut_lamports()? += actual_payout;
        }

        // Update market open interest
        let market = &mut ctx.accounts.market;
        if position.direction == 0 {
            market.open_interest_long =
                market.open_interest_long.saturating_sub(collateral);
        } else {
            market.open_interest_short =
                market.open_interest_short.saturating_sub(collateral);
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
        });

        let outcome = if pnl > 0 { "PROFIT" } else if pnl < 0 { "LOSS" } else { "BREAKEVEN" };
        msg!(
            "Position closed: {} | PnL={} lamports | payout={} lamports",
            outcome,
            pnl,
            actual_payout
        );
        Ok(())
    }

    /// Liquidate an underwater position. Permissionless — anyone can call this.
    /// The autonomous agent monitors all positions every 15 minutes and calls this
    /// when any position's loss exceeds 80% of its collateral.
    ///
    /// Liquidator earns 2% of the collateral as a reward.
    /// Remaining collateral stays in the vault (protocol insurance).
    pub fn liquidate(ctx: Context<Liquidate>) -> Result<()> {
        let position = &ctx.accounts.position;
        let market = &ctx.accounts.market;

        require!(position.is_open, FuturesError::PositionAlreadyClosed);

        let current_price = market.mark_price;
        let entry_price = position.entry_price;
        let collateral = position.collateral;

        // Calculate loss in bps
        let loss_bps: u64 = if position.direction == 0 {
            // Long: losing if price dropped below entry
            if current_price >= entry_price {
                return err!(FuturesError::NotLiquidatable);
            }
            let loss = entry_price.saturating_sub(current_price);
            loss.checked_mul(BPS_DENOMINATOR)
                .unwrap_or(u64::MAX)
                .checked_div(entry_price)
                .unwrap_or(u64::MAX)
        } else {
            // Short: losing if price rose above entry
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

        // Liquidator reward: 2% of original collateral
        let liquidator_reward = collateral
            .checked_mul(LIQUIDATOR_REWARD_BPS)
            .unwrap_or(0)
            .checked_div(BPS_DENOMINATOR)
            .unwrap_or(0);

        let vault_balance = ctx.accounts.vault.to_account_info().lamports();
        let actual_reward = liquidator_reward.min(vault_balance);

        if actual_reward > 0 {
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= actual_reward;
            **ctx.accounts.liquidator.to_account_info().try_borrow_mut_lamports()? += actual_reward;
        }

        // Remaining vault balance stays as protocol insurance fund (intentional)

        // Update market open interest
        let market = &mut ctx.accounts.market;
        if position.direction == 0 {
            market.open_interest_long =
                market.open_interest_long.saturating_sub(collateral);
        } else {
            market.open_interest_short =
                market.open_interest_short.saturating_sub(collateral);
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
            "Position LIQUIDATED: loss={}bps ({}%) | liquidator_reward={} lamports",
            loss_bps,
            loss_bps / 100,
            actual_reward
        );
        Ok(())
    }
}

// ─── Account Structs ───────────────────────────────────────────────────────────

#[account]
pub struct Market {
    pub commodity: [u8; 16],          // e.g. b"ANTIMONY\0\0\0\0\0\0\0\0"
    pub mark_price: u64,              // USD per metric ton (integer)
    pub last_price_update: i64,       // unix timestamp of last price update
    pub open_interest_long: u64,      // total net collateral in long positions (lamports)
    pub open_interest_short: u64,     // total net collateral in short positions (lamports)
    pub total_fees_collected: u64,    // cumulative fees sent to authority (lamports)
    pub authority: Pubkey,            // agent wallet — sole price updater
    pub bump: u8,
}

impl Market {
    pub const SIZE: usize = 8   // discriminator
        + 16                    // commodity [u8;16]
        + 8                     // mark_price u64
        + 8                     // last_price_update i64
        + 8                     // open_interest_long u64
        + 8                     // open_interest_short u64
        + 8                     // total_fees_collected u64
        + 32                    // authority Pubkey
        + 1;                    // bump u8
}

#[account]
pub struct Position {
    pub owner: Pubkey,          // trader wallet
    pub market: Pubkey,         // market PDA this position belongs to
    pub direction: u8,          // 0 = Long, 1 = Short
    pub collateral: u64,        // net collateral after fee (lamports)
    pub entry_price: u64,       // mark_price at open
    pub opened_at: i64,         // nonce passed at open (unix timestamp)
    pub fee_paid: u64,          // fee sent to protocol treasury (lamports)
    pub is_open: bool,          // false once closed or liquidated
    pub bump: u8,
}

impl Position {
    pub const SIZE: usize = 8   // discriminator
        + 32                    // owner Pubkey
        + 32                    // market Pubkey
        + 1                     // direction u8
        + 8                     // collateral u64
        + 8                     // entry_price u64
        + 8                     // opened_at i64
        + 8                     // fee_paid u64
        + 1                     // is_open bool
        + 1;                    // bump u8
}

/// Zero-data account owned by this program — used as the per-position collateral vault.
/// Being program-owned means we can freely modify its lamport balance.
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
#[instruction(direction: u8, nonce: i64, collateral_lamports: u64)]
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

    /// Per-position vault — program-owned PDA that holds the trader's collateral.
    /// Isolated margin: one vault per position, seeded with trader+market+nonce.
    /// Using UncheckedAccount + init_if_needed so it can hold bare lamports.
    #[account(
        init,
        payer = trader,
        space = 8,
        seeds = [b"vault", trader.key().as_ref(), market.key().as_ref(), &nonce.to_le_bytes()],
        bump,
    )]
    pub vault: Account<'info, VaultAccount>,

    /// Protocol treasury — receives taker fees. Must match market.authority.
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

    /// Per-position vault (isolated — only this trader's collateral)
    #[account(
        mut,
        seeds = [
            b"vault",
            trader.key().as_ref(),
            market.key().as_ref(),
            &position.opened_at.to_le_bytes(),
        ],
        bump,
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

    /// Per-position vault for the trader being liquidated
    #[account(
        mut,
        seeds = [
            b"vault",
            position.owner.as_ref(),
            market.key().as_ref(),
            &position.opened_at.to_le_bytes(),
        ],
        bump,
    )]
    pub vault: Account<'info, VaultAccount>,

    /// Anyone can be the liquidator — they earn 2% reward
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
    #[msg("Zero collateral: must deposit SOL into vault before opening position")]
    ZeroCollateral,
}
