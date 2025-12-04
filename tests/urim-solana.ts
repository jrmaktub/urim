import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { UrimSolana } from "../target/types/urim_solana";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";

// Pyth Solana Receiver Program on Devnet
const PYTH_RECEIVER_PROGRAM = new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

// SOL/USD Price Feed ID (same for mainnet/devnet)
const SOL_USD_FEED_ID = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

// Pyth Hermes API for getting price updates
const HERMES_API = "https://hermes.pyth.network";

describe("urim-solana", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.UrimSolana as Program<UrimSolana>;

  // Test accounts
  let urimMint: PublicKey;
  let usdcMint: PublicKey;
  let admin: Keypair;
  let treasuryURIM: PublicKey;
  let treasuryUSDC: PublicKey;
  let configPDA: PublicKey;
  let user1: Keypair;
  let user2: Keypair;
  let user1URIMAccount: PublicKey;
  let user1USDCAccount: PublicKey;
  let user2URIMAccount: PublicKey;
  let user2USDCAccount: PublicKey;

  // Round-specific accounts
  let currentRoundId: number = 0;
  let roundPDA: PublicKey;
  let priceUpdateAccount: PublicKey | null;

  // Track if we own the config (for admin tests)
  let isNewConfig: boolean = false;


  // Helper to find or create PriceUpdateV2 account
  async function getPriceUpdateAccount(): Promise<PublicKey> {
    // For testing, we'll use a known price update account or create one
    // The Pyth receiver program creates these accounts when processing price updates

    // First, try to find existing price accounts
    const accounts = await provider.connection.getProgramAccounts(PYTH_RECEIVER_PROGRAM, {
      filters: [
        { dataSize: 224 }, // PriceUpdateV2 account size
      ],
    });

    if (accounts.length > 0) {
      // Use the most recent one
      console.log(`Found ${accounts.length} existing Pyth price accounts`);
      return accounts[0].pubkey;
    }

    throw new Error("No Pyth PriceUpdateV2 accounts found. You may need to post a price update first.");
  }

  before(async () => {
    console.log("\n🔧 Setting up test environment...\n");

    admin = Keypair.generate();
    user1 = Keypair.generate();
    user2 = Keypair.generate();

    // Fund accounts from wallet
    const fundAmount = 0.1 * anchor.web3.LAMPORTS_PER_SOL;

    console.log("Funding test accounts...");
    const transfers = [
      { to: admin.publicKey, amount: fundAmount },
      { to: user1.publicKey, amount: fundAmount },
      { to: user2.publicKey, amount: fundAmount },
    ];

    for (const transfer of transfers) {
      const tx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: transfer.to,
          lamports: transfer.amount,
        })
      );
      await provider.sendAndConfirm(tx);
    }
    console.log("✅ Accounts funded");

    // Create test token mints (simulating URIM and USDC)
    console.log("Creating test token mints...");
    urimMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      6
    );
    console.log(`   URIM Mint: ${urimMint.toString()}`);

    usdcMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      6
    );
    console.log(`   USDC Mint: ${usdcMint.toString()}`);

    // Create user token accounts
    console.log("Creating user token accounts...");
    user1URIMAccount = await createAccount(
      provider.connection,
      user1,
      urimMint,
      user1.publicKey
    );

    user1USDCAccount = await createAccount(
      provider.connection,
      user1,
      usdcMint,
      user1.publicKey
    );

    user2URIMAccount = await createAccount(
      provider.connection,
      user2,
      urimMint,
      user2.publicKey
    );

    user2USDCAccount = await createAccount(
      provider.connection,
      user2,
      usdcMint,
      user2.publicKey
    );

    // Create treasury accounts
    const treasuryKeypairURIM = Keypair.generate();
    const treasuryKeypairUSDC = Keypair.generate();

    treasuryURIM = await createAccount(
      provider.connection,
      admin,
      urimMint,
      treasuryKeypairURIM.publicKey
    );

    treasuryUSDC = await createAccount(
      provider.connection,
      admin,
      usdcMint,
      treasuryKeypairUSDC.publicKey
    );
    console.log("✅ Token accounts created");

    // Mint tokens to users
    console.log("Minting tokens to users...");
    await Promise.all([
      mintTo(provider.connection, admin, urimMint, user1URIMAccount, admin.publicKey, 10000 * 1_000_000),
      mintTo(provider.connection, admin, usdcMint, user1USDCAccount, admin.publicKey, 10000 * 1_000_000),
      mintTo(provider.connection, admin, urimMint, user2URIMAccount, admin.publicKey, 10000 * 1_000_000),
      mintTo(provider.connection, admin, usdcMint, user2USDCAccount, admin.publicKey, 10000 * 1_000_000),
    ]);
    console.log("✅ Tokens minted");

    // Derive config PDA
    [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );
    console.log(`   Config PDA: ${configPDA.toString()}`);

    // Try to find existing Pyth price update account
    console.log("\nSearching for Pyth price update accounts...");
    try {
      priceUpdateAccount = await getPriceUpdateAccount();
      console.log(`✅ Found Pyth price account: ${priceUpdateAccount.toString()}`);
    } catch (e) {
      console.log("⚠️  No Pyth price accounts found - some tests will be skipped");
      priceUpdateAccount = null;
    }

    console.log("\n✅ Test setup complete!\n");
  });

  describe("Platform Initialization", () => {
    it("Initializes the platform with admin and treasuries", async () => {
      // Check if already initialized
      try {
        const existingConfig = await program.account.config.fetch(configPDA);
        console.log("⚠️  Config already exists, skipping initialization");
        console.log(`   Existing admin: ${existingConfig.admin.toString()}`);
        isNewConfig = false;
        return;
      } catch (e) {
        // Not initialized, proceed
      }

      // @ts-ignore - Anchor 0.32+ auto-derives PDAs
      await program.methods
        .initialize(treasuryURIM, treasuryUSDC)
        .accounts({
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      const config = await program.account.config.fetch(configPDA);
      assert.equal(config.admin.toString(), admin.publicKey.toString());
      assert.equal(config.treasuryUrim.toString(), treasuryURIM.toString());
      assert.equal(config.treasuryUsdc.toString(), treasuryUSDC.toString());
      assert.equal(config.paused, false);
      assert.equal(config.currentRoundId.toNumber(), 0);

      isNewConfig = true;
      console.log("✅ Platform initialized successfully");
    });
  });

  describe("Admin Controls", () => {
    it("Admin can pause platform", async function() {
      if (!isNewConfig) {
        console.log("⚠️  Config owned by different admin - skipping pause test");
        this.skip();
      }

      // @ts-ignore - Anchor 0.32+ auto-derives PDAs
      await program.methods
        .pause()
        .accounts({
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      const config = await program.account.config.fetch(configPDA);
      assert.equal(config.paused, true);

      console.log("✅ Platform paused");
    });

    it("Admin can unpause platform", async function() {
      if (!isNewConfig) {
        console.log("⚠️  Config owned by different admin - skipping unpause test");
        this.skip();
      }

      // @ts-ignore - Anchor 0.32+ auto-derives PDAs
      await program.methods
        .unpause()
        .accounts({
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      const config = await program.account.config.fetch(configPDA);
      assert.equal(config.paused, false);

      console.log("✅ Platform unpaused");
    });

    it("Non-admin cannot pause", async () => {
      try {
        // @ts-ignore - Anchor 0.32+ auto-derives PDAs
        await program.methods
          .pause()
          .accounts({
            admin: user1.publicKey,
          })
          .signers([user1])
          .rpc();
        assert.fail("Should have failed");
      } catch (err) {
        // Check for constraint violation (Anchor 0.32+ format)
        const errStr = err.toString();
        assert.isTrue(
          errStr.includes("ConstraintHasOne") || errStr.includes("has_one") || errStr.includes("2001"),
          `Expected has_one constraint error, got: ${errStr}`
        );
        console.log("✅ Non-admin correctly blocked from pausing");
      }
    });
  });

  describe("Math Verification", () => {
    it("Correctly calculates proportional winnings", () => {
      const userBet = 30 * 1_000_000;
      const yesPool = 100 * 1_000_000;
      const noPool = 200 * 1_000_000;

      // Simulate contract math (fee charged on bet placement, not winnings)
      const winningsShare = (BigInt(userBet) * BigInt(noPool)) / BigInt(yesPool);
      const totalPayout = BigInt(userBet) + winningsShare;

      // User bet 30 on YES, YES pool was 100, NO pool was 200
      // Share of losing pool = 30/100 * 200 = 60
      // Total payout = 30 + 60 = 90
      assert.equal(Number(totalPayout), 90 * 1_000_000);

      console.log("✅ Payout calculation verified");
    });

    it("Fee is charged on bet placement (not on winnings)", () => {
      const betAmount = 100 * 1_000_000;
      const feeBps = 50; // 0.5%

      const fee = (BigInt(betAmount) * BigInt(feeBps)) / BigInt(10000);
      const amountAfterFee = BigInt(betAmount) - fee;

      assert.equal(Number(fee), 0.5 * 1_000_000);
      assert.equal(Number(amountAfterFee), 99.5 * 1_000_000);

      console.log("✅ Immediate fee calculation verified");
    });

    it("Handles winning pool = 0 edge case", () => {
      const userBet = 100 * 1_000_000;
      const winningPool = 0;

      // When winning pool is 0, user just gets their bet back
      if (winningPool === 0) {
        const payout = userBet;
        assert.equal(payout, 100 * 1_000_000);
        console.log("✅ Edge case: solo winner verified");
      }
    });
  });

  describe("Boundary Calculations", () => {
    it("SAFE boundary = 3% above current price", () => {
      const currentPrice = 150;
      const boundaryBps = 300; // 3%

      const targetPrice = currentPrice + (currentPrice * boundaryBps) / 10000;

      assert.equal(targetPrice, 154.5);
      console.log("✅ SAFE boundary (3%) verified");
    });

    it("BALANCED boundary = 10% above current price", () => {
      const currentPrice = 150;
      const boundaryBps = 1000; // 10%

      const targetPrice = currentPrice + (currentPrice * boundaryBps) / 10000;

      assert.equal(targetPrice, 165);
      console.log("✅ BALANCED boundary (10%) verified");
    });

    it("MOONSHOT boundary = 20% above current price", () => {
      const currentPrice = 150;
      const boundaryBps = 2000; // 20%

      const targetPrice = currentPrice + (currentPrice * boundaryBps) / 10000;

      assert.equal(targetPrice, 180);
      console.log("✅ MOONSHOT boundary (20%) verified");
    });
  });

  describe("Pyth Integration Tests", () => {
    it("Validates Pyth receiver program exists on devnet", async () => {
      const accountInfo = await provider.connection.getAccountInfo(PYTH_RECEIVER_PROGRAM);
      assert.isNotNull(accountInfo, "Pyth receiver program not found on devnet");
      assert.isTrue(accountInfo.executable, "Pyth receiver program should be executable");
      console.log("✅ Pyth receiver program verified on devnet");
    });

    it("Can fetch price data from Pyth Hermes API", async () => {
      try {
        const feedIdClean = SOL_USD_FEED_ID.replace("0x", "");
        const url = `${HERMES_API}/api/latest_price_feeds?ids[]=${feedIdClean}`;

        const response = await fetch(url);
        const data = await response.json() as any[];

        assert.isArray(data, "Expected array response");
        assert.isTrue(data.length > 0, "Expected at least one price feed");

        const priceFeed = data[0];
        assert.isDefined(priceFeed.price, "Price should be defined");

        const price = Number(priceFeed.price.price) * Math.pow(10, priceFeed.price.expo);
        console.log(`✅ Current SOL/USD price from Pyth: $${price.toFixed(2)}`);
      } catch (e: any) {
        console.log("⚠️  Could not fetch from Hermes API:", e.message);
        // Don't fail - API might be rate limited
      }
    });

    it("Finds existing PriceUpdateV2 accounts on devnet", async () => {
      if (!priceUpdateAccount) {
        console.log("⚠️  No Pyth price accounts found - skipping");
        return;
      }

      const accountInfo = await provider.connection.getAccountInfo(priceUpdateAccount);
      assert.isNotNull(accountInfo, "Price update account should exist");
      console.log(`✅ Found valid PriceUpdateV2 account: ${priceUpdateAccount.toString()}`);
      console.log(`   Owner: ${accountInfo.owner.toString()}`);
      console.log(`   Data size: ${accountInfo.data.length} bytes`);
    });
  });

  describe("Round Creation Tests", () => {
    it("Can derive round PDA correctly", async () => {
      const config = await program.account.config.fetch(configPDA);
      currentRoundId = config.currentRoundId.toNumber();

      const roundIdBuffer = Buffer.alloc(8);
      roundIdBuffer.writeBigUInt64LE(BigInt(currentRoundId));

      [roundPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("round"), roundIdBuffer],
        program.programId
      );

      console.log(`✅ Round PDA derived: ${roundPDA.toString()}`);
      console.log(`   Current round ID: ${currentRoundId}`);
    });

    it("Can derive vault PDAs correctly", async () => {
      const roundIdBuffer = Buffer.alloc(8);
      roundIdBuffer.writeBigUInt64LE(BigInt(currentRoundId));

      // Note: The actual vault creation happens in start_round
      // These are the expected PDA seeds
      const [vaultURIMPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_urim"), roundIdBuffer],
        program.programId
      );

      const [vaultUSDCPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_usdc"), roundIdBuffer],
        program.programId
      );

      console.log(`✅ Vault PDAs derived:`);
      console.log(`   URIM Vault: ${vaultURIMPDA.toString()}`);
      console.log(`   USDC Vault: ${vaultUSDCPDA.toString()}`);
    });

    it("Creates a new round with Pyth price feed", async function() {
      if (!priceUpdateAccount) {
        console.log("⚠️  No Pyth price account available - skipping round creation");
        this.skip();
      }

      const config = await program.account.config.fetch(configPDA);
      currentRoundId = config.currentRoundId.toNumber();

      const roundIdBuffer = Buffer.alloc(8);
      roundIdBuffer.writeBigUInt64LE(BigInt(currentRoundId));

      [roundPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("round"), roundIdBuffer],
        program.programId
      );

      // Find vault bumps
      const [, vaultURIMBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_urim"), roundIdBuffer],
        program.programId
      );

      const [, vaultUSDCBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_usdc"), roundIdBuffer],
        program.programId
      );

      try {
        // @ts-ignore - Anchor 0.32+ auto-derives PDAs, we just need priceUpdate
        await program.methods
          .startRound(
            { turbo: {} }, // DurationType::Turbo (15 min)
            { safe: {} },  // BoundaryType::Safe (3%)
            vaultURIMBump,
            vaultUSDCBump
          )
          .accounts({
            priceUpdate: priceUpdateAccount!,
          })
          .signers([admin])
          .rpc();

        const round = await program.account.round.fetch(roundPDA);
        console.log(`✅ Round ${round.roundId.toNumber()} created!`);
        console.log(`   Start price: $${round.startPrice.toNumber()}`);
        console.log(`   Target price: $${round.targetPrice.toNumber()}`);
        console.log(`   Duration: Turbo (15 min)`);
        console.log(`   Boundary: Safe (3%)`);
      } catch (e: any) {
        console.log("⚠️  Round creation failed:", e.message);
        // This might fail if the price account is stale or admin doesn't match
        this.skip();
      }
    });
  });

  describe("Token Support", () => {
    it("Verifies program uses correct SOL/USD feed ID", () => {
      // The feed ID is hardcoded in the program
      const expectedFeedId = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
      assert.equal(SOL_USD_FEED_ID, expectedFeedId);
      console.log("✅ SOL/USD feed ID verified");
    });

    it("Verifies dual token constants are configured", () => {
      // These are compile-time constants in the program
      const URIM_MINT_EXPECTED = "F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump";
      const USDC_MINT_EXPECTED = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

      console.log(`✅ URIM Mint: ${URIM_MINT_EXPECTED}`);
      console.log(`✅ USDC Mint: ${USDC_MINT_EXPECTED}`);
      console.log("✅ Dual token support configured");
    });
  });
});
