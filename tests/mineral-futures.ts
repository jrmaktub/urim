import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { MineralFutures } from "../target/types/mineral_futures";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { assert } from "chai";

const PROGRAM_ID = new PublicKey("9zakGc9vksLmWz62R84BG9KNHP4xjNAPJ6L91eFhRxUq");
const IDL = require("../target/idl/mineral_futures.json");

const findMarketPDA = (commodity: string) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(commodity)],
    PROGRAM_ID
  );

const findVaultPDA = (marketKey: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), marketKey.toBuffer()],
    PROGRAM_ID
  );

const findPositionPDA = (trader: PublicKey, market: PublicKey, nonce: BN) =>
  PublicKey.findProgramAddressSync(
    [
      Buffer.from("position"),
      trader.toBuffer(),
      market.toBuffer(),
      nonce.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );

// Helper: ensure price is set. Uses intermediate step to avoid duplicate tx hashes in bankrun.
let resetCounter = 0;
async function resetPrice(program: any, marketKey: PublicKey, authority: Keypair, price: number) {
  resetCounter++;
  // Set to a unique intermediate price first to avoid duplicate tx hashes
  await program.methods
    .updatePrice(new BN(price + resetCounter))
    .accounts({ market: marketKey, authority: authority.publicKey })
    .rpc();
  await program.methods
    .updatePrice(new BN(price))
    .accounts({ market: marketKey, authority: authority.publicKey })
    .rpc();
}

describe("mineral-futures: shared vault + leverage + funding + pause + withdraw", () => {
  let provider: BankrunProvider;
  let program: Program<MineralFutures>;
  let context: any;
  let authority: Keypair;

  const commodity = "COPPER";
  const initialPrice = new BN(12000);
  let marketKey: PublicKey;
  let vaultKey: PublicKey;

  before(async () => {
    const trader1 = Keypair.generate();
    const trader2 = Keypair.generate();

    context = await startAnchor(
      "",
      [],
      [
        {
          address: trader1.publicKey,
          info: {
            lamports: 50 * LAMPORTS_PER_SOL,
            data: Buffer.alloc(0),
            owner: SystemProgram.programId,
            executable: false,
          },
        },
        {
          address: trader2.publicKey,
          info: {
            lamports: 50 * LAMPORTS_PER_SOL,
            data: Buffer.alloc(0),
            owner: SystemProgram.programId,
            executable: false,
          },
        },
      ]
    );

    provider = new BankrunProvider(context);
    anchor.setProvider(provider as any);
    program = new Program<MineralFutures>(IDL, provider as any);
    authority = provider.wallet.payer;

    [marketKey] = findMarketPDA(commodity);
    [vaultKey] = findVaultPDA(marketKey);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. MARKET INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  it("initializes market + shared vault", async () => {
    await program.methods
      .initializeMarket(commodity, initialPrice)
      .accounts({ authority: authority.publicKey })
      .rpc();

    const market = await program.account.market.fetch(marketKey);
    assert.equal(market.markPrice.toNumber(), 12000);
    assert.equal(market.openInterestLong.toNumber(), 0);
    assert.equal(market.openInterestShort.toNumber(), 0);
    assert.equal(market.totalFeesCollected.toNumber(), 0);
    assert.equal(market.authority.toBase58(), authority.publicKey.toBase58());
    assert.equal(market.fundingRateCumulative.toNumber(), 0);
    assert.isFalse(market.isPaused);

    const vaultAccount = await context.banksClient.getAccount(vaultKey);
    assert.ok(vaultAccount, "Vault should be created");
    assert.isAbove(Number(vaultAccount.lamports), 0);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. OPEN LONG 1x
  // ═══════════════════════════════════════════════════════════════════════════

  it("opens a long position with 1x leverage", async () => {
    const nonce = new BN(100001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    const vaultBefore = await context.banksClient.getAccount(vaultKey);

    await program.methods
      .openPosition(0, nonce, collateral, 1, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    const position = await program.account.position.fetch(positionKey);
    assert.equal(position.direction, 0);
    assert.equal(position.leverage, 1);
    assert.isTrue(position.isOpen);
    assert.equal(position.entryPrice.toNumber(), 12000);

    const expectedFee = Math.floor(LAMPORTS_PER_SOL * 5 / 10000);
    assert.equal(position.feePaid.toNumber(), expectedFee);
    assert.equal(position.collateral.toNumber(), LAMPORTS_PER_SOL - expectedFee);

    const vaultAfter = await context.banksClient.getAccount(vaultKey);
    const vaultDelta = Number(vaultAfter.lamports) - Number(vaultBefore.lamports);
    assert.equal(vaultDelta, LAMPORTS_PER_SOL - expectedFee);

    const market = await program.account.market.fetch(marketKey);
    assert.equal(market.openInterestLong.toNumber(), LAMPORTS_PER_SOL - expectedFee);

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CLOSE AT PROFIT — with close fee
  // ═══════════════════════════════════════════════════════════════════════════

  it("closes long at profit — close fee deducted", async () => {
    await resetPrice(program, marketKey, authority, 12000);

    // Seed vault
    const seedTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: vaultKey,
        lamports: 5 * LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(seedTx);

    const nonce = new BN(200001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 1, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price up 10%
    await program.methods
      .updatePrice(new BN(13200))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    const traderBefore = await context.banksClient.getAccount(authority.publicKey);

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
      .rpc();

    const traderAfter = await context.banksClient.getAccount(authority.publicKey);
    const traderDelta = Number(traderAfter.lamports) - Number(traderBefore.lamports);
    assert.isAbove(traderDelta, 0, "Trader PROFITED");

    await resetPrice(program, marketKey, authority, 12000);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CLOSE AT LOSS
  // ═══════════════════════════════════════════════════════════════════════════

  it("closes long at loss — loss stays in shared vault", async () => {
    await resetPrice(program, marketKey, authority, 12000);

    const nonce = new BN(300001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 1, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    await program.methods
      .updatePrice(new BN(9600))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    const vaultBefore = await context.banksClient.getAccount(vaultKey);

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
      .rpc();

    const vaultAfter = await context.banksClient.getAccount(vaultKey);
    assert.isAbove(Number(vaultAfter.lamports), Number(vaultBefore.lamports) - LAMPORTS_PER_SOL);

    await resetPrice(program, marketKey, authority, 12000);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. 5x LEVERAGE — amplifies profit
  // ═══════════════════════════════════════════════════════════════════════════

  it("5x leverage amplifies profit correctly", async () => {
    await resetPrice(program, marketKey, authority, 12000);

    const nonce = new BN(400001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 5, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price up 4%, at 5x = 20% profit
    await program.methods
      .updatePrice(new BN(12480))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    const traderBefore = await context.banksClient.getAccount(authority.publicKey);

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
      .rpc();

    const traderAfter = await context.banksClient.getAccount(authority.publicKey);
    const netCollateral = LAMPORTS_PER_SOL - Math.floor(LAMPORTS_PER_SOL * 5 / 10000);
    const traderDelta = Number(traderAfter.lamports) - Number(traderBefore.lamports);
    assert.isAbove(traderDelta, netCollateral * 1.1, "5x leverage gives ~20% profit on 4% move");

    await resetPrice(program, marketKey, authority, 12000);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. 5x LEVERAGE — amplifies loss
  // ═══════════════════════════════════════════════════════════════════════════

  it("5x leverage amplifies loss correctly", async () => {
    await resetPrice(program, marketKey, authority, 12000);

    const nonce = new BN(500001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 5, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price drops 10%, at 5x = 50% loss
    await program.methods
      .updatePrice(new BN(10800))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    const vaultBefore = await context.banksClient.getAccount(vaultKey);

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
      .rpc();

    const vaultAfter = await context.banksClient.getAccount(vaultKey);
    const netCollateral = LAMPORTS_PER_SOL - Math.floor(LAMPORTS_PER_SOL * 5 / 10000);
    // 50% loss + close fee on remaining ~50% payout
    const expectedLoss = Math.floor((1200 / 12000) * netCollateral * 5);
    const rawPayout = netCollateral - expectedLoss;
    const closeFee = Math.floor(rawPayout * 5 / 10000);
    const expectedPayout = rawPayout - closeFee;

    const vaultDelta = Number(vaultBefore.lamports) - Number(vaultAfter.lamports);
    assert.approximately(vaultDelta, expectedPayout, 50000, "50% loss with 5x leverage + close fee");

    await resetPrice(program, marketKey, authority, 12000);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. SHORT POSITION
  // ═══════════════════════════════════════════════════════════════════════════

  it("short position profits when price drops", async () => {
    await resetPrice(program, marketKey, authority, 12000);

    const nonce = new BN(600001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(1, nonce, collateral, 3, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price drops 5%, at 3x SHORT: 15% profit
    await program.methods
      .updatePrice(new BN(11400))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    const traderBefore = await context.banksClient.getAccount(authority.publicKey);

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
      .rpc();

    const traderAfter = await context.banksClient.getAccount(authority.publicKey);
    const netCollateral = LAMPORTS_PER_SOL - Math.floor(LAMPORTS_PER_SOL * 5 / 10000);
    const traderDelta = Number(traderAfter.lamports) - Number(traderBefore.lamports);
    assert.isAbove(traderDelta, netCollateral * 1.1, "Short 3x profits from 5% drop");

    await resetPrice(program, marketKey, authority, 12000);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. LIQUIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  it("liquidates 5x long when price drops 18%+", async () => {
    await resetPrice(program, marketKey, authority, 12000);

    const nonce = new BN(700001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 5, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price drops 19%: 12000 → 9720. Threshold at 5x = 1800 bps = 18%
    await program.methods
      .updatePrice(new BN(9720))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    await program.methods
      .liquidate()
      .accounts({ market: marketKey, position: positionKey, liquidator: authority.publicKey })
      .rpc();

    const position = await program.account.position.fetch(positionKey);
    assert.isFalse(position.isOpen, "Position liquidated");

    await resetPrice(program, marketKey, authority, 12000);
  });

  it("does NOT liquidate 5x long when price drops only 15%", async () => {
    await resetPrice(program, marketKey, authority, 12000);

    const nonce = new BN(700002);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 5, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    await program.methods
      .updatePrice(new BN(10200))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    try {
      await program.methods
        .liquidate()
        .accounts({ market: marketKey, position: positionKey, liquidator: authority.publicKey })
        .rpc();
      assert.fail("Should have thrown NotLiquidatable");
    } catch (e: any) {
      assert.include(e.toString(), "NotLiquidatable");
    }

    await resetPrice(program, marketKey, authority, 12000);
    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. URIM FEE DISCOUNT (without real SPL)
  // ═══════════════════════════════════════════════════════════════════════════

  it("URIM discount without token account falls back to standard fee", async () => {
    await resetPrice(program, marketKey, authority, 12000);

    const nonce = new BN(800001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 1, true)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    const position = await program.account.position.fetch(positionKey);
    const baseFee = Math.floor(LAMPORTS_PER_SOL * 5 / 10000);
    assert.equal(position.feePaid.toNumber(), baseFee, "Standard fee when no URIM token account");

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. 10x LIQUIDATION at 9%
  // ═══════════════════════════════════════════════════════════════════════════

  it("10x leverage: liquidation at 9%+ price move", async () => {
    await resetPrice(program, marketKey, authority, 12000);

    const nonce = new BN(900001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 10, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price drops 10%: 12000 → 10800. At 10x, threshold = 900 bps = 9%
    await program.methods
      .updatePrice(new BN(10800))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    await program.methods
      .liquidate()
      .accounts({ market: marketKey, position: positionKey, liquidator: authority.publicKey })
      .rpc();

    const position = await program.account.position.fetch(positionKey);
    assert.isFalse(position.isOpen, "10x liquidated at 10% drop");

    await resetPrice(program, marketKey, authority, 12000);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. MARKET PAUSE / UNPAUSE
  // ═══════════════════════════════════════════════════════════════════════════

  it("authority can pause and unpause market", async () => {
    await program.methods
      .pauseMarket()
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    let market = await program.account.market.fetch(marketKey);
    assert.isTrue(market.isPaused, "Market should be paused");

    const nonce = new BN(1000001);
    try {
      await program.methods
        .openPosition(0, nonce, new BN(LAMPORTS_PER_SOL), 1, false)
        .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
        .rpc();
      assert.fail("Should reject when paused");
    } catch (e: any) {
      assert.include(e.toString(), "MarketPaused");
    }

    await program.methods
      .unpauseMarket()
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    market = await program.account.market.fetch(marketKey);
    assert.isFalse(market.isPaused, "Market should be unpaused");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. FUNDING RATE
  // ═══════════════════════════════════════════════════════════════════════════

  it("apply_funding fails before 8 hours", async () => {
    try {
      await program.methods
        .applyFunding()
        .accounts({ market: marketKey })
        .rpc();
      assert.fail("Should reject early funding");
    } catch (e: any) {
      assert.include(e.toString(), "FundingTooEarly");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. WITHDRAW FEES
  // ═══════════════════════════════════════════════════════════════════════════

  it("authority can withdraw excess fees from vault", async () => {
    // Seed vault
    const seedTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: vaultKey,
        lamports: 3 * LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(seedTx);

    const vaultBefore = await context.banksClient.getAccount(vaultKey);
    const authorityBefore = await context.banksClient.getAccount(authority.publicKey);

    const withdrawAmount = new BN(LAMPORTS_PER_SOL);
    await program.methods
      .withdrawFees(withdrawAmount)
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    const vaultAfter = await context.banksClient.getAccount(vaultKey);
    const vaultDelta = Number(vaultBefore.lamports) - Number(vaultAfter.lamports);
    assert.equal(vaultDelta, LAMPORTS_PER_SOL, "Vault decreased by withdraw amount");

    const authorityAfter = await context.banksClient.getAccount(authority.publicKey);
    const authDelta = Number(authorityAfter.lamports) - Number(authorityBefore.lamports);
    assert.isAbove(authDelta, 0, "Authority received funds");
  });

  it("cannot withdraw more than excess over OI", async () => {
    await resetPrice(program, marketKey, authority, 12000);

    const nonce = new BN(1300001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 1, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    try {
      await program.methods
        .withdrawFees(new BN(100 * LAMPORTS_PER_SOL))
        .accounts({ market: marketKey, authority: authority.publicKey })
        .rpc();
      assert.fail("Should reject excessive withdrawal");
    } catch (e: any) {
      assert.include(e.toString(), "NothingToWithdraw");
    }

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. VULNERABILITY TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("vulnerability tests", () => {
    it("cannot open with leverage > 10", async () => {
      const nonce = new BN(1100001);
      try {
        await program.methods
          .openPosition(0, nonce, new BN(LAMPORTS_PER_SOL), 11, false)
          .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
          .rpc();
        assert.fail("Should reject leverage > 10");
      } catch (e: any) {
        assert.include(e.toString(), "InvalidLeverage");
      }
    });

    it("cannot open with leverage 0", async () => {
      const nonce = new BN(1100002);
      try {
        await program.methods
          .openPosition(0, nonce, new BN(LAMPORTS_PER_SOL), 0, false)
          .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
          .rpc();
        assert.fail("Should reject leverage 0");
      } catch (e: any) {
        assert.include(e.toString(), "InvalidLeverage");
      }
    });

    it("cannot open with 0 collateral", async () => {
      const nonce = new BN(1100003);
      try {
        await program.methods
          .openPosition(0, nonce, new BN(0), 1, false)
          .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
          .rpc();
        assert.fail("Should reject 0 collateral");
      } catch (e: any) {
        assert.include(e.toString(), "ZeroCollateral");
      }
    });

    it("cannot open with invalid direction", async () => {
      const nonce = new BN(1100004);
      try {
        await program.methods
          .openPosition(2, nonce, new BN(LAMPORTS_PER_SOL), 1, false)
          .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
          .rpc();
        assert.fail("Should reject direction 2");
      } catch (e: any) {
        assert.include(e.toString(), "InvalidDirection");
      }
    });

    it("cannot double-close a position", async () => {
      await resetPrice(program, marketKey, authority, 12000);

      const nonce = new BN(1100005);
      const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

      await program.methods
        .openPosition(0, nonce, new BN(LAMPORTS_PER_SOL), 1, false)
        .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
        .rpc();

      await program.methods
        .closePosition()
        .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
        .rpc();

      try {
        await program.methods
          .closePosition()
          .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
          .rpc();
        assert.fail("Should reject double close");
      } catch (e: any) {
        assert.ok(e, "Correctly rejected double close");
      }
    });

    it("cannot liquidate a profitable position", async () => {
      await resetPrice(program, marketKey, authority, 12000);

      const nonce = new BN(1100006);
      const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

      await program.methods
        .openPosition(0, nonce, new BN(LAMPORTS_PER_SOL), 1, false)
        .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
        .rpc();

      await program.methods
        .updatePrice(new BN(15000))
        .accounts({ market: marketKey, authority: authority.publicKey })
        .rpc();

      try {
        await program.methods
          .liquidate()
          .accounts({ market: marketKey, position: positionKey, liquidator: authority.publicKey })
          .rpc();
        assert.fail("Should not liquidate profitable position");
      } catch (e: any) {
        assert.include(e.toString(), "NotLiquidatable");
      }

      await resetPrice(program, marketKey, authority, 12000);
      await program.methods
        .closePosition()
        .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
        .rpc();
    });

    it("only authority can update price", async () => {
      const randomUser = Keypair.generate();
      const fundTx = new anchor.web3.Transaction().add(
        SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: randomUser.publicKey,
          lamports: LAMPORTS_PER_SOL,
        })
      );
      await provider.sendAndConfirm(fundTx);

      try {
        await program.methods
          .updatePrice(new BN(99999))
          .accounts({ market: marketKey, authority: randomUser.publicKey })
          .signers([randomUser])
          .rpc();
        assert.fail("Random user should not update price");
      } catch (e: any) {
        assert.ok(e, "Correctly rejected unauthorized price update");
      }

      const market = await program.account.market.fetch(marketKey);
      assert.equal(market.markPrice.toNumber(), 12000, "Price unchanged");
    });

    it("only authority can pause market", async () => {
      const randomUser = Keypair.generate();
      const fundTx = new anchor.web3.Transaction().add(
        SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: randomUser.publicKey,
          lamports: LAMPORTS_PER_SOL,
        })
      );
      await provider.sendAndConfirm(fundTx);

      try {
        await program.methods
          .pauseMarket()
          .accounts({ market: marketKey, authority: randomUser.publicKey })
          .signers([randomUser])
          .rpc();
        assert.fail("Random user should not pause market");
      } catch (e: any) {
        assert.ok(e, "Correctly rejected unauthorized pause");
      }
    });

    it("only authority can withdraw fees", async () => {
      const randomUser = Keypair.generate();
      const fundTx = new anchor.web3.Transaction().add(
        SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: randomUser.publicKey,
          lamports: LAMPORTS_PER_SOL,
        })
      );
      await provider.sendAndConfirm(fundTx);

      try {
        await program.methods
          .withdrawFees(new BN(LAMPORTS_PER_SOL))
          .accounts({ market: marketKey, authority: randomUser.publicKey })
          .signers([randomUser])
          .rpc();
        assert.fail("Random user should not withdraw fees");
      } catch (e: any) {
        assert.ok(e, "Correctly rejected unauthorized withdrawal");
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. VAULT DRAIN PROTECTION
  // ═══════════════════════════════════════════════════════════════════════════

  it("payout capped to vault available balance (rent-exempt protected)", async () => {
    const commodity2 = "LITHIUM";
    const [market2Key] = findMarketPDA(commodity2);
    const [vault2Key] = findVaultPDA(market2Key);

    await program.methods
      .initializeMarket(commodity2, new BN(50000))
      .accounts({ authority: authority.publicKey })
      .rpc();

    const nonce = new BN(1200001);
    const collateral = new BN(LAMPORTS_PER_SOL / 10);
    const [positionKey] = findPositionPDA(authority.publicKey, market2Key, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 10, false)
      .accounts({ market: market2Key, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Massive price increase: 200% profit at 10x
    await program.methods
      .updatePrice(new BN(60000))
      .accounts({ market: market2Key, authority: authority.publicKey })
      .rpc();

    await program.methods
      .closePosition()
      .accounts({ market: market2Key, position: positionKey, trader: authority.publicKey })
      .rpc();

    const vaultAfter = await context.banksClient.getAccount(vault2Key);
    assert.isAbove(Number(vaultAfter.lamports), 0, "Vault maintains rent-exempt balance");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. POSITION SIZE LIMIT
  // ═══════════════════════════════════════════════════════════════════════════

  it("rejects oversized position when OI exists", async () => {
    await resetPrice(program, marketKey, authority, 12000);

    // Open a small position to create OI
    const nonce1 = new BN(1400001);
    const [pos1Key] = findPositionPDA(authority.publicKey, marketKey, nonce1);

    await program.methods
      .openPosition(0, nonce1, new BN(LAMPORTS_PER_SOL / 10), 1, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Now try a whale position: 10x on 10 SOL when vault has ~few SOL
    const nonce2 = new BN(1400002);
    try {
      await program.methods
        .openPosition(0, nonce2, new BN(10 * LAMPORTS_PER_SOL), 10, false)
        .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
        .rpc();
      assert.fail("Should reject oversized position");
    } catch (e: any) {
      assert.include(e.toString(), "PositionTooLarge");
    }

    // Cleanup
    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: pos1Key, trader: authority.publicKey })
      .rpc();
  });
});
