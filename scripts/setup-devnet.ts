/**
 * Devnet Setup Script for URIM Betting Platform
 *
 * This script creates test tokens on devnet and mints them to your wallet.
 * Run with: npx ts-node scripts/setup-devnet.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { createMint, mintTo, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";

// Configuration
const DEVNET_RPC = "https://api.devnet.solana.com";

// How many tokens to mint (with 6 decimals)
const USDC_AMOUNT = 10_000 * 1_000_000; // 10,000 USDC
const URIM_AMOUNT = 1_000_000 * 1_000_000; // 1,000,000 URIM

async function main() {
  console.log("🚀 URIM Devnet Setup Script\n");
  console.log("=".repeat(60));

  // Load wallet from default Solana config
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  if (!fs.existsSync(walletPath)) {
    console.error("❌ No wallet found at ~/.config/solana/id.json");
    console.error("   Run: solana-keygen new");
    process.exit(1);
  }

  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  console.log(`📍 Wallet: ${walletKeypair.publicKey.toBase58()}`);

  // Connect to devnet
  const connection = new Connection(DEVNET_RPC, "confirmed");
  console.log(`🌐 Network: Devnet (${DEVNET_RPC})`);

  // Check SOL balance
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`💰 SOL Balance: ${(balance / 1e9).toFixed(4)} SOL`);

  if (balance < 0.1 * 1e9) {
    console.log("\n⚠️  Low SOL balance! Requesting airdrop...");
    try {
      const sig = await connection.requestAirdrop(walletKeypair.publicKey, 2 * 1e9);
      await connection.confirmTransaction(sig);
      console.log("✅ Airdrop successful: 2 SOL");
    } catch (e) {
      console.log("❌ Airdrop failed. Get devnet SOL from: https://faucet.solana.com");
      process.exit(1);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Creating Test Tokens...\n");

  // Create USDC mint
  console.log("Creating test USDC mint (6 decimals)...");
  const usdcMint = await createMint(
    connection,
    walletKeypair,
    walletKeypair.publicKey, // mint authority
    null, // freeze authority
    6 // decimals (same as real USDC)
  );
  console.log(`✅ Test USDC Mint: ${usdcMint.toBase58()}`);

  // Create URIM mint
  console.log("Creating test URIM mint (6 decimals)...");
  const urimMint = await createMint(
    connection,
    walletKeypair,
    walletKeypair.publicKey,
    null,
    6
  );
  console.log(`✅ Test URIM Mint: ${urimMint.toBase58()}`);

  console.log("\n" + "=".repeat(60));
  console.log("Creating Token Accounts & Minting...\n");

  // Create USDC token account and mint
  const usdcAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    walletKeypair,
    usdcMint,
    walletKeypair.publicKey
  );
  console.log(`📦 USDC Token Account: ${usdcAccount.address.toBase58()}`);

  await mintTo(
    connection,
    walletKeypair,
    usdcMint,
    usdcAccount.address,
    walletKeypair.publicKey,
    USDC_AMOUNT
  );
  console.log(`✅ Minted ${USDC_AMOUNT / 1_000_000} USDC to your wallet`);

  // Create URIM token account and mint
  const urimAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    walletKeypair,
    urimMint,
    walletKeypair.publicKey
  );
  console.log(`📦 URIM Token Account: ${urimAccount.address.toBase58()}`);

  await mintTo(
    connection,
    walletKeypair,
    urimMint,
    urimAccount.address,
    walletKeypair.publicKey,
    URIM_AMOUNT
  );
  console.log(`✅ Minted ${URIM_AMOUNT / 1_000_000} URIM to your wallet`);

  // Save config for frontend
  const config = {
    network: "devnet",
    programId: "5KqMaQLoKhBYcHD1qWZVcQqu5pmTvMitDUEqmKsqBTQg",
    usdcMint: usdcMint.toBase58(),
    urimMint: urimMint.toBase58(),
    pythSolUsd: "J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix",
    adminWallet: walletKeypair.publicKey.toBase58(),
  };

  fs.writeFileSync(
    "devnet-config.json",
    JSON.stringify(config, null, 2)
  );

  console.log("\n" + "=".repeat(60));
  console.log("🎉 SETUP COMPLETE!\n");
  console.log("Config saved to: devnet-config.json\n");

  console.log("📋 COPY THIS TO LOVABLE:\n");
  console.log("```");
  console.log(`Program ID: ${config.programId}`);
  console.log(`USDC Mint:  ${config.usdcMint}`);
  console.log(`URIM Mint:  ${config.urimMint}`);
  console.log(`Network:    Solana Devnet`);
  console.log(`RPC:        ${DEVNET_RPC}`);
  console.log("```");

  console.log("\n⚠️  IMPORTANT: These are TEST tokens, not real USDC/URIM!");
  console.log("   The program is deployed but needs to be initialized with these mints.");
  console.log("\n" + "=".repeat(60));
}

main().catch(console.error);
