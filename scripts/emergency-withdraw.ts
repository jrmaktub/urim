/**
 * EMERGENCY WITHDRAW - Get ALL funds from vault (ADMIN ONLY)
 * Use this when funds are stuck or in case of emergency
 *
 * Run with: npx ts-node scripts/emergency-withdraw.ts <round-id> [usdc|urim|all]
 *
 * Examples:
 *   npx ts-node scripts/emergency-withdraw.ts 165 usdc  - Withdraw USDC from round 165
 *   npx ts-node scripts/emergency-withdraw.ts 165 urim  - Withdraw URIM from round 165
 *   npx ts-node scripts/emergency-withdraw.ts 165 all   - Withdraw both from round 165
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
  const roundId = parseInt(process.argv[2]);
  const tokenType = process.argv[3] || 'all';

  if (isNaN(roundId)) {
    console.log('Usage: npx ts-node scripts/emergency-withdraw.ts <round-id> [usdc|urim|all]');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node scripts/emergency-withdraw.ts 165 usdc');
    console.log('  npx ts-node scripts/emergency-withdraw.ts 165 all');
    return;
  }

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

  // Derive PDAs
  const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(roundId));
  const [roundPDA] = PublicKey.findProgramAddressSync([Buffer.from('round'), roundIdBuffer], PROGRAM_ID);
  const [vaultPDA] = PublicKey.findProgramAddressSync([Buffer.from('vault'), roundIdBuffer], PROGRAM_ID);
  const [urimVaultPDA] = PublicKey.findProgramAddressSync([Buffer.from('urim_vault'), roundIdBuffer], PROGRAM_ID);

  // Treasury accounts (admin's token accounts)
  const treasuryUsdc = await getAssociatedTokenAddress(USDC_MINT, adminKeypair.publicKey);
  const treasuryUrim = await getAssociatedTokenAddress(URIM_MINT, adminKeypair.publicKey);

  console.log('\n🚨 EMERGENCY WITHDRAWAL');
  console.log('========================');
  console.log(`Round: ${roundId}`);
  console.log(`Token: ${tokenType.toUpperCase()}`);
  console.log(`Admin: ${adminKeypair.publicKey.toBase58()}`);

  // Check vault balances
  let usdcBalance = 0;
  let urimBalance = 0;

  try {
    const vaultAccount = await connection.getTokenAccountBalance(vaultPDA);
    usdcBalance = Number(vaultAccount.value.amount);
    console.log(`\nUSDC Vault Balance: ${(usdcBalance / 1_000_000).toFixed(6)} USDC`);
  } catch {
    console.log('\nUSDC Vault: Not found or empty');
  }

  try {
    const urimVaultAccount = await connection.getTokenAccountBalance(urimVaultPDA);
    urimBalance = Number(urimVaultAccount.value.amount);
    console.log(`URIM Vault Balance: ${(urimBalance / 1_000_000).toFixed(6)} URIM`);
  } catch {
    console.log('URIM Vault: Not found or empty');
  }

  // Withdraw USDC
  if ((tokenType === 'usdc' || tokenType === 'all') && usdcBalance > 0) {
    console.log('\n📤 Withdrawing USDC...');
    try {
      const tx = await program.methods
        .emergencyWithdraw()
        .accounts({
          config: configPDA,
          round: roundPDA,
          vault: vaultPDA,
          treasury: treasuryUsdc,
        })
        .rpc();
      console.log(`✅ USDC withdrawn! TX: ${tx}`);
      console.log(`   Amount: ${(usdcBalance / 1_000_000).toFixed(6)} USDC → Treasury`);
    } catch (e: any) {
      console.log(`❌ USDC withdrawal failed: ${e.message}`);
    }
  }

  // Withdraw URIM
  if ((tokenType === 'urim' || tokenType === 'all') && urimBalance > 0) {
    console.log('\n📤 Withdrawing URIM...');
    try {
      const tx = await program.methods
        .emergencyWithdrawUrim()
        .accounts({
          config: configPDA,
          round: roundPDA,
          urimVault: urimVaultPDA,
          urimTreasury: treasuryUrim,
        })
        .rpc();
      console.log(`✅ URIM withdrawn! TX: ${tx}`);
      console.log(`   Amount: ${(urimBalance / 1_000_000).toFixed(6)} URIM → Treasury`);
    } catch (e: any) {
      console.log(`❌ URIM withdrawal failed: ${e.message}`);
    }
  }

  if (usdcBalance === 0 && urimBalance === 0) {
    console.log('\n⚠️  Both vaults are empty for this round.');
  }

  // Final treasury balances
  console.log('\n=== TREASURY BALANCES ===');
  try {
    const usdcTreasuryBalance = await connection.getTokenAccountBalance(treasuryUsdc);
    console.log(`Treasury USDC: ${usdcTreasuryBalance.value.uiAmount} USDC`);
  } catch { console.log('Treasury USDC: 0'); }

  try {
    const urimTreasuryBalance = await connection.getTokenAccountBalance(treasuryUrim);
    console.log(`Treasury URIM: ${urimTreasuryBalance.value.uiAmount} URIM`);
  } catch { console.log('Treasury URIM: 0'); }
}

main().catch(console.error);
