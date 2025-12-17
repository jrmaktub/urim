/**
 * Test Full Betting Flow - USDC and URIM
 *
 * Tests the complete flow: bet → resolution → claim
 *
 * Usage:
 *   npx ts-node scripts/test-full-flow.ts
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import * as fs from 'fs';
import * as os from 'os';

const URIM_PAIR_ADDRESS = 'DjNhU15XfeZC5eU3Bmp1LM1VZAA4wUFs5P4nd8JbEaHS';

const config = JSON.parse(fs.readFileSync('devnet-config.json', 'utf-8'));
const PROGRAM_ID = new PublicKey(config.programId);
const USDC_MINT = new PublicKey(config.usdcMint);
const URIM_MINT = new PublicKey(config.urimMint);
const PYTH_SOL_USD = new PublicKey(config.pythSolUsd);

let connection: Connection;
let program: any;
let userKeypair: Keypair;

async function setup() {
  connection = new Connection(
    'https://solana-devnet.g.alchemy.com/v2/27SvVEbGAVC2VSJ8rPss0',
    { commitment: 'confirmed', confirmTransactionInitialTimeout: 60000 }
  );

  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  userKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );

  const wallet = new anchor.Wallet(userKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync('target/idl/urim_solana.json', 'utf-8'));
  program = new Program(idl, provider) as any;
}

async function getUrimPriceUsd(): Promise<number> {
  const response = await fetch(
    `https://api.dexscreener.com/latest/dex/pairs/solana/${URIM_PAIR_ADDRESS}`
  );
  const data: any = await response.json();
  if (!data.pair || !data.pair.priceUsd) {
    throw new Error('Failed to fetch URIM price from DexScreener');
  }
  return parseFloat(data.pair.priceUsd);
}

async function getBalances() {
  const userUsdcAta = await getAssociatedTokenAddress(USDC_MINT, userKeypair.publicKey);
  const userUrimAta = await getAssociatedTokenAddress(URIM_MINT, userKeypair.publicKey);

  let usdcBalance = 0;
  let urimBalance = 0;

  try {
    const usdcAccount = await getAccount(connection, userUsdcAta);
    usdcBalance = Number(usdcAccount.amount) / 1_000_000;
  } catch {}

  try {
    const urimAccount = await getAccount(connection, userUrimAta);
    urimBalance = Number(urimAccount.amount) / 1_000_000;
  } catch {}

  return { usdcBalance, urimBalance };
}

async function getCurrentRound() {
  const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
  const configAccount = await program.account.config.fetch(configPDA);
  const currentRoundId = configAccount.currentRoundId.toNumber() - 1;

  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(currentRoundId));
  const [roundPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('round'), roundIdBuffer],
    PROGRAM_ID
  );

  const round = await program.account.round.fetch(roundPDA);
  return { roundId: currentRoundId, roundPDA, round, configPDA };
}

async function startNewRound(durationSeconds: number = 60): Promise<{ roundId: number; roundPDA: PublicKey }> {
  console.log(`\n🚀 Starting new round (${durationSeconds}s duration) using Pyth...`);

  const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
  const configAccount = await program.account.config.fetch(configPDA);
  const roundId = configAccount.currentRoundId.toNumber();

  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(roundId));

  const [roundPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('round'), roundIdBuffer],
    PROGRAM_ID
  );

  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), roundIdBuffer],
    PROGRAM_ID
  );

  const [urimVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('urim_vault'), roundIdBuffer],
    PROGRAM_ID
  );

  try {
    const tx = await program.methods
      .startRound(new anchor.BN(durationSeconds))
      .accounts({
        config: configPDA,
        round: roundPDA,
        vault: vault,
        urimVault: urimVault,
        usdcMint: USDC_MINT,
        urimMint: URIM_MINT,
        pythPriceFeed: PYTH_SOL_USD,
        admin: userKeypair.publicKey,
      })
      .rpc();

    console.log(`   tx: ${tx.slice(0, 20)}...`);
  } catch (e: any) {
    if (e.signature) {
      console.log(`   ⏳ Transaction timed out, checking status...`);
      await new Promise(r => setTimeout(r, 5000));
      const status = await connection.getSignatureStatus(e.signature);
      if (status.value?.confirmationStatus === 'finalized' || status.value?.confirmationStatus === 'confirmed') {
        console.log(`   ✅ Transaction confirmed after timeout`);
      } else {
        throw e;
      }
    } else {
      throw e;
    }
  }

  const round = await program.account.round.fetch(roundPDA);
  console.log(`   ✅ Round #${roundId} started (locked: $${(round.lockedPrice.toNumber() / 100).toFixed(2)} from Pyth)`);

  return { roundId, roundPDA };
}

async function sendWithRetry(methodsBuilder: any): Promise<string> {
  try {
    return await methodsBuilder.rpc();
  } catch (e: any) {
    if (e.signature) {
      console.log(`   ⏳ Timeout, checking...`);
      await new Promise(r => setTimeout(r, 5000));
      const status = await connection.getSignatureStatus(e.signature);
      if (status.value?.confirmationStatus === 'finalized' || status.value?.confirmationStatus === 'confirmed') {
        return e.signature;
      }
    }
    throw e;
  }
}

async function placeBetUsdc(roundPDA: PublicKey, amountUsdc: number, betUp: boolean) {
  console.log(`\n💵 Placing USDC bet: $${amountUsdc} on ${betUp ? 'UP' : 'DOWN'}...`);

  const round = await program.account.round.fetch(roundPDA);
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(round.roundId.toNumber()));

  const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), roundIdBuffer],
    PROGRAM_ID
  );
  const [userBetPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), roundPDA.toBuffer(), userKeypair.publicKey.toBuffer()],
    PROGRAM_ID
  );

  const userUsdcAta = await getAssociatedTokenAddress(USDC_MINT, userKeypair.publicKey);
  const amount = BigInt(amountUsdc * 1_000_000); // USDC has 6 decimals

  const tx = await sendWithRetry(
    program.methods
      .placeBet(new anchor.BN(amount.toString()), betUp)
      .accounts({
        config: configPDA,
        round: roundPDA,
        userBet: userBetPDA,
        vault: vault,
        userTokenAccount: userUsdcAta,
        user: userKeypair.publicKey,
      })
  );

  console.log(`   ✅ Bet placed, tx: ${tx.slice(0, 20)}...`);
  return userBetPDA;
}

async function placeBetUrim(roundPDA: PublicKey, amountUsd: number, betUp: boolean) {
  console.log(`\n🪙 Placing URIM bet: $${amountUsd} worth on ${betUp ? 'UP' : 'DOWN'}...`);

  const priceUsd = await getUrimPriceUsd();
  const priceScaled = Math.round(priceUsd * 100_000_000);
  const urimTokens = amountUsd / priceUsd;
  const urimAmount = BigInt(Math.ceil(urimTokens * 1_000_000));

  console.log(`   URIM Price: $${priceUsd.toFixed(8)}`);
  console.log(`   URIM Amount: ${(Number(urimAmount) / 1_000_000).toLocaleString()} URIM`);

  const round = await program.account.round.fetch(roundPDA);
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(round.roundId.toNumber()));

  const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
  const [urimVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('urim_vault'), roundIdBuffer],
    PROGRAM_ID
  );
  const [userBetPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), roundPDA.toBuffer(), userKeypair.publicKey.toBuffer()],
    PROGRAM_ID
  );

  const userUrimAta = await getAssociatedTokenAddress(URIM_MINT, userKeypair.publicKey);

  const tx = await sendWithRetry(
    program.methods
      .placeBetUrim(
        new anchor.BN(urimAmount.toString()),
        betUp,
        new anchor.BN(priceScaled)
      )
      .accounts({
        config: configPDA,
        round: roundPDA,
        userBet: userBetPDA,
        urimVault: urimVault,
        userTokenAccount: userUrimAta,
        user: userKeypair.publicKey,
      })
  );

  console.log(`   ✅ Bet placed, tx: ${tx.slice(0, 20)}...`);
  return userBetPDA;
}

async function waitForRoundEnd(roundPDA: PublicKey) {
  const round = await program.account.round.fetch(roundPDA);
  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = round.endTime.toNumber() - now;

  if (secondsLeft > 0) {
    console.log(`\n⏳ Waiting ${secondsLeft}s for round to end...`);
    await new Promise(resolve => setTimeout(resolve, (secondsLeft + 2) * 1000));
  }
}

async function resolveRound(roundPDA: PublicKey) {
  console.log(`\n🎯 Resolving round...`);

  const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);

  const tx = await sendWithRetry(
    program.methods
      .resolveRound()
      .accounts({
        config: configPDA,
        round: roundPDA,
        pythPriceFeed: PYTH_SOL_USD,
        admin: userKeypair.publicKey,
      })
  );

  const round = await program.account.round.fetch(roundPDA);
  const outcome = round.outcome.up ? 'UP' : round.outcome.down ? 'DOWN' : 'TIE';

  console.log(`   ✅ Resolved! Outcome: ${outcome}`);
  console.log(`   Locked: $${(round.lockedPrice.toNumber() / 100).toFixed(2)}`);
  console.log(`   Final: $${(round.finalPrice.toNumber() / 100).toFixed(2)}`);
  console.log(`   tx: ${tx.slice(0, 20)}...`);

  return outcome;
}

async function claimUsdc(roundPDA: PublicKey, userBetPDA: PublicKey) {
  console.log(`\n💰 Claiming USDC winnings...`);

  const round = await program.account.round.fetch(roundPDA);
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(round.roundId.toNumber()));

  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), roundIdBuffer],
    PROGRAM_ID
  );

  const userUsdcAta = await getAssociatedTokenAddress(USDC_MINT, userKeypair.publicKey);

  try {
    const tx = await sendWithRetry(
      program.methods
        .claim()
        .accounts({
          round: roundPDA,
          userBet: userBetPDA,
          vault: vault,
          userTokenAccount: userUsdcAta,
          user: userKeypair.publicKey,
        })
    );

    console.log(`   ✅ Claimed! tx: ${tx.slice(0, 20)}...`);
    return true;
  } catch (e: any) {
    if (e.message?.includes('NoPayout')) {
      console.log(`   ℹ️ No payout (you lost or it was a tie)`);
    } else {
      console.log(`   ❌ Claim failed: ${e.message}`);
    }
    return false;
  }
}

async function claimUrim(roundPDA: PublicKey, userBetPDA: PublicKey) {
  console.log(`\n💰 Claiming URIM winnings...`);

  const round = await program.account.round.fetch(roundPDA);
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(round.roundId.toNumber()));

  const [urimVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('urim_vault'), roundIdBuffer],
    PROGRAM_ID
  );

  const userUrimAta = await getAssociatedTokenAddress(URIM_MINT, userKeypair.publicKey);

  try {
    const tx = await sendWithRetry(
      program.methods
        .claimUrim()
        .accounts({
          round: roundPDA,
          userBet: userBetPDA,
          urimVault: urimVault,
          userTokenAccount: userUrimAta,
          user: userKeypair.publicKey,
        })
    );

    console.log(`   ✅ Claimed! tx: ${tx.slice(0, 20)}...`);
    return true;
  } catch (e: any) {
    if (e.message?.includes('NoPayout')) {
      console.log(`   ℹ️ No payout (you lost or it was a tie)`);
    } else {
      console.log(`   ❌ Claim failed: ${e.message}`);
    }
    return false;
  }
}

async function testUsdcFlow(durationSeconds: number = 120) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST 1: USDC BETTING FLOW');
  console.log('='.repeat(60));

  const balancesBefore = await getBalances();
  console.log(`\n📊 Balances Before:`);
  console.log(`   USDC: ${balancesBefore.usdcBalance.toFixed(2)}`);

  // Start a round
  const { roundPDA } = await startNewRound(durationSeconds);

  // Place bet
  const userBetPDA = await placeBetUsdc(roundPDA, 1, true); // $1 on UP

  // Wait for round to end
  await waitForRoundEnd(roundPDA);

  // Resolve
  const outcome = await resolveRound(roundPDA);

  // Claim
  await claimUsdc(roundPDA, userBetPDA);

  const balancesAfter = await getBalances();
  console.log(`\n📊 Balances After:`);
  console.log(`   USDC: ${balancesAfter.usdcBalance.toFixed(2)}`);
  console.log(`   Change: ${(balancesAfter.usdcBalance - balancesBefore.usdcBalance).toFixed(4)} USDC`);

  return outcome;
}

async function testUrimFlow(durationSeconds: number = 120) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST 2: URIM BETTING FLOW');
  console.log('='.repeat(60));

  const balancesBefore = await getBalances();
  console.log(`\n📊 Balances Before:`);
  console.log(`   URIM: ${balancesBefore.urimBalance.toLocaleString()}`);

  // Start a round
  const { roundPDA } = await startNewRound(durationSeconds);

  // Place bet
  const userBetPDA = await placeBetUrim(roundPDA, 1, false); // $1 on DOWN

  // Wait for round to end
  await waitForRoundEnd(roundPDA);

  // Resolve
  const outcome = await resolveRound(roundPDA);

  // Claim
  await claimUrim(roundPDA, userBetPDA);

  const balancesAfter = await getBalances();
  console.log(`\n📊 Balances After:`);
  console.log(`   URIM: ${balancesAfter.urimBalance.toLocaleString()}`);
  console.log(`   Change: ${(balancesAfter.urimBalance - balancesBefore.urimBalance).toLocaleString()} URIM`);

  return outcome;
}

async function main() {
  console.log('🧪 FULL FLOW TEST - USDC & URIM BETTING');
  console.log('========================================\n');

  await setup();
  console.log(`User: ${userKeypair.publicKey.toBase58()}`);

  const initialBalances = await getBalances();
  console.log(`\n💼 Initial Balances:`);
  console.log(`   USDC: ${initialBalances.usdcBalance.toFixed(2)}`);
  console.log(`   URIM: ${initialBalances.urimBalance.toLocaleString()}`);

  // Test USDC flow (use 120s rounds due to slow devnet confirmations)
  await testUsdcFlow(120);

  // Test URIM flow
  await testUrimFlow(120);

  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL TESTS COMPLETED');
  console.log('='.repeat(60));

  const finalBalances = await getBalances();
  console.log(`\n💼 Final Balances:`);
  console.log(`   USDC: ${finalBalances.usdcBalance.toFixed(2)} (${(finalBalances.usdcBalance - initialBalances.usdcBalance >= 0 ? '+' : '')}${(finalBalances.usdcBalance - initialBalances.usdcBalance).toFixed(4)})`);
  console.log(`   URIM: ${finalBalances.urimBalance.toLocaleString()} (${(finalBalances.urimBalance - initialBalances.urimBalance >= 0 ? '+' : '')}${(finalBalances.urimBalance - initialBalances.urimBalance).toLocaleString()})`);
}

main().catch(console.error);
