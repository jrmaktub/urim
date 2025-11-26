import { useState, useEffect } from "react";
import { getContractEvents } from "thirdweb";
import { hondurasElectionContract, sharesPurchasedEvent, sharesSoldEvent } from "@/lib/thirdwebContract";

export interface OrderBookEntry {
  type: "BID" | "ASK";
  price: string;
  shares: string;
  totalUSDC: string;
  trader: string;
  timestamp: string;
  txHash: string;
}

export const useThirdwebTransactions = (candidateId: number) => {
  const [orders, setOrders] = useState<OrderBookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      console.log("🔍 THIRDWEB V5: Starting fetch for candidate", candidateId);

      // Fetch SharesPurchased events
      const purchaseEvents = await getContractEvents({
        contract: hondurasElectionContract,
        events: [sharesPurchasedEvent],
      });

      console.log("🔍 THIRDWEB V5: Purchase events:", purchaseEvents);

      // Fetch SharesSold events
      const soldEvents = await getContractEvents({
        contract: hondurasElectionContract,
        events: [sharesSoldEvent],
      });

      console.log("🔍 THIRDWEB V5: Sold events:", soldEvents);

      // Process purchase events
      const buyTrades = purchaseEvents
        .filter((event: any) => {
          const eventCandidateId = Number(event.args.candidateId);
          console.log(`🔍 THIRDWEB V5: BUY - candidateId: ${eventCandidateId}, matches: ${eventCandidateId === candidateId}`);
          return eventCandidateId === candidateId;
        })
        .map((event: any) => {
          const shares = Number(event.args.sharesReceived) / 1e18;
          const usdcAmount = Number(event.args.usdcAmount) / 1e6;
          const price = Number(event.args.newPrice) * 100;
          const trader = event.args.buyer;
          const txHash = event.transactionHash;
          const timestamp = new Date(Number(event.blockTimestamp) * 1000);

          console.log(`✅ THIRDWEB V5: BUY ${shares.toFixed(2)} shares at ${price.toFixed(1)}¢`);

          return {
            type: "BID" as const,
            price: price.toFixed(1),
            shares: shares.toFixed(2),
            totalUSDC: usdcAmount.toFixed(2),
            trader,
            timestamp: getTimeAgo(timestamp.getTime()),
            txHash,
          };
        });

      // Process sold events
      const sellTrades = soldEvents
        .filter((event: any) => {
          const eventCandidateId = Number(event.args.candidateId);
          console.log(`🔍 THIRDWEB V5: SELL - candidateId: ${eventCandidateId}, matches: ${eventCandidateId === candidateId}`);
          return eventCandidateId === candidateId;
        })
        .map((event: any) => {
          const shares = Number(event.args.sharesSold) / 1e18;
          const usdcAmount = Number(event.args.usdcReceived) / 1e6;
          const price = Number(event.args.newPrice) * 100;
          const trader = event.args.seller;
          const txHash = event.transactionHash;
          const timestamp = new Date(Number(event.blockTimestamp) * 1000);

          console.log(`✅ THIRDWEB V5: SELL ${shares.toFixed(2)} shares at ${price.toFixed(1)}¢`);

          return {
            type: "ASK" as const,
            price: price.toFixed(1),
            shares: shares.toFixed(2),
            totalUSDC: usdcAmount.toFixed(2),
            trader,
            timestamp: getTimeAgo(timestamp.getTime()),
            txHash,
          };
        });

      // Combine and sort by most recent
      const allTrades = [...buyTrades, ...sellTrades];

      console.log(`🔍 THIRDWEB V5: Final trades count: ${allTrades.length}`);
      setOrders(allTrades);
      setError(null);
    } catch (err) {
      console.error("❌ THIRDWEB V5 ERROR:", err);
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

