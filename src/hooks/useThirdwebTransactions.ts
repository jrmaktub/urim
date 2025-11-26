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

const THIRDWEB_INSIGHT_API_URL = "https://insight.thirdweb.com/v1/events";
const THIRDWEB_CLIENT_ID = "6338fc246f407a9d38ba885ba43487f2";

export const useThirdwebTransactions = (candidateId: number) => {
  const [orders, setOrders] = useState<OrderBookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      console.log("🔍 THIRDWEB INSIGHT: Starting fetch for candidate", candidateId);
      
      // Use Insight API to get contract events
      const contractAddress = "0xb73D817C1c90606ecb6d131a10766919fcBD6Ec6";
      const chainId = 8453; // Base Mainnet
      
      const response = await fetch(
        `${THIRDWEB_INSIGHT_API_URL}?chain_id=${chainId}&filter_address=${contractAddress}&limit=100`,
        {
          headers: {
            "x-client-id": THIRDWEB_CLIENT_ID,
          },
        }
      );

      console.log("🔍 THIRDWEB INSIGHT: Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("🔍 THIRDWEB INSIGHT: Error response:", errorText);
        throw new Error(`Failed to fetch events: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("🔍 THIRDWEB INSIGHT: Full response data:", data);

      // Check response structure
      if (!data.result) {
        console.error("🔍 THIRDWEB INSIGHT: Unexpected response structure:", data);
        throw new Error("Unexpected API response structure");
      }

      const allEvents = data.result;
      console.log(`🔍 THIRDWEB INSIGHT: Found ${allEvents.length} total events`);

      // Log first event to see structure
      if (allEvents.length > 0) {
        console.log("🔍 THIRDWEB INSIGHT: First event structure:", JSON.stringify(allEvents[0], null, 2));
      }

      // Filter and process trades for the specific candidate
      const trades = allEvents
        .filter((event: any) => {
          const eventName = event.event_name || event.eventName;
          const isCorrectEvent = eventName === "SharesPurchased" || eventName === "SharesSold";
          
          // Extract candidateId from decoded params
          const decodedParams = event.decoded_params || event.decodedParams || [];
          const candidateIdParam = decodedParams.find((p: any) => p.name === "candidateId");
          const eventCandidateId = candidateIdParam ? parseInt(candidateIdParam.value) : null;
          
          const matchesCandidate = eventCandidateId === candidateId;
          
          console.log(`🔍 THIRDWEB INSIGHT: Event ${event.transaction_hash?.slice(0, 10)}... - event:${eventName}, candidateId:${eventCandidateId}, matches:${matchesCandidate}`);
          
          return isCorrectEvent && matchesCandidate;
        })
        .map((event: any) => {
          const eventName = event.event_name || event.eventName;
          const isBuy = eventName === "SharesPurchased";
          
          // Extract params from decoded_params array
          const decodedParams = event.decoded_params || event.decodedParams || [];
          
          const getParamValue = (name: string) => {
            const param = decodedParams.find((p: any) => p.name === name);
            return param?.value || "0";
          };
          
          const shares = isBuy ? getParamValue("sharesReceived") : getParamValue("sharesSold");
          const usdcAmount = isBuy ? getParamValue("usdcAmount") : getParamValue("usdcReceived");
          const price = getParamValue("newPrice");
          const trader = isBuy ? getParamValue("buyer") : getParamValue("seller");
          const txHash = event.transaction_hash || event.transactionHash || "";

          // Convert from wei to readable format
          const sharesFormatted = shares ? (parseFloat(shares) / 1e18).toFixed(2) : "0";
          const usdcFormatted = usdcAmount ? (parseFloat(usdcAmount) / 1e6).toFixed(2) : "0";
          const priceFormatted = price ? (parseFloat(price) * 100).toFixed(1) : "0";

          // Format timestamp
          const timestamp = event.block_timestamp || event.blockTimestamp || new Date().toISOString();
          const timeAgo = getTimeAgo(new Date(timestamp).getTime());

          console.log(`✅ THIRDWEB INSIGHT: Processed trade - ${isBuy ? 'BUY' : 'SELL'} ${sharesFormatted} shares at ${priceFormatted}¢ by ${trader?.slice(0, 8)}...`);

          return {
            type: isBuy ? "BID" : "ASK",
            price: priceFormatted,
            shares: sharesFormatted,
            totalUSDC: usdcFormatted,
            trader: trader || "",
            timestamp: timeAgo,
            txHash: txHash,
          } as OrderBookEntry;
        });

      console.log(`🔍 THIRDWEB INSIGHT: Final filtered trades count: ${trades.length}`);
      setOrders(trades);
      setError(null);
    } catch (err) {
      console.error("❌ THIRDWEB INSIGHT ERROR:", err);
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
