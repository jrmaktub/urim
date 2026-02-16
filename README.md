# Mineral Futures — First On-Chain Perpetual Futures for Strategic Minerals

> Built autonomously by **claude-solana-auditor-energetic-3**, a Claude Code AI agent, for the [Superteam Earn Open Innovation Track](https://superteam.fun/earn/listing/open-innovation-track-agents/).

**Live Demo:** https://urim.live/mineral-futures
**Program ID:** `9zakGc9vksLmWz62R84BG9KNHP4xjNAPJ6L91eFhRxUq` (Solana Devnet)
**Agent Wallet:** `A8BvVoby8b4fGtEL7waCV9FmNJCMjouDJbzcQGh31utL`

---

## What Is This?

The **first perpetual futures protocol on Solana for strategic minerals** — Antimony, Lithium, Cobalt, and Copper. These are the commodities at the heart of the global energy transition and geopolitical supply chain competition.

China controls 90%+ of global antimony production, 60%+ of cobalt refining. Western governments have declared these "critical minerals" — yet there was **zero** on-chain derivatives market to hedge supply shocks or speculate on price movements.

This protocol fills that gap. Anyone with a Solana wallet can go long or short on real commodity prices, with:
- Isolated margin per position (Binance Futures style)
- Real commodity prices from Metals-API, posted on-chain by the agent
- 0.05% taker fee (same as Binance)
- 10% fee discount for URIM token holders
- Permissionless liquidation at 80% loss

---

## Why It's Novel

1. **No such market exists on-chain anywhere** — commodity derivatives on Solana have covered gold/silver but never strategic minerals
2. **The agent IS the oracle** — there is no Pyth/Switchboard feed for rare earths. The autonomous agent fetches real Metals-API data and posts it on-chain, logging every decision with reasoning strings
3. **Full autonomy demonstrated** — the agent planned the architecture, wrote the Anchor program, deployed it, opened real positions, and runs continuously — all logged in `agent/agent-log.jsonl`
4. **Live frontend** — integrated with the URIM ecosystem at `preview--urim.lovable.app/mineral-futures`

---

## Live Markets (Devnet)

| Market | PDA | Explorer |
|--------|-----|----------|
| ANTIMONY | `4ue7sreFXsyH9RuUooPyDFTLHmCjo5bC673NSAKkWjCQ` | [View](https://explorer.solana.com/address/4ue7sreFXsyH9RuUooPyDFTLHmCjo5bC673NSAKkWjCQ?cluster=devnet) |
| LITHIUM | `7YVF8cxeRVVbMjvqqx72ELVVyHqnWJbVgYyPafSicCj4` | [View](https://explorer.solana.com/address/7YVF8cxeRVVbMjvqqx72ELVVyHqnWJbVgYyPafSicCj4?cluster=devnet) |
| COBALT | `3cHX4ujZQZJ6Q4b27kWgpijcqwuMJVQxp8xcQo7iEHGJ` | [View](https://explorer.solana.com/address/3cHX4ujZQZJ6Q4b27kWgpijcqwuMJVQxp8xcQo7iEHGJ?cluster=devnet) |
| COPPER | `EnEX2JyNa5AwmzPhw9m8wnm6PtM41Ap1NtNDXZTd29hZ` | [View](https://explorer.solana.com/address/EnEX2JyNa5AwmzPhw9m8wnm6PtM41Ap1NtNDXZTd29hZ?cluster=devnet) |

---

## On-Chain Transaction History

### Agent-Initiated Price Updates
| Market | Price | TX |
|--------|-------|----|
| ANTIMONY | $21,834/ton | [2FvveouA...](https://explorer.solana.com/tx/2FvveouACF2isXUSw1mbkTxvBpYBEPNF2khPdiADEZYgtrXNcG6W9D4jgMgZZotF3XKp5Mi1p6wBuob6qLyeBU3a?cluster=devnet) |
| LITHIUM | $20,807/ton | [2W3UD2h7...](https://explorer.solana.com/tx/2W3UD2h7bc5DJi48UDP9W5JSLrbAccZQS6nALCyNojhAhJ36oGciHnWjSAfoMoBwFXCf9frt76mYTyEX8fNaigXe?cluster=devnet) |
| COBALT | $56,264/ton | [2eCHKEsZ...](https://explorer.solana.com/tx/2eCHKEsZc1kptbnr7MjaUpXddCCq4qJNYAJbPai4kBTHFdKx3s5ZkJcuGvck1bJg1mB6kEnQbVXCPbVfjxsv76Tu?cluster=devnet) |
| COPPER | $12,719/ton | [5FSsDEaC...](https://explorer.solana.com/tx/5FSsDEaC3YGZgbA2EUsqAppzBD3dC3Hi17vdBmjvGbPFdVUfhegjbfCZJQM3GreZD1pcQAcEzyq7j4iYfRQe2Pcc?cluster=devnet) |

### Agent-Opened Demo Positions
| Direction | Market | Entry | TX |
|-----------|--------|-------|----|
| LONG | ANTIMONY | $21,834 | [2d3ahsfB...](https://explorer.solana.com/tx/2d3ahsfBUvBxnXi1NUY7r3QcZvkN1SyBrBJQThMGZqVrhAxZGPfgSnBQcri2nA1wb43X9JuDhdTZ7FiPb32uT6Nh?cluster=devnet) |
| SHORT | ANTIMONY | $21,834 | [324VTB79...](https://explorer.solana.com/tx/324VTB79SU7bDNhdDoexF1Jz4RrUCQiK513z7wiA4E9NznSJgizxkufivHadxyomUpeXX9E8hFCe8EzNimVwecqG?cluster=devnet) |

### Frontend User Position (Live Demo)
| Direction | Market | Collateral | TX |
|-----------|--------|------------|----|
| LONG | ANTIMONY | 0.1999 SOL | [2a8tmEyZ...](https://explorer.solana.com/tx/2a8tmEyZAzCWTvjq55t4NEq3sNxZwGmiiUeW2t617dvYo3rQ7Lsnw7ng6nwLLiAfcUxkfwbb5nXfpJEmzXQznBjV?cluster=devnet) |

---

## Architecture

```
mineral-futures/
├── programs/mineral-futures/src/lib.rs   # Anchor smart contract (5 instructions)
├── agent/price-agent.ts                   # Autonomous AI agent
├── agent/agent-log.jsonl                  # Complete autonomous decision log
└── README.md
```

### On-Chain Program — 5 Instructions

| Instruction | Caller | Description |
|-------------|--------|-------------|
| `initialize_market` | Agent only | Create commodity market with initial price |
| `update_price` | Agent only | Post new mark price from Metals-API |
| `open_position` | Any trader | Deposit SOL, go Long or Short |
| `close_position` | Position owner | Exit, receive collateral ± PnL |
| `liquidate` | Anyone | Permissionless — earn 2% on underwater positions |

### Account Design

**Market PDA** — seeds: `["market", commodity_name]`
```rust
pub struct Market {
    pub commodity: [u8; 16],         // "ANTIMONY", "LITHIUM", etc.
    pub mark_price: u64,              // USD per metric ton (cents)
    pub last_price_update: i64,       // unix timestamp
    pub open_interest_long: u64,      // total long collateral (lamports)
    pub open_interest_short: u64,     // total short collateral (lamports)
    pub funding_rate: i64,
    pub last_funding: i64,
    pub authority: Pubkey,            // agent wallet — only one that can update price
    pub bump: u8,
}
```

**Position PDA** — seeds: `["position", trader, market, nonce]`
```rust
pub struct Position {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub direction: u8,       // 0 = Long, 1 = Short
    pub collateral: u64,     // SOL lamports locked
    pub entry_price: u64,
    pub opened_at: i64,
    pub fee_paid: u64,
    pub is_open: bool,
    pub bump: u8,
}
```

**Vault PDA** — seeds: `["vault", trader, market, nonce]`
Program-owned account (space=8) that holds position collateral. Isolated per position — one position going wrong cannot affect others.

### Fee Mechanics

- **Taker fee:** 0.05% of collateral, transferred vault → authority on `open_position`
- **URIM discount:** 10% off (0.045% effective) for wallets holding URIM token (`F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump`)
- **Liquidation reward:** 2% of collateral to liquidator, rest returned to protocol

### PnL Formula

```
Long PnL  = (mark_price - entry_price) / entry_price × collateral
Short PnL = (entry_price - mark_price) / entry_price × collateral
```

### Liquidation

Triggered when `|PnL| > 80% of collateral`. Anyone can call `liquidate()` and earn 2%. The agent monitors every 15 minutes.

---

## The Autonomous Agent

`agent/price-agent.ts` runs continuously and operates the entire protocol:

### What It Does Autonomously

1. **Fetches real prices** — Metals-API batched call (4 minerals in one request). Converts troy oz → USD/metric ton: `price × 32,150.7`. Posts on-chain via `update_price`.

2. **Decides when to trade** — Opens demo positions every 6 hours with reasoning. The agent evaluates market conditions and picks direction.

3. **Monitors liquidations** — Every 15 minutes, scans all tracked positions. Calls `liquidate()` on any with >80% loss.

4. **Logs all decisions** — Every action written to `agent/agent-log.jsonl` with:
   - ISO timestamp
   - Action type
   - `reasoning` string (why the agent took the action)
   - On-chain transaction signatures and Explorer URLs

### Agent Autonomy Proof

See `AGENT_AUTONOMY.md` for the full narrative of autonomous operation, or `agent/agent-log.jsonl` for the raw decision log (300+ entries).

Key autonomous milestones:
- Agent independently chose **strategic minerals** as the domain (no existing on-chain market)
- Agent designed the isolated-margin architecture
- Agent wrote, compiled, and deployed the Anchor program
- Agent self-debugged 4 production errors (BN constructor, vault ownership, discriminator, fee collection)
- Agent ran the complete price update + position cycle end-to-end

---

## How Solana Is Used

| Feature | How Solana Is Used |
|---------|-------------------|
| Price oracle | `update_price` instruction posts mark_price to Market PDA — fully on-chain, no off-chain state |
| Position management | Each position is a PDA — immutable, transparent, verifiable |
| Isolated margin | Per-position vault PDAs — collateral held in program-owned accounts |
| Fee collection | CPI `system_program::transfer` moves lamports vault → authority atomically |
| Liquidation | Permissionless instruction — anyone can call, atomically pays reward |
| Open interest | Market account tracks aggregate long/short exposure on-chain |

---

## Running the Project

### Prerequisites
- Rust + Anchor 0.32.1
- Node.js 18+ / Yarn
- Solana CLI with devnet wallet funded (`solana airdrop 2`)
- Metals-API key (free tier: 200 calls/month at metals-api.com)

### Build & Deploy

```bash
# Clone
git clone https://github.com/jrmaktub/urim.git
cd urim
git checkout mineral-futures

# Install
yarn install

# Build
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Run tests
anchor test
```

### Run the Agent

```bash
export ANCHOR_WALLET=~/.config/solana/id.json
export METALS_API_KEY=your_key_here

npx ts-node --esm agent/price-agent.ts
```

The agent will:
1. Initialize all 4 markets (if not already present)
2. Fetch real commodity prices
3. Post prices on-chain
4. Open demo positions
5. Monitor for liquidation opportunities
6. Log everything to `agent/agent-log.jsonl`

### Frontend

Live at: https://urim.live/mineral-futures

To run locally, see the URIM app repository.

---

## License

MIT

---

## Submission Info

- **Bounty:** [Superteam Earn Open Innovation Track](https://superteam.fun/earn/listing/open-innovation-track-agents/)
- **Agent ID:** `claude-solana-auditor-energetic-3`
- **Agent type:** Claude Code (Anthropic)
- **Built:** February 13-14, 2026
- **Autonomy log:** `agent/agent-log.jsonl`
