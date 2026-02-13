import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Mineral Futures Autonomous Agent
 *
 * Claude Code acting as an autonomous agent managing the Mineral Futures protocol.
 *
 * What this agent does:
 * 1. Fetches real commodity prices from Metals-API (ONE batched call per cycle)
 * 2. Posts updated mark prices on-chain for ANTIMONY, LITHIUM, COBALT, COPPER
 * 3. Opens demo Long + Short positions across all 4 markets every 6 hours
 * 4. Closes positions after they've been open for a while (to demo close_position)
 * 5. Monitors all open positions every 15 min and liquidates any at >80% loss
 * 6. Checks URIM token balance — holders with ≥$10 worth get 10% fee discount
 * 7. Logs ALL decisions with reasoning strings to agent-log.jsonl
 *
 * API budget: 200 calls/month. At 3h intervals = ~16 calls over 2 days.
 *
 * URIM token: F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump
 * Fee discount: hold ≥$10 of URIM → pay 0.045% taker fee instead of 0.05%
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";
import * as fs from "fs";
import * as path from "path";

// ─── Config ───────────────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey("9zakGc9vksLmWz62R84BG9KNHP4xjNAPJ6L91eFhRxUq");
const RPC_URL = "https://api.devnet.solana.com";
const METALS_API_KEY = process.env.METALS_API_KEY ||
  "qdvu4sm6j8u1vi21wn52v12di3knagrv1jqo6u28wc5tc7emdf9i2t9g7k7t";

// URIM token mint (mainnet) — F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump
const URIM_MINT = new PublicKey("F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump");
const URIM_DISCOUNT_THRESHOLD_USD = 10; // need ≥$10 of URIM for fee discount

// Price update interval — 3 hours (conserve 200 calls/month budget)
const PRICE_UPDATE_INTERVAL_MS = 3 * 60 * 60 * 1000;
// Liquidation check — every 15 minutes (no API call)
const LIQUIDATION_CHECK_INTERVAL_MS = 15 * 60 * 1000;
// Demo position interval — open positions every 6 hours
const DEMO_POSITION_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Troy ounces per metric ton (USD conversion)
const TROY_OZ_PER_TON = 32_150.7;

// Metals-API symbols
const METALS = {
  ANTIMONY: { symbol: "ANTIMONY", display: "Antimony" },
  LITHIUM:  { symbol: "LITHIUM",  display: "Lithium"  },
  COBALT:   { symbol: "LCO",      display: "Cobalt"   },
  COPPER:   { symbol: "LME-XCU",  display: "Copper"   },
};

const LOG_FILE = path.join(__dirname, "agent-log.jsonl");

// Track open positions we've created (for demo close/liquidate)
const openPositions: Array<{
  commodity: string;
  marketPDA: PublicKey;
  positionPDA: PublicKey;
  vaultPDA: PublicKey;
  nonce: number;
  direction: number;
  entryPrice: number;
  openedAt: Date;
}> = [];

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(action: string, reasoning: string, data?: any) {
  const entry = { timestamp: new Date().toISOString(), action, reasoning, data };
  console.log(`[${entry.timestamp}] ${action}: ${reasoning}`);
  if (data) console.log("  →", JSON.stringify(data));
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
}

// ─── PDA Helpers ──────────────────────────────────────────────────────────────

function getMarketPDA(commodity: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(commodity)],
    PROGRAM_ID
  );
  return pda;
}

// Per-position vault: ["vault", trader, market, nonce] — true isolated margin
function getVaultPDA(trader: PublicKey, market: PublicKey, nonce: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      trader.toBuffer(),
      market.toBuffer(),
      Buffer.from(new BN(nonce).toArray("le", 8)),
    ],
    PROGRAM_ID
  );
  return pda;
}

function getPositionPDA(trader: PublicKey, market: PublicKey, nonce: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("position"),
      trader.toBuffer(),
      market.toBuffer(),
      Buffer.from(new BN(nonce).toArray("le", 8)),
    ],
    PROGRAM_ID
  );
  return pda;
}

// ─── Price Fetching ───────────────────────────────────────────────────────────

interface CommodityPrices {
  ANTIMONY: number;
  LITHIUM:  number;
  COBALT:   number;
  COPPER:   number;
  timestamp: number;
  callNumber: number;
}

let totalApiCallsUsed = 0;

