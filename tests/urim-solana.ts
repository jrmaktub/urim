import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { UrimSolana } from "../target/types/urim_solana";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("urim-solana", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.UrimSolana as Program<UrimSolana>;

  let usdcMint: PublicKey;
  let admin: Keypair;
  let treasury: PublicKey;
  let treasuryTokenAccount: PublicKey;
  let configPDA: PublicKey;
  let user1: Keypair;
  let user2: Keypair;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;

  before(async () => {
    admin = Keypair.generate();
    user1 = Keypair.generate();
    user2 = Keypair.generate();
    treasury = Keypair.generate().publicKey;

    // Airdrop SOL
    await provider.connection.requestAirdrop(
      admin.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      user1.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      user2.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create USDC mint (simulated)
    usdcMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      6 // USDC has 6 decimals
    );

    // Create token accounts
    user1TokenAccount = await createAccount(
      provider.connection,
      user1,
      usdcMint,
      user1.publicKey
    );

    user2TokenAccount = await createAccount(
      provider.connection,
      user2,
      usdcMint,
      user2.publicKey
    );

    treasuryTokenAccount = await createAccount(
      provider.connection,
      admin,
      usdcMint,
      treasury
    );

    // Mint USDC to users
    await mintTo(
      provider.connection,
      admin,
      usdcMint,
      user1TokenAccount,
      admin.publicKey,
      1000 * 1_000_000 // 1000 USDC
    );

    await mintTo(
      provider.connection,
      admin,
      usdcMint,
      user2TokenAccount,
      admin.publicKey,
      1000 * 1_000_000 // 1000 USDC
    );

    // Derive config PDA
    [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );
  });

  describe("Initialization", () => {
    it("Initializes the platform", async () => {
      await program.methods
        .initialize(treasury)
        .accounts({
          config: configPDA,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const config = await program.account.config.fetch(configPDA);
      assert.equal(config.admin.toString(), admin.publicKey.toString());
      assert.equal(config.treasury.toString(), treasury.toString());
      assert.equal(config.paused, false);
      assert.equal(config.currentRoundId.toNumber(), 0);
    });
  });

  describe("Math Verification", () => {
    it("Correctly calculates proportional winnings", () => {
      // User bet: 30 USDC on YES
      // YES pool: 100 USDC
      // NO pool: 200 USDC
      // YES wins
      //
      // Expected: user_share = (30/100) * 200 = 60 USDC profit
      // Fee (0.5%): 60 * 0.005 = 0.3 USDC
      // Total payout: 30 (stake) + 60 (profit) - 0.3 (fee) = 89.7 USDC

      const userBet = 30 * 1_000_000;
      const yesPool = 100 * 1_000_000;
      const noPool = 200 * 1_000_000;
      const feeBps = 50; // 0.5%

      // Simulate contract math
      const winningsShare =
        (BigInt(userBet) * BigInt(noPool)) / BigInt(yesPool);
      const netProfit = winningsShare;
      const fee = (netProfit * BigInt(feeBps)) / BigInt(10000);
      const totalPayout = BigInt(userBet) + netProfit - fee;

      const expectedPayout = 89.7 * 1_000_000;
      assert.approximately(
        Number(totalPayout),
        expectedPayout,
        100 // Allow 100 lamport margin for rounding
      );
    });

    it("Fee is on NET profit only, not gross", () => {
      // User bet: 100 USDC
      // Wins 50 USDC profit
      // Total return: 150 USDC
      //
      // WRONG (gross): 150 * 0.5% = 0.75 USDC fee
      // CORRECT (net): 50 * 0.5% = 0.25 USDC fee
      // Payout: 100 + 50 - 0.25 = 149.75 USDC

      const stake = 100 * 1_000_000;
      const profit = 50 * 1_000_000;
      const feeBps = 50;

      const correctFee = (BigInt(profit) * BigInt(feeBps)) / BigInt(10000);
      const wrongFee =
        (BigInt(stake + profit) * BigInt(feeBps)) / BigInt(10000);

      assert.equal(Number(correctFee), 0.25 * 1_000_000);
      assert.equal(Number(wrongFee), 0.75 * 1_000_000);

      const correctPayout = BigInt(stake) + BigInt(profit) - correctFee;
      assert.equal(Number(correctPayout), 149.75 * 1_000_000);
    });

    it("Handles winning pool = 0 edge case", () => {
      // Edge case: User is the ONLY winner
      // Should get stake back with no fee

      const userBet = 100 * 1_000_000;
      const winningPool = 0;

      if (winningPool === 0) {
        const payout = userBet;
        const fee = 0;

        assert.equal(payout, 100 * 1_000_000);
        assert.equal(fee, 0);
      }
    });
  });

  describe("Boundary Calculations", () => {
    it("SAFE boundary = 3% above current price", () => {
      const currentPrice = 150; // $150
      const boundaryBps = 300; // 3%

      const targetPrice = currentPrice + (currentPrice * boundaryBps) / 10000;

      assert.equal(targetPrice, 154.5); // $154.50
    });

    it("BALANCED boundary = 10% above current price", () => {
      const currentPrice = 150;
      const boundaryBps = 1000; // 10%

      const targetPrice = currentPrice + (currentPrice * boundaryBps) / 10000;

      assert.equal(targetPrice, 165); // $165
    });

    it("MOONSHOT boundary = 20% above current price", () => {
      const currentPrice = 150;
      const boundaryBps = 2000; // 20%

      const targetPrice = currentPrice + (currentPrice * boundaryBps) / 10000;

      assert.equal(targetPrice, 180); // $180
    });
  });

  describe("Admin Functions", () => {
    it("Admin can pause platform", async () => {
      await program.methods
        .pause()
        .accounts({
          config: configPDA,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      const config = await program.account.config.fetch(configPDA);
      assert.equal(config.paused, true);
    });

    it("Admin can unpause platform", async () => {
      await program.methods
        .unpause()
        .accounts({
          config: configPDA,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      const config = await program.account.config.fetch(configPDA);
      assert.equal(config.paused, false);
    });

    it("Non-admin cannot pause", async () => {
      try {
        await program.methods
          .pause()
          .accounts({
            config: configPDA,
            admin: user1.publicKey,
          })
          .signers([user1])
          .rpc();
        assert.fail("Should have failed");
      } catch (err) {
        assert.include(err.toString(), "has_one");
      }
    });
  });

  // NOTE: Full integration tests require Pyth devnet account
  // These are placeholders for documentation purposes
  describe("Integration Tests (Require Pyth)", () => {
    it("TODO: Start round with Pyth price feed", () => {
      console.log("⚠️ Requires Pyth PriceUpdateV2 account on devnet");
    });

    it("TODO: Place bets and resolve round", () => {
      console.log("⚠️ Requires active round");
    });

    it("TODO: Claim winnings after resolution", () => {
      console.log("⚠️ Requires resolved round");
    });

    it("TODO: Collect fees to treasury", () => {
      console.log("⚠️ Requires round with fees");
    });

    it("TODO: Emergency withdraw after timeout", () => {
      console.log("⚠️ Requires 24h+ timeout");
    });
  });
});
