/**
 * Initialize the URIM program on devnet with the test tokens
 * Run with: npx ts-node scripts/init-program.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";

// Load config from setup script
const config = JSON.parse(fs.readFileSync("devnet-config.json", "utf-8"));

const PROGRAM_ID = new PublicKey(config.programId);
const USDC_MINT = new PublicKey(config.usdcMint);
const URIM_MINT = new PublicKey(config.urimMint);
const PYTH_SOL_USD = new PublicKey(config.pythSolUsd);

async function main() {
  console.log("🚀 Initializing URIM Program on Devnet\n");
  console.log("=".repeat(60));

  // Load wallet
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  console.log(`📍 Admin Wallet: ${walletKeypair.publicKey.toBase58()}`);

  // Connect
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  // Load IDL and program
  const idl = JSON.parse(fs.readFileSync("target/idl/urim_solana.json", "utf-8"));
  const program = new Program(idl, provider) as any;

  console.log(`📦 Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`💵 USDC Mint: ${USDC_MINT.toBase58()}`);
  console.log(`🪙 URIM Mint: ${URIM_MINT.toBase58()}`);

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
  console.log("Initializing Program...\n");

  try {
    const existingConfig = await program.account.config.fetch(configPDA);
    console.log("⚠️  Program already initialized!");
    console.log(`   Current round: ${existingConfig.currentRoundId}`);
    console.log(`   Admin: ${existingConfig.admin.toBase58()}`);

    // Update treasury if needed
    if (!existingConfig.treasury.equals(treasuryUsdc.address)) {
      console.log("\n📝 Updating treasury to new USDC account...");
      await program.methods
        .updateTreasury(treasuryUsdc.address)
        .rpc();
      console.log("✅ Treasury updated!");
    }
  } catch (e) {
    // Not initialized yet, do it now
    console.log("Initializing program for the first time...");

    await program.methods
      .initialize()
      .accounts({
        treasury: treasuryUsdc.address,
      })
      .rpc();

    console.log("✅ Program initialized!");
  }

  // Start a test round
  console.log("\n" + "=".repeat(60));
  console.log("Starting Test Round...\n");

  try {
    const configAccount = await program.account.config.fetch(configPDA);
    const roundId = configAccount.currentRoundId.toNumber();

    // Check if round already exists
    const roundIdBuffer = Buffer.alloc(8);
    roundIdBuffer.writeBigUInt64LE(BigInt(roundId));
    const [roundPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("round"), roundIdBuffer],
      PROGRAM_ID
    );

    try {
      await program.account.round.fetch(roundPDA);
      console.log(`⚠️  Round ${roundId} already exists`);
    } catch {
      // Start new round with manual price ($140 SOL)
      console.log(`Starting round ${roundId} with price $140.00...`);

      await program.methods
        .startRoundManual(
          new anchor.BN(14000), // $140.00 in cents
          new anchor.BN(300)    // 5 minutes duration
        )
        .accounts({
          usdcMint: USDC_MINT,
          urimMint: URIM_MINT,
        })
        .rpc();

      console.log(`✅ Round ${roundId} started!`);
      console.log(`   Locked price: $140.00`);
      console.log(`   Duration: 5 minutes`);
    }
  } catch (e: any) {
    console.log(`❌ Error starting round: ${e.message}`);
  }

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 SETUP COMPLETE!\n");

  const finalConfig = await program.account.config.fetch(configPDA);

  console.log("📋 FINAL CONFIGURATION:");
  console.log("```");
  console.log(`Program ID:     ${PROGRAM_ID.toBase58()}`);
  console.log(`USDC Mint:      ${USDC_MINT.toBase58()}`);
  console.log(`URIM Mint:      ${URIM_MINT.toBase58()}`);
  console.log(`Treasury USDC:  ${treasuryUsdc.address.toBase58()}`);
  console.log(`Treasury URIM:  ${treasuryUrim.address.toBase58()}`);
  console.log(`Admin:          ${finalConfig.admin.toBase58()}`);
  console.log(`Current Round:  ${finalConfig.currentRoundId}`);
  console.log(`Network:        Solana Devnet`);
  console.log(`RPC:            https://api.devnet.solana.com`);
  console.log("```");

  // Update config file
  const fullConfig = {
    ...config,
    treasuryUsdc: treasuryUsdc.address.toBase58(),
    treasuryUrim: treasuryUrim.address.toBase58(),
    currentRound: finalConfig.currentRoundId.toString(),
  };
  fs.writeFileSync("devnet-config.json", JSON.stringify(fullConfig, null, 2));
  console.log("\n✅ Config saved to devnet-config.json");

  console.log("\n" + "=".repeat(60));
  console.log("🔗 GIVE THIS TO LOVABLE:");
  console.log("=".repeat(60));
  console.log(`
Network:        Solana Devnet
RPC:            https://api.devnet.solana.com
Program ID:     ${PROGRAM_ID.toBase58()}
USDC Mint:      ${USDC_MINT.toBase58()}
URIM Mint:      ${URIM_MINT.toBase58()}
Pyth SOL/USD:   ${PYTH_SOL_USD.toBase58()}

Wallet Adapter: @solana/wallet-adapter-react (NOT Ethereum!)
`);
}

main().catch(console.error);
