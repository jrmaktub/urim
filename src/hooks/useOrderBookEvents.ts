import { useState, useEffect } from "react";
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

const BASESCAN_API_KEY = "6VT5S4WW78C4WSEPS1NTUEJAP4GE4XMQP8";

export function useOrderBookEvents(candidateId: number) {
  const [orders, setOrders] = useState<OrderBookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        console.log("🔍 Fetching transactions from BaseScan for candidate", candidateId);
        
        // Fetch all transactions for the contract
        const response = await fetch(
          `https://api.basescan.org/api?module=account&action=txlist&address=${HONDURAS_ELECTION_ADDRESS}&startblock=0&endblock=99999999&sort=desc&apikey=${BASESCAN_API_KEY}`
        );

        const data = await response.json();
        
        if (data.status !== "1") {
          console.error("❌ BaseScan error:", data.message);
          setIsLoading(false);
          return;
        }

        const transactions = data.result || [];
        console.log(`✅ Found ${transactions.length} total transactions`);
        console.log("First 5 transactions:", transactions.slice(0, 5));

        // For now, just show ALL transactions as buys
        const allOrders: OrderBookEntry[] = transactions
          .filter((tx: any) => tx.isError === "0" && tx.to.toLowerCase() === HONDURAS_ELECTION_ADDRESS.toLowerCase())
          .slice(0, 20)
          .map((tx: any, idx: number) => ({
            type: idx % 2 === 0 ? "BID" : "ASK",
            price: 33,
            shares: (Number(tx.value) / 1e18).toFixed(2),
            totalUSDC: (Number(tx.gasPrice) * Number(tx.gasUsed) / 1e18).toFixed(6),
            trader: tx.from,
            timestamp: new Date(Number(tx.timeStamp) * 1000).toLocaleTimeString(),
            blockNumber: Number(tx.blockNumber),
          }));

        console.log(`✅ Processed ${allOrders.length} orders`);
        setOrders(allOrders);
      } catch (error) {
        console.error("❌ Error fetching transactions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchTransactions, 10000);
    return () => clearInterval(interval);
  }, [candidateId]);

  return { orders, isLoading };
}
