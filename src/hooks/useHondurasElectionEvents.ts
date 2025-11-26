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
      if (!publicClient) return;
      
      setIsLoading(true);
      try {
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
          fromBlock: BigInt(0),
          toBlock: 'latest',
        });

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
          fromBlock: BigInt(0),
          toBlock: 'latest',
        });

        // Process purchase events (Bids)
        const bids: OrderBookEntry[] = purchaseEvents
          .filter((event: any) => Number(event.args.candidateId) === candidateId)
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

        // Process sale events (Asks)
        const asks: OrderBookEntry[] = saleEvents
          .filter((event: any) => Number(event.args.candidateId) === candidateId)
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

        // Combine and sort by timestamp (most recent first)
        const allOrders = [...bids, ...asks].sort((a, b) => b.timestamp - a.timestamp);
        setOrders(allOrders);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [candidateId, publicClient]);

  return { orders, isLoading };
}
