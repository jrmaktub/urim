import { useState, useCallback, useEffect } from "react";
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { PROGRAM_ID, SOLANA_DEVNET_RPC, DEVNET_USDC_MINT, DEVNET_URIM_MINT } from "./useSolanaWallet";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

// Account discriminators from IDL
const CONFIG_DISCRIMINATOR = Buffer.from([155, 12, 170, 224, 30, 250, 204, 130]);
const ROUND_DISCRIMINATOR = Buffer.from([87, 127, 165, 51, 73, 78, 116, 174]);
const USER_BET_DISCRIMINATOR = Buffer.from([180, 131, 8, 241, 60, 243, 46, 63]);

// Instruction discriminators
const PLACE_BET_DISCRIMINATOR = Buffer.from([222, 62, 67, 220, 63, 166, 126, 33]);
const CLAIM_ALL_DISCRIMINATOR = Buffer.from([194, 194, 80, 194, 234, 210, 217, 90]);

// Export function to get user's USDC balance
export async function getUserUsdcBalance(userPublicKey: string): Promise<number> {
  try {
    const connection = new Connection(SOLANA_DEVNET_RPC, "confirmed");
    const userPubkey = new PublicKey(userPublicKey);
    const usdcMint = new PublicKey(DEVNET_USDC_MINT);
    const userTokenAccount = await getAssociatedTokenAddress(usdcMint, userPubkey);
    
    const accountInfo = await getAccount(connection, userTokenAccount);
    // USDC has 6 decimals
    return Number(accountInfo.amount) / 1_000_000;
  } catch (err) {
    console.log("No USDC account or error fetching balance:", err);
    return 0;
  }
}

export interface RoundData {
  roundId: bigint;
  lockedPrice: bigint;       // Price in CENTS (divide by 100 for dollars)
  finalPrice: bigint;
  startTime: bigint;
  endTime: bigint;           // USE THIS FOR TIMER
  upPool: bigint;            // USDC in UP pool (6 decimals)
  downPool: bigint;          // USDC in DOWN pool (6 decimals)
  upPoolUrim: bigint;        // URIM in UP pool (6 decimals)
  downPoolUrim: bigint;      // URIM in DOWN pool (6 decimals)
  upPoolUsd: bigint;         // Total UP USD value in CENTS
  downPoolUsd: bigint;       // Total DOWN USD value in CENTS
  totalFees: bigint;
  totalFeesUrim: bigint;
  resolved: boolean;
  outcome: "Pending" | "Up" | "Down" | "Draw";
}

export interface UserBetData {
  user: string;
  roundId: bigint;
  amount: bigint;            // Amount in tokens (6 decimals)
  usdValue: bigint;          // USD value in cents
  betUp: boolean;
  claimedUsdc: boolean;
  claimedUrim: boolean;
  tokenType: "USDC" | "URIM";
  urimPriceAtBet: bigint;
}

export interface ConfigData {
  admin: string;
  treasury: string;
  paused: boolean;
  currentRoundId: bigint;
}

const connection = new Connection(SOLANA_DEVNET_RPC, "confirmed");
const programId = new PublicKey(PROGRAM_ID);

// PDA derivation helpers
function getConfigPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
  return pda;
}

function getRoundPda(roundId: bigint): PublicKey {
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(roundId);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), roundIdBuffer],
    programId
  );
  return pda;
}

function getVaultPda(roundId: bigint): PublicKey {
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(roundId);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), roundIdBuffer],
    programId
  );
  return pda;
}

function getUrimVaultPda(roundId: bigint): PublicKey {
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(roundId);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("urim_vault"), roundIdBuffer],
    programId
  );
  return pda;
}

function getUserBetPda(roundPda: PublicKey, userPubkey: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), roundPda.toBuffer(), userPubkey.toBuffer()],
    programId
  );
  return pda;
}

// Parse account data
function parseConfigData(data: Buffer): ConfigData | null {
  try {
    if (!data.subarray(0, 8).equals(CONFIG_DISCRIMINATOR)) return null;
    const offset = 8;
    const admin = new PublicKey(data.subarray(offset, offset + 32)).toString();
    const treasury = new PublicKey(data.subarray(offset + 32, offset + 64)).toString();
    const paused = data[offset + 64] === 1;
    const currentRoundId = data.readBigUInt64LE(offset + 65);
    return { admin, treasury, paused, currentRoundId };
  } catch {
    return null;
  }
}

