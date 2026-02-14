import { useState, useEffect, useCallback } from "react";
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import BN from "bn.js";
import {
  MINERAL_FUTURES_PROGRAM_ID,
  MINERAL_FUTURES_RPC,
  MARKET_AUTHORITY,
  MARKET_PDAS,
  URIM_TOKEN_MINT,
  POSITION_ACCOUNT_SIZE,
  getPositionPDA,
  getVaultPDA,
  type CommodityName,
} from "@/constants/mineralFutures";

const connection = new Connection(MINERAL_FUTURES_RPC, "confirmed");

// ── Discriminator helper ──
// Anchor discriminator = first 8 bytes of SHA-256("global:<instruction_name>")
async function getDiscriminator(instructionName: string): Promise<Buffer> {
  const msgBuffer = new TextEncoder().encode(`global:${instructionName}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return Buffer.from(new Uint8Array(hashBuffer).slice(0, 8));
}

// ── Account Parsing ──

export interface MarketData {
  commodity: string;
  markPrice: number;
  lastPriceUpdate: number;
  openInterestLong: number;
  openInterestShort: number;
  totalFeesCollected: number;
  authority: string;
}

export interface PositionData {
  publicKey: string;
  owner: string;
  market: string;
  direction: number;
  collateral: number;
  entryPrice: number;
  openedAt: number;
  feePaid: number;
  isOpen: boolean;
}

function parseMarketAccount(data: Buffer): MarketData | null {
  try {
    const offset = 8;
    const commodityBytes = data.subarray(offset, offset + 16);
    const commodity = Buffer.from(commodityBytes).toString("utf-8").replace(/\0/g, "");
    const markPrice = Number(data.readBigUInt64LE(offset + 16));
    const lastPriceUpdate = Number(data.readBigInt64LE(offset + 24));
    const openInterestLong = Number(data.readBigUInt64LE(offset + 32));
    const openInterestShort = Number(data.readBigUInt64LE(offset + 40));
    const totalFeesCollected = Number(data.readBigUInt64LE(offset + 48));
    const authority = new PublicKey(data.subarray(offset + 56, offset + 88)).toString();
    return { commodity, markPrice, lastPriceUpdate, openInterestLong, openInterestShort, totalFeesCollected, authority };
  } catch (e) {
    console.error("Failed to parse market:", e);
    return null;
  }
}

function parsePositionAccount(data: Buffer, pubkey: string): PositionData | null {
  try {
    const offset = 8;
    const owner = new PublicKey(data.subarray(offset, offset + 32)).toString();
    const market = new PublicKey(data.subarray(offset + 32, offset + 64)).toString();
    const direction = data[offset + 64];
    const collateral = Number(data.readBigUInt64LE(offset + 65));
    const entryPrice = Number(data.readBigUInt64LE(offset + 73));
    const openedAt = Number(data.readBigInt64LE(offset + 81));
    const feePaid = Number(data.readBigUInt64LE(offset + 89));
    const isOpen = data[offset + 97] === 1;
    return { publicKey: pubkey, owner, market, direction, collateral, entryPrice, openedAt, feePaid, isOpen };
  } catch (e) {
    console.error("Failed to parse position:", e);
    return null;
  }
}

// ── Hook ──

export function useMineralFutures(userPublicKey: string | null) {
  const [markets, setMarkets] = useState<Record<string, MarketData>>({});
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [solBalance, setSolBalance] = useState(0);
  const [urimBalance, setUrimBalance] = useState(0);
  const [hasUrimDiscount, setHasUrimDiscount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    const results: Record<string, MarketData> = {};
    const entries = Object.entries(MARKET_PDAS) as [CommodityName, string][];
    await Promise.all(
      entries.map(async ([name, address]) => {
        try {
          const account = await connection.getAccountInfo(new PublicKey(address));
          if (account) {
            const parsed = parseMarketAccount(Buffer.from(account.data));
            if (parsed) results[name] = parsed;
          }
        } catch (e) {
          console.warn(`Failed to fetch market ${name}:`, e);
        }
      })
    );
    setMarkets(results);
  }, []);

  const fetchPositions = useCallback(async () => {
    if (!userPublicKey) { setPositions([]); return; }
    try {
      const accounts = await connection.getProgramAccounts(MINERAL_FUTURES_PROGRAM_ID, {
        filters: [
          { dataSize: POSITION_ACCOUNT_SIZE },
          { memcmp: { offset: 8, bytes: userPublicKey } },
        ],
      });
      const parsed = accounts
        .map((a) => parsePositionAccount(Buffer.from(a.account.data), a.pubkey.toString()))
        .filter((p): p is PositionData => p !== null && p.isOpen);
      setPositions(parsed);
    } catch (e) {
      console.warn("Failed to fetch positions:", e);
      setPositions([]);
    }
  }, [userPublicKey]);

  const fetchBalances = useCallback(async () => {
    if (!userPublicKey) return;
    try {
      const balance = await connection.getBalance(new PublicKey(userPublicKey));
      setSolBalance(balance / 1e9);
    } catch { /* */ }
    try {
      const ata = await getAssociatedTokenAddress(
        new PublicKey(URIM_TOKEN_MINT),
        new PublicKey(userPublicKey)
      );
      const account = await getAccount(connection, ata);
      const bal = Number(account.amount) / 1e6;
      setUrimBalance(bal);
      setHasUrimDiscount(bal > 0);
    } catch {
      setUrimBalance(0);
      setHasUrimDiscount(false);
    }
  }, [userPublicKey]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchMarkets(), fetchPositions(), fetchBalances()]);
    } catch (e: any) {
      setError(e.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [fetchMarkets, fetchPositions, fetchBalances]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // ── Trade Actions (raw TransactionInstruction, no Anchor Program class) ──

  const openPosition = useCallback(
    async (
      provider: any,
      commodityName: CommodityName,
      direction: number,
      collateralLamports: number
    ) => {
      if (!provider || !userPublicKey) throw new Error("Wallet not connected");

      const marketPDA = new PublicKey(MARKET_PDAS[commodityName]);
      const trader = new PublicKey(userPublicKey);
      const nonce = Math.floor(Date.now() / 1000);
      const positionPDA = getPositionPDA(trader, marketPDA, nonce);
      const vaultPDA = getVaultPDA(trader, marketPDA, nonce);

      // Build instruction data manually:
      // [8 bytes discriminator][1 byte direction][8 bytes nonce i64 LE][8 bytes collateral u64 LE][1 byte bool]
      const discriminator = await getDiscriminator("open_position");
      const data = Buffer.alloc(8 + 1 + 8 + 8 + 1);
      discriminator.copy(data, 0);
      data.writeUInt8(direction, 8);
      data.writeBigInt64LE(BigInt(nonce), 9);
      data.writeBigUInt64LE(BigInt(collateralLamports), 17);
      data.writeUInt8(hasUrimDiscount ? 1 : 0, 25);

      const keys = [
        { pubkey: marketPDA, isSigner: false, isWritable: true },
        { pubkey: positionPDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: MARKET_AUTHORITY, isSigner: false, isWritable: false },
        { pubkey: trader, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ];

      const instruction = new TransactionInstruction({
        keys,
        programId: MINERAL_FUTURES_PROGRAM_ID,
        data,
      });

      const tx = new Transaction().add(instruction);
      tx.feePayer = trader;
      tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;

      const signed = await provider.signTransaction(tx);
      const txId = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(txId, "confirmed");

      console.log("Position opened:", txId);
      await refresh();
      return txId;
    },
    [userPublicKey, hasUrimDiscount, refresh]
  );

  const closePosition = useCallback(
    async (provider: any, position: PositionData) => {
      if (!provider || !userPublicKey) throw new Error("Wallet not connected");

      const trader = new PublicKey(userPublicKey);
      const marketPDA = new PublicKey(position.market);
      const positionPDA = new PublicKey(position.publicKey);
      const vaultPDA = getVaultPDA(trader, marketPDA, position.openedAt);

      // close_position has no args, just the discriminator
      const discriminator = await getDiscriminator("close_position");

      const keys = [
        { pubkey: marketPDA, isSigner: false, isWritable: false },
        { pubkey: positionPDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: trader, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ];

      const instruction = new TransactionInstruction({
        keys,
        programId: MINERAL_FUTURES_PROGRAM_ID,
        data: discriminator,
      });

      const tx = new Transaction().add(instruction);
      tx.feePayer = trader;
      tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;

      const signed = await provider.signTransaction(tx);
      const txId = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(txId, "confirmed");

      console.log("Position closed:", txId);
      await refresh();
      return txId;
    },
    [userPublicKey, refresh]
  );

  return {
    markets,
    positions,
    solBalance,
    urimBalance,
    hasUrimDiscount,
    loading,
    error,
    refresh,
    openPosition,
    closePosition,
  };
}
