import { useState, useEffect } from "react";
import { HONDURAS_ELECTION_ADDRESS } from "@/constants/hondurasElection";
import { ethers } from "ethers";

export interface OrderBookEntry {
  type: "BID" | "ASK";
  price: string;
  shares: string;
  totalUSDC: string;
  trader: string;
  timestamp: string;
  txHash: string;
  blockNumber: number;
}

const BASESCAN_API_KEY = "6VT5S4WW78C4WSEPS1NTUEJAP4GE4XMQP8";
const BASESCAN_API_URL = "https://api.basescan.org/api";

// Event signatures
const SHARES_PURCHASED_SIGNATURE = ethers.id("SharesPurchased(address,uint8,uint256,uint256)");
const SHARES_SOLD_SIGNATURE = ethers.id("SharesSold(address,uint8,uint256,uint256)");

export const useAlchemyContractEvents = (candidateId: number) => {
  const [orders, setOrders] = useState<OrderBookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContractEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("🔍 Fetching events from BaseScan...");
      console.log("Contract Address:", HONDURAS_ELECTION_ADDRESS);
      console.log("Candidate ID:", candidateId);
      console.log("Event signatures:", SHARES_PURCHASED_SIGNATURE, SHARES_SOLD_SIGNATURE);

      // Fetch SharesPurchased events
      const purchaseResponse = await fetch(
        `${BASESCAN_API_URL}?module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=${HONDURAS_ELECTION_ADDRESS}&topic0=${SHARES_PURCHASED_SIGNATURE}&apikey=${BASESCAN_API_KEY}`
      );

      const purchaseData = await purchaseResponse.json();
      console.log("Purchase events response:", purchaseData);

      if (purchaseData.status !== "1" && purchaseData.message !== "No records found") {
        console.error("❌ BaseScan API error (purchases):", purchaseData.message);
        throw new Error(purchaseData.message || "Failed to fetch purchase logs");
      }

      // Fetch SharesSold events
      const saleResponse = await fetch(
        `${BASESCAN_API_URL}?module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=${HONDURAS_ELECTION_ADDRESS}&topic0=${SHARES_SOLD_SIGNATURE}&apikey=${BASESCAN_API_KEY}`
      );

      const saleData = await saleResponse.json();
      console.log("Sale events response:", saleData);

      if (saleData.status !== "1" && saleData.message !== "No records found") {
        console.error("❌ BaseScan API error (sales):", saleData.message);
        throw new Error(saleData.message || "Failed to fetch sale logs");
      }

      // Combine all logs
      const purchaseLogs = purchaseData.result || [];
      const saleLogs = saleData.result || [];
      const allLogs = [...purchaseLogs, ...saleLogs];
      console.log(`✅ Total logs fetched: ${allLogs.length} (${purchaseLogs.length} purchases, ${saleLogs.length} sales)`);

      const processedOrders: OrderBookEntry[] = [];

      // Fetch block timestamps for all unique blocks
      const blockNumbers = [...new Set(allLogs.map((log: any) => log.blockNumber))];
      const blockTimestamps: Record<string, number> = {};

      await Promise.all(
        blockNumbers.map(async (blockNum: string) => {
          try {
            const blockNumber = parseInt(blockNum, 16);
            const response = await fetch(
              `${BASESCAN_API_URL}?module=block&action=getblockreward&blockno=${blockNumber}&apikey=${BASESCAN_API_KEY}`
            );
            const data = await response.json();
            if (data.status === "1" && data.result && data.result.timeStamp) {
              blockTimestamps[blockNum] = parseInt(data.result.timeStamp);
            }
          } catch (err) {
            console.error(`Error fetching block ${blockNum}:`, err);
          }
        })
      );

      // Parse each log
      for (const log of allLogs) {
        const isBuy = log.topics[0] === SHARES_PURCHASED_SIGNATURE;
        const isSell = log.topics[0] === SHARES_SOLD_SIGNATURE;

        if (!isBuy && !isSell) {
          console.log("⚠️ Unknown event signature:", log.topics[0]);
          continue;
        }

        // Parse topics
        const traderAddress = ethers.getAddress("0x" + log.topics[1].slice(26));
        const outcomeIndex = parseInt(log.topics[2], 16);

        console.log(`Event: ${isBuy ? 'BUY' : 'SELL'} for candidate ${outcomeIndex} by ${traderAddress}`);

        // Only include events for this candidate
        if (outcomeIndex !== candidateId) {
          console.log(`⏭️ Skipping - not for candidate ${candidateId}`);
          continue;
        }

        // Parse data field (contains shares and usdcAmount)
        const dataHex = log.data.slice(2); // Remove '0x'
        const shares = BigInt("0x" + dataHex.slice(0, 64));
        const usdcAmount = BigInt("0x" + dataHex.slice(64, 128));

        // Convert to human-readable values
        const sharesDecimal = Number(shares) / 1e18;
        const usdcDecimal = Number(usdcAmount) / 1e6;
        const pricePerShare = sharesDecimal > 0 ? (usdcDecimal / sharesDecimal) * 100 : 0;

        // Get timestamp
        const blockNum = parseInt(log.blockNumber, 16);
        const timestamp = blockTimestamps[log.blockNumber] || Date.now() / 1000;
        const timeAgo = getTimeAgo(timestamp);

        processedOrders.push({
          type: isBuy ? "BID" : "ASK",
          price: pricePerShare.toFixed(1),
          shares: sharesDecimal.toFixed(2),
          totalUSDC: usdcDecimal.toFixed(2),
          trader: traderAddress,
          timestamp: timeAgo,
          txHash: log.transactionHash,
          blockNumber: blockNum,
        });
      }

      // Sort by block number (most recent first)
      processedOrders.sort((a, b) => b.blockNumber - a.blockNumber);

      console.log(`📊 Processed ${processedOrders.length} orders for candidate ${candidateId}`);
      console.log("Orders:", processedOrders);

      setOrders(processedOrders);
    } catch (err) {
      console.error("❌ Error fetching BaseScan contract events:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch contract events");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContractEvents();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchContractEvents, 30000);

    return () => clearInterval(interval);
  }, [candidateId]);

  return { orders, isLoading, error, refetch: fetchContractEvents };
};

// Helper function to format timestamp
function getTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
