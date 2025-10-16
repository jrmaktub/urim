import { useState, useEffect } from "react";
import { parseEther } from "viem";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "./ui/button";

const CONTRACT_ADDRESS = "0xe56e233fa13Ec5D144F829656BeEc294c8F2647F"; // ETH Bet contract

export default function BetButton() {
  const [msg, setMsg] = useState("");
  
  const { address } = useAccount();
  const { sendTransaction, data: hash, isPending, error } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // The SDK will automatically trigger the "Skip further approvals" popup
  // when the Sub Account needs funds for the first transaction
  const handleBet = async () => {
    if (!address) {
      setMsg("❌ Please connect wallet first");
      return;
    }

    setMsg("⏳ Placing bet from Sub Account...");
    
    // Simply send the transaction - the baseAccount connector
    // will automatically handle Sub Account creation and permissions
    sendTransaction({
      to: CONTRACT_ADDRESS,
      value: parseEther("0.001"),
    });
  };

  // Update message based on transaction status
  useEffect(() => {
    if (error) {
      setMsg("❌ Bet failed — check console.");
      console.error("Transaction error:", error);
    } else if (isConfirming) {
      setMsg("⏳ Confirming transaction...");
    } else if (isSuccess) {
      setMsg("✅ Bet placed! Future bets won't need approval!");
    }
  }, [error, isConfirming, isSuccess]);

  const loading = isPending || isConfirming;
  const explorerUrl = hash ? `https://sepolia.basescan.org/tx/${hash}` : null;

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
      {explorerUrl && (
        <a 
          href={explorerUrl}
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
