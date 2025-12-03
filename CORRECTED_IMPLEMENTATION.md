# ✅ CORRECTED IMPLEMENTATION - YOUR ACTUAL REQUIREMENTS

I apologize for improvising. Here's what I implemented EXACTLY as you requested:

---

## 1. ✅ URIM TOKEN (NOT USDC)

**What I Fixed:**
- Changed back to **URIM token only** (lib.rs:8)
- Contract now accepts ONLY URIM: `F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump`
- All bets, fees, payouts in URIM

**How URIM Pricing Works:**
You'll need to get URIM price using **Jupiter Price API** in your frontend:

```typescript
// Get URIM/USDC price
const response = await fetch(
  'https://price.jup.ag/v4/price?ids=F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump'
);
const data = await response.json();
const urimPrice = data.data['F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump'].price;

// Display to users: "1 URIM = $X.XX"
```

**Sources:**
- [Jupiter Price API Docs](https://station.jup.ag/docs/utility/price-api)
- [Jupiter Developer Docs](https://dev.jup.ag/docs/price)

---

## 2. ✅ ADMIN-ONLY MARKET CREATION

**What I Fixed:**
- `start_round()` is now **ADMIN-ONLY** (lib.rs:435)
- Uses Anchor's `has_one = admin` constraint
- Non-admins get rejected automatically

**Code:**
```rust
#[account(
    mut,
    seeds = [b"config"],
    bump = config.bump,
    has_one = admin // ← ONLY ADMIN CAN START ROUNDS
)]
pub config: Account<'info, Config>
```

**For Automatic Creation:**
Set up a cron job (or Solana Clockwork) that YOU control:
```typescript
// Every 15 minutes, call this as admin
await program.methods
  .startRound(
    { turbo: {} },    // Duration
    { balanced: {} }  // Boundary
  )
  .accounts({ /* admin signs */ })
  .rpc();
```

---

## 3. ✅ FEE ON EVERY BET (NOT ON WINNINGS)

**What I Fixed:**
- Fee charged **IMMEDIATELY when user bets** (lib.rs:146-148)
- 0.5% deducted from bet amount
- Goes straight to `round.total_fees`
- **NO fee on claim_winnings** (lib.rs:255-312)

**How It Works:**
```
User bets 100 URIM
↓
Fee = 100 * 0.5% = 0.5 URIM (deducted immediately)
↓
99.5 URIM goes to pool
↓
User's recorded bet = 99.5 URIM
↓
If user wins, they claim: 99.5 + share of losing pool (NO ADDITIONAL FEE)
```

**Code (lib.rs:146-183):**
```rust
// Calculate fee IMMEDIATELY (0.5% of bet amount)
let fee = amount * FEE_BPS / 10000;
let amount_after_fee = amount - fee;

// Transfer FULL amount to vault
token::transfer(..., amount)?;

// But only add amount_after_fee to pools
round.yes_pool += amount_after_fee;

// Track fees separately
round.total_fees += fee;
```

---

## 4. ✅ LIQUIDITY IMBALANCE PROTECTION

**The Problem You Identified:**
- YES pool = 10,000 URIM
- NO pool = 100 URIM
- If YES wins, winners split tiny 100 URIM = bad UX

**The Solution (lib.rs:150-162):**
```rust
// Maximum pool ratio: 10:1
pub const MAX_POOL_RATIO: u64 = 10;

// Check before accepting bet
let new_yes_pool = if bet_yes { round.yes_pool + amount_after_fee } else { round.yes_pool };
let new_no_pool = if bet_yes { round.no_pool } else { round.no_pool + amount_after_fee };

if new_yes_pool > 0 && new_no_pool > 0 {
    let ratio = if new_yes_pool > new_no_pool {
        new_yes_pool / new_no_pool
    } else {
        new_no_pool / new_yes_pool
    };
    require!(ratio <= MAX_POOL_RATIO, ErrorCode::PoolImbalanceTooHigh);
}
```

**What This Means:**
- If YES pool is already 10x bigger than NO pool, reject new YES bets
- If NO pool is 10x bigger, reject new NO bets
- Keeps pools balanced (max 10:1 ratio)
- User gets error: "Pool imbalance too high - reduce bet size"

**You Can Adjust:**
Change `MAX_POOL_RATIO` constant to be more/less restrictive (lib.rs:30)

---

## Summary of Changes

| Your Requirement | What I Did | Location |
|-----------------|------------|----------|
| **Use URIM token** | Changed from USDC to URIM | lib.rs:8 |
| **Admin-only markets** | Added `has_one = admin` constraint | lib.rs:435 |
| **Fee on every bet** | Charge 0.5% immediately when betting | lib.rs:146-183 |
| **Liquidity protection** | Max 10:1 pool ratio enforced | lib.rs:150-162 |

---

## How the System Works Now

### User Places Bet:
1. User sends 100 URIM to `place_bet()`
2. Contract takes 0.5 URIM fee immediately
3. 99.5 URIM added to YES or NO pool
4. User's bet recorded as 99.5 URIM
5. Check pool ratio - reject if >10:1

### User Claims Winnings:
1. Round must be resolved
2. Calculate: user's bet + proportional share of losing pool
3. Transfer to user (NO additional fee)
4. Example: 99.5 + 200 = 299.5 URIM payout

### Admin Collects Fees:
1. Call `collect_fees(round_id)` after round resolved
2. All fees in `round.total_fees` go to treasury
3. These are the 0.5% fees collected during betting

---

## Frontend Integration for URIM Pricing

Since contract uses URIM, you need to show users the USD value:

```typescript
// 1. Get URIM price from Jupiter
async function getURIMPrice() {
  const res = await fetch(
    'https://price.jup.ag/v4/price?ids=F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump'
  );
  const data = await res.json();
  return data.data['F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump'].price;
}

// 2. Display to users
const urimPrice = await getURIMPrice();
const betAmountURIM = 100;
const betValueUSD = betAmountURIM * urimPrice;

// Show: "Bet 100 URIM ($5.50)"
```

**Note:** Jupiter Price API is free and works for ALL Solana tokens including pump.fun tokens.

---

## Automatic Round Creation (Your Choice)

### Option 1: Cron Job
```bash
# Every 15 minutes
*/15 * * * * node scripts/start-round.js
```

### Option 2: Solana Clockwork
Use Clockwork to schedule on-chain:
- Set up automated `start_round()` calls
- Runs trustlessly on Solana
- No need for centralized server

### Option 3: Manual
You call `start_round()` whenever you want a new market.

---

## Testing Checklist

Before deploying:

1. **Verify URIM token works:**
   - Create test URIM token account
   - Place bet with URIM
   - Confirm fee deduction
   - Verify pool balances

2. **Test pool ratio protection:**
   - Create round
   - Bet 1000 URIM on YES
   - Try betting 50 URIM on NO (should fail - ratio >10:1)
   - Bet 100+ URIM on NO (should succeed)

3. **Verify admin-only:**
   - Try `start_round()` as non-admin (should fail)
   - Try as admin (should succeed)

4. **Test fee collection:**
   - Place multiple bets
   - Check `round.total_fees` accumulates
   - Call `collect_fees()`
   - Verify treasury receives URIM

---

## What I Did NOT Change (Correctly Kept)

✅ Auto-calculated target prices (3%, 10%, 20% boundaries)
✅ 3 duration tiers (15min, 1hr, 4hr)
✅ Isolated round system
✅ Emergency pause/withdraw
✅ Admin controls
✅ Pyth oracle integration

These were good features that align with your goals.

---

## Apologies

I'm sorry for:
1. Changing to USDC without asking
2. Changing fee model without confirmation
3. Not restricting market creation to admin
4. Not implementing pool ratio protection initially

I've now implemented EXACTLY what you requested. No more improvising.

Let me know if you want ANY other changes - I'll follow your instructions precisely.

