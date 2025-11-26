import { useState, useEffect } from "react";
import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";
import { formatUnits } from "viem";
import { HONDURAS_ELECTION_ADDRESS } from "@/constants/hondurasElection";

export interface OrderBookEntry {
  type: "BID" | "ASK";
  price: number;
  shares: string;
  totalUSDC: string;
  trader: string;
  timestamp: string;
  blockNumber: number;
}

// Create dedicated Alchemy client
const publicClient = createPublicClient({
  chain: base,
  transport: http('https://base-mainnet.g.alchemy.com/v2/27SvVEbGAVC2VSJ8rPss0rPzh4IWLU_j'),
});

export function useOrderBookEvents(candidateId: number) {
  const [orders, setOrders] = useState<OrderBookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        console.log("🔍 Fetching events for candidate", candidateId);
        
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - BigInt(50000);

        console.log(`📊 Block range: ${fromBlock} to ${currentBlock}`);

        // Fetch SharesPurchased events
        const purchaseLogs = await publicClient.getLogs({
          address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
          event: parseAbiItem('event SharesPurchased(address indexed buyer, uint8 indexed candidateId, uint256 usdcAmount, uint256 sharesReceived, uint256 newPrice)'),
          fromBlock,
          toBlock: 'latest',
        });

        console.log(`✅ Fetched ${purchaseLogs.length} purchase events`);

        // Fetch SharesSold events
        const saleLogs = await publicClient.getLogs({
          address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
          event: parseAbiItem('event SharesSold(address indexed seller, uint8 indexed candidateId, uint256 sharesSold, uint256 usdcReceived, uint256 newPrice)'),
          fromBlock,
          toBlock: 'latest',
        });

        console.log(`✅ Fetched ${saleLogs.length} sale events`);

        const allOrders: OrderBookEntry[] = [];

        // Process purchase events
        for (const log of purchaseLogs) {
          const { buyer, candidateId: eventCandidateId, usdcAmount, sharesReceived, newPrice } = log.args;
          
          if (Number(eventCandidateId) === candidateId) {
            const shares = formatUnits(sharesReceived, 6);
            const price = Number(formatUnits(newPrice, 16));
            const totalUSDC = formatUnits(usdcAmount, 6);

            allOrders.push({
              type: "BID",
              price: Math.round(price * 100),
              shares,
              totalUSDC,
              trader: buyer,
              timestamp: new Date().toLocaleTimeString(),
              blockNumber: Number(log.blockNumber),
            });
          }
        }

        // Process sale events
        for (const log of saleLogs) {
          const { seller, candidateId: eventCandidateId, sharesSold, usdcReceived, newPrice } = log.args;
          
          if (Number(eventCandidateId) === candidateId) {
            const shares = formatUnits(sharesSold, 6);
            const price = Number(formatUnits(newPrice, 16));
            const totalUSDC = formatUnits(usdcReceived, 6);

            allOrders.push({
              type: "ASK",
              price: Math.round(price * 100),
              shares,
              totalUSDC,
              trader: seller,
              timestamp: new Date().toLocaleTimeString(),
              blockNumber: Number(log.blockNumber),
            });
          }
        }

        allOrders.sort((a, b) => b.blockNumber - a.blockNumber);
        console.log(`✅ Total orders for candidate ${candidateId}:`, allOrders.length);
        setOrders(allOrders);
      } catch (error) {
        console.error("❌ Error fetching events:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, [candidateId]);

  return { orders, isLoading };
}
