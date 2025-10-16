import { useState, useEffect } from "react";
import { parseEther } from "viem";
import { useSendTransaction, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { Button } from "./ui/button";

const CONTRACT_ADDRESS = "0xe56e233fa13Ec5D144F829656BeEc294c8F2647F"; // ETH Bet contract

export default function BetButton() {
  const [msg, setMsg] = useState("");
  const { address } = useAccount();
  
  const { sendTransaction, data: hash, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleBet = async () => {
    if (!address) {
      setMsg("❌ Please connect wallet first");
      return;
    }

    try {
      setMsg("⏳ Placing bet...");
      
      sendTransaction({
        to: CONTRACT_ADDRESS,
        value: parseEther("0.001")
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
        {loading ? "Processing…" : "Place Bet (0.001 ETH)"}
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
