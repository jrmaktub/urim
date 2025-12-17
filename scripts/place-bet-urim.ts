/**
 * Place URIM Bet - Test script for placing bets with URIM tokens
 *
 * Fetches real URIM price from DexScreener and places a bet.
 *
 * Usage:
 *   npx ts-node scripts/place-bet-urim.ts <amount_usd> <up|down>
 *
 * Examples:
 *   npx ts-node scripts/place-bet-urim.ts 1 up      # Bet $1 worth of URIM on UP
 *   npx ts-node scripts/place-bet-urim.ts 5 down   # Bet $5 worth of URIM on DOWN
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import * as fs from 'fs';
import * as os from 'os';

// URIM token on mainnet (same mint used on devnet for testing)
const URIM_PAIR_ADDRESS = 'DjNhU15XfeZC5eU3Bmp1LM1VZAA4wUFs5P4nd8JbEaHS';

const config = JSON.parse(fs.readFileSync('devnet-config.json', 'utf-8'));
const PROGRAM_ID = new PublicKey(config.programId);
const URIM_MINT = new PublicKey(config.urimMint);

/**
 * Fetch URIM price from DexScreener API
 * Returns price in USD
 */
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

/**
 * Convert USD price to scaled format for contract
 * Contract expects: urim_price_scaled = price_usd * 100_000_000 (8 decimals)
 * Example: $0.00001251 => 1251
 */
function usdToScaledPrice(priceUsd: number): number {
  return Math.round(priceUsd * 100_000_000);
}

/**
 * Calculate how many URIM tokens needed for a given USD value
 */