function parseRoundData(data: Buffer): RoundData | null {
  try {
    if (!data.subarray(0, 8).equals(ROUND_DISCRIMINATOR)) return null;
    
    // Correct byte layout from IDL (urim_solana.json):
    // - 8 bytes: discriminator (0-7)
    // - 8 bytes: round_id (8-15)
    // - 8 bytes: locked_price (16-23) - in CENTS
    // - 8 bytes: final_price (24-31) - in CENTS
    // - 8 bytes: created_at (32-39)
    // - 8 bytes: lock_time (40-47)
    // - 8 bytes: end_time (48-55) <- USE THIS FOR TIMER
    // - 8 bytes: up_pool (56-63) - USDC raw amount (6 decimals)
    // - 8 bytes: down_pool (64-71)
    // - 8 bytes: total_fees (72-79)
    // - 8 bytes: up_pool_urim (80-87)
    // - 8 bytes: down_pool_urim (88-95)
    // - 8 bytes: total_fees_urim (96-103)
    // - 8 bytes: up_pool_usd (104-111) - in CENTS
    // - 8 bytes: down_pool_usd (112-119) - in CENTS
    // - 8 bytes: total_fees_usd (120-127)
    // - 1 byte: resolved (128)
    // - 1 byte: outcome enum (129)
    // - 1 byte: bump (130)
    // - 1 byte: vault_bump (131)
    // - 1 byte: urim_vault_bump (132)
    
    const roundId = data.readBigUInt64LE(8);
    const lockedPrice = data.readBigUInt64LE(16);      // CENTS
    const finalPrice = data.readBigUInt64LE(24);       // CENTS
    const startTime = data.readBigInt64LE(32);         // created_at
    const endTime = data.readBigInt64LE(48);           // For timer (offset 48!)
    const upPool = data.readBigUInt64LE(56);           // USDC (6 decimals)
    const downPool = data.readBigUInt64LE(64);         // USDC (6 decimals)
    const totalFees = data.readBigUInt64LE(72);
    const upPoolUrim = data.readBigUInt64LE(80);       // URIM (6 decimals)
    const downPoolUrim = data.readBigUInt64LE(88);     // URIM (6 decimals)
    const totalFeesUrim = data.readBigUInt64LE(96);
    const upPoolUsd = data.readBigUInt64LE(104);       // USD value in CENTS
    const downPoolUsd = data.readBigUInt64LE(112);     // USD value in CENTS
    
    const resolved = data[128] === 1;
    const outcomeVal = data[129];
    const outcomes: Record<number, "Pending" | "Up" | "Down" | "Draw"> = {
      0: "Pending", 1: "Up", 2: "Down", 3: "Draw"
    };
    const outcome = outcomes[outcomeVal] || "Pending";
    
    const now = Math.floor(Date.now() / 1000);
    const endTimeNum = Number(endTime);
    const secondsLeft = endTimeNum - now;
    
    console.log("Parsed round data:", {
      roundId: roundId.toString(),
      lockedPrice: Number(lockedPrice) / 100,
      endTime: endTimeNum,
      endTimeDate: new Date(endTimeNum * 1000).toISOString(),
      secondsLeft,
      upPool: Number(upPool) / 1_000_000,
      downPool: Number(downPool) / 1_000_000,
      resolved,
      outcome
    });
    
    return {
      roundId, lockedPrice, finalPrice, startTime, endTime,
      upPool, downPool, upPoolUrim, downPoolUrim, upPoolUsd, downPoolUsd,
      totalFees, totalFeesUrim, resolved, outcome
    };
  } catch (err) {
    console.error("Error parsing round data:", err);
    return null;
  }
}

function parseUserBetData(data: Buffer): UserBetData | null {
  try {
    if (!data.subarray(0, 8).equals(USER_BET_DISCRIMINATOR)) return null;
    let offset = 8;
    const user = new PublicKey(data.subarray(offset, offset + 32)).toString(); offset += 32;
    const roundId = data.readBigUInt64LE(offset); offset += 8;
    const amount = data.readBigUInt64LE(offset); offset += 8;
    const usdValue = data.readBigUInt64LE(offset); offset += 8;
    const betUp = data[offset] === 1; offset += 1;
    const claimedUsdc = data[offset] === 1; offset += 1;
    const claimedUrim = data[offset] === 1; offset += 1;
    const tokenTypeVal = data[offset]; offset += 1;
    const tokenType = tokenTypeVal === 0 ? "USDC" : "URIM";
    const urimPriceAtBet = data.readBigUInt64LE(offset);
    
    return { user, roundId, amount, usdValue, betUp, claimedUsdc, claimedUrim, tokenType, urimPriceAtBet };
  } catch {
    return null;
  }
}

