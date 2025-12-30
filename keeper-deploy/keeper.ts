/**
 * URIM Round Keeper - Standalone deployment for Railway
 *
 * Environment Variables:
 *   NETWORK: devnet | mainnet (default: devnet)
 *   RPC_URL: Custom RPC URL (optional)
 *   KEEPER_PRIVATE_KEY: Base58 encoded private key (required)
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import bs58 from 'bs58';

// Configuration
const CHECK_INTERVAL_MS = 30_000; // 30 seconds
const ROUND_DURATION_SECONDS = 180; // 3 minutes

// Network configs
const CONFIGS = {
  devnet: {
    programId: '5KqMaQLoKhBYcHD1qWZVcQqu5pmTvMitDUEqmKsqBTQg',
    usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    urimMint: 'z9hasbeeaPU4JVb1Np9oqNbpe984J8cr5THSEGCWwpR',
    rpc: 'https://api.devnet.solana.com'
  },
  mainnet: {
    programId: '5KqMaQLoKhBYcHD1qWZVcQqu5pmTvMitDUEqmKsqBTQg',
    usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    urimMint: 'F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump',
    rpc: 'https://api.mainnet-beta.solana.com'
  }
};

// Minimal IDL for keeper operations
const IDL = {
  "address": "5KqMaQLoKhBYcHD1qWZVcQqu5pmTvMitDUEqmKsqBTQg",
  "metadata": { "name": "urim_solana", "version": "0.1.0", "spec": "0.1.0" },
  "instructions": [
    {
      "name": "start_round_manual",
      "discriminator": [183,88,98,209,230,189,204,235],
      "accounts": [
        { "name": "config", "writable": true, "pda": { "seeds": [{ "kind": "const", "value": [99,111,110,102,105,103] }] } },
        { "name": "round", "writable": true, "pda": { "seeds": [{ "kind": "const", "value": [114,111,117,110,100] }, { "kind": "account", "path": "config.current_round_id", "account": "Config" }] } },
        { "name": "vault", "writable": true, "pda": { "seeds": [{ "kind": "const", "value": [118,97,117,108,116] }, { "kind": "account", "path": "config.current_round_id", "account": "Config" }] } },
        { "name": "urim_vault", "writable": true, "pda": { "seeds": [{ "kind": "const", "value": [117,114,105,109,95,118,97,117,108,116] }, { "kind": "account", "path": "config.current_round_id", "account": "Config" }] } },
        { "name": "usdc_mint" },
        { "name": "urim_mint" },
        { "name": "admin", "writable": true, "signer": true, "relations": ["config"] },
        { "name": "token_program", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { "name": "system_program", "address": "11111111111111111111111111111111" }
      ],
      "args": [{ "name": "locked_price", "type": "u64" }, { "name": "duration_seconds", "type": "i64" }]
    },
    {
      "name": "resolve_round_manual",
      "discriminator": [83,37,59,217,15,109,76,204],
      "accounts": [
        { "name": "config", "pda": { "seeds": [{ "kind": "const", "value": [99,111,110,102,105,103] }] } },
        { "name": "round", "writable": true },
        { "name": "admin", "signer": true, "relations": ["config"] }
      ],
      "args": [{ "name": "final_price", "type": "u64" }]
    }
  ],
  "accounts": [
    { "name": "Config", "discriminator": [155,12,170,224,30,250,204,130] },
    { "name": "Round", "discriminator": [87,127,165,51,73,78,116,174] }
  ],
  "types": [
    {
      "name": "Config",
      "type": { "kind": "struct", "fields": [
        { "name": "admin", "type": "pubkey" },
        { "name": "treasury", "type": "pubkey" },
        { "name": "paused", "type": "bool" },
        { "name": "current_round_id", "type": "u64" },
        { "name": "bump", "type": "u8" }
      ]}
    },
    {
      "name": "Round",
      "type": { "kind": "struct", "fields": [
        { "name": "round_id", "type": "u64" },
        { "name": "locked_price", "type": "u64" },
        { "name": "final_price", "type": "u64" },
        { "name": "created_at", "type": "i64" },
        { "name": "lock_time", "type": "i64" },
        { "name": "end_time", "type": "i64" },
        { "name": "up_pool", "type": "u64" },
        { "name": "down_pool", "type": "u64" },
        { "name": "total_fees", "type": "u64" },
        { "name": "up_pool_urim", "type": "u64" },
        { "name": "down_pool_urim", "type": "u64" },
        { "name": "total_fees_urim", "type": "u64" },
        { "name": "up_pool_usd", "type": "u64" },
        { "name": "down_pool_usd", "type": "u64" },
        { "name": "total_fees_usd", "type": "u64" },
        { "name": "resolved", "type": "bool" },
        { "name": "outcome", "type": { "defined": { "name": "Outcome" } } },
        { "name": "bump", "type": "u8" },
        { "name": "vault_bump", "type": "u8" },
        { "name": "urim_vault_bump", "type": "u8" }
      ]}
    },
    { "name": "Outcome", "type": { "kind": "enum", "variants": [{ "name": "Pending" }, { "name": "Up" }, { "name": "Down" }, { "name": "Draw" }] } }
  ]
};

const NETWORK = (process.env.NETWORK || 'devnet') as 'devnet' | 'mainnet';
const config = CONFIGS[NETWORK];
const PROGRAM_ID = new PublicKey(config.programId);
const USDC_MINT = new PublicKey(config.usdcMint);
const URIM_MINT = new PublicKey(config.urimMint);

let connection: Connection;
let program: any;
let adminKeypair: Keypair;

async function setup() {
  const rpcUrl = process.env.RPC_URL || config.rpc;
  connection = new Connection(rpcUrl, 'confirmed');

  if (!process.env.KEEPER_PRIVATE_KEY) {
    console.error('ERROR: KEEPER_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  const secretKey = bs58.decode(process.env.KEEPER_PRIVATE_KEY);
  adminKeypair = Keypair.fromSecretKey(secretKey);

  const wallet = new anchor.Wallet(adminKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  program = new Program(IDL as any, provider);

  console.log('🤖 URIM Round Keeper Started');
  console.log(`   Network: ${NETWORK}`);
  console.log(`   RPC: ${rpcUrl.substring(0, 40)}...`);
  console.log(`   Admin: ${adminKeypair.publicKey.toBase58()}`);
  console.log(`   Round duration: ${ROUND_DURATION_SECONDS / 60} minutes`);
  console.log('');
}

async function getCurrentPrice(): Promise<number> {
  const resp = await fetch(
    'https://hermes.pyth.network/v2/updates/price/latest?ids[]=ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'
  );
  const data: any = await resp.json();
  const priceData = data.parsed[0].price;
  return Math.round(Number(priceData.price) * Math.pow(10, priceData.expo) * 100);
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
      console.log(`[${timestamp}] No active round, starting new one...`);
      const newId = await startNewRound();
      if (newId) console.log(`   ✅ Started Round #${newId}`);
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const endTime = round.endTime.toNumber();
    const secondsLeft = endTime - now;

    if (!round.resolved) {
      if (secondsLeft > 0) {
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        console.log(
          `[${timestamp}] Round #${currentRoundId} | ${mins}:${secs.toString().padStart(2, '0')} left | ` +
          `UP: $${(round.upPool.toNumber() / 1_000_000).toFixed(2)} | DOWN: $${(round.downPool.toNumber() / 1_000_000).toFixed(2)}`
        );
      } else {
        console.log(`[${timestamp}] Round #${currentRoundId} EXPIRED - Resolving...`);
        const resolved = await resolveRound(currentRoundId);

        if (resolved) {
          const updatedRound = await program.account.round.fetch(roundPDA);
          const outcome = updatedRound.outcome.up ? 'UP' : updatedRound.outcome.down ? 'DOWN' : 'DRAW';
          console.log(`   ✅ Round #${currentRoundId} resolved: ${outcome}`);

          const newId = await startNewRound();
          if (newId) console.log(`   ✅ Started Round #${newId}`);
        }
      }
    } else {
      console.log(`[${timestamp}] Round #${currentRoundId} already resolved`);
      const newId = await startNewRound();
      if (newId) console.log(`   ✅ Started Round #${newId}`);
    }
  } catch (e: any) {
    console.log(`[${timestamp}] Error: ${e.message}`);
  }
}

async function main() {
  await setup();
  await checkAndManageRounds();
  setInterval(checkAndManageRounds, CHECK_INTERVAL_MS);
  console.log('🔄 Keeper running continuously...\n');
}

main().catch(console.error);