function calculateUrimAmount(usdValue: number, priceUsd: number): bigint {
  // URIM has 6 decimals
  const urimTokens = usdValue / priceUsd;
  return BigInt(Math.ceil(urimTokens * 1_000_000)); // Convert to micro-units
}

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: npx ts-node scripts/place-bet-urim.ts <amount_usd> <up|down>');
    console.log('Example: npx ts-node scripts/place-bet-urim.ts 1 up');
    process.exit(1);
  }

  const amountUsd = parseFloat(args[0]);
  const direction = args[1].toLowerCase();

  if (isNaN(amountUsd) || amountUsd < 1) {
    console.error('Amount must be at least $1.00');
    process.exit(1);
  }

  if (direction !== 'up' && direction !== 'down') {
    console.error('Direction must be "up" or "down"');
    process.exit(1);
  }

  const betUp = direction === 'up';

  // Setup connection
  const connection = new Connection(
    'https://solana-devnet.g.alchemy.com/v2/27SvVEbGAVC2VSJ8rPss0',
    'confirmed'
  );

  // Load wallet
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const userKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );

  const wallet = new anchor.Wallet(userKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync('target/idl/urim_solana.json', 'utf-8'));
  const program = new Program(idl, provider) as any;

  console.log('\n🎲 URIM BET PLACER');
  console.log('==================');
  console.log(`User: ${userKeypair.publicKey.toBase58()}`);

  // Fetch current URIM price
  console.log('\n📊 Fetching URIM price from DexScreener...');
  const priceUsd = await getUrimPriceUsd();
  const priceScaled = usdToScaledPrice(priceUsd);

  console.log(`   URIM Price: $${priceUsd.toFixed(8)} USD`);
  console.log(`   Price (scaled): ${priceScaled} (= $${priceUsd} * 10^8)`);

  // Calculate URIM amount needed
  const urimAmount = calculateUrimAmount(amountUsd, priceUsd);
  const urimTokens = Number(urimAmount) / 1_000_000;

  console.log(`\n💰 Bet Details:`);
  console.log(`   USD Value: $${amountUsd.toFixed(2)}`);
  console.log(`   URIM Amount: ${urimTokens.toLocaleString()} URIM`);
  console.log(`   Direction: ${betUp ? '🟢 UP' : '🔴 DOWN'}`);

  // Check user's URIM balance
  const userUrimAta = await getAssociatedTokenAddress(URIM_MINT, userKeypair.publicKey);
  try {
    const urimAccount = await getAccount(connection, userUrimAta);
    const balance = Number(urimAccount.amount) / 1_000_000;
    console.log(`   Your URIM Balance: ${balance.toLocaleString()} URIM`);

    // Calculate total with fee (0.5%)
    const totalWithFee = Number(urimAmount) * 1.005;
    if (Number(urimAccount.amount) < totalWithFee) {
      console.error(`\n❌ Insufficient URIM balance. Need ${(totalWithFee / 1_000_000).toLocaleString()} URIM (including 0.5% fee)`);
      process.exit(1);
    }
  } catch {
    console.error('\n❌ No URIM token account found. Create one first.');
    process.exit(1);
  }

  // Get current round
  const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
  const configAccount = await program.account.config.fetch(configPDA);
  const currentRoundId = configAccount.currentRoundId.toNumber() - 1;

  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(currentRoundId));
  const [roundPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('round'), roundIdBuffer],
    PROGRAM_ID
  );

  // Check round status
  let round;
  try {
    round = await program.account.round.fetch(roundPDA);
  } catch {
    console.error('\n❌ No active round found');
    process.exit(1);
  }

  if (round.resolved) {
    console.error('\n❌ Current round is already resolved. Wait for new round.');
    process.exit(1);
  }

  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = round.endTime.toNumber() - now;
  if (secondsLeft <= 0) {
    console.error('\n❌ Round has expired. Wait for resolution and new round.');
    process.exit(1);
  }

  console.log(`\n📍 Round #${currentRoundId}`);
  console.log(`   Time left: ${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, '0')}`);
  console.log(`   UP Pool: $${(round.upPoolUsd.toNumber() / 100).toFixed(2)} USD`);
  console.log(`   DOWN Pool: $${(round.downPoolUsd.toNumber() / 100).toFixed(2)} USD`);

  // Calculate potential payout
  const myUsdValue = amountUsd * 100; // in cents
  const winningPool = betUp ? round.upPoolUsd.toNumber() + myUsdValue : round.downPoolUsd.toNumber() + myUsdValue;
  const losingPool = betUp ? round.downPoolUsd.toNumber() : round.upPoolUsd.toNumber();

  if (losingPool > 0) {
    const myShare = myUsdValue / winningPool;
    const potentialWinnings = myShare * losingPool;
    const totalPayout = amountUsd + (potentialWinnings / 100);
    const multiplier = totalPayout / amountUsd;
    console.log(`\n📈 Potential Payout (if ${direction.toUpperCase()} wins):`);
    console.log(`   Your share: ${(myShare * 100).toFixed(2)}% of winning pool`);
    console.log(`   Winnings: $${(potentialWinnings / 100).toFixed(2)}`);
    console.log(`   Total payout: $${totalPayout.toFixed(2)} (${multiplier.toFixed(2)}x)`);
  }

  // Place the bet
  console.log('\n🚀 Placing bet...');

  try {
    const tx = await program.methods
      .placeBetUrim(
        new anchor.BN(urimAmount.toString()),
        betUp,
        new anchor.BN(priceScaled)
      )
      .accounts({
        round: roundPDA,
        userTokenAccount: userUrimAta,
      })
      .rpc();

    console.log(`\n✅ Bet placed successfully!`);
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://solscan.io/tx/${tx}?cluster=devnet`);

    // Fetch updated round
    const updatedRound = await program.account.round.fetch(roundPDA);
    console.log(`\n📊 Updated Pool:`);
    console.log(`   UP Pool: $${(updatedRound.upPoolUsd.toNumber() / 100).toFixed(2)} USD`);
    console.log(`   DOWN Pool: $${(updatedRound.downPoolUsd.toNumber() / 100).toFixed(2)} USD`);
    console.log(`   URIM UP: ${(updatedRound.upPoolUrim.toNumber() / 1_000_000).toLocaleString()} URIM`);
    console.log(`   URIM DOWN: ${(updatedRound.downPoolUrim.toNumber() / 1_000_000).toLocaleString()} URIM`);

  } catch (e: any) {
    console.error(`\n❌ Failed to place bet: ${e.message}`);
    if (e.logs) {
      console.error('Logs:', e.logs.slice(-5).join('\n'));
    }
    process.exit(1);
  }
}

main().catch(console.error);