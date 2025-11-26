import { useState } from "react";
import { useWatchContractEvent } from "wagmi";
import { HONDURAS_ELECTION_ADDRESS } from "@/constants/hondurasElection";
import HondurasElectionABI from "@/contracts/HondurasElection.json";
import { formatUnits } from "viem";

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
        shares: formatUnits(log.args.shareAmount, 18),
        usdcAmount: formatUnits(log.args.cost, 6),
        price: formatUnits(log.args.newPrice, 6),
        trader: log.args.buyer,
        timestamp: Date.now(),
        txHash: log.transactionHash,
      };
      setRecentTrades((prev) => [newTrade, ...prev].slice(0, 20));
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
        shares: formatUnits(log.args.shareAmount, 18),
        usdcAmount: formatUnits(log.args.payout, 6),
        price: formatUnits(log.args.newPrice, 6),
        trader: log.args.seller,
        timestamp: Date.now(),
        txHash: log.transactionHash,
      };
      setRecentTrades((prev) => [newTrade, ...prev].slice(0, 20));
    },
  });

  return { recentTrades };
}
