import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Mineral Futures Price Agent
 *
 * Autonomous agent that:
 * 1. Fetches real commodity prices from Metals-API (1 batched call per cycle)
 * 2. Posts prices on-chain for ANTIMONY, LITHIUM, COBALT, COPPER
 * 3. Opens demo long/short positions autonomously to demonstrate protocol
 * 4. Monitors all positions and liquidates underwater ones automatically
 * 5. Logs all decisions with reasoning to agent-log.jsonl
 *
 * API efficiency: ALL 4 metals fetched in a SINGLE API call per cycle.
 * At 3-hour intervals: ~16 calls over 2 days (budget: 200 calls/month).
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import * as fs from "fs";
import * as path from "path";

// ─── Config ───────────────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey("BxCSsWy14b1yUGi8h5mEDJc9tH4AEbqVwGC8b4tcVvmz");
const RPC_URL = "https://api.devnet.solana.com";
const METALS_API_KEY = process.env.METALS_API_KEY || "qdvu4sm6j8u1vi21wn52v12di3knagrv1jqo6u28wc5tc7emdf9i2t9g7k7t";

// Price update interval — 3 hours to conserve API calls (200/month budget)
// At 3h intervals over 2 days = ~16 calls used
const PRICE_UPDATE_INTERVAL_MS = 3 * 60 * 60 * 1000;

// Liquidation check interval — every 15 minutes (no API call needed)
const LIQUIDATION_CHECK_INTERVAL_MS = 15 * 60 * 1000;

// Demo position interval — open a demo position every 6 hours
const DEMO_POSITION_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Troy ounces per metric ton (for USD/ton conversion)
const TROY_OZ_PER_TON = 32_150.7;

// Metals-API symbols for our 4 commodities
const METALS = {
  ANTIMONY: { symbol: "ANTIMONY", display: "Antimony" },
  LITHIUM:  { symbol: "LITHIUM",  display: "Lithium" },
  COBALT:   { symbol: "LCO",      display: "Cobalt" },
  COPPER:   { symbol: "LME-XCU",  display: "Copper (LME)" },
};

const LOG_FILE = path.join(__dirname, "agent-log.jsonl");

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(action: string, reasoning: string, data?: any) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    reasoning,
    data,
  };
  console.log(`[${entry.timestamp}] ${action}: ${reasoning}`);
  if (data) console.log("  data:", JSON.stringify(data, null, 2));
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
}

// ─── Price Fetching ───────────────────────────────────────────────────────────

interface CommodityPrices {
  ANTIMONY: number; // USD per metric ton
  LITHIUM:  number;
  COBALT:   number;
  COPPER:   number;
  timestamp: number;
  apiCallUsed: number; // track budget
}

let totalApiCallsUsed = 0;

async function fetchPrices(): Promise<CommodityPrices | null> {
  // ALL 4 metals in ONE single API call — efficient use of 200-call budget
  const symbols = Object.values(METALS).map(m => m.symbol).join(",");
  const url = `https://metals-api.com/api/latest?access_key=${METALS_API_KEY}&base=USD&symbols=${symbols}`;

  try {
    totalApiCallsUsed++;
    log(
      "FETCH_PRICES",
      `Fetching all 4 commodity prices in one batched API call (call #${totalApiCallsUsed}/200 this month)`,
      { symbols, url: url.replace(METALS_API_KEY, "***REDACTED***") }
    );

    const res = await fetch(url);
    const data = await res.json() as any;

    if (!data.success) {
      log("FETCH_ERROR", `API returned error: ${JSON.stringify(data.error)}`);
      return null;
    }

    const rates = data.rates;

    // API returns rates as USD/troy_oz in the USDXXX field
    // Convert to USD/metric_ton for more meaningful futures pricing
    const prices: CommodityPrices = {
      ANTIMONY: Math.round((rates["USDANTIMONY"] || 1 / rates["ANTIMONY"]) * TROY_OZ_PER_TON),
      LITHIUM:  Math.round((rates["USDLITHIUM"]  || 1 / rates["LITHIUM"])  * TROY_OZ_PER_TON),
      COBALT:   Math.round((rates["USDLCO"]       || 1 / rates["LCO"])      * TROY_OZ_PER_TON),
      COPPER:   Math.round((rates["USDLME-XCU"]   || 1 / rates["LME-XCU"]) * TROY_OZ_PER_TON),
      timestamp: data.timestamp,
      apiCallUsed: totalApiCallsUsed,
    };

    log("PRICES_FETCHED", "Successfully fetched and converted commodity prices to USD/metric ton", prices);
    return prices;

  } catch (err: any) {
    log("FETCH_ERROR", `Network error fetching prices: ${err.message}`);
    return null;
  }
}

