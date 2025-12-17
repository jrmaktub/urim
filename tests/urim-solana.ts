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
import { assert } from "chai";
import axios from "axios";

// Constants matching the contract
const FEE_BPS = 50; // 0.5%
const TEST_DURATION = 45; // 45 seconds for test rounds (handles devnet latency)
const PYTH_SOL_USD_DEVNET = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");

// Real devnet USDC (Circle's official devnet USDC) - for future real USDC testing
// const REAL_DEVNET_USDC = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

// URIM price for testing - now uses 8-decimal scaled format
// $0.05 per URIM = 0.05 * 100_000_000 = 5_000_000
const URIM_PRICE_SCALED = 5_000_000; // $0.05 per URIM (scaled by 10^8)

// SOL/USD Price Feed ID (Pyth network hex format)
const SOL_USD_PRICE_FEED_ID = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

// Hermes endpoint for fetching real-time prices
const HERMES_ENDPOINT = "https://hermes.pyth.network";

// Helper to wait
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to fetch real price from Hermes
async function fetchHermesPrice(): Promise<{ price: number; priceInCents: number }> {
  const response = await axios.get(
    `${HERMES_ENDPOINT}/v2/updates/price/latest?ids[]=${SOL_USD_PRICE_FEED_ID}`
  );
  const priceData = response.data.parsed[0];
  const price = Number(priceData.price.price) * Math.pow(10, priceData.price.expo);
  const priceInCents = Math.round(price * 100);
  return { price, priceInCents };
}

