# Agent Autonomy Report — Mineral Futures

**Agent:** `claude-solana-auditor-energetic-3`
**Agent Type:** Claude Code (Anthropic)
**Operating Period:** February 13–14, 2026
**Full Decision Log:** `agent/agent-log.jsonl`

---

## Overview

This document describes how the autonomous AI agent designed, built, deployed, and operated the Mineral Futures protocol on Solana. All actions were taken by the agent with minimal human direction — the operator provided a general goal ("build something for the Open Innovation bounty") and the agent chose the domain, designed the system, and executed everything.

---

## Phase 1: Autonomous Domain Selection

The agent was given the Superteam Earn Open Innovation Track brief with no specific product requirement. The agent autonomously:

1. **Researched the existing Solana ecosystem** — identified that DeFi derivatives existed for crypto and gold/silver but **zero on-chain market existed for strategic minerals** (antimony, lithium, cobalt, rare earths)
2. **Identified the geopolitical angle** — China's supply chain dominance over critical minerals creates genuine hedging demand that no existing protocol serves
3. **Chose perpetual futures** as the mechanism — familiar UX (Binance Futures style) with isolated margin for safety
4. **Named the protocol** — "Mineral Futures" with the tagline "First on-chain perpetual futures for strategic minerals"

This entire domain selection was autonomous. The operator did not specify what to build.

---

## Phase 2: Architecture Design

The agent designed the full technical architecture:

### Anchor Program Design Decisions (Agent-Made)
- **Isolated margin over cross-margin** — safer for users, prevents cascade liquidations
- **Per-position vault PDAs** — seeds `["vault", trader, market, nonce]` gives each position its own collateral account
- **Agent-controlled oracle** — no Pyth/Switchboard feed exists for rare earth metals; agent acts as trusted price poster
- **Permissionless liquidation** — anyone can liquidate, 2% reward incentivizes bots
- **URIM integration** — 10% fee discount for URIM token holders to drive ecosystem synergy

### Account Architecture (Agent-Designed)
```
Market PDA     ["market", commodity]           — price + open interest
Position PDA   ["position", trader, market, nonce] — trade state
Vault PDA      ["vault", trader, market, nonce]    — collateral (program-owned)
```

---

## Phase 3: Development

The agent wrote all code:

### Programs Written by Agent
- `programs/mineral-futures/src/lib.rs` — Full Anchor program with 5 instructions
- `agent/price-agent.ts` — Autonomous agent script

### Compile & Deploy Cycle
The agent ran the full build/deploy cycle autonomously:
```
anchor build → anchor deploy → test → debug → redeploy
```

### Bugs Self-Diagnosed and Fixed

| Error | Root Cause | Agent Fix |
|-------|-----------|-----------|
| `anchor.BN is not a constructor` | ESM import issue in ts-node | Changed to `import BN from "bn.js"` |
| `instruction spent from the balance of an account it does not own` | Vault was SystemProgram-owned, couldn't mutate lamports | Added `VaultAccount {}` struct with `space=8`, making vault program-owned |
| `range start index 8 out of range for slice of length 0` | `space=0` has no discriminator, Anchor panics deserializing | Changed to `space=8` for discriminator |
| `DeclaredProgramIdMismatch` | New deployment produced new program ID | Updated `declare_id!` and `Anchor.toml` |
| `ConstraintMut on authority` | Frontend missing authority account in TX | Added authority as writable in account keys |

All 5 bugs were diagnosed from error messages alone — the agent read the logs, identified root causes, and shipped fixes.

---

## Phase 4: Autonomous Operation

Once deployed, the agent ran the protocol:

### Agent Log Excerpt (from `agent/agent-log.jsonl`)

```json
{"timestamp":"2026-02-13T21:00:28.515Z","action":"AGENT_START",
  "reasoning":"Mineral Futures Agent starting. I am an autonomous AI agent (Claude Code) that will manage on-chain commodity futures markets for strategic minerals. My goals: (1) maintain accurate price feeds by fetching real data from Metals-API, (2) demonstrate protocol functionality by autonomously trading, (3) protect the protocol by liquidating underwater positions.",
  "data":{"programId":"BxCSsWy14b1yUGi8h5mEDJc9tH4AEbqVwGC8b4tcVvmz"}}

{"timestamp":"2026-02-13T21:00:28.956Z","action":"PRICES_FETCHED",
  "reasoning":"Successfully fetched and converted commodity prices to USD/metric ton",
  "data":{"ANTIMONY":21834,"LITHIUM":20807,"COBALT":56264,"COPPER":12719}}

{"timestamp":"2026-02-13T21:00:29.614Z","action":"MARKET_CREATE",
  "reasoning":"Initializing ANTIMONY market. Reasoning: This is a strategically important mineral with significant geopolitical supply chain risk. Current price: $21,834/ton.",
  "data":{"commodity":"ANTIMONY","initialPrice":21834}}

{"timestamp":"2026-02-13T21:00:30.883Z","action":"MARKET_CREATED",
  "reasoning":"Market ANTIMONY initialized on-chain",
  "data":{"tx":"56yxia27KV24GvNSDTaPSmvr65aGyiKzQjfE1CuM5qMgFCgY8giAQhfhfj9JhhRtaWqWkje2Mq15WXtGBU6nHdk4"}}
```

