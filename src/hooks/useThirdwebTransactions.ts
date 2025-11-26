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

      // Log first few transactions to see actual structure
      if (allTransactions.length > 0) {
        console.log("🔍 THIRDWEB: First 3 transactions:", JSON.stringify(allTransactions.slice(0, 3), null, 2));
      }

      // Filter and process trades for the specific candidate
      const trades = allTransactions
        .filter((tx: any) => {
          // Log every transaction to understand structure
          console.log("🔍 THIRDWEB: Inspecting TX:", {
            hash: tx.transactionHash || tx.hash,
            functionName: tx.functionName,
            decodedName: tx.decoded?.name,
            hasEvents: !!tx.events,
            eventsCount: tx.events?.length,
            eventNames: tx.events?.map((e: any) => e.eventName)
          });

          // Check if transaction has events (not decoded directly on tx)
          if (tx.events && tx.events.length > 0) {
            for (const event of tx.events) {
              if (event.eventName === "SharesPurchased" || event.eventName === "SharesSold") {
                // Check if this event is for our candidate
                const eventCandidateId = event.args?.candidateId || event.decodedLog?.args?.candidateId;
                console.log(`🔍 THIRDWEB: Found ${event.eventName} event, candidateId: ${eventCandidateId}, looking for: ${candidateId}`);
                
                if (parseInt(eventCandidateId) === candidateId) {
                  return true;
                }
              }
            }
          }

          // Fallback to old structure
          const hasDecoded = tx.decoded !== undefined;
          const eventName = tx.decoded?.name;
          const isCorrectEvent = eventName === "SharesPurchased" || eventName === "SharesSold";
          const txCandidateId = tx.decoded?.inputs?.candidateId;
          const matchesCandidate = parseInt(txCandidateId) === candidateId;
          
          return hasDecoded && isCorrectEvent && matchesCandidate;
        })
        .map((tx: any) => {
          // Try to extract from events first
          let isBuy = false;
          let shares = "0";
          let usdcAmount = "0";
          let price = "0";
          let trader = "";
          let txHash = tx.transactionHash || tx.hash || "";
          
          if (tx.events && tx.events.length > 0) {
            const relevantEvent = tx.events.find((e: any) => 
              e.eventName === "SharesPurchased" || e.eventName === "SharesSold"
            );
            
            if (relevantEvent) {
              isBuy = relevantEvent.eventName === "SharesPurchased";
              const args = relevantEvent.args || relevantEvent.decodedLog?.args || {};
              
              shares = isBuy ? (args.sharesReceived || "0") : (args.sharesSold || "0");
              usdcAmount = isBuy ? (args.usdcAmount || "0") : (args.usdcReceived || "0");
              price = args.newPrice || "0";
              trader = isBuy ? (args.buyer || tx.from || "") : (args.seller || tx.from || "");
            }
          } else if (tx.decoded) {
            // Fallback to old structure
            isBuy = tx.decoded.name === "SharesPurchased";
            shares = isBuy ? tx.decoded.inputs.sharesReceived : tx.decoded.inputs.sharesSold;
            usdcAmount = isBuy ? tx.decoded.inputs.usdcAmount : tx.decoded.inputs.usdcReceived;
            price = tx.decoded.inputs.newPrice;
            trader = isBuy ? tx.decoded.inputs.buyer : tx.decoded.inputs.seller;
          }

          // Convert from wei to readable format
          const sharesFormatted = shares ? (parseFloat(shares) / 1e18).toFixed(2) : "0";
          const usdcFormatted = usdcAmount ? (parseFloat(usdcAmount) / 1e6).toFixed(2) : "0";
          const priceFormatted = price ? (parseFloat(price) * 100).toFixed(1) : "0";

          // Format timestamp
          const timestamp = tx.blockTimestamp || tx.timestamp || new Date().toISOString();
          const timeAgo = getTimeAgo(new Date(timestamp).getTime());

          console.log(`✅ THIRDWEB: Processed trade - ${isBuy ? 'BUY' : 'SELL'} ${sharesFormatted} shares at ${priceFormatted}¢ by ${trader?.slice(0, 8)}...`);

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