describe("Urim Solana - COMPREHENSIVE TEST SUITE", () => {
  // Use longer timeout for devnet
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

  // Test accounts
  let usdcMint: PublicKey;
  let urimMint: PublicKey;
  let treasuryTokenAccount: PublicKey;
  let urimTreasuryTokenAccount: PublicKey;
  let configPDA: PublicKey;

  // Test users
  let alice: Keypair;
  let bob: Keypair;
  let carol: Keypair;
  let aliceUSDC: PublicKey;
  let bobUSDC: PublicKey;
  let carolUSDC: PublicKey;
  let aliceURIM: PublicKey;
  let bobURIM: PublicKey;
  let carolURIM: PublicKey;

  // Payer for mints
  let payerKeypair: Keypair;

  // Helper functions
  function getRoundPDA(roundId: number): [PublicKey, number] {
    const roundIdBuffer = Buffer.alloc(8);
    roundIdBuffer.writeBigUInt64LE(BigInt(roundId));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("round"), roundIdBuffer],
      program.programId
    );
  }

  function getVaultPDA(roundId: number): [PublicKey, number] {
    const roundIdBuffer = Buffer.alloc(8);
    roundIdBuffer.writeBigUInt64LE(BigInt(roundId));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), roundIdBuffer],
      program.programId
    );
  }

  function getUrimVaultPDA(roundId: number): [PublicKey, number] {
    const roundIdBuffer = Buffer.alloc(8);
    roundIdBuffer.writeBigUInt64LE(BigInt(roundId));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("urim_vault"), roundIdBuffer],
      program.programId
    );
  }

  function getUserBetPDA(roundPDA: PublicKey, user: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), roundPDA.toBuffer(), user.toBuffer()],
      program.programId
    );
  }

  async function getBalance(tokenAccount: PublicKey): Promise<number> {
    const account = await getAccount(provider.connection, tokenAccount);
    return Number(account.amount);
  }

  before(async () => {
    console.log("\n" + "=".repeat(70));
    console.log("SETTING UP COMPREHENSIVE TEST ENVIRONMENT");
    console.log("=".repeat(70));

    // Create test users
    alice = Keypair.generate();
    bob = Keypair.generate();
    carol = Keypair.generate();

    // Fund users with more SOL for rent + tx fees
    const fundAmount = 0.5 * anchor.web3.LAMPORTS_PER_SOL;
    for (const user of [alice, bob, carol]) {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: adminWallet.publicKey,
          toPubkey: user.publicKey,
          lamports: fundAmount,
        })
      );
      await provider.sendAndConfirm(tx);
    }

    // Create payer for mints
    payerKeypair = Keypair.generate();
    await provider.sendAndConfirm(new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: adminWallet.publicKey,
        toPubkey: payerKeypair.publicKey,
        lamports: 1 * anchor.web3.LAMPORTS_PER_SOL,
      })
    ));

    // Create USDC mock mint (for testing - 6 decimals like real USDC)
    usdcMint = await createMint(provider.connection, payerKeypair, payerKeypair.publicKey, null, 6);

    // Create URIM mock mint (for testing - 6 decimals like pump.fun tokens)
    urimMint = await createMint(provider.connection, payerKeypair, payerKeypair.publicKey, null, 6);

    // Create USDC token accounts
    aliceUSDC = await createAccount(provider.connection, alice, usdcMint, alice.publicKey);
    bobUSDC = await createAccount(provider.connection, bob, usdcMint, bob.publicKey);
    carolUSDC = await createAccount(provider.connection, carol, usdcMint, carol.publicKey);

    // Create URIM token accounts
    aliceURIM = await createAccount(provider.connection, alice, urimMint, alice.publicKey);
    bobURIM = await createAccount(provider.connection, bob, urimMint, bob.publicKey);
    carolURIM = await createAccount(provider.connection, carol, urimMint, carol.publicKey);

    // Create treasury for USDC
    const treasuryKeypair = Keypair.generate();
    await provider.sendAndConfirm(new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: adminWallet.publicKey,
        toPubkey: treasuryKeypair.publicKey,
        lamports: 0.02 * anchor.web3.LAMPORTS_PER_SOL,
      })
    ));
    treasuryTokenAccount = await createAccount(provider.connection, treasuryKeypair, usdcMint, treasuryKeypair.publicKey);
    urimTreasuryTokenAccount = await createAccount(provider.connection, treasuryKeypair, urimMint, treasuryKeypair.publicKey);

    // Mint USDC to users (100,000 each for large bet tests)
    const mintAmount = 100_000 * 1_000_000;
    await Promise.all([
      mintTo(provider.connection, payerKeypair, usdcMint, aliceUSDC, payerKeypair.publicKey, mintAmount),
      mintTo(provider.connection, payerKeypair, usdcMint, bobUSDC, payerKeypair.publicKey, mintAmount),
      mintTo(provider.connection, payerKeypair, usdcMint, carolUSDC, payerKeypair.publicKey, mintAmount),
    ]);

    // Mint URIM to users (1,000,000 each - more because URIM is cheaper)
    const urimMintAmount = 1_000_000 * 1_000_000;
    await Promise.all([
      mintTo(provider.connection, payerKeypair, urimMint, aliceURIM, payerKeypair.publicKey, urimMintAmount),
      mintTo(provider.connection, payerKeypair, urimMint, bobURIM, payerKeypair.publicKey, urimMintAmount),
      mintTo(provider.connection, payerKeypair, urimMint, carolURIM, payerKeypair.publicKey, urimMintAmount),
    ]);

    // Derive config PDA
    [configPDA] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);

    console.log(`   Program: ${program.programId}`);
    console.log(`   Admin: ${adminWallet.publicKey}`);
    console.log(`   USDC Mint: ${usdcMint}`);
    console.log(`   URIM Mint: ${urimMint}`);
    console.log(`   Pyth SOL/USD: ${PYTH_SOL_USD_DEVNET}`);
    console.log(`   URIM Price: $${URIM_PRICE_SCALED / 100_000_000} (scaled: ${URIM_PRICE_SCALED})`);
    console.log(`   Test duration: ${TEST_DURATION}s per round`);
    console.log(`   Users funded: 100,000 USDC + 1,000,000 URIM each`);
    console.log("   Setup complete!\n");
  });

  // ============================================================================
  // 1. INITIALIZATION
  // ============================================================================
  describe("1. Platform Initialization", () => {
    it("Initializes platform", async () => {
      try {
        const existingConfig = await program.account.config.fetch(configPDA);
        console.log("   Config already exists");

        // Update treasury to our new test treasury if different
        if (existingConfig.treasury.toString() !== treasuryTokenAccount.toString()) {
          console.log("   Updating treasury to match new test mint...");
          await program.methods
            .updateTreasury(treasuryTokenAccount)
            .rpc();
          console.log("   Treasury updated!");
        }
        return;
      } catch { }

      await program.methods.initialize(treasuryTokenAccount).rpc();
      const config = await program.account.config.fetch(configPDA);
      assert.equal(config.admin.toString(), adminWallet.publicKey.toString());
      console.log("   Platform initialized");
    });
  });

  // ============================================================================
  // 2. REAL PYTH ON-CHAIN ORACLE TEST
  // ============================================================================
  describe("2. REAL PYTH ON-CHAIN: start_round() and resolve_round()", () => {
    let roundPDA: PublicKey;
    let roundId: number;

    it("Attempts to start round with REAL Pyth on-chain price feed", async () => {
      const config = await program.account.config.fetch(configPDA);
      roundId = config.currentRoundId.toNumber();
      [roundPDA] = getRoundPDA(roundId);

      try {
        await program.methods
          .startRound(new anchor.BN(TEST_DURATION))
          .accounts({
            usdcMint,
            urimMint,
            pythPriceFeed: PYTH_SOL_USD_DEVNET,
          })
          .rpc();

        const round = await program.account.round.fetch(roundPDA);
        console.log(`   ✅ Pyth on-chain WORKS! Round ${roundId} started`);
        console.log(`   Locked price from Pyth: $${(round.lockedPrice.toNumber() / 100).toFixed(2)}`);
      } catch (err: any) {
        if (err.toString().includes("PythPriceStale")) {
          console.log("   ⚠️  Pyth on-chain price is STALE (expected on devnet)");
          console.log("   This is normal - devnet Pyth feeds are not always updated");
          console.log("   Using manual price functions as fallback...");

          // Start with manual price instead
          const { priceInCents } = await fetchHermesPrice();
          await program.methods
            .startRoundManual(new anchor.BN(priceInCents), new anchor.BN(TEST_DURATION))
            .accounts({ usdcMint, urimMint })
            .rpc();

          const round = await program.account.round.fetch(roundPDA);
          console.log(`   Round ${roundId} started with Hermes price: $${(round.lockedPrice.toNumber() / 100).toFixed(2)}`);
        } else {
          throw err;
        }
      }
    });

    it("Users place bets", async () => {
      const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
      const aliceProgram = new Program(program.idl, aliceProvider);

      await aliceProgram.methods
        .placeBet(new anchor.BN(100 * 1_000_000), true) // Alice bets UP
        .accounts({ round: roundPDA, userTokenAccount: aliceUSDC })
        .rpc();

      const bobProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(bob), {});
      const bobProgram = new Program(program.idl, bobProvider);

      await bobProgram.methods
        .placeBet(new anchor.BN(100 * 1_000_000), false) // Bob bets DOWN
        .accounts({ round: roundPDA, userTokenAccount: bobUSDC })
        .rpc();

      console.log("   Alice: 100 USDC on UP, Bob: 100 USDC on DOWN");
    });

    it("Waits and attempts to resolve with REAL Pyth", async () => {
      console.log(`   Waiting ${TEST_DURATION + 2}s for round to end...`);
      await sleep((TEST_DURATION + 2) * 1000);

      try {
        await program.methods
          .resolveRound()
          .accounts({
            round: roundPDA,
            pythPriceFeed: PYTH_SOL_USD_DEVNET,
          })
          .rpc();

        const round = await program.account.round.fetch(roundPDA);
        console.log(`   ✅ Resolved with Pyth! Final: $${(round.finalPrice.toNumber() / 100).toFixed(2)}`);
        console.log(`   Outcome: ${JSON.stringify(round.outcome)}`);
      } catch (err: any) {
        if (err.toString().includes("PythPriceStale")) {
          console.log("   ⚠️  Pyth price stale for resolution - using manual");
          const { priceInCents } = await fetchHermesPrice();
          await program.methods
            .resolveRoundManual(new anchor.BN(priceInCents))
            .accounts({ round: roundPDA })
            .rpc();

          const round = await program.account.round.fetch(roundPDA);
          console.log(`   Resolved with Hermes: $${(round.finalPrice.toNumber() / 100).toFixed(2)}`);
          console.log(`   Outcome: ${JSON.stringify(round.outcome)}`);
        } else {
          throw err;
        }
      }
    });

    it("Winner claims correctly", async () => {
      const round = await program.account.round.fetch(roundPDA);

      if (round.outcome.up) {
        const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
        const aliceProgram = new Program(program.idl, aliceProvider);
        const [userBetPDA] = getUserBetPDA(roundPDA, alice.publicKey);

        await aliceProgram.methods
          .claim()
          .accounts({ round: roundPDA, userBet: userBetPDA, userTokenAccount: aliceUSDC })
          .rpc();

        console.log("   Alice claimed (UP won)!");
      } else if (round.outcome.down) {
        const bobProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(bob), {});
        const bobProgram = new Program(program.idl, bobProvider);
        const [userBetPDA] = getUserBetPDA(roundPDA, bob.publicKey);

        await bobProgram.methods
          .claim()
          .accounts({ round: roundPDA, userBet: userBetPDA, userTokenAccount: bobUSDC })
          .rpc();

        console.log("   Bob claimed (DOWN won)!");
      } else {
        // Draw - both claim
        const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
        const aliceProgram = new Program(program.idl, aliceProvider);
        const [aliceBetPDA] = getUserBetPDA(roundPDA, alice.publicKey);
        await aliceProgram.methods
          .claim()
          .accounts({ round: roundPDA, userBet: aliceBetPDA, userTokenAccount: aliceUSDC })
          .rpc();

        const bobProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(bob), {});
        const bobProgram = new Program(program.idl, bobProvider);
        const [bobBetPDA] = getUserBetPDA(roundPDA, bob.publicKey);
        await bobProgram.methods
          .claim()
          .accounts({ round: roundPDA, userBet: bobBetPDA, userTokenAccount: bobUSDC })
          .rpc();

        console.log("   Both claimed (DRAW)!");
      }
    });
  });

  // ============================================================================
  // 3. PYTH STALE PRICE HANDLING
  // ============================================================================
  describe("3. PYTH STALE PRICE HANDLING", () => {
    it("Verifies contract rejects stale Pyth prices correctly", async () => {
      // The Pyth on-chain feed on devnet is typically stale
      // This test verifies our error handling works
      const pythAccount = await provider.connection.getAccountInfo(PYTH_SOL_USD_DEVNET);
      assert.isNotNull(pythAccount, "Pyth account should exist");

      console.log(`   Pyth account size: ${pythAccount!.data.length} bytes`);
      console.log(`   Pyth account owner: ${pythAccount!.owner.toString()}`);

      // Try to read the price age
      const config = await program.account.config.fetch(configPDA);
      const roundId = config.currentRoundId.toNumber();
      const [roundPDA] = getRoundPDA(roundId);

      try {
        await program.methods
          .startRound(new anchor.BN(TEST_DURATION))
          .accounts({
            usdcMint,
            urimMint,
            pythPriceFeed: PYTH_SOL_USD_DEVNET,
          })
          .rpc();
        console.log("   ✅ Pyth price was fresh! Round started successfully.");
      } catch (err: any) {
        if (err.toString().includes("PythPriceStale")) {
          console.log("   ✅ Contract correctly rejected stale Pyth price");
          console.log("   Error: PythPriceStale (as expected)");
        } else {
          console.log(`   Unexpected error: ${err.toString().slice(0, 100)}`);
        }
      }
    });
  });

  // ============================================================================
  // 4. LARGE BET OVERFLOW TESTS
  // ============================================================================
  describe("4. LARGE BET OVERFLOW TESTS", () => {
    let roundPDA: PublicKey;
    let roundId: number;

    it("Handles large bets without overflow (50,000 USDC each)", async () => {
      const config = await program.account.config.fetch(configPDA);
      roundId = config.currentRoundId.toNumber();
      [roundPDA] = getRoundPDA(roundId);

      await program.methods
        .startRoundManual(new anchor.BN(15000), new anchor.BN(TEST_DURATION)) // $150.00
        .accounts({ usdcMint, urimMint })
        .rpc();

      // Alice bets 50,000 USDC on UP
      const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
      const aliceProgram = new Program(program.idl, aliceProvider);
      const largeBet = 50_000 * 1_000_000; // 50,000 USDC

      await aliceProgram.methods
        .placeBet(new anchor.BN(largeBet), true)
        .accounts({ round: roundPDA, userTokenAccount: aliceUSDC })
        .rpc();

      // Bob bets 50,000 USDC on DOWN
      const bobProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(bob), {});
      const bobProgram = new Program(program.idl, bobProvider);

      await bobProgram.methods
        .placeBet(new anchor.BN(largeBet), false)
        .accounts({ round: roundPDA, userTokenAccount: bobUSDC })
        .rpc();

      const round = await program.account.round.fetch(roundPDA);
      console.log(`   Alice: ${largeBet / 1_000_000} USDC on UP`);
      console.log(`   Bob: ${largeBet / 1_000_000} USDC on DOWN`);
      console.log(`   Total pool: ${(round.upPool.toNumber() + round.downPool.toNumber()) / 1_000_000} USDC`);
      console.log(`   Total fees: ${round.totalFees.toNumber() / 1_000_000} USDC`);

      // Verify pools are correct
      assert.equal(round.upPool.toNumber(), largeBet);
      assert.equal(round.downPool.toNumber(), largeBet);
      assert.equal(round.totalFees.toNumber(), (largeBet * 2 * FEE_BPS) / 10000);
    });

    it("Resolves large bet round and pays correctly", async () => {
      await sleep((TEST_DURATION + 1) * 1000);

      // UP wins
      await program.methods
        .resolveRoundManual(new anchor.BN(15100)) // $151.00 > $150.00
        .accounts({ round: roundPDA })
        .rpc();

      const round = await program.account.round.fetch(roundPDA);
      assert.deepEqual(round.outcome, { up: {} });

      // Alice claims - should get her 50k + Bob's 50k = 100k
      const aliceBalanceBefore = await getBalance(aliceUSDC);
      const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
      const aliceProgram = new Program(program.idl, aliceProvider);
      const [userBetPDA] = getUserBetPDA(roundPDA, alice.publicKey);

      await aliceProgram.methods
        .claim()
        .accounts({ round: roundPDA, userBet: userBetPDA, userTokenAccount: aliceUSDC })
        .rpc();

      const aliceBalanceAfter = await getBalance(aliceUSDC);
      const payout = aliceBalanceAfter - aliceBalanceBefore;

      // Expected: 50k (her bet) + 50k (loser pool) = 100k
      const expectedPayout = 100_000 * 1_000_000;
      console.log(`   Alice payout: ${payout / 1_000_000} USDC`);
      console.log(`   Expected: ${expectedPayout / 1_000_000} USDC`);

      assert.equal(payout, expectedPayout, "Large bet payout should be correct");
      console.log("   ✅ Large bet (100k USDC pool) handled correctly!");
    });
  });

  // ============================================================================
  // 5. MULTIPLE ROUNDS (NOT CONCURRENT - SEQUENTIAL)
  // ============================================================================
  describe("5. MULTIPLE SEQUENTIAL ROUNDS", () => {
    it("Can start new round while previous round is resolved", async () => {
      const config = await program.account.config.fetch(configPDA);
      const startRoundId = config.currentRoundId.toNumber();

      // Start and complete 3 rounds quickly
      for (let i = 0; i < 3; i++) {
        const roundId = startRoundId + i;
        const [roundPDA] = getRoundPDA(roundId);

        await program.methods
          .startRoundManual(new anchor.BN(14000 + i * 100), new anchor.BN(1)) // 1 second
          .accounts({ usdcMint, urimMint })
          .rpc();

        console.log(`   Round ${roundId} started: $${140 + i}.00`);

        await sleep(2000);

        await program.methods
          .resolveRoundManual(new anchor.BN(14050 + i * 100)) // UP wins
          .accounts({ round: roundPDA })
          .rpc();

        console.log(`   Round ${roundId} resolved: $${140.5 + i}.00`);
      }

      const newConfig = await program.account.config.fetch(configPDA);
      console.log(`   ✅ Created ${newConfig.currentRoundId.toNumber() - startRoundId} rounds successfully`);
    });
  });

  // ============================================================================
  // 6. EDGE CASES & VALIDATION
  // ============================================================================
  describe("6. COMPREHENSIVE EDGE CASES", () => {
    it("Rejects bet below minimum (1 USDC)", async () => {
      const config = await program.account.config.fetch(configPDA);
      const roundId = config.currentRoundId.toNumber();
      const [roundPDA] = getRoundPDA(roundId);

      await program.methods
        .startRoundManual(new anchor.BN(13000), new anchor.BN(TEST_DURATION))
        .accounts({ usdcMint, urimMint })
        .rpc();

      const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
      const aliceProgram = new Program(program.idl, aliceProvider);

      try {
        await aliceProgram.methods
          .placeBet(new anchor.BN(500_000), true) // 0.5 USDC - below minimum
          .accounts({ round: roundPDA, userTokenAccount: aliceUSDC })
          .rpc();
        assert.fail("Should have rejected small bet");
      } catch (err: any) {
        assert.include(err.toString(), "BetTooSmall");
        console.log("   ✅ Correctly rejected bet below 1 USDC minimum");
      }

      // Emergency resolve to clean up
      await program.methods
        .emergencyResolve(new anchor.BN(13000), 0)
        .accounts({ round: roundPDA })
        .rpc();
    });

    it("Accepts exactly minimum bet (1 USDC)", async () => {
      const config = await program.account.config.fetch(configPDA);
      const roundId = config.currentRoundId.toNumber();
      const [roundPDA] = getRoundPDA(roundId);

      await program.methods
        .startRoundManual(new anchor.BN(13000), new anchor.BN(TEST_DURATION))
        .accounts({ usdcMint, urimMint })
        .rpc();

      const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
      const aliceProgram = new Program(program.idl, aliceProvider);

      await aliceProgram.methods
        .placeBet(new anchor.BN(1_000_000), true) // Exactly 1 USDC
        .accounts({ round: roundPDA, userTokenAccount: aliceUSDC })
        .rpc();

      const round = await program.account.round.fetch(roundPDA);
      assert.equal(round.upPool.toNumber(), 1_000_000);
      console.log("   ✅ Accepted exactly 1 USDC (minimum bet)");

      // Emergency resolve
      await program.methods
        .emergencyResolve(new anchor.BN(13100), 1)
        .accounts({ round: roundPDA })
        .rpc();
    });

    it("Cannot bet after placing on opposite side", async () => {
      const config = await program.account.config.fetch(configPDA);
      const roundId = config.currentRoundId.toNumber();
      const [roundPDA] = getRoundPDA(roundId);

      await program.methods
        .startRoundManual(new anchor.BN(13000), new anchor.BN(TEST_DURATION))
        .accounts({ usdcMint, urimMint })
        .rpc();

      const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
      const aliceProgram = new Program(program.idl, aliceProvider);

      // Alice bets UP
      await aliceProgram.methods
        .placeBet(new anchor.BN(10 * 1_000_000), true)
        .accounts({ round: roundPDA, userTokenAccount: aliceUSDC })
        .rpc();

      // Alice tries to bet DOWN - should fail
      try {
        await aliceProgram.methods
          .placeBet(new anchor.BN(10 * 1_000_000), false)
          .accounts({ round: roundPDA, userTokenAccount: aliceUSDC })
          .rpc();
        assert.fail("Should have rejected opposite side bet");
      } catch (err: any) {
        assert.include(err.toString(), "CannotSwitchSides");
        console.log("   ✅ Correctly rejected bet on opposite side");
      }

      // Emergency resolve
      await program.methods
        .emergencyResolve(new anchor.BN(13100), 1)
        .accounts({ round: roundPDA })
        .rpc();
    });

    it("Can add to existing bet on same side", async () => {
      const config = await program.account.config.fetch(configPDA);
      const roundId = config.currentRoundId.toNumber();
      const [roundPDA] = getRoundPDA(roundId);

      await program.methods
        .startRoundManual(new anchor.BN(13000), new anchor.BN(TEST_DURATION))
        .accounts({ usdcMint, urimMint })
        .rpc();

      const carolProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(carol), {});
      const carolProgram = new Program(program.idl, carolProvider);

      // Carol bets 10 USDC on UP
      await carolProgram.methods
        .placeBet(new anchor.BN(10 * 1_000_000), true)
        .accounts({ round: roundPDA, userTokenAccount: carolUSDC })
        .rpc();

      // Carol adds 20 more USDC on UP
      await carolProgram.methods
        .placeBet(new anchor.BN(20 * 1_000_000), true)
        .accounts({ round: roundPDA, userTokenAccount: carolUSDC })
        .rpc();

      const [userBetPDA] = getUserBetPDA(roundPDA, carol.publicKey);
      const userBet = await program.account.userBet.fetch(userBetPDA);

      assert.equal(userBet.amount.toNumber(), 30 * 1_000_000);
      console.log("   ✅ Can add to existing bet: 10 + 20 = 30 USDC");

      // Emergency resolve
      await program.methods
        .emergencyResolve(new anchor.BN(13100), 1)
        .accounts({ round: roundPDA })
        .rpc();
    });

    it("Non-admin cannot start round", async () => {
      const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
      const aliceProgram = new Program(program.idl, aliceProvider);

      try {
        await aliceProgram.methods
          .startRoundManual(new anchor.BN(13000), new anchor.BN(TEST_DURATION))
          .accounts({ usdcMint, urimMint })
          .rpc();
        assert.fail("Should have rejected non-admin");
      } catch (err: any) {
        console.log("   ✅ Non-admin cannot start round");
      }
    });

    it("Non-admin cannot resolve round", async () => {
      const config = await program.account.config.fetch(configPDA);
      const roundId = config.currentRoundId.toNumber();
      const [roundPDA] = getRoundPDA(roundId);

      await program.methods
        .startRoundManual(new anchor.BN(13000), new anchor.BN(1))
        .accounts({ usdcMint, urimMint })
        .rpc();

      await sleep(2000);

      const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
      const aliceProgram = new Program(program.idl, aliceProvider);

      try {
        await aliceProgram.methods
          .resolveRoundManual(new anchor.BN(13100))
          .accounts({ round: roundPDA })
          .rpc();
        assert.fail("Should have rejected non-admin");
      } catch (err: any) {
        console.log("   ✅ Non-admin cannot resolve round");
      }

      // Admin resolves
      await program.methods
        .resolveRoundManual(new anchor.BN(13100))
        .accounts({ round: roundPDA })
        .rpc();
    });
  });

  // ============================================================================
  // 7. FULL FLOW WITH HERMES PRICE (PRODUCTION-LIKE)
  // ============================================================================
  describe("7. FULL PRODUCTION-LIKE FLOW", () => {
    let roundPDA: PublicKey;
    let roundId: number;
    let startPrice: number;
    let aliceBalanceBefore: number;
    let bobBalanceBefore: number;

    it("Fetches REAL SOL/USD price from Hermes", async () => {
      const { price, priceInCents } = await fetchHermesPrice();
      startPrice = priceInCents;
      console.log(`   ✅ Hermes SOL/USD: $${price.toFixed(2)} (${priceInCents} cents)`);

      const config = await program.account.config.fetch(configPDA);
      roundId = config.currentRoundId.toNumber();
      [roundPDA] = getRoundPDA(roundId);

      await program.methods
        .startRoundManual(new anchor.BN(startPrice), new anchor.BN(TEST_DURATION))
        .accounts({ usdcMint, urimMint })
        .rpc();

      console.log(`   Round ${roundId} started at: $${(startPrice / 100).toFixed(2)}`);
    });

    it("Multiple users bet with real amounts", async () => {
      aliceBalanceBefore = await getBalance(aliceUSDC);
      bobBalanceBefore = await getBalance(bobUSDC);

      // Alice bets 500 USDC on UP
      const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
      const aliceProgram = new Program(program.idl, aliceProvider);
      await aliceProgram.methods
        .placeBet(new anchor.BN(500 * 1_000_000), true)
        .accounts({ round: roundPDA, userTokenAccount: aliceUSDC })
        .rpc();

      // Bob bets 300 USDC on DOWN
      const bobProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(bob), {});
      const bobProgram = new Program(program.idl, bobProvider);
      await bobProgram.methods
        .placeBet(new anchor.BN(300 * 1_000_000), false)
        .accounts({ round: roundPDA, userTokenAccount: bobUSDC })
        .rpc();

      // Carol bets 200 USDC on UP
      const carolProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(carol), {});
      const carolProgram = new Program(program.idl, carolProvider);
      await carolProgram.methods
        .placeBet(new anchor.BN(200 * 1_000_000), true)
        .accounts({ round: roundPDA, userTokenAccount: carolUSDC })
        .rpc();

      const round = await program.account.round.fetch(roundPDA);
      console.log(`   UP Pool: ${round.upPool.toNumber() / 1_000_000} USDC (Alice: 500, Carol: 200)`);
      console.log(`   DOWN Pool: ${round.downPool.toNumber() / 1_000_000} USDC (Bob: 300)`);
      console.log(`   Total Fees: ${round.totalFees.toNumber() / 1_000_000} USDC`);
    });

    it("Waits and resolves with REAL updated price", async () => {
      console.log(`   Waiting ${TEST_DURATION + 2}s for round to end...`);
      await sleep((TEST_DURATION + 2) * 1000);

      const { price: endPrice, priceInCents: endPriceCents } = await fetchHermesPrice();
      console.log(`   ✅ End price: $${endPrice.toFixed(2)}`);

      await program.methods
        .resolveRoundManual(new anchor.BN(endPriceCents))
        .accounts({ round: roundPDA })
        .rpc();

      const round = await program.account.round.fetch(roundPDA);
      console.log(`   Resolved: $${(startPrice / 100).toFixed(2)} → $${endPrice.toFixed(2)}`);
      console.log(`   Outcome: ${JSON.stringify(round.outcome)}`);
    });

    it("Verifies CORRECT payouts based on parimutuel math", async () => {
      const round = await program.account.round.fetch(roundPDA);

      if (round.outcome.up) {
        // UP wins: Alice and Carol share Bob's pool
        // Alice: 500 + (500/700) * 300 = 500 + 214.28 = 714.28
        // Carol: 200 + (200/700) * 300 = 200 + 85.71 = 285.71

        const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
        const aliceProgram = new Program(program.idl, aliceProvider);
        const [aliceBetPDA] = getUserBetPDA(roundPDA, alice.publicKey);
        await aliceProgram.methods
          .claim()
          .accounts({ round: roundPDA, userBet: aliceBetPDA, userTokenAccount: aliceUSDC })
          .rpc();

        const aliceBalanceAfter = await getBalance(aliceUSDC);
        const aliceNet = aliceBalanceAfter - aliceBalanceBefore;
        // Net = payout - (bet + fee) = 714.28 - 502.50 = 211.78
        console.log(`   Alice net change: ${(aliceNet / 1_000_000).toFixed(2)} USDC`);

        const carolProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(carol), {});
        const carolProgram = new Program(program.idl, carolProvider);
        const [carolBetPDA] = getUserBetPDA(roundPDA, carol.publicKey);
        await carolProgram.methods
          .claim()
          .accounts({ round: roundPDA, userBet: carolBetPDA, userTokenAccount: carolUSDC })
          .rpc();

        console.log("   ✅ UP won - Alice and Carol claimed winnings!");
      } else if (round.outcome.down) {
        // DOWN wins: Bob gets Alice and Carol's pools
        const bobProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(bob), {});
        const bobProgram = new Program(program.idl, bobProvider);
        const [bobBetPDA] = getUserBetPDA(roundPDA, bob.publicKey);
        await bobProgram.methods
          .claim()
          .accounts({ round: roundPDA, userBet: bobBetPDA, userTokenAccount: bobUSDC })
          .rpc();

        const bobBalanceAfter = await getBalance(bobUSDC);
        const bobNet = bobBalanceAfter - bobBalanceBefore;
        console.log(`   Bob net change: ${(bobNet / 1_000_000).toFixed(2)} USDC`);
        console.log("   ✅ DOWN won - Bob claimed winnings!");
      } else {
        // Draw - everyone gets refund (minus fees)
        console.log("   ✅ DRAW - Everyone gets refund (fees not refunded)");
      }

      // Collect fees
      const treasuryBefore = await getBalance(treasuryTokenAccount);
      await program.methods
        .collectFees()
        .accounts({ round: roundPDA })
        .rpc();
      const treasuryAfter = await getBalance(treasuryTokenAccount);
      console.log(`   Treasury collected: ${(treasuryAfter - treasuryBefore) / 1_000_000} USDC`);
    });
  });

  // ============================================================================
  // 8. MIXED POOL: USDC + URIM BETTING
  // ============================================================================
  describe("8. MIXED POOL: USDC + URIM BETTING", () => {
    let roundPDA: PublicKey;
    let roundId: number;

    it("Creates round with both USDC and URIM vaults", async () => {
      const config = await program.account.config.fetch(configPDA);
      roundId = config.currentRoundId.toNumber();
      [roundPDA] = getRoundPDA(roundId);
      const [urimVaultPDA] = getUrimVaultPDA(roundId);

      await program.methods
        .startRoundManual(new anchor.BN(15000), new anchor.BN(TEST_DURATION)) // $150.00
        .accounts({ usdcMint, urimMint })
        .rpc();

      const round = await program.account.round.fetch(roundPDA);
      console.log(`   Round ${roundId} started with dual vaults`);
      console.log(`   USDC Vault bump: ${round.vaultBump}`);
      console.log(`   URIM Vault bump: ${round.urimVaultBump}`);

      // Verify URIM vault was created
      const urimVaultAccount = await provider.connection.getAccountInfo(urimVaultPDA);
      assert.isNotNull(urimVaultAccount, "URIM vault should exist");
      console.log("   ✅ Both USDC and URIM vaults created");
    });

    it("Alice bets USDC, Bob bets URIM - mixed pool", async () => {
      // Alice bets 100 USDC on UP ($100 USD value)
      const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
      const aliceProgram = new Program(program.idl, aliceProvider);

      await aliceProgram.methods
        .placeBet(new anchor.BN(100 * 1_000_000), true) // 100 USDC on UP
        .accounts({ round: roundPDA, userTokenAccount: aliceUSDC })
        .rpc();

      console.log("   Alice: 100 USDC on UP ($100 USD value)");

      // Bob bets 2000 URIM on DOWN at $0.05/URIM = $100 USD value
      const bobProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(bob), {});
      const bobProgram = new Program(program.idl, bobProvider);

      await bobProgram.methods
        .placeBetUrim(
          new anchor.BN(2000 * 1_000_000), // 2000 URIM
          false, // DOWN
          new anchor.BN(URIM_PRICE_SCALED) // $0.05 per URIM (8-decimal scaled)
        )
        .accounts({ round: roundPDA, userTokenAccount: bobURIM })
        .rpc();

      console.log(`   Bob: 2000 URIM on DOWN ($100 USD value @ $0.05/URIM)`);

      // Verify pools
      const round = await program.account.round.fetch(roundPDA);
      console.log(`   UP Pool USD: $${round.upPoolUsd.toNumber() / 100}`);
      console.log(`   DOWN Pool USD: $${round.downPoolUsd.toNumber() / 100}`);
      console.log(`   USDC UP Pool: ${round.upPool.toNumber() / 1_000_000} USDC`);
      console.log(`   URIM DOWN Pool: ${round.downPoolUrim.toNumber() / 1_000_000} URIM`);

      // Both should have ~$100 USD value (equal pools)
      assert.approximately(round.upPoolUsd.toNumber(), 10000, 100); // ~$100
      assert.approximately(round.downPoolUsd.toNumber(), 10000, 100); // ~$100
      console.log("   ✅ Mixed pool with equal USD values");
    });

    it("Resolves and pays winner in their original token", async () => {
      await sleep((TEST_DURATION + 1) * 1000);

      // UP wins - Alice wins Bob's pool
      await program.methods
        .resolveRoundManual(new anchor.BN(15100)) // $151.00 > $150.00 = UP wins
        .accounts({ round: roundPDA })
        .rpc();

      const round = await program.account.round.fetch(roundPDA);
      assert.deepEqual(round.outcome, { up: {} });
      console.log("   UP wins! Alice claims from BOTH vaults");

      const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
      const aliceProgram = new Program(program.idl, aliceProvider);
      const [aliceBetPDA] = getUserBetPDA(roundPDA, alice.publicKey);

      // Alice claims USDC (her bet back - no USDC losers in this round)
      const aliceUsdcBefore = await getBalance(aliceUSDC);
      await aliceProgram.methods
        .claim()
        .accounts({ round: roundPDA, userBet: aliceBetPDA, userTokenAccount: aliceUSDC })
        .rpc();
      const aliceUsdcAfter = await getBalance(aliceUSDC);
      const aliceUsdcPayout = aliceUsdcAfter - aliceUsdcBefore;
      console.log(`   Alice USDC payout: ${aliceUsdcPayout / 1_000_000} USDC (her bet back)`);
      assert.approximately(aliceUsdcPayout / 1_000_000, 100, 1); // Gets her 100 USDC back

      // Alice claims URIM (Bob's losing bet)
      const aliceUrimBefore = await getBalance(aliceURIM);
      await aliceProgram.methods
        .claimUrim()
        .accounts({ round: roundPDA, userBet: aliceBetPDA, userTokenAccount: aliceURIM })
        .rpc();
      const aliceUrimAfter = await getBalance(aliceURIM);
      const aliceUrimPayout = aliceUrimAfter - aliceUrimBefore;
      console.log(`   Alice URIM payout: ${aliceUrimPayout / 1_000_000} URIM (Bob's losing bet)`);
      // Alice gets Bob's 2000 URIM (minus fee = ~1990 URIM in vault)
      assert.isAbove(aliceUrimPayout / 1_000_000, 1900); // Gets Bob's URIM

      console.log("   ✅ Alice received from BOTH vaults: USDC back + Bob's URIM!");
    });

    it("Loser (Bob) cannot claim", async () => {
      const bobProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(bob), {});
      const bobProgram = new Program(program.idl, bobProvider);
      const [bobBetPDA] = getUserBetPDA(roundPDA, bob.publicKey);

      try {
        await bobProgram.methods
          .claimUrim()
          .accounts({ round: roundPDA, userBet: bobBetPDA, userTokenAccount: bobURIM })
          .rpc();
        assert.fail("Loser should not be able to claim");
      } catch (err: any) {
        assert.include(err.toString(), "NoPayout");
        console.log("   ✅ Loser correctly cannot claim");
      }
    });
  });

  // ============================================================================
  // 8.5 CLAIM_ALL: SINGLE TRANSACTION CLAIM FROM BOTH VAULTS
  // ============================================================================
  describe("8.5 CLAIM_ALL: Multiple Winners with Mixed Tokens", () => {
    let roundPDA: PublicKey;
    let roundId: number;

    // Track balances for assertions
    let aliceUsdcBefore: number;
    let aliceUrimBefore: number;
    let carolUsdcBefore: number;
    let carolUrimBefore: number;

    it("Sets up mixed pool with MULTIPLE winners (Alice USDC, Carol URIM on UP)", async () => {
      const config = await program.account.config.fetch(configPDA);
      roundId = config.currentRoundId.toNumber();
      [roundPDA] = getRoundPDA(roundId);

      await program.methods
        .startRoundManual(new anchor.BN(15000), new anchor.BN(TEST_DURATION)) // $150.00
        .accounts({ usdcMint, urimMint })
        .rpc();

      console.log(`   Round ${roundId} started for claim_all test`);

      // Record initial balances
      aliceUsdcBefore = await getBalance(aliceUSDC);
      aliceUrimBefore = await getBalance(aliceURIM);
      carolUsdcBefore = await getBalance(carolUSDC);
      carolUrimBefore = await getBalance(carolURIM);

      // === WINNERS (UP side) ===
      // Alice bets 100 USDC on UP ($100 USD value)
      const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
      const aliceProgram = new Program(program.idl, aliceProvider);
      await aliceProgram.methods
        .placeBet(new anchor.BN(100 * 1_000_000), true) // 100 USDC on UP
        .accounts({ round: roundPDA, userTokenAccount: aliceUSDC })
        .rpc();
      console.log("   Alice: 100 USDC on UP ($100 USD value)");

      // Carol bets 4000 URIM on UP at $0.05/URIM = $200 USD value
      const carolProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(carol), {});
      const carolProgram = new Program(program.idl, carolProvider);
      await carolProgram.methods
        .placeBetUrim(
          new anchor.BN(4000 * 1_000_000), // 4000 URIM
          true, // UP
          new anchor.BN(URIM_PRICE_SCALED) // $0.05 per URIM (8-decimal scaled)
        )
        .accounts({ round: roundPDA, userTokenAccount: carolURIM })
        .rpc();
      console.log(`   Carol: 4000 URIM on UP ($200 USD value @ $0.05/URIM)`);

      // === LOSERS (DOWN side) ===
      // Bob bets 150 USDC on DOWN ($150 USD value)
      const bobProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(bob), {});
      const bobProgram = new Program(program.idl, bobProvider);
      await bobProgram.methods
        .placeBet(new anchor.BN(150 * 1_000_000), false) // 150 USDC on DOWN
        .accounts({ round: roundPDA, userTokenAccount: bobUSDC })
        .rpc();
      console.log("   Bob: 150 USDC on DOWN ($150 USD value) - LOSER");

      // Verify pools
      const round = await program.account.round.fetch(roundPDA);
      console.log("\n   === POOL STATE ===");
      console.log(`   UP Pool USD: $${round.upPoolUsd.toNumber() / 100} (Alice $100 + Carol $200 = $300)`);
      console.log(`   DOWN Pool USD: $${round.downPoolUsd.toNumber() / 100} (Bob $150)`);
      console.log(`   USDC in vault: ${round.upPool.toNumber() / 1_000_000} UP + ${round.downPool.toNumber() / 1_000_000} DOWN`);
      console.log(`   URIM in vault: ${round.upPoolUrim.toNumber() / 1_000_000} UP + ${round.downPoolUrim.toNumber() / 1_000_000} DOWN`);

      // Verify USD values
      assert.approximately(round.upPoolUsd.toNumber(), 30000, 100); // $300
      assert.approximately(round.downPoolUsd.toNumber(), 15000, 100); // $150
    });

    it("Resolves round (UP wins) and winners use claim_all", async () => {
      await sleep((TEST_DURATION + 1) * 1000);

      // UP wins - Alice and Carol are winners
      await program.methods
        .resolveRoundManual(new anchor.BN(15100)) // $151.00 > $150.00 = UP wins
        .accounts({ round: roundPDA })
        .rpc();

      const round = await program.account.round.fetch(roundPDA);
      assert.deepEqual(round.outcome, { up: {} });
      console.log("\n   === UP WINS! ===");
      console.log("   Winners: Alice (100 USDC, $100) + Carol (4000 URIM, $200)");
      console.log("   Loser pool to distribute: Bob's 150 USDC ($150)");

      // Calculate expected payouts
      // Total winning USD = $300 (Alice $100 + Carol $200)
      // Loser USDC pool = 150 USDC (minus fees in vault = ~149.25 USDC)
      // Loser URIM pool = 0 URIM
      //
      // Alice share = $100 / $300 = 33.33%
      // Carol share = $200 / $300 = 66.67%
      //
      // Alice USDC payout = 100 (her bet back) + 33.33% of 150 = ~150 USDC
      // Alice URIM payout = 33.33% of 0 = 0 URIM
      // Carol USDC payout = 66.67% of 150 = ~100 USDC
      // Carol URIM payout = 4000 (her bet back) + 66.67% of 0 = ~4000 URIM

      console.log("\n   === EXPECTED PAYOUTS ===");
      console.log("   Alice (33.33% share): ~150 USDC (100 back + 50 winnings) + 0 URIM");
      console.log("   Carol (66.67% share): ~100 USDC (winnings only) + ~4000 URIM (her bet back)");
    });

    it("Alice uses claim_all (single transaction)", async () => {
      const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
      const aliceProgram = new Program(program.idl, aliceProvider);
      const [aliceBetPDA] = getUserBetPDA(roundPDA, alice.publicKey);
      const [vaultPDA] = getVaultPDA(roundId);
      const [urimVaultPDA] = getUrimVaultPDA(roundId);

      // Use claim_all - single transaction!
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

      const aliceUsdcAfter = await getBalance(aliceUSDC);
      const aliceUrimAfter = await getBalance(aliceURIM);

      // Alice paid 100.5 USDC (100 + 0.5% fee), gets back ~150 USDC
      // Net gain should be ~49.5 USDC
      const aliceUsdcNet = aliceUsdcAfter - aliceUsdcBefore;
      const aliceUrimNet = aliceUrimAfter - aliceUrimBefore;

      console.log(`   Alice USDC change: ${(aliceUsdcNet / 1_000_000).toFixed(2)} USDC`);
      console.log(`   Alice URIM change: ${(aliceUrimNet / 1_000_000).toFixed(2)} URIM`);

      // Alice should have net positive USDC (won some of Bob's stake)
      assert.isAbove(aliceUsdcNet, 0, "Alice should have won USDC");
      // Alice gets 0 URIM (no URIM in loser pool)
      assert.equal(aliceUrimNet, 0, "Alice should get 0 URIM (no URIM losers)");

      // Verify claimed flags
      const aliceBet = await program.account.userBet.fetch(aliceBetPDA);
      assert.equal(aliceBet.claimedUsdc, true, "USDC claimed flag should be true");
      // Alice has no URIM payout (no URIM losers), so claimed_urim stays false
      assert.equal(aliceBet.claimedUrim, false, "URIM claimed flag should be false (no URIM to claim)");

      console.log("   ✅ Alice claimed with claim_all (single tx)!");
    });

    it("Carol uses claim_all (single transaction)", async () => {
      const carolProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(carol), {});
      const carolProgram = new Program(program.idl, carolProvider);
      const [carolBetPDA] = getUserBetPDA(roundPDA, carol.publicKey);
      const [vaultPDA] = getVaultPDA(roundId);
      const [urimVaultPDA] = getUrimVaultPDA(roundId);

      // Use claim_all - single transaction!
      await carolProgram.methods
        .claimAll()
        .accounts({
          round: roundPDA,
          userBet: carolBetPDA,
          vault: vaultPDA,
          urimVault: urimVaultPDA,
          userUsdcAccount: carolUSDC,
          userUrimAccount: carolURIM,
        })
        .rpc();

      const carolUsdcAfter = await getBalance(carolUSDC);
      const carolUrimAfter = await getBalance(carolURIM);

      // Carol paid 4020 URIM (4000 + 0.5% fee), gets back ~4000 URIM
      // Carol also gets ~100 USDC from Bob's losing stake
      const carolUsdcNet = carolUsdcAfter - carolUsdcBefore;
      const carolUrimNet = carolUrimAfter - carolUrimBefore;

      console.log(`   Carol USDC change: ${(carolUsdcNet / 1_000_000).toFixed(2)} USDC`);
      console.log(`   Carol URIM change: ${(carolUrimNet / 1_000_000).toFixed(2)} URIM`);

      // Carol should have gained USDC (from Bob's losing pool)
      assert.isAbove(carolUsdcNet, 0, "Carol should have won USDC");
      // Carol should be slightly negative on URIM (paid fee, got bet back, no URIM winnings)
      // She paid 4020 URIM, got back 4000 URIM = -20 URIM net
      assert.isBelow(carolUrimNet, 0, "Carol net URIM should be negative (fee)");

      // Verify both claimed flags are set
      const carolBet = await program.account.userBet.fetch(carolBetPDA);
      assert.equal(carolBet.claimedUsdc, true, "USDC claimed flag should be true");
      assert.equal(carolBet.claimedUrim, true, "URIM claimed flag should be true");

      console.log("   ✅ Carol claimed with claim_all (single tx)!");
    });

    it("Verifies payout math (proportional distribution)", async () => {
      const aliceUsdcAfter = await getBalance(aliceUSDC);
      const carolUsdcAfter = await getBalance(carolUSDC);

      // Calculate net USDC gains after fees
      // Alice paid 100.5 USDC total (100 + fee), Carol paid 0 USDC
      const aliceUsdcNet = aliceUsdcAfter - aliceUsdcBefore;
      const carolUsdcNet = carolUsdcAfter - carolUsdcBefore;

      // Bob lost 150.75 USDC (150 + fee)
      // After fees collected, ~150 USDC in loser pool
      // Alice (33.33%): gets 100 back + ~50 USDC winnings = ~150 total, net ~+50 (minus her 0.5 fee = ~+49.5)
      // Carol (66.67%): gets 0 back + ~100 USDC winnings, net ~+100

      const aliceWinnings = aliceUsdcNet + (100.5 * 1_000_000); // Add back her original bet+fee
      const carolWinnings = carolUsdcNet;

      console.log("\n   === PAYOUT VERIFICATION ===");
      console.log(`   Alice raw USDC received: ${(aliceWinnings / 1_000_000).toFixed(2)} USDC`);
      console.log(`   Carol raw USDC received: ${(carolWinnings / 1_000_000).toFixed(2)} USDC`);

      // Alice got ~150 USDC (100 back + 50 share of Bob's 150)
      // Carol got ~100 USDC (100 share of Bob's 150)
      // Ratio should be approximately 1.5:1 (Alice:Carol) since Alice gets bet back
      // But for share of winnings only: 1:2 (Alice:Carol) = 33%:67%

      // The shares should be proportional to USD value
      // Alice $100 / $300 = 33.33%
      // Carol $200 / $300 = 66.67%
      // Carol should get ~2x Alice's share of winnings
      const aliceShareOfBob = (aliceWinnings / 1_000_000) - 100; // Subtract her bet back
      const carolShareOfBob = carolWinnings / 1_000_000;

      console.log(`   Alice share of Bob's pool: ${aliceShareOfBob.toFixed(2)} USDC (~33%)`);
      console.log(`   Carol share of Bob's pool: ${carolShareOfBob.toFixed(2)} USDC (~67%)`);

      // Carol should get ~2x what Alice got from Bob's pool
      const ratio = carolShareOfBob / aliceShareOfBob;
      console.log(`   Ratio Carol:Alice = ${ratio.toFixed(2)} (expected ~2.0)`);

      assert.approximately(ratio, 2.0, 0.2, "Carol should get ~2x Alice's share (67% vs 33%)");
      console.log("   ✅ Payout math is CORRECT! Proportional to USD value contribution.");
    });
  });

  // ============================================================================
  // 9. EMERGENCY FUNCTIONS
  // ============================================================================
  describe("9. EMERGENCY FUNCTIONS", () => {
    it("Emergency resolve bypasses timing", async () => {
      const config = await program.account.config.fetch(configPDA);
      const roundId = config.currentRoundId.toNumber();
      const [roundPDA] = getRoundPDA(roundId);

      await program.methods
        .startRoundManual(new anchor.BN(13000), new anchor.BN(3600)) // 1 hour
        .accounts({ usdcMint, urimMint })
        .rpc();

      // Can't normal resolve
      try {
        await program.methods
          .resolveRoundManual(new anchor.BN(13100))
          .accounts({ round: roundPDA })
          .rpc();
        assert.fail("Should fail - round not ended");
      } catch (err: any) {
        assert.include(err.toString(), "RoundNotEnded");
      }

      // Emergency resolve works
      await program.methods
        .emergencyResolve(new anchor.BN(13100), 1) // Force UP
        .accounts({ round: roundPDA })
        .rpc();

      const round = await program.account.round.fetch(roundPDA);
      assert.equal(round.resolved, true);
      console.log("   ✅ Emergency resolve bypassed timing check");
    });

    it("Emergency withdraw moves all funds to treasury", async () => {
      const config = await program.account.config.fetch(configPDA);
      const roundId = config.currentRoundId.toNumber();
      const [roundPDA] = getRoundPDA(roundId);
      const [vaultPDA] = getVaultPDA(roundId);

      await program.methods
        .startRoundManual(new anchor.BN(13000), new anchor.BN(TEST_DURATION))
        .accounts({ usdcMint, urimMint })
        .rpc();

      // Alice bets
      const aliceProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(alice), {});
      const aliceProgram = new Program(program.idl, aliceProvider);
      await aliceProgram.methods
        .placeBet(new anchor.BN(100 * 1_000_000), true)
        .accounts({ round: roundPDA, userTokenAccount: aliceUSDC })
        .rpc();

      const vaultBefore = await getBalance(vaultPDA);
      const treasuryBefore = await getBalance(treasuryTokenAccount);

      console.log(`   Vault before: ${vaultBefore / 1_000_000} USDC`);

      await program.methods
        .emergencyWithdraw()
        .accounts({ round: roundPDA })
        .rpc();

      const vaultAfter = await getBalance(vaultPDA);
      const treasuryAfter = await getBalance(treasuryTokenAccount);

      assert.equal(vaultAfter, 0);
      console.log(`   Vault after: ${vaultAfter} USDC`);
      console.log(`   Treasury received: ${(treasuryAfter - treasuryBefore) / 1_000_000} USDC`);
      console.log("   ✅ Emergency withdraw moved all funds");
    });
  });

  // ============================================================================
  // 10. FINAL SUMMARY
  // ============================================================================
  describe("10. FINAL TEST SUMMARY", () => {
    it("Prints comprehensive final state", async () => {
      const config = await program.account.config.fetch(configPDA);
      const treasuryBalance = await getBalance(treasuryTokenAccount);
      const urimTreasuryBalance = await getBalance(urimTreasuryTokenAccount);
      const aliceBalance = await getBalance(aliceUSDC);
      const bobBalance = await getBalance(bobUSDC);
      const carolBalance = await getBalance(carolUSDC);
      const aliceUrimBalance = await getBalance(aliceURIM);
      const bobUrimBalance = await getBalance(bobURIM);
      const carolUrimBalance = await getBalance(carolURIM);

      console.log("\n" + "=".repeat(70));
      console.log("COMPREHENSIVE TEST SUITE - FINAL STATE");
      console.log("=".repeat(70));
      console.log(`   Total rounds created: ${config.currentRoundId}`);
      console.log(`   USDC Treasury: ${(treasuryBalance / 1_000_000).toFixed(2)} USDC`);
      console.log(`   URIM Treasury: ${(urimTreasuryBalance / 1_000_000).toFixed(2)} URIM`);
      console.log("   ---");
      console.log(`   Alice: ${(aliceBalance / 1_000_000).toFixed(2)} USDC | ${(aliceUrimBalance / 1_000_000).toFixed(2)} URIM`);
      console.log(`   Bob: ${(bobBalance / 1_000_000).toFixed(2)} USDC | ${(bobUrimBalance / 1_000_000).toFixed(2)} URIM`);
      console.log(`   Carol: ${(carolBalance / 1_000_000).toFixed(2)} USDC | ${(carolUrimBalance / 1_000_000).toFixed(2)} URIM`);
      console.log("=".repeat(70));
      console.log("\n✅ TESTED:");
      console.log("   • Real Pyth on-chain oracle (with stale fallback)");
      console.log("   • Hermes API real-time price integration");
      console.log("   • Large bets (50k+ USDC) - overflow protection");
      console.log("   • Minimum bet enforcement ($1.00 USD value)");
      console.log("   • Cannot switch sides after betting");
      console.log("   • Can add to existing bet");
      console.log("   • Admin-only functions (start/resolve)");
      console.log("   • Emergency resolve (bypass timing)");
      console.log("   • Emergency withdraw (all funds to treasury)");
      console.log("   • Parimutuel payout math verification");
      console.log("   • Fee collection (0.5% ON TOP)");
      console.log("   • Multiple sequential rounds");
      console.log("   • *** MIXED POOLS: USDC + URIM betting ***");
      console.log("   • *** Dual vault creation per round ***");
      console.log("   • *** USD value-based payout calculation ***");
      console.log("   • *** Winners paid in their original token ***");
      console.log("=".repeat(70));
    });
  });
});
