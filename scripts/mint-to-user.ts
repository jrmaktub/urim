/**
 * Mint test USDC and URIM to a user's wallet
 * Run with: npx ts-node scripts/mint-to-user.ts <wallet-address>
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import * as fs from 'fs';
import * as os from 'os';

const config = JSON.parse(fs.readFileSync('devnet-config.json', 'utf-8'));
const USDC_MINT = new PublicKey(config.usdcMint);
const URIM_MINT = new PublicKey(config.urimMint);

async function main() {
  // Get user wallet from args or use default
  const userAddress = process.argv[2] || 'eidQaS95NK5BXt1gwBG8cZpxFJi6njtesP2saF9LQ3L';
  const USER_WALLET = new PublicKey(userAddress);

  console.log(`\nMinting test tokens to: ${USER_WALLET.toBase58()}\n`);

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Load mint authority (admin wallet that created the mints)
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const mintAuthority = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );

  console.log('Creating/Getting USDC token account...');
  const userUsdcAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    mintAuthority,
    USDC_MINT,
    USER_WALLET
  );
  console.log(`USDC Token Account: ${userUsdcAccount.address.toBase58()}`);

  console.log('Creating/Getting URIM token account...');
  const userUrimAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    mintAuthority,
    URIM_MINT,
    USER_WALLET
  );
  console.log(`URIM Token Account: ${userUrimAccount.address.toBase58()}`);

  // Mint 1000 test USDC
  console.log('\nMinting 1000 test USDC...');
  await mintTo(
    connection,
    mintAuthority,
    USDC_MINT,
    userUsdcAccount.address,
    mintAuthority.publicKey,
    1000 * 1_000_000 // 1000 USDC (6 decimals)
  );

  // Mint 10000 test URIM
  console.log('Minting 10000 test URIM...');
  await mintTo(
    connection,
    mintAuthority,
    URIM_MINT,
    userUrimAccount.address,
    mintAuthority.publicKey,
    10000 * 1_000_000 // 10000 URIM (6 decimals)
  );

  console.log('\n✅ SUCCESS!');
  console.log(`Wallet ${USER_WALLET.toBase58()} now has:`);
  console.log('  - 1000 test USDC');
  console.log('  - 10000 test URIM');
  console.log('\nRefresh the frontend and try betting again!');
}

main().catch(console.error);
