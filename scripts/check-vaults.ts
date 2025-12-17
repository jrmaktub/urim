/**
 * Check vault balances for each round
 */
import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('5KqMaQLoKhBYcHD1qWZVcQqu5pmTvMitDUEqmKsqBTQg');

async function main() {
  const connection = new Connection('https://api.devnet.solana.com');

  console.log('=== VAULT STATUS PER ROUND ===\n');
  console.log('Each round has its own INDEPENDENT vault (PDA)\n');

  for (let roundId = 163; roundId <= 167; roundId++) {
    const roundIdBuffer = Buffer.alloc(8);
    roundIdBuffer.writeBigUInt64LE(BigInt(roundId));

    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), roundIdBuffer],
      PROGRAM_ID
    );

    const [urimVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('urim_vault'), roundIdBuffer],
      PROGRAM_ID
    );

    let usdcBalance = 'Not created';
    let urimBalance = 'Not created';

    try {
      const balance = await connection.getTokenAccountBalance(vaultPDA);
      usdcBalance = `${balance.value.uiAmount} USDC`;
    } catch {}

    try {
      const balance = await connection.getTokenAccountBalance(urimVaultPDA);
      urimBalance = `${balance.value.uiAmount} URIM`;
    } catch {}

    console.log(`Round ${roundId}:`);
    console.log(`  USDC Vault: ${usdcBalance}`);
    console.log(`  URIM Vault: ${urimBalance}`);
    console.log(`  Vault PDA:  ${vaultPDA.toBase58()}`);
    console.log('');
  }
}

main().catch(console.error);
