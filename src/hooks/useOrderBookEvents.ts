import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { HONDURAS_ELECTION_ADDRESS } from "@/constants/hondurasElection";
import HondurasElectionABI from "@/contracts/HondurasElection.json";
import { parseAbiItem, formatUnits } from "viem";

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
  const publicClient = usePublicClient();

  useEffect(() => {
    const fetchEvents = async () => {
      if (!publicClient) return;
      
      try {
        console.log("🔍 FETCHING EVENTS FOR CANDIDATE:", candidateId);
        
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - 50000n; // Last ~50k blocks
        
        console.log(`📦 Fetching from block ${fromBlock} to ${currentBlock}`);
        
        // Fetch SharesPurchased events
        const purchaseLogs = await publicClient.getLogs({
          address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
          event: parseAbiItem('event SharesPurchased(uint8 indexed candidateId, address indexed buyer, uint256 shareAmount, uint256 cost, uint256 newPrice)'),
          fromBlock,
          toBlock: 'latest'
        });
        
        // Fetch SharesSold events
        const sellLogs = await publicClient.getLogs({
          address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
          event: parseAbiItem('event SharesSold(uint8 indexed candidateId, address indexed seller, uint256 shareAmount, uint256 payout, uint256 newPrice)'),
          fromBlock,
          toBlock: 'latest'
        });
        
        console.log(`✅ GOT ${purchaseLogs.length} purchase events, ${sellLogs.length} sell events`);
        
        // Process purchase events
        const purchases: OrderBookEntry[] = await Promise.all(
          purchaseLogs
            .filter((log: any) => Number(log.args.candidateId) === candidateId)
            .map(async (log: any) => {
              const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
              return {
                type: "BID" as const,
                price: Number(formatUnits(log.args.newPrice, 6)),
                shares: formatUnits(log.args.shareAmount, 18),
                totalUSDC: formatUnits(log.args.cost, 6),
                trader: log.args.buyer,
                timestamp: new Date(Number(block.timestamp) * 1000).toLocaleTimeString(),
                blockNumber: Number(log.blockNumber),
                txHash: log.transactionHash
              };
            })
        );
        
        // Process sell events
        const sells: OrderBookEntry[] = await Promise.all(
          sellLogs
            .filter((log: any) => Number(log.args.candidateId) === candidateId)
            .map(async (log: any) => {
              const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
              return {
                type: "ASK" as const,
                price: Number(formatUnits(log.args.newPrice, 6)),
                shares: formatUnits(log.args.shareAmount, 18),
                totalUSDC: formatUnits(log.args.payout, 6),
                trader: log.args.seller,
                timestamp: new Date(Number(block.timestamp) * 1000).toLocaleTimeString(),
                blockNumber: Number(log.blockNumber),
                txHash: log.transactionHash
              };
            })
        );
        
        // Combine and sort by block number (newest first)
        const allOrders = [...purchases, ...sells].sort((a, b) => b.blockNumber - a.blockNumber);
        
        console.log(`✅ PROCESSED ${allOrders.length} TOTAL ORDERS FOR CANDIDATE ${candidateId}`);
        setOrders(allOrders);
        setIsLoading(false);
      } catch (error) {
        console.error("❌ FETCH ERROR:", error);
        setIsLoading(false);
      }
    };

    fetchEvents();
    
    // Refresh every 15 seconds
    const interval = setInterval(fetchEvents, 15000);
    return () => clearInterval(interval);
  }, [candidateId, publicClient]);

  return { orders, isLoading };
}
