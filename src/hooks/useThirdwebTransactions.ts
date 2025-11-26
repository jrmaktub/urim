import { useState, useEffect } from "react";
import { HONDURAS_ELECTION_ADDRESS, BASE_MAINNET_CHAIN_ID } from "@/constants/hondurasElection";

interface ThirdwebTransaction {
  transactionHash: string;
  blockTimestamp: string;
  from: string;
  decoded?: {
    name: string;
    inputs?: {
      name: string;
      value: string;
    }[];
  };
}

export interface OrderBookEntry {
  type: "BID" | "ASK";
  price: string;
  shares: string;
  totalUSDC: string;
  trader: string;
  timestamp: string;
  txHash: string;
}

const THIRDWEB_CLIENT_ID = "6338fc246f407a9d38ba885ba43487f2";

export const useThirdwebTransactions = (candidateId: number) => {
  const [orders, setOrders] = useState<OrderBookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `https://api.thirdweb.com/v1/contracts/${BASE_MAINNET_CHAIN_ID}/${HONDURAS_ELECTION_ADDRESS}/transactions`,
        {
          headers: {
            "x-client-id": THIRDWEB_CLIENT_ID,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.statusText}`);
      }

      const data = await response.json();
      const transactions: ThirdwebTransaction[] = data.result || [];

      // Filter and process transactions for this specific candidate
      const processedOrders: OrderBookEntry[] = [];

      for (const tx of transactions) {
        if (!tx.decoded || !tx.decoded.inputs) continue;

        const isBuy = tx.decoded.name === "buyShares";
        const isSell = tx.decoded.name === "sellShares";

        if (!isBuy && !isSell) continue;

        // Extract inputs
        const outcomeIndexInput = tx.decoded.inputs.find((i) => i.name === "outcomeIndex");
        const usdcAmountInput = tx.decoded.inputs.find((i) => i.name === "usdcAmount");
        const sharesInput = tx.decoded.inputs.find((i) => i.name === "shares");

        if (!outcomeIndexInput || !usdcAmountInput || !sharesInput) continue;

        const outcomeIndex = parseInt(outcomeIndexInput.value);
        
        // Only include transactions for this candidate (outcomeIndex matches candidateId)
        if (outcomeIndex !== candidateId) continue;

        const usdcAmount = parseFloat(usdcAmountInput.value) / 1e6; // USDC has 6 decimals
        const shares = parseFloat(sharesInput.value) / 1e18; // Shares have 18 decimals
        const pricePerShare = shares > 0 ? (usdcAmount / shares) * 100 : 0; // Price in cents

        processedOrders.push({
          type: isBuy ? "BID" : "ASK",
          price: pricePerShare.toFixed(1),
          shares: shares.toFixed(2),
          totalUSDC: usdcAmount.toFixed(2),
          trader: tx.from,
          timestamp: tx.blockTimestamp,
          txHash: tx.transactionHash,
        });
      }

      // Sort by timestamp (most recent first)
      processedOrders.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setOrders(processedOrders);
    } catch (err) {
      console.error("Error fetching thirdweb transactions:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch transactions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchTransactions, 30000);

    return () => clearInterval(interval);
  }, [candidateId]);

  return { orders, isLoading, error, refetch: fetchTransactions };
};
