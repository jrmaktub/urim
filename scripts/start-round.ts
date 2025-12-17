/**
 * Start a new betting round (as admin)
 * Run with: npx ts-node scripts/start-round.ts [duration-minutes]
 *
 * Default duration: 15 minutes
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as os from 'os';

const config = JSON.parse(fs.readFileSync('devnet-config.json', 'utf-8'));
const PROGRAM_ID = new PublicKey(config.programId);
const USDC_MINT = new PublicKey(config.usdcMint);
const URIM_MINT = new PublicKey(config.urimMint);

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Load admin wallet
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );

  const wallet = new anchor.Wallet(adminKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync('target/idl/urim_solana.json', 'utf-8'));
  const program = new Program(idl, provider) as any;

  // Duration from args (default 15 minutes)
  const durationMinutes = process.argv[2] ? parseInt(process.argv[2]) : 15;
  const durationSeconds = durationMinutes * 60;

  // Fetch current SOL/USD price from Hermes
  console.log('Fetching current SOL/USD price from Hermes...');
  const resp = await fetch('https://hermes.pyth.network/v2/updates/price/latest?ids[]=ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d');
  const data: any = await resp.json();
  const priceData = data.parsed[0].price;
  const currentPrice = Number(priceData.price) * Math.pow(10, priceData.expo);
  const priceInCents = Math.round(currentPrice * 100);

  console.log(`Current SOL/USD: $${currentPrice.toFixed(2)} (${priceInCents} cents)\n`);

  // Start the round
  console.log(`Starting new round with ${durationMinutes} minute duration...`);

  const tx = await program.methods
    .startRoundManual(new anchor.BN(priceInCents), new anchor.BN(durationSeconds))
    .accounts({ usdcMint: USDC_MINT, urimMint: URIM_MINT })
    .rpc();

  console.log(`Transaction: ${tx}`);

  // Get the new round info
  const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
  const configAccount = await program.account.config.fetch(configPDA);
  const roundId = configAccount.currentRoundId.toNumber() - 1;

  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(roundId));
  const [roundPDA] = PublicKey.findProgramAddressSync([Buffer.from('round'), roundIdBuffer], PROGRAM_ID);

  const round = await program.account.round.fetch(roundPDA);
  const endTime = round.endTime.toNumber();

  console.log('\n✅ NEW ROUND STARTED!');
  console.log(`Round ID: ${roundId}`);
  console.log(`Round PDA: ${roundPDA.toBase58()}`);
  console.log(`Locked Price: $${(round.lockedPrice.toNumber() / 100).toFixed(2)}`);
  console.log(`End Time: ${new Date(endTime * 1000).toISOString()}`);
  console.log(`Duration: ${durationMinutes} minutes`);
  console.log('\nUsers can now place bets!');
}

main().catch(console.error);
