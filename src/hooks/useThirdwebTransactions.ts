import { useState, useEffect } from "react";
import { createThirdwebClient } from "thirdweb";

// Initialize Thirdweb client
const client = createThirdwebClient({
  clientId: "6338fc246f407a9d38ba885ba43487f2"
});

interface ThirdwebTransaction {
  hash: string;
  blockTimestamp: string;
  decoded?: {
    name: string;
    inputs: {
      candidateId: number;
      sharesReceived?: string;
      sharesSold?: string;
      usdcAmount?: string;
      usdcReceived?: string;
      newPrice: string;
      buyer?: string;
      seller?: string;
    };
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

const THIRDWEB_API_URL = "https://api.thirdweb.com/v1/contracts/8453/0xb73D817C1c90606ecb6d131a10766919fcBD6Ec6/transactions";
const THIRDWEB_SECRET_KEY = "SImL1yUgAoQDQYt3CbIkUhqHcJEfB77W_hxTVDoKVYMWT7AVZIzN0Z88n8mN8FR0A9xZ984GWzGJ8CR2EBcaWQ";

export const useThirdwebTransactions = (candidateId: number) => {
  const [orders, setOrders] = useState<OrderBookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      console.log("🔍 THIRDWEB: Starting fetch for candidate", candidateId);
      
      const response = await fetch(`${THIRDWEB_API_URL}?page=1&limit=100`, {
        headers: {
          "x-secret-key": THIRDWEB_SECRET_KEY,
        },
      });

      console.log("🔍 THIRDWEB: Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("🔍 THIRDWEB: Error response:", errorText);
        throw new Error(`Failed to fetch transactions: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("🔍 THIRDWEB: Full response data:", data);

      // Check response structure
      if (!data.result || !data.result.data) {
        console.error("🔍 THIRDWEB: Unexpected response structure:", data);
        throw new Error("Unexpected API response structure");
      }

      const allTransactions = data.result.data;
      console.log(`🔍 THIRDWEB: Found ${allTransactions.length} total transactions`);

      // Log first transaction to see structure
      if (allTransactions.length > 0) {
        console.log("🔍 THIRDWEB: First transaction structure:", JSON.stringify(allTransactions[0], null, 2));
      }

      // Filter and process trades for the specific candidate
      const trades = allTransactions
        .filter((tx: ThirdwebTransaction) => {
          const hasDecoded = tx.decoded !== undefined;
          const eventName = tx.decoded?.name;
          const isCorrectEvent = eventName === "SharesPurchased" || eventName === "SharesSold";
          const txCandidateId = tx.decoded?.inputs?.candidateId;
          const matchesCandidate = txCandidateId === candidateId;
          
          console.log(`🔍 THIRDWEB: TX ${tx.hash?.slice(0, 10)}... - decoded:${hasDecoded}, event:${eventName}, candidateId:${txCandidateId}, matches:${matchesCandidate}`);
          
          return hasDecoded && isCorrectEvent && matchesCandidate;
        })
        .map((tx: ThirdwebTransaction) => {
          const isBuy = tx.decoded!.name === "SharesPurchased";
          const shares = isBuy
            ? tx.decoded!.inputs.sharesReceived
            : tx.decoded!.inputs.sharesSold;
          const usdcAmount = isBuy
            ? tx.decoded!.inputs.usdcAmount
            : tx.decoded!.inputs.usdcReceived;
          const price = tx.decoded!.inputs.newPrice;
          const trader = isBuy ? tx.decoded!.inputs.buyer : tx.decoded!.inputs.seller;

          // Convert from wei to readable format
          const sharesFormatted = shares ? (parseFloat(shares) / 1e18).toFixed(2) : "0";
          const usdcFormatted = usdcAmount ? (parseFloat(usdcAmount) / 1e6).toFixed(2) : "0";
          const priceFormatted = price ? (parseFloat(price) * 100).toFixed(1) : "0";

          // Format timestamp
          const timeAgo = getTimeAgo(new Date(tx.blockTimestamp).getTime());

          console.log(`🔍 THIRDWEB: Processed trade - ${isBuy ? 'BUY' : 'SELL'} ${sharesFormatted} shares at ${priceFormatted}¢`);

          return {
            type: isBuy ? "BID" : "ASK",
            price: priceFormatted,
            shares: sharesFormatted,
            totalUSDC: usdcFormatted,
            trader: trader || "",
            timestamp: timeAgo,
            txHash: tx.hash,
          } as OrderBookEntry;
        });

      console.log(`🔍 THIRDWEB: Final filtered trades count: ${trades.length}`);
      setOrders(trades);
      setError(null);
    } catch (err) {
      console.error("❌ THIRDWEB ERROR:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();

    // Refresh every 30 seconds
    const interval = setInterval(fetchTransactions, 30000);

    return () => clearInterval(interval);
  }, [candidateId]);

  return { orders, isLoading, error, refetch: fetchTransactions };
};

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
