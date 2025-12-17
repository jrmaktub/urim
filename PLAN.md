# Plan: Single Claim Instruction for Mixed Pools

## Problem
Current implementation requires users to click 2 buttons (claim + claim_urim) to get their winnings. This is bad UX.

## Solution
**One `claim_all` instruction that pays from BOTH vaults in a single transaction.**

## Changes Required

### 1. New Instruction: `claim_all`
```rust
pub fn claim_all(ctx: Context<ClaimAll>) -> Result<()>
```

This instruction:
- Calculates USDC payout (bet back + share of USDC losers)
- Calculates URIM payout (share of URIM losers)
- Transfers from USDC vault to user's USDC account
- Transfers from URIM vault to user's URIM account
- Sets both `claimed_usdc` and `claimed_urim` to true

### 2. New Account Struct: `ClaimAll`
```rust
#[derive(Accounts)]
pub struct ClaimAll<'info> {
    pub round: Account<'info, Round>,
    #[account(mut)]
    pub user_bet: Account<'info, UserBet>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,        // USDC vault
    #[account(mut)]
    pub urim_vault: Account<'info, TokenAccount>,   // URIM vault
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_urim_account: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
```

### 3. Keep Old Instructions (backwards compatible)
Keep `claim` and `claim_urim` for users who only want one token type, but recommend `claim_all` in the UI.

## Implementation Steps

1. Add `ClaimAll` accounts struct
2. Add `claim_all` instruction that calls both payout functions and transfers from both vaults
3. Update tests to use `claim_all` instead of separate claims
4. Rebuild and deploy

## Complexity
Low - just combining two existing operations into one instruction.
