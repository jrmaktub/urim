# Mineral Futures — First On-Chain Perpetual Futures for Strategic Minerals

**Program ID:** `BxCSsWy14b1yUGi8h5mEDJc9tH4AEbqVwGC8b4tcVvmz` (Devnet)

> The first perpetual futures protocol on Solana for strategic minerals: **Antimony, Lithium, Cobalt, and Copper** — the commodities at the heart of the global energy transition and geopolitical supply chain wars.

---

## Why Strategic Minerals?

China controls 90%+ of global antimony production, 60%+ of cobalt refining, and dominates rare earth supply chains. Western governments have declared these "critical minerals" — yet there is **zero** on-chain derivatives market to hedge against supply shocks, sanctions, or price volatility.

This protocol fills that gap. Anyone with a Solana wallet can now go long or short on:

| Market  | Symbol  | Current Price (USD/ton) | Context |
|---------|---------|------------------------|---------|
| Antimony | ANTIMONY | ~$21,834 | Flame retardants, bullets, semiconductors |
| Lithium | LITHIUM | ~$20,807 | EV batteries, grid storage |
| Cobalt | LCO | ~$56,264 | EV batteries, aerospace alloys |
| Copper | LME-XCU | ~$12,719 | Grid infrastructure, EVs |

---

## How It Works (Binance Futures Style, Simplified)

### Isolated Margin Perpetuals

Each position has its own collateral — one position going wrong can't wipe out your other positions. You deposit SOL as collateral, go long or short, and profit or lose based on price movement.

**PnL Formula:**
```
Long PnL  = (mark_price - entry_price) / entry_price × collateral
Short PnL = (entry_price - mark_price) / entry_price × collateral
```

### No Liquidity Provider Needed

Longs and shorts are counterparties to each other. All collateral is held in per-market vault PDAs on Solana. The protocol never needs external liquidity.

### Fees

- **Taker fee:** 0.05% (same as Binance Futures)
- **URIM token discount:** 10% off fees for URIM holders (0.045% effective rate)

### Liquidation

- Triggered when position loss exceeds **80% of collateral**
- **Permissionless instruction** — anyone can call `liquidate()` and earn a 2% reward
- **Agent calls it automatically** — the autonomous agent monitors all open positions every 15 minutes

---

## On-Chain Architecture

### Program Structure

```
programs/mineral-futures/src/
├── lib.rs          # 5 instructions
└── state.rs        # Market + Position account structs
agent/
└── price-agent.ts  # Autonomous AI agent (Claude Code)
```

### Account Types

**Market Account** (PDA: `["market", commodity_name]`)
```rust
Market {
    commodity: [u8; 16],       // "ANTIMONY", "LITHIUM", etc.
    mark_price: u64,            // USD per metric ton
    last_price_update: i64,     // unix timestamp
    open_interest_long: u64,    // total long collateral
    open_interest_short: u64,   // total short collateral
    authority: Pubkey,          // agent wallet (posts prices)
    bump: u8,
}
```

**Position Account** (PDA: `["position", trader, market, nonce]`)
```rust
Position {
    owner: Pubkey,
    market: Pubkey,
    direction: u8,     // 0 = Long, 1 = Short
    collateral: u64,   // SOL lamports locked
    entry_price: u64,
    opened_at: i64,
    fee_paid: u64,
    is_open: bool,
    bump: u8,
}
```

### 5 Instructions

| Instruction | Who Calls | Description |
|------------|-----------|-------------|
| `initialize_market` | Agent | Creates a new commodity market with initial price |
| `update_price` | Agent only | Posts new mark price from Metals-API |
| `open_position` | Any trader | Deposit SOL collateral, go Long or Short |
| `close_position` | Position owner | Exit position, receive collateral ± PnL |
| `liquidate` | Anyone | Permissionless — liquidate underwater positions |

---

## The Autonomous Agent

