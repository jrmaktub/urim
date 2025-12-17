/**
 * Resolve a round (as admin) - determines winners and allows claims
 * Run with: npx ts-node scripts/resolve-round.ts [round-id]
 *
 * If no round-id provided, resolves the most recent active round
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as os from 'os';

const config = JSON.parse(fs.readFileSync('devnet-config.json', 'utf-8'));
const PROGRAM_ID = new PublicKey(config.programId);

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

  // Get config to find current round
  const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
  const configAccount = await program.account.config.fetch(configPDA);

  // Round to resolve (from args or most recent)
  const roundId = process.argv[2] ? parseInt(process.argv[2]) : configAccount.currentRoundId.toNumber() - 1;

  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(roundId));
  const [roundPDA] = PublicKey.findProgramAddressSync([Buffer.from('round'), roundIdBuffer], PROGRAM_ID);

  // Fetch round data
  const round = await program.account.round.fetch(roundPDA);

  console.log('\n=== ROUND STATUS ===');
  console.log(`Round ID: ${roundId}`);
  console.log(`Locked Price: $${(round.lockedPrice.toNumber() / 100).toFixed(2)}`);
  console.log(`Resolved: ${round.resolved}`);
  console.log(`End Time: ${new Date(round.endTime.toNumber() * 1000).toISOString()}`);

  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = round.endTime.toNumber() - now;

  if (secondsLeft > 0) {
    console.log(`\n⏳ Round still active! ${Math.floor(secondsLeft / 60)}m ${secondsLeft % 60}s remaining`);
    console.log('Wait for the round to end, or use emergency_resolve to force resolve.');
    return;
  }

  if (round.resolved) {
    console.log('\n✅ Round already resolved!');
    console.log(`Outcome: ${JSON.stringify(round.outcome)}`);
    console.log(`Final Price: $${(round.finalPrice.toNumber() / 100).toFixed(2)}`);
    return;
  }

  // Fetch current price from Hermes
  console.log('\nFetching current SOL/USD price from Hermes...');
  const resp = await fetch('https://hermes.pyth.network/v2/updates/price/latest?ids[]=ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d');
  const data: any = await resp.json();
  const priceData = data.parsed[0].price;
  const currentPrice = Number(priceData.price) * Math.pow(10, priceData.expo);
  const priceInCents = Math.round(currentPrice * 100);

  console.log(`Current Price: $${currentPrice.toFixed(2)} (${priceInCents} cents)`);
  console.log(`Locked Price: $${(round.lockedPrice.toNumber() / 100).toFixed(2)}`);

  const outcome = priceInCents > round.lockedPrice.toNumber() ? 'UP' :
                  priceInCents < round.lockedPrice.toNumber() ? 'DOWN' : 'DRAW';
  console.log(`\nExpected Outcome: ${outcome}`);

  // Resolve the round
  console.log('\nResolving round...');

  const tx = await program.methods
    .resolveRoundManual(new anchor.BN(priceInCents))
    .accounts({ round: roundPDA })
    .rpc();

  console.log(`Transaction: ${tx}`);

  // Verify
  const resolvedRound = await program.account.round.fetch(roundPDA);
  console.log('\n✅ ROUND RESOLVED!');
  console.log(`Final Price: $${(resolvedRound.finalPrice.toNumber() / 100).toFixed(2)}`);
  console.log(`Outcome: ${JSON.stringify(resolvedRound.outcome)}`);
  console.log(`\nWinners can now claim their payouts using the frontend!`);
}

main().catch(console.error);
