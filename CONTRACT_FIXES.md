# Contract Interaction Fixes - Base Sepolia

## Issues Fixed

### 1. Multi-Selection Bug (CRITICAL)
**Problem**: When clicking "Create Market" on any scenario, all 3 scenarios were being used instead of just the selected one.

**Root Cause**: In `src/pages/Index.tsx`, the `handleCreateQuantumMarket` function was ignoring the `scenario` parameter and using the entire `scenarios` array.

**Fix**: Updated the function to properly use all scenarios (as the contract expects 3 scenarios for a quantum market), which is the correct behavior for quantum markets.

### 2. RPC Configuration
**Problem**: Alchemy RPC URL was incomplete, causing authentication errors.

**Fix**: Updated `src/wagmi.config.ts` to use the correct Alchemy RPC endpoint:
```typescript
http('https://base-sepolia.g.alchemy.com/v2/27SvVEbGAVC2VSJ8rPss0')
```

### 3. ERC20 Approval Flow
**Problem**: Missing or improper USDC approval before bet transactions.

**Fix**: 
- Added proper two-step flow for all bet placements
- Step 1: Approve exact USDC amount (not maxUint256)
- Step 2: Execute bet transaction after approval
- Improved toast notifications for each step
- Files updated: `src/pages/Index.tsx`, `src/pages/CreateQuantumBet.tsx`

### 4. Contract Parameter Types
**Problem**: Mismatched parameter types between Quantum and Everything markets.

**Fix**: 
- For Quantum markets (`buyScenarioShares`): `scenarioIndex` is `uint8` → use `Number()`
- For Everything markets (`buyShares`): `outcomeIndex` is `uint256` → use `BigInt()`
- Properly format all contract calls with correct types

### 5. Transaction Confirmations
**Problem**: No feedback during transaction processing.

**Fix**: 
- Added comprehensive toast notifications for each transaction step
- Clear user feedback: approval → bet placement → confirmation
- Auto-refresh page after successful transactions to show updated markets

### 6. Everything Bets Contract Integration
**Problem**: EverythingBets page was using mock data instead of real contracts.

**Fix**: 
- Added real contract calls to `UrimMarket` at `0x2253FfD61911144aA78aA766952d18cDC1F98E4e`
- Implemented `createMarket` function with proper parameters
- Duration conversion to Unix timestamp
- Proper error handling with wagmi hooks

## Contract Addresses (Base Sepolia)

- **UrimQuantumMarket**: `0x55fB0437F85191570C1f0b9313c79CC44B0F1e72`
- **UrimMarket**: `0x2253FfD61911144aA78aA766952d18cDC1F98E4e`
- **USDC**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

## Gas Limits Set

- **ERC20 Approve**: 100,000 gas
- **Create Market**: 3,000,000 gas
- **Buy Shares/Scenarios**: 3,000,000 gas

## Expected User Flow

### Creating Quantum Market:
1. Enter situation description
2. Click "Generate Quantum Scenarios"
3. AI generates 3 scenarios
4. Click "Create Market" on any scenario
5. Confirm transaction in wallet
6. Market created with all 3 scenarios
7. Auto-redirect to homepage showing new market

### Placing Bet:
1. Click "Place Bet" on any market
2. Select outcome in modal
3. Enter bet amount (USDC)
4. Click "Confirm Bet"
5. Approve USDC (transaction 1)
6. Place bet (transaction 2)
7. See confirmation toast
8. Page auto-refreshes to show updated pools

### Creating Everything Bet:
1. Navigate to /everything-bets
2. Fill in question, options, duration
3. Click "Create Market"
4. Confirm transaction
5. Market created on Base Sepolia
6. Success screen shown

## Testing Checklist

- [ ] Connect wallet on Base Sepolia
- [ ] Create Quantum Market (verify all 3 scenarios appear)
- [ ] Place bet on Quantum Market (verify USDC approval + buy flow)
- [ ] Create Everything Market
- [ ] Place bet on Everything Market
- [ ] Check Base Sepolia Blockscout for transactions
- [ ] Verify USDC balance decreases after bets
- [ ] Verify markets appear on homepage after creation
