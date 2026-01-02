/**
 * Initialize the URIM program on MAINNET
 * Run with: npx ts-node scripts/init-mainnet.ts
 *
 * IMPORTANT: Make sure you have:
 * 1. SOL in your wallet for transaction fees
 * 2. The program deployed to mainnet
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";

// Load MAINNET config
const config = JSON.parse(fs.readFileSync("mainnet-config.json", "utf-8"));

const PROGRAM_ID = new PublicKey(config.programId);
const USDC_MINT = new PublicKey(config.usdcMint);
const URIM_MINT = new PublicKey(config.urimMint);
const PYTH_SOL_USD = new PublicKey(config.pythSolUsd);

async function main() {
  console.log("🚀 Initializing URIM Program on MAINNET\n");
  console.log("⚠️  THIS IS MAINNET - REAL MONEY!");
  console.log("=".repeat(60));

  // Load wallet
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  console.log(`📍 Admin Wallet: ${walletKeypair.publicKey.toBase58()}`);

  // Connect to MAINNET
  const rpcUrl = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  // Check balance
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`💰 Balance: ${(balance / 1e9).toFixed(4)} SOL`);

  if (balance < 0.02 * 1e9) {
    console.log("❌ Insufficient SOL balance. Need at least 0.02 SOL for fees.");
    process.exit(1);
  }

  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  // Load IDL and program
  const idl = JSON.parse(fs.readFileSync("target/idl/urim_solana.json", "utf-8"));
  const program = new Program(idl, provider) as any;

  console.log(`📦 Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`💵 USDC Mint: ${USDC_MINT.toBase58()}`);
  console.log(`🪙 URIM Mint: ${URIM_MINT.toBase58()}`);
  console.log(`📊 Pyth SOL/USD: ${PYTH_SOL_USD.toBase58()}`);

  // Derive config PDA
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
  console.log(`⚙️  Config PDA: ${configPDA.toBase58()}`);

  // Create treasury token account for USDC
  console.log("\n" + "=".repeat(60));
  console.log("Creating Treasury Accounts...\n");

  const treasuryUsdc = await getOrCreateAssociatedTokenAccount(
    connection,
    walletKeypair,
    USDC_MINT,
    walletKeypair.publicKey
  );
  console.log(`✅ Treasury USDC: ${treasuryUsdc.address.toBase58()}`);

  const treasuryUrim = await getOrCreateAssociatedTokenAccount(
    connection,
    walletKeypair,
    URIM_MINT,
    walletKeypair.publicKey
  );
  console.log(`✅ Treasury URIM: ${treasuryUrim.address.toBase58()}`);

  // Check if already initialized
  console.log("\n" + "=".repeat(60));
  console.log("Checking Program State...\n");

  try {
    const existingConfig = await program.account.config.fetch(configPDA);
    console.log("✅ Program already initialized on mainnet!");
    console.log(`   Current round: ${existingConfig.currentRoundId}`);
    console.log(`   Admin: ${existingConfig.admin.toBase58()}`);
    console.log(`   Treasury: ${existingConfig.treasury.toBase58()}`);
    console.log(`   Paused: ${existingConfig.paused}`);

    // Update treasury if needed
    if (!existingConfig.treasury.equals(treasuryUsdc.address)) {
      console.log("\n📝 Treasury mismatch - updating...");
      await program.methods
        .updateTreasury(treasuryUsdc.address)
        .rpc();
      console.log("✅ Treasury updated!");
    }
  } catch (e) {
    // Not initialized yet, do it now
    console.log("Program not initialized. Initializing now...\n");

    await program.methods
      .initialize(treasuryUsdc.address)
      .rpc();

    console.log("✅ Program initialized on MAINNET!");
  }

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 MAINNET SETUP COMPLETE!\n");

  const finalConfig = await program.account.config.fetch(configPDA);

  console.log("📋 MAINNET CONFIGURATION:");
  console.log("```");
  console.log(`Network:        Solana Mainnet`);
  console.log(`Program ID:     ${PROGRAM_ID.toBase58()}`);
  console.log(`USDC Mint:      ${USDC_MINT.toBase58()}`);
  console.log(`URIM Mint:      ${URIM_MINT.toBase58()}`);
  console.log(`Treasury USDC:  ${treasuryUsdc.address.toBase58()}`);
  console.log(`Treasury URIM:  ${treasuryUrim.address.toBase58()}`);
  console.log(`Admin:          ${finalConfig.admin.toBase58()}`);
  console.log(`Current Round:  ${finalConfig.currentRoundId}`);
  console.log(`Paused:         ${finalConfig.paused}`);
  console.log("```");

  // Update config file with treasury addresses
  const fullConfig = {
    ...config,
    treasuryUsdc: treasuryUsdc.address.toBase58(),
    treasuryUrim: treasuryUrim.address.toBase58(),
    admin: finalConfig.admin.toBase58(),
  };
  fs.writeFileSync("mainnet-config.json", JSON.stringify(fullConfig, null, 2));
  console.log("\n✅ Config saved to mainnet-config.json");

  console.log("\n" + "=".repeat(60));
  console.log("⚠️  NEXT STEPS:");
  console.log("=".repeat(60));
  console.log(`
1. Update Railway env var: NETWORK=mainnet
2. The keeper will automatically use mainnet-config.json
3. Fund admin wallet with SOL for keeper transactions
4. Monitor first few rounds carefully
`);
}

main().catch(console.error);
