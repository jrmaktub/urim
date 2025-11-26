import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
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
}

export function useHondurasElectionEvents(candidateId: number) {
  const [orders, setOrders] = useState<OrderBookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const publicClient = usePublicClient({ chainId: base.id });

  useEffect(() => {
    const fetchEvents = async () => {
      if (!publicClient) {
        console.log("⚠️ No public client available");
        return;
      }
      
      setIsLoading(true);
      try {
        // Get current block to fetch recent events only
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - BigInt(100000); // Last ~2 weeks on Base
        
        console.log("🔍 Fetching events for candidate:", candidateId);
        console.log("📊 Block range:", fromBlock.toString(), "to", currentBlock.toString());
        console.log("📍 Contract:", HONDURAS_ELECTION_ADDRESS);
        
        // Fetch SharesPurchased events (Bids)
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

        console.log(`✅ Fetched ${purchaseEvents.length} purchase events`);

        // Fetch SharesSold events (Asks)
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

        console.log(`✅ Fetched ${saleEvents.length} sale events`);

        // Process purchase events (Bids)
        const bids: OrderBookEntry[] = purchaseEvents
          .filter((event: any) => {
            const eventCandidateId = Number(event.args.candidateId);
            console.log(`📝 Purchase event: candidate ${eventCandidateId}, buyer ${event.args.buyer}`);
            return eventCandidateId === candidateId;
          })
          .map((event: any) => {
            const shares = formatUnits(event.args.sharesReceived, 6);
            const price = Number(formatUnits(event.args.newPrice, 16));
            const totalUSDC = formatUnits(event.args.usdcAmount, 6);
            
            return {
              type: "BID" as const,
              price: Math.round(price * 100),
              shares,
              totalUSDC,
              trader: event.args.buyer,
              timestamp: Number(event.blockNumber),
            };
          });

        console.log(`✅ Processed ${bids.length} bids for candidate ${candidateId}`);

        // Process sale events (Asks)
        const asks: OrderBookEntry[] = saleEvents
          .filter((event: any) => {
            const eventCandidateId = Number(event.args.candidateId);
            console.log(`📝 Sale event: candidate ${eventCandidateId}, seller ${event.args.seller}`);
            return eventCandidateId === candidateId;
          })
          .map((event: any) => {
            const shares = formatUnits(event.args.sharesSold, 6);
            const price = Number(formatUnits(event.args.newPrice, 16));
            const totalUSDC = formatUnits(event.args.usdcReceived, 6);
            
            return {
              type: "ASK" as const,
              price: Math.round(price * 100),
              shares,
              totalUSDC,
              trader: event.args.seller,
              timestamp: Number(event.blockNumber),
            };
          });

        console.log(`✅ Processed ${asks.length} asks for candidate ${candidateId}`);

        // Combine and sort by timestamp (most recent first)
        const allOrders = [...bids, ...asks].sort((a, b) => b.timestamp - a.timestamp);
        console.log(`📦 Total orders:`, allOrders.length);
        setOrders(allOrders);
      } catch (error) {
        console.error("❌ Error fetching events:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [candidateId, publicClient]);

  return { orders, isLoading };
}
