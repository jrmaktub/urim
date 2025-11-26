import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { base } from "wagmi/chains";
import { HONDURAS_ELECTION_ADDRESS } from "@/constants/hondurasElection";
import { parseAbiItem, decodeEventLog } from "viem";

export interface OrderBookEntry {
  type: "BID" | "ASK";
  price: number;
  shares: string;
  totalUSDC: string;
  trader: string;
  timestamp: string;
  blockNumber: number;
  txHash: string;
}

export function useOrderBookEvents(candidateId: number) {
  const [orders, setOrders] = useState<OrderBookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const publicClient = usePublicClient({ chainId: base.id });

  useEffect(() => {
    const fetchEvents = async () => {
      if (!publicClient) return;
      
      try {
        console.log("🔍 Fetching logs for candidate", candidateId);
        
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - BigInt(50000);

        // Get ALL logs from the contract
        const logs = await publicClient.getLogs({
          address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
          fromBlock,
          toBlock: 'latest',
        });

        console.log(`✅ Found ${logs.length} total logs from contract`);

        const allOrders: OrderBookEntry[] = [];

        // Parse each log
        for (const log of logs) {
          const logWithTopics = log as any;
          try {
            // Try to decode as SharesPurchased
            try {
              const decoded = decodeEventLog({
                abi: [parseAbiItem('event SharesPurchased(address indexed buyer, uint8 indexed candidateId, uint256 usdcAmount, uint256 sharesReceived, uint256 newPrice)')],
                data: logWithTopics.data,
                topics: logWithTopics.topics,
              }) as any;

              const { buyer, candidateId: cid, usdcAmount, sharesReceived, newPrice } = decoded.args;
              
              if (Number(cid) === candidateId) {
                allOrders.push({
                  type: "BID",
                  price: Math.round(Number(newPrice) / 1e14), // newPrice is in 1e16, convert to cents
                  shares: (Number(sharesReceived) / 1e6).toFixed(2),
                  totalUSDC: (Number(usdcAmount) / 1e6).toFixed(2),
                  trader: buyer as string,
                  timestamp: new Date().toLocaleTimeString(),
                  blockNumber: Number(log.blockNumber),
                  txHash: log.transactionHash || "",
                });
              }
            } catch (e) {
              // Not a SharesPurchased event
            }

            // Try to decode as SharesSold
            try {
              const decoded = decodeEventLog({
                abi: [parseAbiItem('event SharesSold(address indexed seller, uint8 indexed candidateId, uint256 sharesSold, uint256 usdcReceived, uint256 newPrice)')],
                data: logWithTopics.data,
                topics: logWithTopics.topics,
              }) as any;

              const { seller, candidateId: cid, sharesSold, usdcReceived, newPrice } = decoded.args;
              
              if (Number(cid) === candidateId) {
                allOrders.push({
                  type: "ASK",
                  price: Math.round(Number(newPrice) / 1e14),
                  shares: (Number(sharesSold) / 1e6).toFixed(2),
                  totalUSDC: (Number(usdcReceived) / 1e6).toFixed(2),
                  trader: seller as string,
                  timestamp: new Date().toLocaleTimeString(),
                  blockNumber: Number(log.blockNumber),
                  txHash: log.transactionHash || "",
                });
              }
            } catch (e) {
              // Not a SharesSold event
            }
          } catch (error) {
            // Skip unparseable logs
          }
        }

        allOrders.sort((a, b) => b.blockNumber - a.blockNumber);
        console.log(`✅ Processed ${allOrders.length} orders for candidate ${candidateId}`);
        setOrders(allOrders);
      } catch (error) {
        console.error("❌ Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
    
    const interval = setInterval(fetchEvents, 15000);
    return () => clearInterval(interval);
  }, [candidateId, publicClient]);

  return { orders, isLoading };
}
