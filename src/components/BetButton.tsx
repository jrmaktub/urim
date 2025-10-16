import { useState, useEffect } from "react";
import { parseUnits } from "viem";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { Button } from "./ui/button";

const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC
const RECEIVER = "0x2177F513BA2a0746A22037Eb6626616e131eB69E"; // BetReceiver contract

const PLACE_BET_ABI = [{
  name: 'placeBet',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ],
  outputs: []
}] as const;

export default function BetButton() {
  const [msg, setMsg] = useState("");
  const { address } = useAccount();
  
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleBet = async () => {
    if (!address) {
      setMsg("❌ Please connect wallet first");
      return;
    }

    try {
      setMsg("⏳ Placing bet...");
      
      writeContract({
        account: address,
        chain: baseSepolia,
        address: RECEIVER,
        abi: PLACE_BET_ABI,
        functionName: 'placeBet',
        args: [USDC, parseUnits("0.1", 6)]
      });
      
    } catch (err) {
      console.error("❌ Bet failed:", err);
      setMsg("❌ Bet failed — check console.");
    }
  };

  // Update message based on transaction status
  useEffect(() => {
    if (isConfirming) {
      setMsg("⏳ Confirming transaction...");
    } else if (isSuccess) {
      setMsg("✅ Bet placed! Check Basescan.");
    }
  }, [isConfirming, isSuccess]);

  const loading = isPending || isConfirming;

  return (
    <div className="space-y-2">
      <Button
        onClick={handleBet}
        disabled={loading}
        className="w-full rounded-xl border border-primary/40 bg-background/50 text-foreground hover:bg-primary/20 disabled:opacity-50"
      >
        {loading ? "Processing…" : "Place Bet (0.1 USDC)"}
      </Button>
      {msg && <p className="text-xs text-muted-foreground text-center">{msg}</p>}
      {hash && (
        <a 
          href={`https://sepolia.basescan.org/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline block text-center"
        >
          View on Basescan →
        </a>
      )}
    </div>
  );
}