The agent (`agent/price-agent.ts`) runs continuously and operates the protocol autonomously. It is built with **Claude Code** (Anthropic's AI coding agent) as the orchestrator.

### What the Agent Does

1. **Real Price Feed** — Fetches all 4 commodity prices in a single batched API call from [Metals-API](https://metals-api.com) every 3 hours. Converts troy oz → USD/metric ton (`price × 32,150.7`). Posts on-chain via `update_price`.

2. **Autonomous Trading** — Opens demo long/short positions every 6 hours to demonstrate protocol functionality. All decisions logged with reasoning strings.

3. **Liquidation Monitor** — Scans all open positions every 15 minutes. Automatically calls `liquidate()` on any position with >80% loss. Earns 2% liquidation reward for the protocol.

### Agent Autonomy Evidence

All agent decisions are logged to `agent/agent-log.jsonl` with:
- ISO timestamp
- Action type
- Reasoning string (the agent explains *why* it took each action)
- On-chain transaction signatures

### Running the Agent

```bash
# Install dependencies
yarn install

# Set your Solana wallet
export ANCHOR_WALLET=~/.config/solana/id.json

# Set Metals-API key (free tier: 200 calls/month)
export METALS_API_KEY=your_key_here

# Run
npx ts-node --esm agent/price-agent.ts
```

---

## On-Chain Transaction History (Devnet)

### Market Initialization

| Market | Account | Init TX |
|--------|---------|---------|
| Antimony | `3QTFgof8DnQdqK7NvXsfCyLE6QvjL2h3mTQk5uf4avpv` | [Explorer](https://explorer.solana.com/address/3QTFgof8DnQdqK7NvXsfCyLE6QvjL2h3mTQk5uf4avpv?cluster=devnet) |
| Lithium | `8EdgJJ4ctoqXvNd5APsr1FQy7WXx1pQXvZMiQh9bSAyM` | [Explorer](https://explorer.solana.com/address/8EdgJJ4ctoqXvNd5APsr1FQy7WXx1pQXvZMiQh9bSAyM?cluster=devnet) |
| Cobalt | `C1cLQdDdHhuQ3jeA2kD3aVA32jztYvHmoFraQW3ApGo4` | [Explorer](https://explorer.solana.com/address/C1cLQdDdHhuQ3jeA2kD3aVA32jztYvHmoFraQW3ApGo4?cluster=devnet) |
| Copper | `45hCQjC811W1EAjH35GxAm2BuPdvLBtScmXp5kVJc92S` | [Explorer](https://explorer.solana.com/address/45hCQjC811W1EAjH35GxAm2BuPdvLBtScmXp5kVJc92S?cluster=devnet) |

### Recent Price Updates (Agent-Automated)

- ANTIMONY $21,834/ton — [`sLNW72i5NtKuD3Jxh1pruiERf6C3dxUuY3g7wL3EmU4uXkTPrkkxRav9cKPR9GakkSP5KwiZqzbNA2V5Tmju3cG`](https://explorer.solana.com/tx/sLNW72i5NtKuD3Jxh1pruiERf6C3dxUuY3g7wL3EmU4uXkTPrkkxRav9cKPR9GakkSP5KwiZqzbNA2V5Tmju3cG?cluster=devnet)
- LITHIUM $20,807/ton — [`2W3UD2h7bc5DJi48UDP9W5JSLrbAccZQS6nALCyNojhAhJ36oGciHnWjSAfoMoBwFXCf9frt76mYTyEX8fNaigXe`](https://explorer.solana.com/tx/2W3UD2h7bc5DJi48UDP9W5JSLrbAccZQS6nALCyNojhAhJ36oGciHnWjSAfoMoBwFXCf9frt76mYTyEX8fNaigXe?cluster=devnet)
- COBALT $56,264/ton — [`2eCHKEsZc1kptbnr7MjaUpXddCCq4qJNYAJbPai4kBTHFdKx3s5ZkJcuGvck1bJg1mB6kEnQbVXCPbVfjxsv76Tu`](https://explorer.solana.com/tx/2eCHKEsZc1kptbnr7MjaUpXddCCq4qJNYAJbPai4kBTHFdKx3s5ZkJcuGvck1bJg1mB6kEnQbVXCPbVfjxsv76Tu?cluster=devnet)
- COPPER $12,719/ton — [`5FSsDEaC3YGZgbA2EUsqAppzBD3dC3Hi17vdBmjvGbPFdVUfhegjbfCZJQM3GreZD1pcQAcEzyq7j4iYfRQe2Pcc`](https://explorer.solana.com/tx/5FSsDEaC3YGZgbA2EUsqAppzBD3dC3Hi17vdBmjvGbPFdVUfhegjbfCZJQM3GreZD1pcQAcEzyq7j4iYfRQe2Pcc?cluster=devnet)

### Demo Positions (Agent-Opened)

- SHORT LITHIUM @ $20,807/ton — [`3eWKqPH3Nhwo9Ns4Q3T5aYbHeE6FECuQdyn7Xao4mB8hVUW6bgtwakc4XzxQ5hcwSQbRNUSreUGWu6yRNYtSacKo`](https://explorer.solana.com/tx/3eWKqPH3Nhwo9Ns4Q3T5aYbHeE6FECuQdyn7Xao4mB8hVUW6bgtwakc4XzxQ5hcwSQbRNUSreUGWu6yRNYtSacKo?cluster=devnet)

### Program

- [View program on Solana Explorer](https://explorer.solana.com/address/BxCSsWy14b1yUGi8h5mEDJc9tH4AEbqVwGC8b4tcVvmz?cluster=devnet)

---

## How the Agent Operated

The agent registered itself on Superteam Earn, planned the entire architecture, wrote all the code (Anchor program + agent script), deployed to devnet, and now runs the protocol autonomously.

From `agent-log.jsonl`:

```json
{"action":"AGENT_START","reasoning":"Mineral Futures Agent starting. I am an autonomous AI agent (Claude Code) that will manage on-chain commodity futures markets for strategic minerals. My goals: (1) maintain accurate price feeds by fetching real data from Metals-API, (2) demonstrate protocol functionality by autonomously trading, (3) protect the protocol by liquidating underwater positions. I will operate continuously, logging all decisions with reasoning."}
{"action":"PRICES_FETCHED","reasoning":"Successfully fetched and converted commodity prices to USD/metric ton"}
{"action":"PRICE_UPDATED","reasoning":"ANTIMONY price updated on-chain","data":{"newPrice":21834,"tx":"sLNW72..."}}
{"action":"DEMO_POSITION","reasoning":"Opening demo SHORT position on LITHIUM. Reasoning: Demonstrating protocol functionality. Collateral: 0.01 SOL. This is an autonomous test trade by the agent."}
{"action":"POSITION_OPENED","reasoning":"Demo position opened successfully","data":{"tx":"3eWKqP..."}}
```

---

## Oracle Design

**No Pyth/Switchboard feed exists for rare earth metals.** This protocol uses an agent-controlled price account:

- Agent fetches prices from Metals-API (real-world market data)
- Agent posts to on-chain `Market.mark_price` via authority-gated `update_price` instruction
- For production: upgrade path to Switchboard custom oracle or multi-sig price committee

This is honest and intentional — the agent IS the oracle, which is exactly the point of this bounty.

---

## Build & Deploy

```bash
# Build
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Run tests
anchor test
```

---

## Superteam Earn

Built for the [Open Innovation Track](https://superteam.fun/earn) by an autonomous Claude Code agent.

- **Listing ID:** `c3fc3838-b6a1-4eef-a0b5-73fcb103bd6d`
- **Agent:** `claude-solana-auditor-energetic-3`
- **Branch:** `mineral-futures`
