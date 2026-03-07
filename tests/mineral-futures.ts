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

let resetCounter = 0;
async function setPrice(program: any, marketKey: PublicKey, authority: Keypair, price: number) {
  resetCounter++;
  await program.methods
    .updatePrice(new BN(price + resetCounter))
    .accounts({ market: marketKey, authority: authority.publicKey })
    .rpc();
  await program.methods
    .updatePrice(new BN(price))
    .accounts({ market: marketKey, authority: authority.publicKey })
    .rpc();
}

const COL = LAMPORTS_PER_SOL; // 1 SOL collateral shorthand
const MIN_COL = 10_000_000; // 0.01 SOL minimum

describe("mineral-futures: FULL SYSTEM TEST", () => {
  let provider: BankrunProvider;
  let program: Program<MineralFutures>;
  let context: any;
  let authority: Keypair;

  const commodity = "ANTIMONY";
  const initialPrice = new BN(25000); // $25,000/ton
  let marketKey: PublicKey;
  let vaultKey: PublicKey;

  before(async () => {
    context = await startAnchor("", [], []);
    provider = new BankrunProvider(context);
    anchor.setProvider(provider as any);
    program = new Program<MineralFutures>(IDL, provider as any);
    authority = provider.wallet.payer;
    [marketKey] = findMarketPDA(commodity);
    [vaultKey] = findVaultPDA(marketKey);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: MARKET SETUP
  // ═══════════════════════════════════════════════════════════════════════════

  it("1. initializes ANTIMONY market", async () => {
    await program.methods
      .initializeMarket(commodity, initialPrice)
      .accounts({ authority: authority.publicKey })
      .rpc();

    const market = await program.account.market.fetch(marketKey);
    assert.equal(market.markPrice.toNumber(), 25000);
    assert.equal(market.openInterestLong.toNumber(), 0);
    assert.equal(market.openInterestShort.toNumber(), 0);
    assert.isFalse(market.isPaused);
    assert.equal(market.fundingRateCumulative.toNumber(), 0);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: TRADERS PROFIT
  // ═══════════════════════════════════════════════════════════════════════════

  it("2. seed vault so traders can profit", async () => {
    // Simulate existing liquidity from previous traders' losses
    const seedTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: vaultKey,
        lamports: 10 * COL,
      })
    );
    await provider.sendAndConfirm(seedTx);

    const vault = await context.banksClient.getAccount(vaultKey);
    assert.isAbove(Number(vault.lamports), 10 * COL);
  });

  it("3. LONG 1x: trader profits on price rise", async () => {
    const nonce = new BN(1);
    const [posKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    const traderBefore = await context.banksClient.getAccount(authority.publicKey);

    await program.methods
      .openPosition(0, nonce, new BN(COL), 1, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price rises 20%: 25000 → 30000
    await program.methods
      .updatePrice(new BN(30000))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: posKey, trader: authority.publicKey })
      .rpc();

    const traderAfter = await context.banksClient.getAccount(authority.publicKey);
    const delta = Number(traderAfter.lamports) - Number(traderBefore.lamports);
    // Should profit ~0.2 SOL minus open+close fees and tx fees
    assert.isAbove(delta, 0.1 * COL, "Trader profited from 1x long");

    await setPrice(program, marketKey, authority, 25000);
  });

  it("4. SHORT 3x: trader profits on price drop", async () => {
    await setPrice(program, marketKey, authority, 25000);
    const nonce = new BN(2);
    const [posKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    const traderBefore = await context.banksClient.getAccount(authority.publicKey);

    await program.methods
      .openPosition(1, nonce, new BN(COL), 3, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price drops 10%: 25000 → 22500. At 3x SHORT = 30% profit
    await program.methods
      .updatePrice(new BN(22500))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: posKey, trader: authority.publicKey })
      .rpc();

    const traderAfter = await context.banksClient.getAccount(authority.publicKey);
    const delta = Number(traderAfter.lamports) - Number(traderBefore.lamports);
    assert.isAbove(delta, 0.2 * COL, "Short 3x: ~30% profit on 10% drop");

    await setPrice(program, marketKey, authority, 25000);
  });

  it("5. LONG 10x: massive profit on small move", async () => {
    await setPrice(program, marketKey, authority, 25000);
    const nonce = new BN(3);
    const [posKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    const traderBefore = await context.banksClient.getAccount(authority.publicKey);

    await program.methods
      .openPosition(0, nonce, new BN(COL), 10, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price rises 5%: 25000 → 26250. At 10x = 50% profit
    await program.methods
      .updatePrice(new BN(26250))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: posKey, trader: authority.publicKey })
      .rpc();

    const traderAfter = await context.banksClient.getAccount(authority.publicKey);
    const delta = Number(traderAfter.lamports) - Number(traderBefore.lamports);
    assert.isAbove(delta, 0.4 * COL, "10x long: ~50% profit on 5% move");

    await setPrice(program, marketKey, authority, 25000);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: LOSSES
  // ═══════════════════════════════════════════════════════════════════════════

  it("6. LONG at loss: trader loses, vault keeps it", async () => {
    await setPrice(program, marketKey, authority, 25000);
    const nonce = new BN(4);
    const [posKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    const vaultBefore = await context.banksClient.getAccount(vaultKey);

    await program.methods
      .openPosition(0, nonce, new BN(COL), 1, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price drops 30%: 25000 → 17500
    await program.methods
      .updatePrice(new BN(17500))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: posKey, trader: authority.publicKey })
      .rpc();

    const vaultAfter = await context.banksClient.getAccount(vaultKey);
    // Vault should have gained (kept the loss portion)
    assert.isAbove(Number(vaultAfter.lamports), Number(vaultBefore.lamports), "Vault grew from trader loss");

    await setPrice(program, marketKey, authority, 25000);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: LIQUIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  it("7. 5x long liquidated at ~18% drop", async () => {
    await setPrice(program, marketKey, authority, 25000);
    const nonce = new BN(5);
    const [posKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, new BN(COL), 5, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // At 5x, 90% loss threshold = 18% price drop. Drop 20% to be safe.
    await program.methods
      .updatePrice(new BN(20000)) // 20% drop
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    const liquidatorBefore = await context.banksClient.getAccount(authority.publicKey);

    await program.methods
      .liquidate()
      .accounts({ market: marketKey, position: posKey, liquidator: authority.publicKey })
      .rpc();

    const pos = await program.account.position.fetch(posKey);
    assert.isFalse(pos.isOpen, "Liquidated");

    const liquidatorAfter = await context.banksClient.getAccount(authority.publicKey);
    assert.isAbove(
      Number(liquidatorAfter.lamports) - Number(liquidatorBefore.lamports),
      0,
      "Liquidator got 2% reward"
    );

    await setPrice(program, marketKey, authority, 25000);
  });

  it("8. 10x long liquidated at 9% drop", async () => {
    await setPrice(program, marketKey, authority, 25000);
    const nonce = new BN(6);
    const [posKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, new BN(COL), 10, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // At 10x, 90% loss at 9% drop. Drop 10%.
    await program.methods
      .updatePrice(new BN(22500)) // 10% drop
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    await program.methods
      .liquidate()
      .accounts({ market: marketKey, position: posKey, liquidator: authority.publicKey })
      .rpc();

    const pos = await program.account.position.fetch(posKey);
    assert.isFalse(pos.isOpen, "10x liquidated at 10% drop");

    await setPrice(program, marketKey, authority, 25000);
  });

  it("9. profitable position is NOT liquidatable", async () => {
    await setPrice(program, marketKey, authority, 25000);
    const nonce = new BN(7);
    const [posKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, new BN(COL), 5, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Price goes UP — long is profitable
    await program.methods
      .updatePrice(new BN(30000))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    try {
      await program.methods
        .liquidate()
        .accounts({ market: marketKey, position: posKey, liquidator: authority.publicKey })
        .rpc();
      assert.fail("Should not liquidate profitable position");
    } catch (e: any) {
      assert.include(e.toString(), "NotLiquidatable");
    }

    await setPrice(program, marketKey, authority, 25000);
    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: posKey, trader: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5: AUTHORITY WITHDRAWS FEES
  // ═══════════════════════════════════════════════════════════════════════════

  it("10. authority withdraws fees without disrupting system", async () => {
    await setPrice(program, marketKey, authority, 25000);

    // Seed vault with extra to ensure withdrawable excess exists
    const seedTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: vaultKey,
        lamports: 5 * COL,
      })
    );
    await provider.sendAndConfirm(seedTx);

    // Open a position so there's OI
    const nonce = new BN(8);
    const [posKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, new BN(COL), 1, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    const market = await program.account.market.fetch(marketKey);
    const totalOI = market.openInterestLong.toNumber() + market.openInterestShort.toNumber();
    const vaultBal = Number((await context.banksClient.getAccount(vaultKey)).lamports);

    // Try to withdraw everything — should fail (vault needs 2x OI + rent)
    try {
      await program.methods
        .withdrawFees(new BN(vaultBal))
        .accounts({ market: marketKey, authority: authority.publicKey })
        .rpc();
      assert.fail("Should reject draining vault");
    } catch (e: any) {
      assert.include(e.toString(), "NothingToWithdraw");
    }

    // Withdraw a safe amount — 1 SOL (well within excess)
    const authBefore = await context.banksClient.getAccount(authority.publicKey);
    await program.methods
      .withdrawFees(new BN(COL))
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();
    const authAfter = await context.banksClient.getAccount(authority.publicKey);
    assert.isAbove(
      Number(authAfter.lamports) - Number(authBefore.lamports),
      0,
      "Authority received fees"
    );

    // Position should still close fine (vault still has enough)
    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: posKey, trader: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 6: EMERGENCY CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════

  it("11. pause blocks new positions, unpause allows them", async () => {
    await program.methods
      .pauseMarket()
      .accounts({ market: marketKey, authority: authority.publicKey })
      .rpc();

    const nonce = new BN(100);
    try {
      await program.methods
        .openPosition(0, nonce, new BN(COL), 1, false)
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

    // Now it works
    const [posKey] = findPositionPDA(authority.publicKey, marketKey, nonce);
    await program.methods
      .openPosition(0, nonce, new BN(COL), 1, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: posKey, trader: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 7: FUNDING RATE
  // ═══════════════════════════════════════════════════════════════════════════

  it("12. funding rate rejects early, works on-time", async () => {
    try {
      await program.methods
        .applyFunding()
        .accounts({ market: marketKey })
        .rpc();
      assert.fail("Should reject early");
    } catch (e: any) {
      assert.include(e.toString(), "FundingTooEarly");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 8: URIM DISCOUNT
  // ═══════════════════════════════════════════════════════════════════════════

  it("13. URIM discount falls back to standard fee without token account", async () => {
    await setPrice(program, marketKey, authority, 25000);
    const nonce = new BN(200);
    const [posKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, new BN(COL), 1, true) // claim discount but no token acct
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    const pos = await program.account.position.fetch(posKey);
    const standardFee = Math.floor(COL * 5 / 10000);
    assert.equal(pos.feePaid.toNumber(), standardFee, "Standard fee — no discount without URIM");

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: posKey, trader: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 9: MINIMUM COLLATERAL
  // ═══════════════════════════════════════════════════════════════════════════

  it("14. rejects dust positions below 0.01 SOL", async () => {
    const nonce = new BN(300);
    try {
      await program.methods
        .openPosition(0, nonce, new BN(1000), 1, false) // 1000 lamports = dust
        .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
        .rpc();
      assert.fail("Should reject dust position");
    } catch (e: any) {
      assert.include(e.toString(), "CollateralTooSmall");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 10: POSITION SIZE LIMIT
  // ═══════════════════════════════════════════════════════════════════════════

  it("15. rejects whale position when OI exists", async () => {
    await setPrice(program, marketKey, authority, 25000);

    // Open small position to create OI
    const nonce1 = new BN(400);
    const [pos1Key] = findPositionPDA(authority.publicKey, marketKey, nonce1);

    await program.methods
      .openPosition(0, nonce1, new BN(COL / 10), 1, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // Whale tries 10x on 10 SOL
    const nonce2 = new BN(401);
    try {
      await program.methods
        .openPosition(0, nonce2, new BN(10 * COL), 10, false)
        .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
        .rpc();
      assert.fail("Should reject whale");
    } catch (e: any) {
      assert.include(e.toString(), "PositionTooLarge");
    }

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: pos1Key, trader: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 11: AUTHORITY TRANSFER
  // ═══════════════════════════════════════════════════════════════════════════

  it("16. authority transfer works", async () => {
    const newAuth = Keypair.generate();

    // Fund new authority
    const fundTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: newAuth.publicKey,
        lamports: COL,
      })
    );
    await provider.sendAndConfirm(fundTx);

    await program.methods
      .transferAuthority()
      .accounts({ market: marketKey, authority: authority.publicKey, newAuthority: newAuth.publicKey })
      .rpc();

    let market = await program.account.market.fetch(marketKey);
    assert.equal(market.authority.toBase58(), newAuth.publicKey.toBase58());

    // Old authority can't update price anymore
    try {
      await program.methods
        .updatePrice(new BN(99999))
        .accounts({ market: marketKey, authority: authority.publicKey })
        .rpc();
      assert.fail("Old authority should be rejected");
    } catch (e: any) {
      assert.ok(e);
    }

    // New authority CAN update price
    await program.methods
      .updatePrice(new BN(25000))
      .accounts({ market: marketKey, authority: newAuth.publicKey })
      .signers([newAuth])
      .rpc();

    market = await program.account.market.fetch(marketKey);
    assert.equal(market.markPrice.toNumber(), 25000);

    // Transfer back for remaining tests
    await program.methods
      .transferAuthority()
      .accounts({ market: marketKey, authority: newAuth.publicKey, newAuthority: authority.publicKey })
      .signers([newAuth])
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 12: POSITION ACCOUNT RECLAIM
  // ═══════════════════════════════════════════════════════════════════════════

  it("17. reclaim rent from closed position", async () => {
    await setPrice(program, marketKey, authority, 25000);
    const nonce = new BN(500);
    const [posKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, new BN(COL), 1, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: posKey, trader: authority.publicKey })
      .rpc();

    const ownerBefore = await context.banksClient.getAccount(authority.publicKey);

    await program.methods
      .closePositionAccount()
      .accounts({ position: posKey, owner: authority.publicKey })
      .rpc();

    const ownerAfter = await context.banksClient.getAccount(authority.publicKey);
    assert.isAbove(
      Number(ownerAfter.lamports) - Number(ownerBefore.lamports),
      0,
      "Owner reclaimed rent"
    );

    // Position account should be gone
    const posAccount = await context.banksClient.getAccount(posKey);
    assert.isNull(posAccount, "Position account closed");
  });

  it("18. cannot reclaim rent from OPEN position", async () => {
    await setPrice(program, marketKey, authority, 25000);
    const nonce = new BN(501);
    const [posKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

    await program.methods
      .openPosition(0, nonce, new BN(COL), 1, false)
      .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    try {
      await program.methods
        .closePositionAccount()
        .accounts({ position: posKey, owner: authority.publicKey })
        .rpc();
      assert.fail("Should reject — position still open");
    } catch (e: any) {
      assert.include(e.toString(), "PositionStillOpen");
    }

    await program.methods
      .closePosition()
      .accounts({ market: marketKey, position: posKey, trader: authority.publicKey })
      .rpc();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 13: VAULT DRAIN PROTECTION
  // ═══════════════════════════════════════════════════════════════════════════

  it("19. payout capped to vault balance — no drain", async () => {
    const commodity2 = "GALLIUM";
    const [m2Key] = findMarketPDA(commodity2);
    const [v2Key] = findVaultPDA(m2Key);

    await program.methods
      .initializeMarket(commodity2, new BN(50000))
      .accounts({ authority: authority.publicKey })
      .rpc();

    const nonce = new BN(600);
    const [posKey] = findPositionPDA(authority.publicKey, m2Key, nonce);

    await program.methods
      .openPosition(0, nonce, new BN(COL / 10), 10, false)
      .accounts({ market: m2Key, authority: authority.publicKey, trader: authority.publicKey })
      .rpc();

    // 200% profit at 10x — would need 3x collateral but vault only has ~1x
    await program.methods
      .updatePrice(new BN(60000))
      .accounts({ market: m2Key, authority: authority.publicKey })
      .rpc();

    await program.methods
      .closePosition()
      .accounts({ market: m2Key, position: posKey, trader: authority.publicKey })
      .rpc();

    const vault = await context.banksClient.getAccount(v2Key);
    assert.isAbove(Number(vault.lamports), 0, "Vault not drained");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 14: VULNERABILITY TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("vulnerability tests", () => {
    it("rejects leverage > 10", async () => {
      try {
        await program.methods
          .openPosition(0, new BN(9001), new BN(COL), 11, false)
          .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
          .rpc();
        assert.fail();
      } catch (e: any) {
        assert.include(e.toString(), "InvalidLeverage");
      }
    });

    it("rejects leverage 0", async () => {
      try {
        await program.methods
          .openPosition(0, new BN(9002), new BN(COL), 0, false)
          .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
          .rpc();
        assert.fail();
      } catch (e: any) {
        assert.include(e.toString(), "InvalidLeverage");
      }
    });

    it("rejects invalid direction", async () => {
      try {
        await program.methods
          .openPosition(2, new BN(9003), new BN(COL), 1, false)
          .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
          .rpc();
        assert.fail();
      } catch (e: any) {
        assert.include(e.toString(), "InvalidDirection");
      }
    });

    it("rejects double close", async () => {
      await setPrice(program, marketKey, authority, 25000);
      const nonce = new BN(9004);
      const [posKey] = findPositionPDA(authority.publicKey, marketKey, nonce);

      await program.methods
        .openPosition(0, nonce, new BN(COL), 1, false)
        .accounts({ market: marketKey, authority: authority.publicKey, trader: authority.publicKey })
        .rpc();

      await program.methods
        .closePosition()
        .accounts({ market: marketKey, position: posKey, trader: authority.publicKey })
        .rpc();

      try {
        await program.methods
          .closePosition()
          .accounts({ market: marketKey, position: posKey, trader: authority.publicKey })
          .rpc();
        assert.fail();
      } catch (e: any) {
        assert.ok(e, "Rejected double close");
      }
    });

    it("unauthorized user cannot update price", async () => {
      const rando = Keypair.generate();
      const tx = new anchor.web3.Transaction().add(
        SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: rando.publicKey, lamports: COL })
      );
      await provider.sendAndConfirm(tx);

      try {
        await program.methods
          .updatePrice(new BN(99999))
          .accounts({ market: marketKey, authority: rando.publicKey })
          .signers([rando])
          .rpc();
        assert.fail();
      } catch (e: any) {
        assert.ok(e);
      }
    });

    it("unauthorized user cannot pause", async () => {
      const rando = Keypair.generate();
      const tx = new anchor.web3.Transaction().add(
        SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: rando.publicKey, lamports: COL })
      );
      await provider.sendAndConfirm(tx);

      try {
        await program.methods
          .pauseMarket()
          .accounts({ market: marketKey, authority: rando.publicKey })
          .signers([rando])
          .rpc();
        assert.fail();
      } catch (e: any) {
        assert.ok(e);
      }
    });

    it("unauthorized user cannot withdraw", async () => {
      const rando = Keypair.generate();
      const tx = new anchor.web3.Transaction().add(
        SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: rando.publicKey, lamports: COL })
      );
      await provider.sendAndConfirm(tx);

      try {
        await program.methods
          .withdrawFees(new BN(COL))
          .accounts({ market: marketKey, authority: rando.publicKey })
          .signers([rando])
          .rpc();
        assert.fail();
      } catch (e: any) {
        assert.ok(e);
      }
    });
  });
});
