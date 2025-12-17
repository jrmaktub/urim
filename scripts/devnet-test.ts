/**
 * DEVNET TEST SCRIPT
 *
 * This script tests the full betting flow on devnet:
 * 1. Creates mock USDC and URIM tokens (since real URIM doesn't exist on devnet)
 * 2. Starts a round with Pyth price
 * 3. Places bets (USDC and URIM)
 * 4. Waits for round to end
 * 5. Resolves with Pyth price
 * 6. Claims winnings
 *
 * Usage: npx ts-node scripts/devnet-test.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { UrimSolana } from "../target/types/urim_solana";
import { PublicKey, Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import axios from "axios";

// ============================================================================
// CONFIGURATION - UPDATE THESE FOR YOUR TEST
// ============================================================================
const ROUND_DURATION_SECONDS = 60; // 1 minute for quick testing
const PYTH_SOL_USD_DEVNET = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");
const SOL_USD_PRICE_FEED_ID = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const HERMES_ENDPOINT = "https://hermes.pyth.network";

// URIM price: $0.00001251 per URIM = 1251 in 8-decimal scaled format
const URIM_PRICE_SCALED = 1251;

// ============================================================================
// HELPERS
// ============================================================================
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchHermesPrice(): Promise<{ price: number; priceInCents: number }> {
  const response = await axios.get(
    `${HERMES_ENDPOINT}/v2/updates/price/latest?ids[]=${SOL_USD_PRICE_FEED_ID}`
  );
  const priceData = response.data.parsed[0];
  const price = Number(priceData.price.price) * Math.pow(10, priceData.price.expo);
  const priceInCents = Math.round(price * 100);
  return { price, priceInCents };
}

function getRoundPDA(programId: PublicKey, roundId: number): [PublicKey, number] {
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(roundId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("round"), roundIdBuffer],
    programId
  );
}

function getVaultPDA(programId: PublicKey, roundId: number): [PublicKey, number] {
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(roundId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), roundIdBuffer],
    programId
  );
}

function getUrimVaultPDA(programId: PublicKey, roundId: number): [PublicKey, number] {
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(roundId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("urim_vault"), roundIdBuffer],
    programId
  );
}

function getUserBetPDA(programId: PublicKey, roundPDA: PublicKey, user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), roundPDA.toBuffer(), user.toBuffer()],
    programId
  );
}

async function getBalance(connection: anchor.web3.Connection, tokenAccount: PublicKey): Promise<number> {
  try {
    const account = await getAccount(connection, tokenAccount);
    return Number(account.amount);
  } catch {
    return 0;
  }
}

// ============================================================================
// MAIN TEST
// ============================================================================
async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("DEVNET FULL FLOW TEST");
  console.log("=".repeat(70));

  // Setup
  const connection = new anchor.web3.Connection(
    "https://solana-devnet.g.alchemy.com/v2/27SvVEbGAVC2VSJ8rPss0",
    { commitment: "confirmed", confirmTransactionInitialTimeout: 120000 }
  );

  const wallet = anchor.AnchorProvider.env().wallet;
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = anchor.workspace.UrimSolana as Program<UrimSolana>;
  const adminWallet = provider.wallet;

  console.log(`\nProgram ID: ${program.programId}`);
  console.log(`Admin: ${adminWallet.publicKey}`);

  // Check config
  const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  const config = await program.account.config.fetch(configPDA);
  console.log(`Current Round ID: ${config.currentRoundId}`);
  console.log(`Paused: ${config.paused}`);

  // Create mock tokens for testing
  console.log("\n--- Creating mock tokens ---");
  const payerKeypair = Keypair.generate();
  await provider.sendAndConfirm(new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: adminWallet.publicKey,
      toPubkey: payerKeypair.publicKey,
      lamports: 0.5 * anchor.web3.LAMPORTS_PER_SOL,
    })
  ));

  const usdcMint = await createMint(connection, payerKeypair, payerKeypair.publicKey, null, 6);
  const urimMint = await createMint(connection, payerKeypair, payerKeypair.publicKey, null, 6);
  console.log(`Mock USDC: ${usdcMint}`);
  console.log(`Mock URIM: ${urimMint}`);

  // Create test users
  console.log("\n--- Setting up test users ---");
  const alice = Keypair.generate();
  const bob = Keypair.generate();

  // Fund users with SOL
  await provider.sendAndConfirm(new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: adminWallet.publicKey,
      toPubkey: alice.publicKey,
      lamports: 0.2 * anchor.web3.LAMPORTS_PER_SOL,
    }),
    SystemProgram.transfer({
      fromPubkey: adminWallet.publicKey,
      toPubkey: bob.publicKey,
      lamports: 0.2 * anchor.web3.LAMPORTS_PER_SOL,
    })
  ));

  // Create token accounts
  const aliceUSDC = await createAccount(connection, alice, usdcMint, alice.publicKey);
  const bobURIM = await createAccount(connection, bob, urimMint, bob.publicKey);
  const aliceURIM = await createAccount(connection, alice, urimMint, alice.publicKey); // For claiming

  // Mint tokens
  await mintTo(connection, payerKeypair, usdcMint, aliceUSDC, payerKeypair.publicKey, 1000 * 1_000_000); // 1000 USDC
  await mintTo(connection, payerKeypair, urimMint, bobURIM, payerKeypair.publicKey, 100_000_000 * 1_000_000); // 100M URIM

  console.log(`Alice: 1000 USDC`);
  console.log(`Bob: 100M URIM`);

  // Fetch real SOL/USD price from Hermes
  console.log("\n--- Fetching real SOL/USD price from Hermes ---");
  const { price: startPrice, priceInCents: startPriceCents } = await fetchHermesPrice();
  console.log(`Current SOL/USD: $${startPrice.toFixed(2)} (${startPriceCents} cents)`);

  // Start round
  console.log("\n--- Starting round ---");
  const roundId = config.currentRoundId.toNumber();
  const [roundPDA] = getRoundPDA(program.programId, roundId);

  // Try Pyth first, fallback to manual
  try {
    await program.methods
      .startRound(new anchor.BN(ROUND_DURATION_SECONDS))
      .accounts({
        usdcMint,
        urimMint,
        pythPriceFeed: PYTH_SOL_USD_DEVNET,
      })
      .rpc();
    console.log(`Round ${roundId} started with PYTH price!`);
  } catch (err: any) {
    if (err.toString().includes("PythPriceStale")) {
      console.log("Pyth price stale, using manual (Hermes) price...");
      await program.methods
        .startRoundManual(new anchor.BN(startPriceCents), new anchor.BN(ROUND_DURATION_SECONDS))
        .accounts({ usdcMint, urimMint })
        .rpc();
      console.log(`Round ${roundId} started with Hermes price: $${startPrice.toFixed(2)}`);
    } else {
      throw err;
    }
  }

  const round = await program.account.round.fetch(roundPDA);
  console.log(`Locked price: $${(round.lockedPrice.toNumber() / 100).toFixed(2)}`);
  console.log(`End time: ${new Date(round.endTime.toNumber() * 1000).toISOString()}`);

  // Place bets
  console.log("\n--- Placing bets ---");

  // Alice bets 100 USDC on UP
  const aliceProvider = new anchor.AnchorProvider(connection, new anchor.Wallet(alice), {});
  const aliceProgram = new Program(program.idl, aliceProvider);

  await aliceProgram.methods
    .placeBet(new anchor.BN(100 * 1_000_000), true) // 100 USDC on UP
    .accounts({ round: roundPDA, userTokenAccount: aliceUSDC })
    .rpc();
  console.log("Alice: 100 USDC on UP ($100 USD value)");

  // Bob bets URIM on DOWN
  // At $0.00001251/URIM, need ~80M URIM for $1000 USD value
  // 80_000_000 URIM * 1251 / 10^12 = 100.08 cents = ~$1.00 (need more!)
  // For $100 worth: 100 / 0.00001251 = 7,992,006 URIM
  const bobBetAmount = 8_000_000 * 1_000_000; // 8M URIM = ~$100 at this price

  const bobProvider = new anchor.AnchorProvider(connection, new anchor.Wallet(bob), {});
  const bobProgram = new Program(program.idl, bobProvider);

  await bobProgram.methods
    .placeBetUrim(
      new anchor.BN(bobBetAmount),
      false, // DOWN
      new anchor.BN(URIM_PRICE_SCALED)
    )
    .accounts({ round: roundPDA, userTokenAccount: bobURIM })
    .rpc();
  console.log(`Bob: 8M URIM on DOWN (~$100 USD value @ $0.00001251/URIM)`);

  // Check pools
  const roundAfterBets = await program.account.round.fetch(roundPDA);
  console.log("\n--- Pool State ---");
  console.log(`UP Pool (USDC): ${roundAfterBets.upPool.toNumber() / 1_000_000} USDC`);
  console.log(`DOWN Pool (URIM): ${roundAfterBets.downPoolUrim.toNumber() / 1_000_000} URIM`);
  console.log(`UP Pool (USD): $${(roundAfterBets.upPoolUsd.toNumber() / 100).toFixed(2)}`);
  console.log(`DOWN Pool (USD): $${(roundAfterBets.downPoolUsd.toNumber() / 100).toFixed(2)}`);

  // Wait for round to end
  console.log(`\n--- Waiting ${ROUND_DURATION_SECONDS + 5}s for round to end ---`);
  await sleep((ROUND_DURATION_SECONDS + 5) * 1000);

  // Fetch final price
  console.log("\n--- Fetching final SOL/USD price ---");
  const { price: endPrice, priceInCents: endPriceCents } = await fetchHermesPrice();
  console.log(`Final SOL/USD: $${endPrice.toFixed(2)} (${endPriceCents} cents)`);

  // Resolve round
  console.log("\n--- Resolving round ---");
  try {
    await program.methods
      .resolveRound()
      .accounts({
        round: roundPDA,
        pythPriceFeed: PYTH_SOL_USD_DEVNET,
      })
      .rpc();
    console.log("Resolved with PYTH price!");
  } catch (err: any) {
    if (err.toString().includes("PythPriceStale")) {
      console.log("Pyth price stale, using manual (Hermes) price...");
      await program.methods
        .resolveRoundManual(new anchor.BN(endPriceCents))
        .accounts({ round: roundPDA })
        .rpc();
      console.log(`Resolved with Hermes price: $${endPrice.toFixed(2)}`);
    } else {
      throw err;
    }
  }

  const resolvedRound = await program.account.round.fetch(roundPDA);
  console.log(`\nRound ${roundId} RESOLVED!`);
  console.log(`Locked: $${(resolvedRound.lockedPrice.toNumber() / 100).toFixed(2)}`);
  console.log(`Final: $${(resolvedRound.finalPrice.toNumber() / 100).toFixed(2)}`);
  console.log(`Outcome: ${JSON.stringify(resolvedRound.outcome)}`);

  // Determine winner and claim
  console.log("\n--- Claiming winnings ---");

  if (resolvedRound.outcome.up) {
    console.log("UP WINS! Alice wins, Bob loses.");

    const [aliceBetPDA] = getUserBetPDA(program.programId, roundPDA, alice.publicKey);
    const [vaultPDA] = getVaultPDA(program.programId, roundId);
    const [urimVaultPDA] = getUrimVaultPDA(program.programId, roundId);

    const aliceUsdcBefore = await getBalance(connection, aliceUSDC);
    const aliceUrimBefore = await getBalance(connection, aliceURIM);

    // Alice uses claim_all to get both USDC and URIM
    await aliceProgram.methods
      .claimAll()
      .accounts({
        round: roundPDA,
        userBet: aliceBetPDA,
        vault: vaultPDA,
        urimVault: urimVaultPDA,
        userUsdcAccount: aliceUSDC,
        userUrimAccount: aliceURIM,
      })
      .rpc();

    const aliceUsdcAfter = await getBalance(connection, aliceUSDC);
    const aliceUrimAfter = await getBalance(connection, aliceURIM);

    console.log(`\nAlice USDC: ${aliceUsdcBefore / 1_000_000} -> ${aliceUsdcAfter / 1_000_000} (+${(aliceUsdcAfter - aliceUsdcBefore) / 1_000_000})`);
    console.log(`Alice URIM: ${aliceUrimBefore / 1_000_000} -> ${aliceUrimAfter / 1_000_000} (+${(aliceUrimAfter - aliceUrimBefore) / 1_000_000})`);
    console.log("\nAlice claimed successfully! She got:");
    console.log("  - Her 100 USDC back");
    console.log("  - Bob's ~8M URIM (loser pool)");

  } else if (resolvedRound.outcome.down) {
    console.log("DOWN WINS! Bob wins, Alice loses.");

    const [bobBetPDA] = getUserBetPDA(program.programId, roundPDA, bob.publicKey);
    const bobUsdcAccount = await createAccount(connection, bob, usdcMint, bob.publicKey);
    const [vaultPDA] = getVaultPDA(program.programId, roundId);
    const [urimVaultPDA] = getUrimVaultPDA(program.programId, roundId);

    const bobUrimBefore = await getBalance(connection, bobURIM);
    const bobUsdcBefore = await getBalance(connection, bobUsdcAccount);

    await bobProgram.methods
      .claimAll()
      .accounts({
        round: roundPDA,
        userBet: bobBetPDA,
        vault: vaultPDA,
        urimVault: urimVaultPDA,
        userUsdcAccount: bobUsdcAccount,
        userUrimAccount: bobURIM,
      })
      .rpc();

    const bobUrimAfter = await getBalance(connection, bobURIM);
    const bobUsdcAfter = await getBalance(connection, bobUsdcAccount);

    console.log(`\nBob URIM: ${bobUrimBefore / 1_000_000} -> ${bobUrimAfter / 1_000_000} (+${(bobUrimAfter - bobUrimBefore) / 1_000_000})`);
    console.log(`Bob USDC: ${bobUsdcBefore / 1_000_000} -> ${bobUsdcAfter / 1_000_000} (+${(bobUsdcAfter - bobUsdcBefore) / 1_000_000})`);
    console.log("\nBob claimed successfully! He got:");
    console.log("  - His ~8M URIM back");
    console.log("  - Alice's 100 USDC (loser pool)");

  } else {
    console.log("DRAW! Both get refunds.");
  }

  console.log("\n" + "=".repeat(70));
  console.log("TEST COMPLETE!");
  console.log("=".repeat(70));
}

main().catch(console.error);
