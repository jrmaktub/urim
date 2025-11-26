import { useState, useEffect } from "react";
import { useWatchContractEvent, usePublicClient } from "wagmi";
import { HONDURAS_ELECTION_ADDRESS } from "@/constants/hondurasElection";
import HondurasElectionABI from "@/contracts/HondurasElection.json";
import { formatUnits, parseAbiItem } from "viem";

export interface RealtimeTrade {
  type: "BUY" | "SELL";
  candidateId: number;
  shares: string;
  usdcAmount: string;
  price: string;
  trader: string;
  timestamp: number;
  txHash: string;
}

export function useRealtimeTrades() {
  const [recentTrades, setRecentTrades] = useState<RealtimeTrade[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const publicClient = usePublicClient();

  // Fetch historical trades on mount
  useEffect(() => {
    const fetchHistoricalTrades = async () => {
      if (!publicClient) return;

      try {
        console.log("📚 FETCHING HISTORICAL TRADES...");
        const latestBlock = await publicClient.getBlockNumber();
        const startBlock = latestBlock - 1000n > 0n ? latestBlock - 1000n : 0n;
        const allTrades: RealtimeTrade[] = [];

        // Fetch in chunks of 10 blocks to avoid rate limits
        for (let i = startBlock; i <= latestBlock; i += 10n) {
          const toBlock = i + 9n > latestBlock ? latestBlock : i + 9n;

          console.log(`📦 Fetching blocks ${i} to ${toBlock}`);

          const [purchaseLogs, sellLogs] = await Promise.all([
            publicClient.getLogs({
              address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
              event: parseAbiItem('event SharesPurchased(address indexed buyer, uint8 indexed candidateId, uint256 usdcAmount, uint256 sharesReceived, uint256 newPrice)'),
              fromBlock: i,
              toBlock: toBlock
            }),
            publicClient.getLogs({
              address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
              event: parseAbiItem('event SharesSold(address indexed seller, uint8 indexed candidateId, uint256 sharesSold, uint256 usdcReceived, uint256 newPrice)'),
              fromBlock: i,
              toBlock: toBlock
            })
          ]);

          // Process purchase events
          for (const log of purchaseLogs) {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
            allTrades.push({
              type: "BUY",
              candidateId: Number((log.args as any).candidateId),
              shares: formatUnits((log.args as any).sharesReceived, 18),
              usdcAmount: formatUnits((log.args as any).usdcAmount, 6),
              price: formatUnits((log.args as any).newPrice, 6),
              trader: (log.args as any).buyer,
              timestamp: Number(block.timestamp) * 1000,
              txHash: log.transactionHash
            });
          }

          // Process sell events
          for (const log of sellLogs) {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
            allTrades.push({
              type: "SELL",
              candidateId: Number((log.args as any).candidateId),
              shares: formatUnits((log.args as any).sharesSold, 18),
              usdcAmount: formatUnits((log.args as any).usdcReceived, 6),
              price: formatUnits((log.args as any).newPrice, 6),
              trader: (log.args as any).seller,
              timestamp: Number(block.timestamp) * 1000,
              txHash: log.transactionHash
            });
          }

          // Small delay to avoid hammering the RPC
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Sort by timestamp (newest first)
        allTrades.sort((a, b) => b.timestamp - a.timestamp);
        
        console.log(`✅ LOADED ${allTrades.length} HISTORICAL TRADES`);
        setRecentTrades(allTrades.slice(0, 100)); // Keep last 100
        setIsLoadingHistory(false);
      } catch (error) {
        console.error("❌ ERROR FETCHING HISTORICAL TRADES:", error);
        setIsLoadingHistory(false);
      }
    };

    fetchHistoricalTrades();
  }, [publicClient]);

  // Listen for SharesPurchased events
  useWatchContractEvent({
    address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
    abi: HondurasElectionABI,
    eventName: "SharesPurchased",
    onLogs(logs: any) {
      console.log("🟢 NEW BUY:", logs);
      const log = logs[0];
      const newTrade: RealtimeTrade = {
        type: "BUY",
        candidateId: Number(log.args.candidateId),
        shares: formatUnits(log.args.sharesReceived, 18),
        usdcAmount: formatUnits(log.args.usdcAmount, 6),
        price: formatUnits(log.args.newPrice, 6),
        trader: log.args.buyer,
        timestamp: Date.now(),
        txHash: log.transactionHash,
      };
      setRecentTrades((prev) => [newTrade, ...prev].slice(0, 100));
    },
  });

  // Listen for SharesSold events
  useWatchContractEvent({
    address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
    abi: HondurasElectionABI,
    eventName: "SharesSold",
    onLogs(logs: any) {
      console.log("🔴 NEW SELL:", logs);
      const log = logs[0];
      const newTrade: RealtimeTrade = {
        type: "SELL",
        candidateId: Number(log.args.candidateId),
        shares: formatUnits(log.args.sharesSold, 18),
        usdcAmount: formatUnits(log.args.usdcReceived, 6),
        price: formatUnits(log.args.newPrice, 6),
        trader: log.args.seller,
        timestamp: Date.now(),
        txHash: log.transactionHash,
      };
      setRecentTrades((prev) => [newTrade, ...prev].slice(0, 100));
    },
  });

  return { recentTrades, isLoadingHistory };
}
