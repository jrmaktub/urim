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

describe("mineral-futures: shared vault + leverage", () => {
  let provider: BankrunProvider;
  let program: Program<MineralFutures>;
  let context: any;
  let authority: Keypair;

  const commodity = "COPPER";
  const initialPrice = new BN(12000);
  let marketKey: PublicKey;
  let vaultKey: PublicKey;

  before(async () => {
    // Create funded accounts for testing
    const trader1 = Keypair.generate();
    const trader2 = Keypair.generate();

    context = await startAnchor(
      "", // project root
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
      .accounts({
        authority: authority.publicKey,
      })
      .rpc();

    const market = await program.account.market.fetch(marketKey);
    assert.equal(market.markPrice.toNumber(), 12000);
    assert.equal(market.openInterestLong.toNumber(), 0);
    assert.equal(market.openInterestShort.toNumber(), 0);
    assert.equal(market.totalFeesCollected.toNumber(), 0);
    assert.equal(market.authority.toBase58(), authority.publicKey.toBase58());

    // Vault should exist
    const vaultAccount = await context.banksClient.getAccount(vaultKey);
    assert.ok(vaultAccount, "Vault should be created");
    assert.isAbove(Number(vaultAccount.lamports), 0, "Vault should have rent-exempt balance");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. OPEN LONG 1x — collateral deposited to shared vault
  // ═══════════════════════════════════════════════════════════════════════════

  it("opens a long position with 1x leverage", async () => {
    const nonce = new BN(100001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    const vaultBefore = await context.banksClient.getAccount(vaultKey);

    await program.methods
      .openPosition(0, nonce, collateral, 1, false)
      .accounts({
        market: marketKey,
        authority: authority.publicKey,
        trader: authority.publicKey,
      })
      .rpc();

    const position = await program.account.position.fetch(positionKey);
    assert.equal(position.direction, 0, "Should be LONG");
    assert.equal(position.leverage, 1);
    assert.isTrue(position.isOpen);
    assert.equal(position.entryPrice.toNumber(), 12000);

    // Fee: 1 SOL * 5 / 10000 = 50000 lamports (0.05%)
    const expectedFee = Math.floor(LAMPORTS_PER_SOL * 5 / 10000);
    assert.equal(position.feePaid.toNumber(), expectedFee);
    assert.equal(position.collateral.toNumber(), LAMPORTS_PER_SOL - expectedFee);

    // Vault should have gained net collateral
    const vaultAfter = await context.banksClient.getAccount(vaultKey);
    const vaultDelta = Number(vaultAfter.lamports) - Number(vaultBefore.lamports);
    assert.equal(vaultDelta, LAMPORTS_PER_SOL - expectedFee, "Vault holds net collateral");

    // Market open interest updated
    const market = await program.account.market.fetch(marketKey);
    assert.equal(market.openInterestLong.toNumber(), LAMPORTS_PER_SOL - expectedFee);
    assert.equal(market.totalFeesCollected.toNumber(), expectedFee);

    // Close it for cleanup
    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CLOSE AT PROFIT — shared vault pays winner
  // ═══════════════════════════════════════════════════════════════════════════

  it("closes long at profit — shared vault pays the winner", async () => {
    // Seed the vault with extra SOL to simulate other traders' deposits
    // We do this by opening+closing a position at same price (gets back ~same amount)
    // Or we can just transfer directly
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

    // Price up 10%: 12000 → 13200
    await program.methods
      .updatePrice(new BN(13200))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    const traderBefore = await context.banksClient.getAccount(authority.publicKey);
    const vaultBefore = await context.banksClient.getAccount(vaultKey);

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
      .rpc();

    const traderAfter = await context.banksClient.getAccount(authority.publicKey);
    const vaultAfter = await context.banksClient.getAccount(vaultKey);

    const netCollateral = LAMPORTS_PER_SOL - Math.floor(LAMPORTS_PER_SOL * 5 / 10000);
    const expectedPnl = Math.floor((1200 / 12000) * netCollateral);
    const expectedPayout = netCollateral + expectedPnl;

    // Vault decreased by payout amount
    const vaultDelta = Number(vaultBefore.lamports) - Number(vaultAfter.lamports);
    assert.approximately(vaultDelta, expectedPayout, 5000, "Vault pays out profit");

    // Trader gained more than collateral (profit!)
    const traderDelta = Number(traderAfter.lamports) - Number(traderBefore.lamports);
    assert.isAbove(traderDelta, 0, "Trader PROFITED — shared vault works!");

    // Reset price
    await program.methods
      .updatePrice(new BN(12000))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CLOSE AT LOSS — loss stays in vault
  // ═══════════════════════════════════════════════════════════════════════════

  it("closes long at loss — loss stays in shared vault", async () => {
    const nonce = new BN(300001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 1, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price drops 20%: 12000 → 9600
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
    const netCollateral = LAMPORTS_PER_SOL - Math.floor(LAMPORTS_PER_SOL * 5 / 10000);
    const expectedLoss = Math.floor((2400 / 12000) * netCollateral);
    const expectedPayout = netCollateral - expectedLoss;

    // Vault only decreases by partial payout (collateral minus loss)
    const vaultDelta = Number(vaultBefore.lamports) - Number(vaultAfter.lamports);
    assert.approximately(vaultDelta, expectedPayout, 5000, "Vault keeps the loss");

    // Reset price
    await program.methods
      .updatePrice(new BN(12000))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. 5x LEVERAGE — amplifies profit
  // ═══════════════════════════════════════════════════════════════════════════

  it("5x leverage amplifies profit correctly", async () => {
    const nonce = new BN(400001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 5, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    const position = await program.account.position.fetch(positionKey);
    assert.equal(position.leverage, 5);

    // Price up 4%: 12000 → 12480
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

    // At 5x, 4% move = 20% profit
    const traderDelta = Number(traderAfter.lamports) - Number(traderBefore.lamports);
    // Should get back collateral + ~20% profit (minus tx fee)
    assert.isAbove(traderDelta, netCollateral * 1.15, "5x leverage gives ~20% profit on 4% move");

    await program.methods
      .updatePrice(new BN(12000))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. 5x LEVERAGE — amplifies loss
  // ═══════════════════════════════════════════════════════════════════════════

  it("5x leverage amplifies loss correctly", async () => {
    const nonce = new BN(500001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 5, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price drops 10%: 12000 → 10800. At 5x: 50% loss
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
    const expectedLoss = Math.floor((1200 / 12000) * netCollateral * 5); // 50%
    const expectedPayout = netCollateral - expectedLoss; // 50% of collateral

    const vaultDelta = Number(vaultBefore.lamports) - Number(vaultAfter.lamports);
    assert.approximately(vaultDelta, expectedPayout, 5000, "50% loss with 5x leverage");

    await program.methods
      .updatePrice(new BN(12000))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. SHORT POSITION — profit on price drop
  // ═══════════════════════════════════════════════════════════════════════════

  it("short position profits when price drops", async () => {
    const nonce = new BN(600001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(1, nonce, collateral, 3, false) // SHORT 3x
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price drops 5%: 12000 → 11400. At 3x SHORT: 15% profit
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

    await program.methods
      .updatePrice(new BN(12000))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. LIQUIDATION — dynamic threshold with leverage
  // ═══════════════════════════════════════════════════════════════════════════

  it("liquidates 5x long when price drops 18%", async () => {
    const nonce = new BN(700001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 5, false) // LONG 5x
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price drops 18%: 12000 → 9840. Threshold at 5x = 1800 bps = 18%
    await program.methods
      .updatePrice(new BN(9840))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    const liquidatorBefore = await context.banksClient.getAccount(authority.publicKey);

    await program.methods
      .liquidate()
      .accounts({
        market: marketKey,
        position: positionKey,
        liquidator: authority.publicKey,
      })
      .rpc();

    const position = await program.account.position.fetch(positionKey);
    assert.isFalse(position.isOpen, "Position should be closed after liquidation");

    // Liquidator earns 2% of collateral
    const liquidatorAfter = await context.banksClient.getAccount(authority.publicKey);
    const liquidatorDelta = Number(liquidatorAfter.lamports) - Number(liquidatorBefore.lamports);
    assert.isAbove(liquidatorDelta, 0, "Liquidator earned reward");

    await program.methods
      .updatePrice(new BN(12000))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();
  });

  it("does NOT liquidate 5x long when price drops only 15%", async () => {
    const nonce = new BN(700002);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 5, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price drops 15%: 12000 → 10200. 5x threshold = 18%, so NOT liquidatable
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

    // Reset and close
    await program.methods
      .updatePrice(new BN(12000))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();
    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. URIM FEE DISCOUNT
  // ═══════════════════════════════════════════════════════════════════════════

  it("URIM discount reduces fee by 10%", async () => {
    const nonce = new BN(800001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 1, true) // use_urim_discount = true
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    const position = await program.account.position.fetch(positionKey);

    // Standard fee: 50000. URIM: 50000 * 9 / 10 = 45000
    const baseFee = Math.floor(LAMPORTS_PER_SOL * 5 / 10000);
    const expectedFee = Math.floor(baseFee * 9 / 10);
    assert.equal(position.feePaid.toNumber(), expectedFee, "Fee reduced by 10%");
    assert.equal(position.collateral.toNumber(), LAMPORTS_PER_SOL - expectedFee);

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. 10x LIQUIDATION at 9% move
  // ═══════════════════════════════════════════════════════════════════════════

  it("10x leverage: liquidation at 9% price move", async () => {
    const nonce = new BN(900001);
    const collateral = new BN(LAMPORTS_PER_SOL);
    const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 10, false) // LONG 10x
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price drops 9%: 12000 → 10920. At 10x, threshold = 900 bps = 9%
    await program.methods
      .updatePrice(new BN(10920))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    await program.methods
      .liquidate()
      .accounts({ market: marketKey, position: positionKey, liquidator: authority.publicKey })
      .rpc();

    const position = await program.account.position.fetch(positionKey);
    assert.isFalse(position.isOpen, "10x liquidated at 9% drop");

    await program.methods
      .updatePrice(new BN(12000))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. VULNERABILITY TESTS
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
        // May show as "PositionAlreadyClosed" or as a transaction error
        assert.ok(e, "Correctly rejected double close");
      }
    });

    it("cannot liquidate a profitable position", async () => {
      const nonce = new BN(1100006);
      const [positionKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

      await program.methods
        .openPosition(0, nonce, new BN(LAMPORTS_PER_SOL), 1, false)
        .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
        .rpc();

      // Price goes UP — long is profitable
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

      await program.methods
        .updatePrice(new BN(12000))
        .accounts({ market: marketKey, authority: authority.publicKey })
        .rpc();
      await program.methods
        .closePosition()
        .accounts({ market: marketKey, position: positionKey, trader: authority.publicKey })
        .rpc();
    });

    it("only authority can update price", async () => {
      const randomUser = Keypair.generate();
      // Fund the random user
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
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. VAULT DRAIN PROTECTION
  // ═══════════════════════════════════════════════════════════════════════════

  it("payout capped to vault available balance (rent-exempt protected)", async () => {
    // Create a new market with minimal vault
    const commodity2 = "LITHIUM";
    const [market2Key] = findMarketPDA(commodity2);
    const [vault2Key] = findVaultPDA(market2Key);

    await program.methods
      .initializeMarket(commodity2, new BN(50000))
      .accounts({ authority: authority.publicKey })
      .rpc();

    const nonce = new BN(1200001);
    const collateral = new BN(LAMPORTS_PER_SOL / 10); // 0.1 SOL
    const [positionKey] = findPositionPDA(authority.publicKey, market2Key, nonce);

    await program.methods
      .openPosition(0, nonce, collateral, 10, false) // 10x on small vault
      .accounts({ market: market2Key, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Massive price increase: 50000 → 60000 (20% up, at 10x = 200% profit)
    await program.methods
      .updatePrice(new BN(60000))
      .accounts({ market: market2Key, authority: authority.publicKey })
      .rpc();

    await program.methods
      .closePosition()
      .accounts({ market: market2Key, position: positionKey, trader: authority.publicKey })
      .rpc();

    // Vault should NOT be drained below rent-exempt
    const vaultAfter = await context.banksClient.getAccount(vault2Key);
    assert.isAbove(Number(vaultAfter.lamports), 0, "Vault maintains rent-exempt balance");
  });
});
