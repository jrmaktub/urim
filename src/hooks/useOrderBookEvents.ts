import { useState, useEffect } from "react";
import { useWatchContractEvent, usePublicClient } from "wagmi";
import { formatUnits } from "viem";
import { base } from "wagmi/chains";
import { HONDURAS_ELECTION_ADDRESS } from "@/constants/hondurasElection";
import HondurasElectionABI from "@/contracts/HondurasElection.json";

export interface OrderBookEntry {
  type: "BID" | "ASK";
  price: number;
  shares: string;
  totalUSDC: string;
  trader: string;
  timestamp: number;
  blockNumber: number;
}

export function useOrderBookEvents(candidateId: number) {
  const [orders, setOrders] = useState<OrderBookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const publicClient = usePublicClient({ chainId: base.id });

  // Fetch historical events on mount
  useEffect(() => {
    const fetchHistoricalEvents = async () => {
      if (!publicClient) return;

      try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - BigInt(100000); // Last ~2 weeks

        console.log("📚 Fetching historical events for candidate", candidateId);

        // Fetch historical SharesPurchased events
        const purchaseEvents = await publicClient.getLogs({
          address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
          event: {
            type: 'event',
            name: 'SharesPurchased',
            inputs: [
              { indexed: true, name: 'buyer', type: 'address' },
              { indexed: true, name: 'candidateId', type: 'uint8' },
              { indexed: false, name: 'usdcAmount', type: 'uint256' },
              { indexed: false, name: 'sharesReceived', type: 'uint256' },
              { indexed: false, name: 'newPrice', type: 'uint256' },
            ],
          },
          fromBlock,
          toBlock: 'latest',
        });

        // Fetch historical SharesSold events
        const saleEvents = await publicClient.getLogs({
          address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
          event: {
            type: 'event',
            name: 'SharesSold',
            inputs: [
              { indexed: true, name: 'seller', type: 'address' },
              { indexed: true, name: 'candidateId', type: 'uint8' },
              { indexed: false, name: 'sharesSold', type: 'uint256' },
              { indexed: false, name: 'usdcReceived', type: 'uint256' },
              { indexed: false, name: 'newPrice', type: 'uint256' },
            ],
          },
          fromBlock,
          toBlock: 'latest',
        });

        const historicalOrders: OrderBookEntry[] = [];

        // Process purchase events
        purchaseEvents.forEach((event: any) => {
          if (Number(event.args.candidateId) === candidateId) {
            const shares = formatUnits(event.args.sharesReceived, 6);
            const price = Number(formatUnits(event.args.newPrice, 16));
            const totalUSDC = formatUnits(event.args.usdcAmount, 6);

            historicalOrders.push({
              type: "BID",
              price: Math.round(price * 100),
              shares,
              totalUSDC,
              trader: event.args.buyer,
              timestamp: Date.now(),
              blockNumber: Number(event.blockNumber),
            });
          }
        });

        // Process sale events
        saleEvents.forEach((event: any) => {
          if (Number(event.args.candidateId) === candidateId) {
            const shares = formatUnits(event.args.sharesSold, 6);
            const price = Number(formatUnits(event.args.newPrice, 16));
            const totalUSDC = formatUnits(event.args.usdcReceived, 6);

            historicalOrders.push({
              type: "ASK",
              price: Math.round(price * 100),
              shares,
              totalUSDC,
              trader: event.args.seller,
              timestamp: Date.now(),
              blockNumber: Number(event.blockNumber),
            });
          }
        });

        historicalOrders.sort((a, b) => b.blockNumber - a.blockNumber);
        console.log(`✅ Loaded ${historicalOrders.length} historical orders for candidate ${candidateId}`);
        setOrders(historicalOrders);
      } catch (error) {
        console.error("❌ Error fetching historical events:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistoricalEvents();
  }, [candidateId, publicClient]);

  // Watch for new SharesPurchased events
  useWatchContractEvent({
    address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
    abi: HondurasElectionABI,
    eventName: 'SharesPurchased',
    chainId: base.id,
    onLogs(logs) {
      console.log("🔴 NEW SharesPurchased event:", logs);
      
      logs.forEach((log: any) => {
        const eventCandidateId = Number(log.args.candidateId);
        
        if (eventCandidateId === candidateId) {
          const shares = formatUnits(log.args.sharesReceived, 6);
          const price = Number(formatUnits(log.args.newPrice, 16));
          const totalUSDC = formatUnits(log.args.usdcAmount, 6);

          const newOrder: OrderBookEntry = {
            type: "BID",
            price: Math.round(price * 100),
            shares,
            totalUSDC,
            trader: log.args.buyer,
            timestamp: Date.now(),
            blockNumber: Number(log.blockNumber),
          };

          console.log("✅ Adding new BID:", newOrder);
          setOrders((prev) => [newOrder, ...prev]);
        }
      });
    },
  });

  // Watch for new SharesSold events
  useWatchContractEvent({
    address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
    abi: HondurasElectionABI,
    eventName: 'SharesSold',
    chainId: base.id,
    onLogs(logs) {
      console.log("🟢 NEW SharesSold event:", logs);
      
      logs.forEach((log: any) => {
        const eventCandidateId = Number(log.args.candidateId);
        
        if (eventCandidateId === candidateId) {
          const shares = formatUnits(log.args.sharesSold, 6);
          const price = Number(formatUnits(log.args.newPrice, 16));
          const totalUSDC = formatUnits(log.args.usdcReceived, 6);

          const newOrder: OrderBookEntry = {
            type: "ASK",
            price: Math.round(price * 100),
            shares,
            totalUSDC,
            trader: log.args.seller,
            timestamp: Date.now(),
            blockNumber: Number(log.blockNumber),
          };

          console.log("✅ Adding new ASK:", newOrder);
          setOrders((prev) => [newOrder, ...prev]);
        }
      });
    },
  });

  return { orders, isLoading };
}