### Autonomous Actions Taken

| Action | Count | Evidence |
|--------|-------|---------|
| Markets initialized | 4 | TX signatures in log |
| Price updates posted on-chain | 8+ | TX signatures in log |
| Demo positions opened | 2 (LONG + SHORT ANTIMONY) | TX signatures below |
| URIM balance checks | Automated per cycle | Log entries |
| Liquidation scans | Every 15 min | Log entries |
| Self-debug cycles | 5 | Error + fix log entries |

### On-Chain Evidence

**Market Creation (Agent):**
- ANTIMONY: `56yxia27KV24GvNSDTaPSmvr65aGyiKzQjfE1CuM5qMgFCgY8giAQhfhfj9JhhRtaWqWkje2Mq15WXtGBU6nHdk4`
- LITHIUM: `4wmUMzZGBKYSU9SBPKVnraCG6sGWQL6yeKEzXZDVx8gTNgnEsUDbLzrJKgNLLDSoQ5iscPjp6wLxmgGw8Dy8xW2u`
- COBALT: `DTL1dVfUqQn9aAAsQGTDkwQXzek2N5D2jopSaimKBcdq7dQSQ9vSe1HrD9L9aZDSEnZ4Fb8BURwekahgaf3bLLX`
- COPPER: `31AjhDTLs3kU7XmsCRqUWXaVEK1nbFWoWniEMLPtrKsFhVctAeoPg8814egL9G27mWvpMDJZcpgYmj5kFwuA291m`

**Price Updates (Agent):**
- ANTIMONY $21,834: `2FvveouACF2isXUSw1mbkTxvBpYBEPNF2khPdiADEZYgtrXNcG6W9D4jgMgZZotF3XKp5Mi1p6wBuob6qLyeBU3a`
- LITHIUM $20,807: `2W3UD2h7bc5DJi48UDP9W5JSLrbAccZQS6nALCyNojhAhJ36oGciHnWjSAfoMoBwFXCf9frt76mYTyEX8fNaigXe`
- COBALT $56,264: `2eCHKEsZc1kptbnr7MjaUpXddCCq4qJNYAJbPai4kBTHFdKx3s5ZkJcuGvck1bJg1mB6kEnQbVXCPbVfjxsv76Tu`
- COPPER $12,719: `5FSsDEaC3YGZgbA2EUsqAppzBD3dC3Hi17vdBmjvGbPFdVUfhegjbfCZJQM3GreZD1pcQAcEzyq7j4iYfRQe2Pcc`

**Demo Positions (Agent):**
- LONG ANTIMONY: `2d3ahsfBUvBxnXi1NUY7r3QcZvkN1SyBrBJQThMGZqVrhAxZGPfgSnBQcri2nA1wb43X9JuDhdTZ7FiPb32uT6Nh`
- SHORT ANTIMONY: `324VTB79SU7bDNhdDoexF1Jz4RrUCQiK513z7wiA4E9NznSJgizxkufivHadxyomUpeXX9E8hFCe8EzNimVwecqG`

**Frontend User Position (Live Demo — confirms public accessibility):**
- LONG ANTIMONY 0.1999 SOL: `2a8tmEyZAzCWTvjq55t4NEq3sNxZwGmiiUeW2t617dvYo3rQ7Lsnw7ng6nwLLiAfcUxkfwbb5nXfpJEmzXQznBjV`

---

## Phase 5: Frontend Integration

The agent generated the complete Lovable frontend prompt, specifying:
- Exact on-chain account structure for reading prices
- Raw transaction encoding (no Anchor bundler dependency)
- Correct PDA derivation logic
- Account keys and writable flags for each instruction

The frontend went from zero to live at `preview--urim.lovable.app/mineral-futures` with fully working position opening.

---

## Human Involvement Summary

| Task | Human | Agent |
|------|-------|-------|
| Choose what to build | — | ✅ Agent chose strategic minerals |
| Design architecture | — | ✅ Agent designed all PDAs, instructions |
| Write Anchor program | — | ✅ Agent wrote all Rust code |
| Compile & deploy | — | ✅ Agent ran anchor build/deploy |
| Debug errors | — | ✅ Agent diagnosed and fixed 5 bugs |
| Run price oracle | — | ✅ Agent fetches + posts prices |
| Open demo positions | — | ✅ Agent opened LONG + SHORT |
| Write frontend prompt | — | ✅ Agent specified all integration details |
| Provide SOL for fees | ✅ Operator funded wallet | — |
| Point to bounty listing | ✅ Operator shared URL | — |

The operator's role was minimal: fund a devnet wallet and point the agent at the bounty. Everything else was autonomous.

---

## Verification

All transactions can be verified on Solana Explorer (devnet):
- Program: https://explorer.solana.com/address/9zakGc9vksLmWz62R84BG9KNHP4xjNAPJ6L91eFhRxUq?cluster=devnet
- Raw decision log: `agent/agent-log.jsonl` in this repository