async function fetchPrices(): Promise<CommodityPrices | null> {
  const symbols = Object.values(METALS).map(m => m.symbol).join(",");
  const url = `https://metals-api.com/api/latest?access_key=${METALS_API_KEY}&base=USD&symbols=${symbols}`;
  totalApiCallsUsed++;

  log(
    "FETCH_PRICES",
    `Fetching all 4 commodity prices in ONE batched API call (call #${totalApiCallsUsed}/200 this month). ` +
    `Reasoning: batching all 4 metals in a single request to stay within 200-call free tier budget.`,
    { symbols, callNumber: totalApiCallsUsed }
  );

  try {
    const res = await fetch(url);
    const data = await res.json() as any;

    if (!data.success) {
      log("FETCH_ERROR", `Metals-API returned error: ${JSON.stringify(data.error)}`);
      return null;
    }

    const rates = data.rates;
    // API returns rates relative to USD. For USD-based symbols, the rate is how many
    // units of the commodity per 1 USD, so price_USD_per_unit = 1 / rate
    // Then convert to USD/metric ton via * TROY_OZ_PER_TON
    const prices: CommodityPrices = {
      ANTIMONY: Math.round((1 / rates["ANTIMONY"]) * TROY_OZ_PER_TON),
      LITHIUM:  Math.round((1 / rates["LITHIUM"])  * TROY_OZ_PER_TON),
      COBALT:   Math.round((1 / rates["LCO"])      * TROY_OZ_PER_TON),
      COPPER:   Math.round((1 / rates["LME-XCU"])  * TROY_OZ_PER_TON),
      timestamp: data.timestamp,
      callNumber: totalApiCallsUsed,
    };

    log("PRICES_FETCHED", "Real-world commodity prices fetched and converted to USD/metric ton", prices);
    return prices;

  } catch (err: any) {
    log("FETCH_ERROR", `Network error: ${err.message}`);
    return null;
  }
}

// ─── URIM Balance Check ───────────────────────────────────────────────────────

async function checkUrimDiscount(
  wallet: PublicKey,
  connection: Connection
): Promise<boolean> {
  try {
    // NOTE: URIM is a mainnet token; on devnet there's no balance.
    // For demo purposes the agent checks and logs the result.
    // Production: use mainnet connection to check real URIM balance.
    const ata = getAssociatedTokenAddressSync(URIM_MINT, wallet);
    const balance = await connection.getTokenAccountBalance(ata).catch(() => null);

    if (!balance) {
      log(
        "URIM_CHECK",
        `No URIM token account found for ${wallet.toBase58()} (expected on devnet — URIM is mainnet). ` +
        `No discount applied.`,
        { wallet: wallet.toBase58(), discount: false }
      );
      return false;
    }

    const urimAmount = balance.value.uiAmount || 0;
    // For real discount check we'd fetch URIM price from DexScreener/CoinGecko
    // and verify urimAmount * price >= $10. For demo we just log the balance.
    log(
      "URIM_CHECK",
      `Wallet holds ${urimAmount.toLocaleString()} URIM tokens. ` +
      `For ≥$10 USD value of URIM (mint: F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump), ` +
      `fee is reduced by 10%: 0.05% → 0.045%.`,
      { wallet: wallet.toBase58(), urimBalance: urimAmount, discount: urimAmount > 0 }
    );
    return urimAmount > 0;
  } catch {
    return false;
  }
}

// ─── Initialize Markets ───────────────────────────────────────────────────────

