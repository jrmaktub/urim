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

const ALCHEMY_RPC_URL = "https://base-mainnet.g.alchemy.com/v2/27SvVEbGAVC2VSJ8rPss0";

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

      console.log("🔍 Fetching events from Alchemy...");
      console.log("Contract Address:", HONDURAS_ELECTION_ADDRESS);
      console.log("Candidate ID:", candidateId);

      // First, get the current block number
      const blockResponse = await fetch(ALCHEMY_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_blockNumber",
          params: [],
        }),
      });

      const blockData = await blockResponse.json();
      const currentBlock = parseInt(blockData.result, 16);
      console.log("Current block:", currentBlock);

      // Fetch events from the last 50,000 blocks (roughly 1 week on Base)
      const fromBlock = Math.max(0, currentBlock - 50000);
      const toBlock = currentBlock;

      console.log(`Fetching logs from block ${fromBlock} to ${toBlock}`);

      // Fetch events in chunks of 10,000 blocks to avoid rate limits
      const chunkSize = 10000;
      let allLogs: any[] = [];

      for (let start = fromBlock; start <= toBlock; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, toBlock);
        
        console.log(`Fetching chunk: ${start} to ${end}`);

        const requestBody = {
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getLogs",
          params: [
            {
              address: HONDURAS_ELECTION_ADDRESS,
              fromBlock: `0x${start.toString(16)}`,
              toBlock: `0x${end.toString(16)}`,
              topics: [
                [SHARES_PURCHASED_SIGNATURE, SHARES_SOLD_SIGNATURE],
              ],
            },
          ],
        };

        const response = await fetch(ALCHEMY_RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Response not OK:", errorText);
          throw new Error(`Alchemy API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.error) {
          console.error("❌ JSON-RPC Error:", data.error);
          throw new Error(data.error.message || "Failed to fetch logs");
        }

        const logs = data.result || [];
        console.log(`✅ Fetched ${logs.length} logs from chunk ${start}-${end}`);
        allLogs = allLogs.concat(logs);
      }

      console.log(`✅ Total logs fetched: ${allLogs.length}`);
      const processedOrders: OrderBookEntry[] = [];

      // Fetch block timestamps for all unique blocks
      const blockNumbers = [...new Set(allLogs.map((log: any) => log.blockNumber))];
      const blockTimestamps: Record<string, number> = {};

      await Promise.all(
        blockNumbers.map(async (blockNum: string) => {
          try {
            const blockResponse = await fetch(ALCHEMY_RPC_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "eth_getBlockByNumber",
                params: [blockNum, false],
              }),
            });
            const blockData = await blockResponse.json();
            if (blockData.result) {
              blockTimestamps[blockNum] = parseInt(blockData.result.timestamp, 16);
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
      console.error("❌ Error fetching Alchemy contract events:", err);
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