// ─── On-Chain Helpers ─────────────────────────────────────────────────────────

function getMarketPDA(commodity: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(commodity)],
    PROGRAM_ID
  );
  return pda;
}

function getVaultPDA(marketPubkey: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), marketPubkey.toBuffer()],
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

// ─── Main Agent Logic ─────────────────────────────────────────────────────────

async function main() {
  log(
    "AGENT_START",
    "Mineral Futures Agent starting. I am an autonomous AI agent (Claude Code) that will " +
    "manage on-chain commodity futures markets for strategic minerals. My goals: " +
    "(1) maintain accurate price feeds by fetching real data from Metals-API, " +
    "(2) demonstrate protocol functionality by autonomously trading, " +
    "(3) protect the protocol by liquidating underwater positions. " +
    "I will operate continuously, logging all decisions with reasoning.",
    {
      programId: PROGRAM_ID.toBase58(),
      markets: Object.keys(METALS),
      priceUpdateIntervalHours: PRICE_UPDATE_INTERVAL_MS / 3600000,
      apiCallBudget: 200,
    }
  );

  // Load wallet
  const walletPath = process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;
  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load IDL
  const idlPath = path.join(__dirname, "../target/idl/mineral_futures.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  log("WALLET_LOADED", `Agent wallet: ${walletKeypair.publicKey.toBase58()}`, {
    wallet: walletKeypair.publicKey.toBase58(),
  });

  // Step 1: Initialize markets if they don't exist
  await initializeMarketsIfNeeded(program, walletKeypair, connection);

  // Step 2: Fetch initial prices and update on-chain
  await updatePricesOnChain(program, walletKeypair);

  // Step 3: Open a demo position to show protocol works
  await openDemoPosition(program, walletKeypair, connection);

  // Step 4: Start monitoring loops
  log(
    "LOOPS_STARTING",
    "Starting autonomous monitoring loops. Price updates every 3h, liquidation checks every 15min.",
    { priceIntervalMs: PRICE_UPDATE_INTERVAL_MS, liquidationIntervalMs: LIQUIDATION_CHECK_INTERVAL_MS }
  );

  // Price update loop
  setInterval(async () => {
    log("PRICE_LOOP_TICK", "Scheduled price update triggered by timer");
    await updatePricesOnChain(program, walletKeypair);
  }, PRICE_UPDATE_INTERVAL_MS);

  // Demo position loop
  setInterval(async () => {
    log("DEMO_LOOP_TICK", "Scheduled demo position open triggered by timer");
    await openDemoPosition(program, walletKeypair, connection);
  }, DEMO_POSITION_INTERVAL_MS);

  // Liquidation monitor loop
  setInterval(async () => {
    log("LIQUIDATION_LOOP_TICK", "Scheduled liquidation check triggered by timer");
    await checkAndLiquidate(program, walletKeypair, connection);
  }, LIQUIDATION_CHECK_INTERVAL_MS);

  log("AGENT_RUNNING", "Agent is fully operational. All loops started. Ctrl+C to stop.");
}

// ─── Initialize Markets ───────────────────────────────────────────────────────