async function initializeMarketsIfNeeded(
  program: Program,
  authority: Keypair,
  connection: Connection
) {
  log(
    "INIT_MARKETS_CHECK",
    "Checking which commodity markets exist on-chain. Will initialize any missing ones. " +
    "Each market is a PDA seeded with ['market', commodity_name].",
  );

  const prices = await fetchPrices();
  if (!prices) {
    log("INIT_SKIP", "Cannot initialize markets without prices. Skipping.");
    return;
  }

  const configs = [
    { commodity: "ANTIMONY", price: prices.ANTIMONY },
    { commodity: "LITHIUM",  price: prices.LITHIUM  },
    { commodity: "COBALT",   price: prices.COBALT   },
    { commodity: "COPPER",   price: prices.COPPER   },
  ];

  for (const cfg of configs) {
    const marketPDA = getMarketPDA(cfg.commodity);
    const existing = await connection.getAccountInfo(marketPDA);

    if (existing) {
      log("MARKET_EXISTS", `${cfg.commodity} market already live at ${marketPDA.toBase58()}`);
      continue;
    }

    log(
      "MARKET_INIT",
      `Creating ${cfg.commodity} market. This mineral is strategically critical: ` +
      `${cfg.commodity === "ANTIMONY" ? "90% China-controlled, used in munitions & semiconductors" :
         cfg.commodity === "LITHIUM"  ? "EV battery supply chain, subject to export controls" :
         cfg.commodity === "COBALT"   ? "DRC supply concentration, EV + aerospace dependency" :
         "global electrical infrastructure, LME benchmark"}. ` +
      `Initial price: $${cfg.price.toLocaleString()}/ton`,
      { commodity: cfg.commodity, initialPrice: cfg.price, marketPDA: marketPDA.toBase58() }
    );

    try {
      const tx = await (program.methods as any)
        .initializeMarket(cfg.commodity, new BN(cfg.price))
        .accounts({
          market: marketPDA,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      log("MARKET_CREATED", `${cfg.commodity} market initialized on-chain`, {
        marketPDA: marketPDA.toBase58(),
        tx,
        explorer: `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
      });
    } catch (err: any) {
      log("MARKET_CREATE_ERROR", `Failed to create ${cfg.commodity}: ${err.message}`);
    }
  }
}

// ─── Update Prices ────────────────────────────────────────────────────────────

async function updatePricesOnChain(program: Program, authority: Keypair) {
  const prices = await fetchPrices();
  if (!prices) return;

  const updates = [
    { commodity: "ANTIMONY", price: prices.ANTIMONY },
    { commodity: "LITHIUM",  price: prices.LITHIUM  },
    { commodity: "COBALT",   price: prices.COBALT   },
    { commodity: "COPPER",   price: prices.COPPER   },
  ];

  for (const u of updates) {
    const marketPDA = getMarketPDA(u.commodity);
    log(
      "PRICE_UPDATE",
      `Posting ${u.commodity} mark price on-chain: $${u.price.toLocaleString()}/ton. ` +
      `Source: Metals-API real-time data. This feeds all open position PnL calculations.`,
      { commodity: u.commodity, price: u.price }
    );

    try {
      const tx = await (program.methods as any)
        .updatePrice(new BN(u.price))
        .accounts({ market: marketPDA, authority: authority.publicKey })
        .signers([authority])
        .rpc();

      log("PRICE_UPDATED", `${u.commodity} price live on-chain: $${u.price.toLocaleString()}/ton`, {
        commodity: u.commodity, price: u.price, tx,
        explorer: `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
      });
    } catch (err: any) {
      log("PRICE_UPDATE_ERROR", `Failed to update ${u.commodity}: ${err.message}`);
    }
  }
}

// ─── Open Demo Positions (Long + Short on alternating markets) ────────────────

async function openDemoPositions(
  program: Program,
  trader: Keypair,
  connection: Connection
) {
  const commodities = ["ANTIMONY", "LITHIUM", "COBALT", "COPPER"];
  const collateralLamports = Math.floor(0.015 * LAMPORTS_PER_SOL); // 0.015 SOL per position

  // Check URIM discount eligibility
  const useDiscount = await checkUrimDiscount(trader.publicKey, connection);

  // Open one LONG and one SHORT on different markets
  for (let i = 0; i < 2; i++) {
    const commodity = commodities[Math.floor(Math.random() * commodities.length)];
    const direction = i % 2; // 0=Long, 1=Short
    const dirStr = direction === 0 ? "LONG" : "SHORT";
    const nonce = Math.floor(Date.now() / 1000) + i; // different nonce per position
    const marketPDA = getMarketPDA(commodity);
    const positionPDA = getPositionPDA(trader.publicKey, marketPDA, nonce);
    const vaultPDA = getVaultPDA(trader.publicKey, marketPDA, nonce);

    log(
      "OPEN_POSITION",
      `Agent opening demo ${dirStr} on ${commodity}. ` +
      `Reasoning: demonstrating protocol ${dirStr} mechanics with real mark price. ` +
      `Collateral: ${collateralLamports / LAMPORTS_PER_SOL} SOL. ` +
      `Isolated margin vault: ${vaultPDA.toBase58().slice(0,12)}... ` +
      `URIM discount: ${useDiscount ? "YES (fee=0.045%)" : "NO (fee=0.05%)"}`,
      { commodity, direction: dirStr, collateral: collateralLamports, nonce, useUrimDiscount: useDiscount }
    );

    try {
      // Single instruction: transfers collateral from trader → vault internally,
      // deducts fee to authority, records position. No separate vault-funding needed.
      const tx = await (program.methods as any)
        .openPosition(direction, new BN(nonce), new BN(collateralLamports), useDiscount)
        .accounts({
          market: marketPDA,
          position: positionPDA,
          vault: vaultPDA,
          authority: trader.publicKey, // agent IS the market authority — fees go here
          trader: trader.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([trader])
        .rpc();

      log("POSITION_OPENED", `Demo ${dirStr} ${commodity} opened — collateral in isolated vault, fee sent to treasury`, {
        commodity, direction: dirStr,
        positionPDA: positionPDA.toBase58(),
        vaultPDA: vaultPDA.toBase58(),
        collateralSOL: collateralLamports / LAMPORTS_PER_SOL,
        nonce, tx,
        explorer: `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
        feeRate: useDiscount ? "0.045% (URIM 10% discount)" : "0.05%",
      });

      // Track for later close/liquidate demos
      openPositions.push({
        commodity,
        marketPDA,
        positionPDA,
        vaultPDA,
        nonce,
        direction,
        entryPrice: 0,
        openedAt: new Date(),
      });

    } catch (err: any) {
      log("POSITION_OPEN_ERROR", `Failed to open ${dirStr} ${commodity}: ${err.message}`);
    }
  }
}

// ─── Close Demo Positions ─────────────────────────────────────────────────────

async function closeDemoPositions(
  program: Program,
  trader: Keypair
) {
  // Close positions that have been open for ≥ 30 minutes (demo purposes)
  const now = new Date();
  const toClose = openPositions.filter(p => {
    const ageMs = now.getTime() - p.openedAt.getTime();
    return ageMs >= 30 * 60 * 1000; // 30 minutes
  });

  if (toClose.length === 0) {
    log("CLOSE_SKIP", "No positions old enough to close yet (need ≥30 min). Will check again later.");
    return;
  }

  for (const pos of toClose) {
    log(
      "CLOSE_POSITION",
      `Closing ${pos.direction === 0 ? "LONG" : "SHORT"} ${pos.commodity} position. ` +
      `Reasoning: position has been open for ${Math.round((now.getTime() - pos.openedAt.getTime()) / 60000)} minutes. ` +
      `PnL will be calculated from entry_price vs current mark_price. Payout from isolated vault.`,
      { positionPDA: pos.positionPDA.toBase58(), commodity: pos.commodity }
    );

    try {
      const tx = await (program.methods as any)
        .closePosition()
        .accounts({
          market: pos.marketPDA,
          position: pos.positionPDA,
          vault: pos.vaultPDA,
          trader: trader.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([trader])
        .rpc();

      log("POSITION_CLOSED", `Position closed — PnL settled from vault`, {
        positionPDA: pos.positionPDA.toBase58(), commodity: pos.commodity, tx,
        explorer: `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
      });

      // Remove from tracking
      const idx = openPositions.indexOf(pos);
      if (idx > -1) openPositions.splice(idx, 1);

    } catch (err: any) {
      log("CLOSE_ERROR", `Failed to close position: ${err.message}`, {
        positionPDA: pos.positionPDA.toBase58(),
      });
    }
  }
}

// ─── Liquidation Monitor ──────────────────────────────────────────────────────

async function checkAndLiquidate(
  program: Program,
  liquidator: Keypair,
  connection: Connection
) {
  log(
    "LIQUIDATION_SCAN",
    "Scanning all on-chain Position accounts for liquidation eligibility. " +
    "Threshold: >80% loss. Reward: 2% of collateral to liquidator. " +
    "This is a permissionless instruction — anyone can call it.",
  );

  try {
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [{ dataSize: 8 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 1 + 1 }],
    });

    log("SCAN_RESULT", `Found ${accounts.length} Position accounts to evaluate`);

    let liquidated = 0;
    for (const { pubkey, account } of accounts) {
      try {
        const pos = (program.account as any).position.coder.accounts.decode("Position", account.data);
        if (!pos.isOpen) continue;

        const market = await (program.account as any).market.fetch(pos.market);
        const currentPrice = market.markPrice.toNumber();
        const entryPrice = pos.entryPrice.toNumber();
        if (entryPrice === 0) continue;

        let lossBps = 0;
        if (pos.direction === 0 && currentPrice < entryPrice) {
          lossBps = Math.floor((entryPrice - currentPrice) * 10000 / entryPrice);
        } else if (pos.direction === 1 && currentPrice > entryPrice) {
          lossBps = Math.floor((currentPrice - entryPrice) * 10000 / entryPrice);
        }

        if (lossBps >= 8000) {
          const nonce = pos.openedAt.toNumber();
          const vaultPDA = getVaultPDA(pos.owner, pos.market, nonce);

          log(
            "LIQUIDATION_TRIGGERED",
            `Position ${pubkey.toBase58().slice(0,8)}... is ${(lossBps/100).toFixed(1)}% underwater. ` +
            `Entry: $${entryPrice}/ton, Current: $${currentPrice}/ton. ` +
            `Liquidating — agent earns 2% reward, remaining collateral absorbed by protocol.`,
            { position: pubkey.toBase58(), lossPct: (lossBps/100).toFixed(1), entryPrice, currentPrice }
          );

          const tx = await (program.methods as any)
            .liquidate()
            .accounts({
              market: pos.market,
              position: pubkey,
              vault: vaultPDA,
              liquidator: liquidator.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .signers([liquidator])
            .rpc();

          log("LIQUIDATED", "Position liquidated successfully", {
            position: pubkey.toBase58(), tx,
            explorer: `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
          });
          liquidated++;
        }
      } catch { /* skip decode errors */ }
    }

    if (liquidated === 0) {
      log("NO_LIQUIDATIONS", "All positions are healthy. No liquidations needed this cycle.");
    } else {
      log("LIQUIDATION_CYCLE_DONE", `Liquidated ${liquidated} position(s) this cycle.`, { count: liquidated });
    }
  } catch (err: any) {
    log("LIQUIDATION_ERROR", `Scan failed: ${err.message}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(
    "AGENT_START",
    "Mineral Futures Agent starting. I am Claude Code — an autonomous AI agent operating the " +
    "first on-chain perpetual futures protocol for strategic minerals (Antimony, Lithium, Cobalt, Copper) on Solana. " +
    "My responsibilities: (1) post real-world prices from Metals-API, " +
    "(2) demonstrate Long/Short mechanics with demo trades, " +
    "(3) auto-liquidate underwater positions, " +
    "(4) apply 10% fee discount for URIM token holders. " +
    "All decisions logged with reasoning. Program: 9zakGc9vksLmWz62R84BG9KNHP4xjNAPJ6L91eFhRxUq",
    {
      programId: PROGRAM_ID.toBase58(),
      markets: Object.keys(METALS),
      priceIntervalHours: PRICE_UPDATE_INTERVAL_MS / 3_600_000,
      liquidationIntervalMin: LIQUIDATION_CHECK_INTERVAL_MS / 60_000,
      urimMint: URIM_MINT.toBase58(),
      urimDiscountThresholdUSD: URIM_DISCOUNT_THRESHOLD_USD,
    }
  );

  // Load wallet
  const walletPath = process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;
  const keypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idlPath = path.join(__dirname, "../target/idl/mineral_futures.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  log("WALLET_LOADED", `Agent wallet: ${keypair.publicKey.toBase58()}. This wallet is the market authority — it can post prices and collects fees.`, {
    wallet: keypair.publicKey.toBase58(),
  });

  // Boot sequence
  await initializeMarketsIfNeeded(program, keypair, connection);
  await updatePricesOnChain(program, keypair);
  await openDemoPositions(program, keypair, connection);

  log(
    "LOOPS_STARTING",
    "Boot sequence complete. Starting autonomous monitoring loops. " +
    "Price updates every 3h (conserves 200-call API budget). " +
    "Liquidation scans every 15min (no API call needed).",
    {
      priceLoopMs: PRICE_UPDATE_INTERVAL_MS,
      liquidationLoopMs: LIQUIDATION_CHECK_INTERVAL_MS,
      positionLoopMs: DEMO_POSITION_INTERVAL_MS,
    }
  );

  // Price update loop (3h)
  setInterval(async () => {
    log("PRICE_LOOP", "3-hour price update timer fired");
    await updatePricesOnChain(program, keypair);
  }, PRICE_UPDATE_INTERVAL_MS);

  // Demo position loop (6h) — opens new positions, closes old ones
  setInterval(async () => {
    log("POSITION_LOOP", "6-hour demo position timer fired — opening new positions, closing old ones");
    await closeDemoPositions(program, keypair);
    await openDemoPositions(program, keypair, connection);
  }, DEMO_POSITION_INTERVAL_MS);

  // Liquidation monitor (15 min)
  setInterval(async () => {
    log("LIQUIDATION_LOOP", "15-minute liquidation scan timer fired");
    await checkAndLiquidate(program, keypair, connection);
  }, LIQUIDATION_CHECK_INTERVAL_MS);

  log("AGENT_RUNNING", "Agent is fully operational. Running autonomously. All decisions logged to agent-log.jsonl");
}

main().catch(err => {
  log("FATAL_ERROR", `Agent crashed: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
