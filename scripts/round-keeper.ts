/**
 * ROUND KEEPER - Automated round management
 *
 * This script runs continuously and:
 * 1. Monitors current round status
 * 2. Resolves rounds when they expire
 * 3. Starts new rounds automatically
 * 4. Collects fees after resolution
 *
 * Run with: npx ts-node scripts/round-keeper.ts
 *
 * For production, run with PM2:
 *   pm2 start scripts/round-keeper.ts --interpreter npx --interpreter-args "ts-node"
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import * as fs from 'fs';
import * as os from 'os';

// Configuration
const CHECK_INTERVAL_MS = 30_000; // Check every 30 seconds
const ROUND_DURATION_SECONDS = 15 * 60; // 15 minutes per round
const AUTO_START_NEW_ROUND = true;
const AUTO_COLLECT_FEES = true;

const config = JSON.parse(fs.readFileSync('devnet-config.json', 'utf-8'));
const PROGRAM_ID = new PublicKey(config.programId);
const USDC_MINT = new PublicKey(config.usdcMint);
const URIM_MINT = new PublicKey(config.urimMint);

let connection: Connection;
let program: any;
let adminKeypair: Keypair;

async function setup() {
  // Use RPC_URL env var or default to public devnet
  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  connection = new Connection(rpcUrl, 'confirmed');

  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );

  const wallet = new anchor.Wallet(adminKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync('target/idl/urim_solana.json', 'utf-8'));
  program = new Program(idl, provider) as any;

  console.log('🤖 Round Keeper Started');
  console.log(`   Admin: ${adminKeypair.publicKey.toBase58()}`);
  console.log(`   Check interval: ${CHECK_INTERVAL_MS / 1000}s`);
  console.log(`   Round duration: ${ROUND_DURATION_SECONDS / 60} minutes`);
  console.log('');
}

async function getCurrentPrice(): Promise<number> {
  const resp = await fetch(
    'https://hermes.pyth.network/v2/updates/price/latest?ids[]=ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'
  );
  const data: any = await resp.json();
  const priceData = data.parsed[0].price;
  const currentPrice = Number(priceData.price) * Math.pow(10, priceData.expo);
  return Math.round(currentPrice * 100); // Return in cents
}

async function resolveRound(roundId: number): Promise<boolean> {
  try {
    const roundIdBuffer = Buffer.alloc(8);
    roundIdBuffer.writeBigUInt64LE(BigInt(roundId));
    const [roundPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('round'), roundIdBuffer],
      PROGRAM_ID
    );

    const priceInCents = await getCurrentPrice();

    console.log(`   Resolving with price: $${(priceInCents / 100).toFixed(2)}`);

    await program.methods
      .resolveRoundManual(new anchor.BN(priceInCents))
      .accounts({ round: roundPDA })
      .rpc();

    return true;
  } catch (e: any) {
    console.log(`   ❌ Resolve failed: ${e.message}`);
    return false;
  }
}

async function collectFees(roundId: number): Promise<void> {
  try {
    const roundIdBuffer = Buffer.alloc(8);
    roundIdBuffer.writeBigUInt64LE(BigInt(roundId));
    const [roundPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('round'), roundIdBuffer],
      PROGRAM_ID
    );
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), roundIdBuffer],
      PROGRAM_ID
    );

    const treasuryUsdc = await getAssociatedTokenAddress(USDC_MINT, adminKeypair.publicKey);

    const round = await program.account.round.fetch(roundPDA);

    if (round.totalFees.toNumber() > 0 && !round.feesCollected) {
      await program.methods
        .collectFees()
        .accounts({
          round: roundPDA,
          vault: vaultPDA,
          treasury: treasuryUsdc,
        })
        .rpc();
      console.log(`   ✅ Collected ${(round.totalFees.toNumber() / 1_000_000).toFixed(4)} USDC fees`);
    }
  } catch (e: any) {
    // Fees might already be collected or zero
  }
}

async function startNewRound(): Promise<number | null> {
  try {
    const priceInCents = await getCurrentPrice();

    console.log(`   Starting new round at $${(priceInCents / 100).toFixed(2)}`);

    await program.methods
      .startRoundManual(new anchor.BN(priceInCents), new anchor.BN(ROUND_DURATION_SECONDS))
      .accounts({ usdcMint: USDC_MINT, urimMint: URIM_MINT })
      .rpc();

    const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
    const configAccount = await program.account.config.fetch(configPDA);
    return configAccount.currentRoundId.toNumber() - 1;
  } catch (e: any) {
    console.log(`   ❌ Start round failed: ${e.message}`);
    return null;
  }
}

async function checkAndManageRounds() {
  const timestamp = new Date().toISOString();

  try {
    const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
    const configAccount = await program.account.config.fetch(configPDA);
    const currentRoundId = configAccount.currentRoundId.toNumber() - 1;

    const roundIdBuffer = Buffer.alloc(8);
    roundIdBuffer.writeBigUInt64LE(BigInt(currentRoundId));
    const [roundPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('round'), roundIdBuffer],
      PROGRAM_ID
    );

    let round;
    try {
      round = await program.account.round.fetch(roundPDA);
    } catch {
      // No active round, start one
      console.log(`[${timestamp}] No active round found`);
      if (AUTO_START_NEW_ROUND) {
        const newId = await startNewRound();
        if (newId) console.log(`   ✅ Started Round #${newId}`);
      }
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const endTime = round.endTime.toNumber();
    const secondsLeft = endTime - now;

    if (!round.resolved) {
      if (secondsLeft > 0) {
        // Round is active
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        console.log(
          `[${timestamp}] Round #${currentRoundId} | ` +
          `${mins}:${secs.toString().padStart(2, '0')} left | ` +
          `UP: $${(round.upPool.toNumber() / 1_000_000).toFixed(2)} | ` +
          `DOWN: $${(round.downPool.toNumber() / 1_000_000).toFixed(2)}`
        );
      } else {
        // Round expired, needs resolution
        console.log(`[${timestamp}] Round #${currentRoundId} EXPIRED - Resolving...`);
        const resolved = await resolveRound(currentRoundId);

        if (resolved) {
          const updatedRound = await program.account.round.fetch(roundPDA);
          const outcome = updatedRound.outcome.up ? 'UP' : updatedRound.outcome.down ? 'DOWN' : 'DRAW';
          console.log(`   ✅ Round #${currentRoundId} resolved: ${outcome}`);

          if (AUTO_COLLECT_FEES) {
            await collectFees(currentRoundId);
          }

          if (AUTO_START_NEW_ROUND) {
            const newId = await startNewRound();
            if (newId) console.log(`   ✅ Started Round #${newId}`);
          }
        }
      }
    } else {
      // Round already resolved, start new one
      console.log(`[${timestamp}] Round #${currentRoundId} already resolved`);
      if (AUTO_START_NEW_ROUND) {
        const newId = await startNewRound();
        if (newId) console.log(`   ✅ Started Round #${newId}`);
      }
    }
  } catch (e: any) {
    console.log(`[${timestamp}] Error: ${e.message}`);
  }
}

async function main() {
  await setup();

  // Initial check
  await checkAndManageRounds();

  // Run continuously
  setInterval(checkAndManageRounds, CHECK_INTERVAL_MS);

  console.log('\n🔄 Keeper running... Press Ctrl+C to stop\n');
}

main().catch(console.error);
