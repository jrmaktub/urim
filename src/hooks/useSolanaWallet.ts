import { useState, useEffect, useCallback } from "react";

// Mainnet configuration
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const URIM_MINT = "F8W15WcpXHDthW2TyyiZJ2wMLazGc8CQ4poMNpXQpump";
export const PYTH_SOL_USD_FEED = "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG";
export const PROGRAM_ID = "5KqMaQLoKhBYcHD1qWZVcQqu5pmTvMitDUEqmKsqBTQg";
export const SOLANA_RPC = "https://solana-mainnet.g.alchemy.com/v2/27SvVEbGAVC2VSJ8rPss0";

// Legacy exports for compatibility
export const DEVNET_USDC_MINT = USDC_MINT;
export const DEVNET_URIM_MINT = URIM_MINT;
export const SOLANA_DEVNET_RPC = SOLANA_RPC;

interface PhantomProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: unknown) => Promise<unknown>;
  signAllTransactions: (transactions: unknown[]) => Promise<unknown[]>;
  signAndSendTransaction: (transaction: unknown, options?: unknown) => Promise<{ signature: string }>;
  publicKey: { toString: () => string; toBytes: () => Uint8Array } | null;
  isConnected: boolean;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  off: (event: string, callback: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomProvider;
    };
    solana?: PhantomProvider;
  }
}

export function useSolanaWallet() {
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [provider, setProvider] = useState<PhantomProvider | null>(null);

  useEffect(() => {
    const getProvider = (): PhantomProvider | null => {
      if (typeof window !== "undefined") {
        if (window.phantom?.solana?.isPhantom) {
          return window.phantom.solana;
        }
        if (window.solana?.isPhantom) {
          return window.solana;
        }
      }
      return null;
    };

    const solanaProvider = getProvider();
    setProvider(solanaProvider);

    if (solanaProvider) {
      // Check if already connected
      if (solanaProvider.isConnected && solanaProvider.publicKey) {
        setConnected(true);
        setPublicKey(solanaProvider.publicKey.toString());
      }

      // Listen for connection changes
      const handleConnect = () => {
        if (solanaProvider.publicKey) {
          setConnected(true);
          setPublicKey(solanaProvider.publicKey.toString());
        }
      };

      const handleDisconnect = () => {
        setConnected(false);
        setPublicKey(null);
      };

      solanaProvider.on("connect", handleConnect);
      solanaProvider.on("disconnect", handleDisconnect);

      return () => {
        solanaProvider.off("connect", handleConnect);
        solanaProvider.off("disconnect", handleDisconnect);
      };
    }
  }, []);

  const connect = useCallback(async () => {
    if (!provider) {
      window.open("https://phantom.app/", "_blank");
      return;
    }

    try {
      const response = await provider.connect();
      setConnected(true);
      setPublicKey(response.publicKey.toString());
    } catch (error) {
      console.error("Failed to connect to Phantom:", error);
    }
  }, [provider]);

  const disconnect = useCallback(async () => {
    if (provider) {
      try {
        await provider.disconnect();
        setConnected(false);
        setPublicKey(null);
      } catch (error) {
        console.error("Failed to disconnect:", error);
      }
    }
  }, [provider]);

  return {
    connected,
    publicKey,
    provider,
    connect,
    disconnect,
    isPhantomInstalled: !!provider,
  };
}