export function useUrimSolana(userPublicKey: string | null) {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [currentRound, setCurrentRound] = useState<RoundData | null>(null);
  const [userBet, setUserBet] = useState<UserBetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch config and current round
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch config
      const configPda = getConfigPda();
      const configAccount = await connection.getAccountInfo(configPda);
      
      if (configAccount) {
        const configData = parseConfigData(Buffer.from(configAccount.data));
        setConfig(configData);

        if (configData && configData.currentRoundId > 0n) {
          // Fetch current LIVE round (currentRoundId - 1)
          const activeRoundId = configData.currentRoundId - 1n;
          const roundPda = getRoundPda(activeRoundId);
          const roundAccount = await connection.getAccountInfo(roundPda);
          
          if (roundAccount) {
            const roundData = parseRoundData(Buffer.from(roundAccount.data));
            setCurrentRound(roundData);

            // Fetch user bet if connected
            if (userPublicKey && roundData) {
              const userPubkey = new PublicKey(userPublicKey);
              const userBetPda = getUserBetPda(roundPda, userPubkey);
              const userBetAccount = await connection.getAccountInfo(userBetPda);
              
              if (userBetAccount) {
                const userBetData = parseUserBetData(Buffer.from(userBetAccount.data));
                setUserBet(userBetData);
              } else {
                setUserBet(null);
              }
            }
          }
        }
      } else {
        setError("Program not initialized. No active rounds yet.");
      }
    } catch (err) {
      console.error("Error fetching contract data:", err);
      setError("Failed to fetch contract data. Check console for details.");
    } finally {
      setLoading(false);
    }
  }, [userPublicKey]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [fetchData]);

  // Place bet function (USDC)
  const placeBet = useCallback(async (
    amount: number, // USDC amount in dollars
    betUp: boolean,
    provider: unknown
  ) => {
    if (!userPublicKey || !currentRound || !config) {
      throw new Error("Not connected or no active round");
    }

    const phantomProvider = provider as {
      signTransaction: (tx: Transaction) => Promise<Transaction>;
      publicKey: PublicKey;
    };

    const userPubkey = new PublicKey(userPublicKey);
    const amountLamports = BigInt(Math.floor(amount * 1_000_000)); // USDC has 6 decimals
    
    const configPda = getConfigPda();
    const roundPda = getRoundPda(currentRound.roundId);
    const vaultPda = getVaultPda(currentRound.roundId);
    const userBetPda = getUserBetPda(roundPda, userPubkey);
    
    // Get user's USDC token account
    const usdcMint = new PublicKey(DEVNET_USDC_MINT);
    const userTokenAccount = await getAssociatedTokenAddress(usdcMint, userPubkey);

    // Build instruction data
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(amountLamports);
    const betUpBuffer = Buffer.from([betUp ? 1 : 0]);
    const instructionData = Buffer.concat([PLACE_BET_DISCRIMINATOR, amountBuffer, betUpBuffer]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: roundPda, isSigner: false, isWritable: true },
        { pubkey: userBetPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId,
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = userPubkey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const signedTx = await phantomProvider.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(signature, "confirmed");

    // Refresh data after betting
    await fetchData();

    return signature;
  }, [userPublicKey, currentRound, config, fetchData]);

  // Claim winnings
  const claimAll = useCallback(async (provider: unknown) => {
    if (!userPublicKey || !currentRound || !userBet) {
      throw new Error("Not connected or no bet to claim");
    }

    const phantomProvider = provider as {
      signTransaction: (tx: Transaction) => Promise<Transaction>;
      publicKey: PublicKey;
    };

    const userPubkey = new PublicKey(userPublicKey);
    const roundPda = getRoundPda(currentRound.roundId);
    const vaultPda = getVaultPda(currentRound.roundId);
    const urimVaultPda = getUrimVaultPda(currentRound.roundId);
    const userBetPda = getUserBetPda(roundPda, userPubkey);

    // Get token accounts with proper mints
    const usdcMint = new PublicKey(DEVNET_USDC_MINT);
    const urimMint = new PublicKey(DEVNET_URIM_MINT);
    const userUsdcAccount = await getAssociatedTokenAddress(usdcMint, userPubkey);
    const userUrimAccount = await getAssociatedTokenAddress(urimMint, userPubkey);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: roundPda, isSigner: false, isWritable: false },
        { pubkey: userBetPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: urimVaultPda, isSigner: false, isWritable: true },
        { pubkey: userUsdcAccount, isSigner: false, isWritable: true },
        { pubkey: userUrimAccount, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId,
      data: CLAIM_ALL_DISCRIMINATOR,
    });

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = userPubkey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const signedTx = await phantomProvider.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(signature, "confirmed");

    await fetchData();

    return signature;
  }, [userPublicKey, currentRound, userBet, fetchData]);

  return {
    config,
    currentRound,
    userBet,
    loading,
    error,
    placeBet,
    claimAll,
    refetch: fetchData,
  };
}
