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
  txHash: string;
}

const BASESCAN_API_KEY = "6VT5S4WW78C4WSEPS1NTUEJAP4GE4XMQP8";

export function useOrderBookEvents(candidateId: number) {
  const [orders, setOrders] = useState<OrderBookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        console.log("🔍 FETCHING TRANSACTIONS FROM BASESCAN");
        
        // Get internal transactions (contract calls)
        const url = `https://api.basescan.org/api?module=account&action=txlist&address=${HONDURAS_ELECTION_ADDRESS}&startblock=0&endblock=99999999&sort=desc&apikey=${BASESCAN_API_KEY}`;
        
        console.log("Fetching from:", url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log("BaseScan response:", data);
        
        if (data.status === "1" && data.result) {
          const txs = data.result;
          console.log(`✅ GOT ${txs.length} TRANSACTIONS`);
          console.log("First transaction:", txs[0]);
          
          // Show ALL successful transactions as orders
          const allOrders: OrderBookEntry[] = txs
            .filter((tx: any) => tx.isError === "0")
            .slice(0, 50) // Show last 50
            .map((tx: any, idx: number) => {
              // Parse the input to determine buy/sell
              const isBuy = tx.input.includes("0x5d77c4d6"); // buyShares method ID
              
              return {
                type: isBuy ? "BID" : "ASK",
                price: 33, // Will parse later
                shares: "1.00",
                totalUSDC: (Number(tx.value) / 1e18).toFixed(4),
                trader: tx.from,
                timestamp: new Date(Number(tx.timeStamp) * 1000).toLocaleTimeString(),
                blockNumber: Number(tx.blockNumber),
                txHash: tx.hash,
              };
            });
          
          console.log(`✅ PROCESSED ${allOrders.length} ORDERS`);
          setOrders(allOrders);
        } else {
          console.error("❌ BaseScan returned error:", data.message);
        }
      } catch (error) {
        console.error("❌ FETCH ERROR:", error);
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