async function initializeMarketsIfNeeded(
  program: Program,
  authority: Keypair,
  connection: Connection
) {
  log(
    "INIT_MARKETS",
    "Checking if commodity markets are initialized on-chain. Will create any missing markets.",
  );

  // Fetch initial prices for initialization
  const prices = await fetchPrices();
  if (!prices) {
    log("INIT_ERROR", "Cannot initialize markets without prices. Will retry on next cycle.");
    return;
  }

  const marketConfigs = [
    { commodity: "ANTIMONY", initialPrice: prices.ANTIMONY },
    { commodity: "LITHIUM",  initialPrice: prices.LITHIUM },
    { commodity: "COBALT",   initialPrice: prices.COBALT },
    { commodity: "COPPER",   initialPrice: prices.COPPER },
  ];

  for (const config of marketConfigs) {
    const marketPDA = getMarketPDA(config.commodity);

    try {
      const existing = await connection.getAccountInfo(marketPDA);
      if (existing) {
        log(
          "MARKET_EXISTS",
          `Market ${config.commodity} already initialized at ${marketPDA.toBase58()}`,
          { market: marketPDA.toBase58() }
        );
        continue;
      }
    } catch {
      // Account doesn't exist, create it
    }

    try {
      log(
        "MARKET_CREATE",
        `Initializing ${config.commodity} market. Reasoning: This is a strategically important mineral ` +
        `with significant geopolitical supply chain risk. Current price: $${config.initialPrice.toLocaleString()}/ton.`,
        { commodity: config.commodity, initialPrice: config.initialPrice }
      );

      const tx = await (program.methods as any)
        .initializeMarket(config.commodity, new BN(config.initialPrice))
        .accounts({
          market: marketPDA,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      log("MARKET_CREATED", `Market ${config.commodity} initialized on-chain`, {
        commodity: config.commodity,
        marketPDA: marketPDA.toBase58(),
        tx,
        explorerUrl: `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
      });

    } catch (err: any) {
      log("MARKET_CREATE_ERROR", `Failed to create ${config.commodity} market: ${err.message}`);
    }
  }
}

// ─── Update Prices ────────────────────────────────────────────────────────────

async function updatePricesOnChain(program: Program, authority: Keypair) {
  const prices = await fetchPrices();
  if (!prices) return;

  const updates = [
    { commodity: "ANTIMONY", price: prices.ANTIMONY },
    { commodity: "LITHIUM",  price: prices.LITHIUM },
    { commodity: "COBALT",   price: prices.COBALT },
    { commodity: "COPPER",   price: prices.COPPER },
  ];

  for (const update of updates) {
    const marketPDA = getMarketPDA(update.commodity);

    try {
      log(
        "PRICE_UPDATE",
        `Updating ${update.commodity} mark price on-chain to $${update.price.toLocaleString()}/ton. ` +
        `This price is sourced from Metals-API real-time data.`,
        { commodity: update.commodity, priceUsdPerTon: update.price }
      );

      const tx = await (program.methods as any)
        .updatePrice(new BN(update.price))
        .accounts({
          market: marketPDA,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      log("PRICE_UPDATED", `${update.commodity} price updated on-chain`, {
        commodity: update.commodity,
        newPrice: update.price,
        tx,
        explorerUrl: `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
      });

    } catch (err: any) {
      log("PRICE_UPDATE_ERROR", `Failed to update ${update.commodity} price: ${err.message}`);
    }
  }
}

// ─── Open Demo Positions ──────────────────────────────────────────────────────

async function openDemoPosition(
  program: Program,
  trader: Keypair,
  connection: Connection
) {
  // Pick a random commodity and direction for demonstration
  const commodities = ["ANTIMONY", "LITHIUM", "COBALT", "COPPER"];
  const commodity = commodities[Math.floor(Math.random() * commodities.length)];
  const direction = Math.random() > 0.5 ? 0 : 1; // 0=Long, 1=Short
  const collateral = 0.01 * LAMPORTS_PER_SOL; // 0.01 SOL demo position

  const marketPDA = getMarketPDA(commodity);
  const nonce = Math.floor(Date.now() / 1000); // unix timestamp as nonce
  const positionPDA = getPositionPDA(trader.publicKey, marketPDA, nonce);
  const vaultPDA = getVaultPDA(marketPDA);

  log(
    "DEMO_POSITION",
    `Opening demo ${direction === 0 ? "LONG" : "SHORT"} position on ${commodity}. ` +
    `Reasoning: Demonstrating protocol functionality. Collateral: ${collateral / LAMPORTS_PER_SOL} SOL. ` +
    `This is an autonomous test trade by the agent.`,
    { commodity, direction: direction === 0 ? "LONG" : "SHORT", collateral, nonce }
  );

  try {
    // Fund the vault PDA with collateral before opening position
    // (vault holds all collateral; position reads from vault lamports)
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: trader.publicKey,
        toPubkey: vaultPDA,
        lamports: collateral,
      })
    );
    await sendAndConfirmTransaction(connection, fundTx, [trader], { commitment: "confirmed" });
    log("VAULT_FUNDED", `Funded vault with ${collateral / LAMPORTS_PER_SOL} SOL collateral`, {
      vault: vaultPDA.toBase58(), collateral,
    });

    const tx = await (program.methods as any)
      .openPosition(direction, new BN(nonce), false)
      .accounts({
        market: marketPDA,
        position: positionPDA,
        vault: vaultPDA,
        trader: trader.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([trader])
      .rpc();

    log("POSITION_OPENED", `Demo position opened successfully`, {
      commodity,
      direction: direction === 0 ? "LONG" : "SHORT",
      positionPDA: positionPDA.toBase58(),
      nonce,
      tx,
      explorerUrl: `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
    });

  } catch (err: any) {
    log("POSITION_OPEN_ERROR", `Failed to open demo position: ${err.message}`);
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
    "Scanning all open positions for liquidation eligibility. " +
    "Any position with >80% loss will be liquidated by the agent automatically.",
  );

  try {
    // Fetch all Position accounts
    const positions = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { dataSize: 8 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 1 + 1 }, // Position::SIZE
      ],
    });

    log("POSITIONS_SCANNED", `Found ${positions.length} position accounts to check`);

    let liquidated = 0;
    for (const { pubkey, account } of positions) {
      try {
        // Decode position using Anchor's coder
        const position = (program.account as any).position.coder.accounts.decode(
          "Position",
          account.data
        );

        if (!position.isOpen) continue;

        // Get current market price
        const market = await (program.account as any).market.fetch(position.market);
        const currentPrice = market.markPrice.toNumber();
        const entryPrice = position.entryPrice.toNumber();

        if (entryPrice === 0) continue;

        // Calculate loss bps
        let lossBps = 0;
        if (position.direction === 0 && currentPrice < entryPrice) {
          // Long losing
          lossBps = Math.floor((entryPrice - currentPrice) * 10000 / entryPrice);
        } else if (position.direction === 1 && currentPrice > entryPrice) {
          // Short losing
          lossBps = Math.floor((currentPrice - entryPrice) * 10000 / entryPrice);
        }

        if (lossBps >= 8000) {
          log(
            "LIQUIDATION_TRIGGERED",
            `Position ${pubkey.toBase58()} is underwater by ${lossBps / 100}% (threshold: 80%). ` +
            `Liquidating to protect protocol solvency. Agent earns 2% liquidation reward.`,
            { position: pubkey.toBase58(), lossBps, currentPrice, entryPrice }
          );

          const marketPDA = position.market;
          const vaultPDA = getVaultPDA(marketPDA);

          const tx = await (program.methods as any)
            .liquidate()
            .accounts({
              market: marketPDA,
              position: pubkey,
              vault: vaultPDA,
              liquidator: liquidator.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .signers([liquidator])
            .rpc();

          log("LIQUIDATED", `Position liquidated successfully`, {
            position: pubkey.toBase58(),
            tx,
            explorerUrl: `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
          });
          liquidated++;
        }
      } catch {
        // Skip positions that fail to decode (e.g., different account type)
      }
    }

    if (liquidated === 0) {
      log("NO_LIQUIDATIONS", "No positions were eligible for liquidation this cycle.");
    } else {
      log("LIQUIDATION_COMPLETE", `Liquidated ${liquidated} positions this cycle.`, { count: liquidated });
    }

  } catch (err: any) {
    log("LIQUIDATION_SCAN_ERROR", `Error during liquidation scan: ${err.message}`);
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

main().catch(err => {
  log("FATAL_ERROR", `Agent crashed: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
