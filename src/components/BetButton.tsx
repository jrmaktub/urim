import { useState, useEffect } from "react";
import { parseUnits } from "viem";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "./ui/button";

const NEW_URIM_CONTRACT_ADDRESS = '0xdBaDF64Fd3070b18C036d477F0e203007BA8C692' as const;
const NEW_URIM_CONTRACT_ABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "usdcAmount",
        "type": "uint256"
      }
    ],
    "name": "placeBet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "BetPlaced",
    "type": "event"
  }
] as const;

export default function BetButton() {
  const [msg, setMsg] = useState("");
  
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // The SDK will automatically trigger the "Skip further approvals" popup
  // when the Sub Account needs funds for the first USDC transaction
  const handleBet = async () => {
    if (!address) {
      setMsg("❌ Please connect wallet first");
      return;
    }

    setMsg("⏳ Placing USDC bet from Sub Account...");
    
    const betAmountString = '1.0';
    const usdcDecimals = 6;
    
    // Call the new USDC contract's placeBet function
    writeContract({
      address: NEW_URIM_CONTRACT_ADDRESS,
      abi: NEW_URIM_CONTRACT_ABI,
      functionName: 'placeBet',
      args: [parseUnits(betAmountString, usdcDecimals)],
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
        {loading ? "Processing…" : "Place Bet (1 USDC)"}
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
