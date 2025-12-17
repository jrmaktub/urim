/**
 * Collect fees from resolved rounds to treasury (ADMIN ONLY)
 * Run with: npx ts-node scripts/collect-fees.ts [round-id]
 *
 * If no round-id provided, collects from most recent resolved round
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress } from '@solana/spl-token';
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

  // Get config
  const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
  const configAccount = await program.account.config.fetch(configPDA);

  // Round to collect from (from args or most recent)
  const roundId = process.argv[2] ? parseInt(process.argv[2]) : configAccount.currentRoundId.toNumber() - 1;

  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(roundId));
  const [roundPDA] = PublicKey.findProgramAddressSync([Buffer.from('round'), roundIdBuffer], PROGRAM_ID);
  const [vaultPDA] = PublicKey.findProgramAddressSync([Buffer.from('vault'), roundIdBuffer], PROGRAM_ID);
  const [urimVaultPDA] = PublicKey.findProgramAddressSync([Buffer.from('urim_vault'), roundIdBuffer], PROGRAM_ID);

  // Fetch round data
  const round = await program.account.round.fetch(roundPDA);

  console.log('\n=== ROUND FEE STATUS ===');
  console.log(`Round ID: ${roundId}`);
  console.log(`Resolved: ${round.resolved}`);
  console.log(`USDC Fees: ${(round.totalFees.toNumber() / 1_000_000).toFixed(6)} USDC`);
  console.log(`URIM Fees: ${(round.totalFeesUrim.toNumber() / 1_000_000).toFixed(6)} URIM`);
  console.log(`Fees Collected: ${round.feesCollected}`);

  if (!round.resolved) {
    console.log('\n❌ Round not resolved yet. Resolve it first.');
    return;
  }

  if (round.feesCollected) {
    console.log('\n✅ Fees already collected for this round.');
    return;
  }

  // Treasury accounts
  const treasuryUsdc = await getAssociatedTokenAddress(USDC_MINT, adminKeypair.publicKey);
  const treasuryUrim = await getAssociatedTokenAddress(URIM_MINT, adminKeypair.publicKey);

  // Collect USDC fees
  if (round.totalFees.toNumber() > 0) {
    console.log('\nCollecting USDC fees...');
    try {
      const tx = await program.methods
        .collectFees()
        .accounts({
          round: roundPDA,
          vault: vaultPDA,
          treasury: treasuryUsdc,
        })
        .rpc();
      console.log(`✅ USDC fees collected! TX: ${tx}`);
    } catch (e: any) {
      console.log(`❌ USDC fee collection failed: ${e.message}`);
    }
  }

  // Collect URIM fees
  if (round.totalFeesUrim.toNumber() > 0) {
    console.log('\nCollecting URIM fees...');
    try {
      const tx = await program.methods
        .collectFeesUrim()
        .accounts({
          round: roundPDA,
          urimVault: urimVaultPDA,
          treasuryUrim: treasuryUrim,
        })
        .rpc();
      console.log(`✅ URIM fees collected! TX: ${tx}`);
    } catch (e: any) {
      console.log(`❌ URIM fee collection failed: ${e.message}`);
    }
  }

  console.log('\n=== TREASURY BALANCES ===');
  try {
    const usdcBalance = await connection.getTokenAccountBalance(treasuryUsdc);
    console.log(`Treasury USDC: ${usdcBalance.value.uiAmount} USDC`);
  } catch { console.log('Treasury USDC: 0'); }

  try {
    const urimBalance = await connection.getTokenAccountBalance(treasuryUrim);
    console.log(`Treasury URIM: ${urimBalance.value.uiAmount} URIM`);
  } catch { console.log('Treasury URIM: 0'); }
}

main().catch(console.error);
