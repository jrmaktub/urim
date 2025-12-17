# Frontend Integration Guide for URIM Prediction Market

## Overview

This guide explains how to integrate the URIM prediction market smart contract with your Lovable frontend.

## Contract Details

- **Program ID**: `5KqMaQLoKhBYcHD1qWZVcQqu5pmTvMitDUEqmKsqBTQg`
- **Network**: Devnet (Solana)
- **RPC**: `https://solana-devnet.g.alchemy.com/v2/27SvVEbGAVC2VSJ8rPss0`

## Token Mints

```typescript
const USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const URIM_MINT = "z9hasbeeaPU4JVb1Np9oqNbpe984J8cr5THSEGCWwpR";
```

---

## URIM Price Integration

### Fetching Live URIM Price from DexScreener

```typescript
const URIM_PAIR_ADDRESS = 'DjNhU15XfeZC5eU3Bmp1LM1VZAA4wUFs5P4nd8JbEaHS';

async function getUrimPriceUsd(): Promise<number> {
  const response = await fetch(
    `https://api.dexscreener.com/latest/dex/pairs/solana/${URIM_PAIR_ADDRESS}`
  );
  const data = await response.json();

  if (!data.pair || !data.pair.priceUsd) {
    throw new Error('Failed to fetch URIM price');
  }

  return parseFloat(data.pair.priceUsd); // e.g., 0.00001251
}
```

### Price Format for Contract

The contract expects URIM price in an 8-decimal scaled format:

```typescript
// Convert USD price to scaled format for contract
// Contract expects: urim_price_scaled = price_usd * 100_000_000
function usdToScaledPrice(priceUsd: number): number {
  return Math.round(priceUsd * 100_000_000);
}

// Example:
// URIM at $0.00001251 → urim_price_scaled = 1251
```

### Calculate URIM Amount for USD Value

```typescript
// Calculate how many URIM tokens needed for a given USD value
function calculateUrimAmount(usdValue: number, priceUsd: number): bigint {
  // URIM has 6 decimals
  const urimTokens = usdValue / priceUsd;
  return BigInt(Math.ceil(urimTokens * 1_000_000)); // Convert to micro-units
}

// Example:
// $1 at price $0.00001251 = 79,936 URIM tokens
// In micro-units: 79,936,051,000
```

---

## Betting Flow

### 1. Place Bet with USDC

```typescript
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

