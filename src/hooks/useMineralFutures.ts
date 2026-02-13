import { useState, useEffect, useCallback } from "react";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
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

// ── Account Parsing ──

export interface MarketData {
  commodity: string;
  markPrice: number; // USD integer
  lastPriceUpdate: number;
  openInterestLong: number; // lamports
  openInterestShort: number;
  totalFeesCollected: number;
  authority: string;
}

export interface PositionData {
  publicKey: string;
  owner: string;
  market: string;
  direction: number; // 0=Long 1=Short
  collateral: number; // lamports
  entryPrice: number; // USD integer
  openedAt: number;
  feePaid: number;
  isOpen: boolean;
}

function parseMarketAccount(data: Buffer): MarketData | null {
  try {
    const offset = 8; // skip discriminator
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

  // Fetch all market accounts
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

  // Fetch user positions
  const fetchPositions = useCallback(async () => {
    if (!userPublicKey) {
      setPositions([]);
      return;
    }
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

  // Fetch balances
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
      setHasUrimDiscount(bal > 0); // any URIM = discount
    } catch {
      setUrimBalance(0);
      setHasUrimDiscount(false);
    }
  }, [userPublicKey]);

  // Refresh all data
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

  // Auto-refresh every 30s
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // ── Trade Actions ──

  const openPosition = useCallback(
    async (
      provider: any,
      commodityName: CommodityName,
      direction: number, // 0=Long, 1=Short
      collateralLamports: number
    ) => {
      if (!provider || !userPublicKey) throw new Error("Wallet not connected");

      const marketPDA = new PublicKey(MARKET_PDAS[commodityName]);
      const trader = new PublicKey(userPublicKey);
      const nonce = Math.floor(Date.now() / 1000);
      const positionPDA = getPositionPDA(trader, marketPDA, nonce);
      const vaultPDA = getVaultPDA(trader, marketPDA, nonce);

      // Build the instruction manually using Anchor discriminator
      // open_position discriminator = sha256("global:open_position")[0..8]
      const { Program, AnchorProvider, Wallet, BN: AnchorBN } = await import("@coral-xyz/anchor");
      const idl = (await import("@/contracts/MineralFutures.json")).default;

      // Create a read-only provider, we'll sign via Phantom
      const anchorProvider = new AnchorProvider(connection, {
        publicKey: trader,
        signTransaction: provider.signTransaction.bind(provider),
        signAllTransactions: provider.signAllTransactions.bind(provider),
      } as any, { commitment: "confirmed" });

      const program = new Program(idl as any, anchorProvider);

      const tx = await (program.methods as any)
        .openPosition(
          direction,
          new AnchorBN(nonce),
          new AnchorBN(collateralLamports),
          hasUrimDiscount
        )
        .accounts({
          market: marketPDA,
          position: positionPDA,
          vault: vaultPDA,
          authority: MARKET_AUTHORITY,
          trader,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Position opened:", tx);
      await refresh();
      return tx;
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

      const { Program, AnchorProvider } = await import("@coral-xyz/anchor");
      const idl = (await import("@/contracts/MineralFutures.json")).default;

      const anchorProvider = new AnchorProvider(connection, {
        publicKey: trader,
        signTransaction: provider.signTransaction.bind(provider),
        signAllTransactions: provider.signAllTransactions.bind(provider),
      } as any, { commitment: "confirmed" });

      const program = new Program(idl as any, anchorProvider);

      const tx = await (program.methods as any)
        .closePosition()
        .accounts({
          market: marketPDA,
          position: positionPDA,
          vault: vaultPDA,
          trader,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Position closed:", tx);
      await refresh();
      return tx;
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