async function placeBetUsdc(
  program: Program,
  roundPDA: PublicKey,
  amountUsdc: number,  // e.g., 1 for $1
  betUp: boolean
) {
  const roundIdBuffer = Buffer.alloc(8);
  const round = await program.account.round.fetch(roundPDA);
  roundIdBuffer.writeBigUInt64LE(BigInt(round.roundId.toNumber()));

  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    program.programId
  );

  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), roundIdBuffer],
    program.programId
  );

  const [userBetPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), roundPDA.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId
  );

  const userUsdcAta = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
  const amount = BigInt(amountUsdc * 1_000_000); // USDC has 6 decimals

  await program.methods
    .placeBet(new anchor.BN(amount.toString()), betUp)
    .accounts({
      config: configPDA,
      round: roundPDA,
      userBet: userBetPDA,
      vault: vault,
      userTokenAccount: userUsdcAta,
      user: wallet.publicKey,
    })
    .rpc();
}
```

### 2. Place Bet with URIM

```typescript
async function placeBetUrim(
  program: Program,
  roundPDA: PublicKey,
  amountUsd: number,  // e.g., 1 for $1 worth of URIM
  betUp: boolean
) {
  // 1. Fetch live URIM price
  const priceUsd = await getUrimPriceUsd();
  const priceScaled = usdToScaledPrice(priceUsd);
  const urimAmount = calculateUrimAmount(amountUsd, priceUsd);

  // 2. Get PDAs
  const round = await program.account.round.fetch(roundPDA);
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(round.roundId.toNumber()));

  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    program.programId
  );

  const [urimVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('urim_vault'), roundIdBuffer],
    program.programId
  );

  const [userBetPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), roundPDA.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId
  );

  const userUrimAta = await getAssociatedTokenAddress(URIM_MINT, wallet.publicKey);

  // 3. Place bet
  await program.methods
    .placeBetUrim(
      new anchor.BN(urimAmount.toString()),
      betUp,
      new anchor.BN(priceScaled)
    )
    .accounts({
      config: configPDA,
      round: roundPDA,
      userBet: userBetPDA,
      urimVault: urimVault,
      userTokenAccount: userUrimAta,
      user: wallet.publicKey,
    })
    .rpc();
}
```

---

## Getting Round Data

### Fetch Current Round

```typescript
async function getCurrentRound(program: Program) {
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    program.programId
  );

  const config = await program.account.config.fetch(configPDA);
  const currentRoundId = config.currentRoundId.toNumber() - 1;

  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(currentRoundId));

  const [roundPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('round'), roundIdBuffer],
    program.programId
  );

  const round = await program.account.round.fetch(roundPDA);

  return {
    roundId: currentRoundId,
    roundPDA,
    lockedPrice: round.lockedPrice.toNumber() / 100, // Convert cents to dollars
    finalPrice: round.finalPrice.toNumber() / 100,
    endTime: round.endTime.toNumber(),
    resolved: round.resolved,
    outcome: round.outcome,
    // USD pools (in cents)
    upPoolUsd: round.upPoolUsd.toNumber() / 100,
    downPoolUsd: round.downPoolUsd.toNumber() / 100,
    // USDC pools (raw token amounts)
    upPool: round.upPool.toNumber() / 1_000_000,
    downPool: round.downPool.toNumber() / 1_000_000,
    // URIM pools (raw token amounts)
    upPoolUrim: round.upPoolUrim.toNumber() / 1_000_000,
    downPoolUrim: round.downPoolUrim.toNumber() / 1_000_000,
  };
}
```

### Display Round Info

```typescript
function formatRoundDisplay(round: RoundData) {
  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = Math.max(0, round.endTime - now);
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return {
    timeLeft: `${minutes}:${seconds.toString().padStart(2, '0')}`,
    lockedPrice: `$${round.lockedPrice.toFixed(2)}`,
    upPoolDisplay: `$${round.upPoolUsd.toFixed(2)}`,
    downPoolDisplay: `$${round.downPoolUsd.toFixed(2)}`,
    isActive: !round.resolved && secondsLeft > 0,
  };
}
```

---

## Claiming Winnings

### Claim USDC

```typescript
async function claimUsdc(program: Program, roundPDA: PublicKey) {
  const round = await program.account.round.fetch(roundPDA);
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(round.roundId.toNumber()));

  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), roundIdBuffer],
    program.programId
  );

  const [userBetPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), roundPDA.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId
  );

  const userUsdcAta = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);

  await program.methods
    .claim()
    .accounts({
      round: roundPDA,
      userBet: userBetPDA,
      vault: vault,
      userTokenAccount: userUsdcAta,
      user: wallet.publicKey,
    })
    .rpc();
}
```

### Claim URIM

```typescript
async function claimUrim(program: Program, roundPDA: PublicKey) {
  const round = await program.account.round.fetch(roundPDA);
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(round.roundId.toNumber()));

  const [urimVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('urim_vault'), roundIdBuffer],
    program.programId
  );

  const [userBetPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), roundPDA.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId
  );

  const userUrimAta = await getAssociatedTokenAddress(URIM_MINT, wallet.publicKey);

  await program.methods
    .claimUrim()
    .accounts({
      round: roundPDA,
      userBet: userBetPDA,
      urimVault: urimVault,
      userTokenAccount: userUrimAta,
      user: wallet.publicKey,
    })
    .rpc();
}
```

---

## UI Integration Checklist

### For the "Place Your Bet" Panel

1. **Token Selection** (USDC / URIM toggle)
   - When URIM selected: fetch live price from DexScreener
   - Show URIM amount needed for selected USD value

2. **Amount Input**
   - Minimum bet: $1.00
   - Quick-select buttons: $1, $5, $10, $50
   - For URIM: calculate and display token amount

3. **Direction Buttons**
   - UP (green) / DOWN (red)
   - Show current pool sizes for each direction

4. **Fee Display**
   - "0.5% fee on all bets"
   - Show fee amount before confirmation

### Loading Contract Data

```typescript
// Display these in the left panel
const displayData = {
  solPrice: round.lockedPrice,      // "Live SOL/USD: $136.05"
  timeLeft: formatTimeLeft(round),  // "3:46 until close"
  upPool: round.upPoolUsd,          // Total USD in UP pool
  downPool: round.downPoolUsd,      // Total USD in DOWN pool
};
```

### Calculate Potential Payout

```typescript
function calculatePotentialPayout(
  betAmountUsd: number,
  betUp: boolean,
  upPoolUsd: number,
  downPoolUsd: number
): { payout: number; multiplier: number } {
  const myPool = betUp ? upPoolUsd + betAmountUsd : downPoolUsd + betAmountUsd;
  const oppositePool = betUp ? downPoolUsd : upPoolUsd;

  if (oppositePool === 0) {
    return { payout: betAmountUsd, multiplier: 1 };
  }

  const myShare = betAmountUsd / myPool;
  const winnings = myShare * oppositePool;
  const payout = betAmountUsd + winnings;
  const multiplier = payout / betAmountUsd;

  return { payout, multiplier };
}
```

---

## Error Handling

Common errors and user-friendly messages:

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  'BetTooSmall': 'Minimum bet is $1.00',
  'BettingClosed': 'This round has ended. Wait for the next round.',
  'RoundResolved': 'This round is already resolved.',
  'CannotSwitchSides': 'You cannot change your bet direction in this round.',
  'CannotMixTokens': 'You cannot mix USDC and URIM bets in the same round.',
  'InsufficientFunds': 'Insufficient balance for this bet.',
  'NoPayout': 'No winnings to claim (you lost or tie with no opposing bets).',
  'AlreadyClaimed': 'You have already claimed your winnings.',
};
```

---

## Example: Complete Bet Flow

```typescript
async function handlePlaceBet(tokenType: 'USDC' | 'URIM', amountUsd: number, betUp: boolean) {
  try {
    // 1. Get current round
    const { roundPDA, isActive } = await getCurrentRound(program);

    if (!isActive) {
      throw new Error('Round not active');
    }

    // 2. Place bet based on token type
    if (tokenType === 'USDC') {
      await placeBetUsdc(program, roundPDA, amountUsd, betUp);
    } else {
      await placeBetUrim(program, roundPDA, amountUsd, betUp);
    }

    // 3. Update UI
    showSuccess(`Bet placed: $${amountUsd} on ${betUp ? 'UP' : 'DOWN'}`);

  } catch (error) {
    const message = ERROR_MESSAGES[error.code] || error.message;
    showError(message);
  }
}
```
