import { useState, useEffect } from "react";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { Button } from "./ui/button";

const CONTRACT_ADDRESS = "0xe56e233fa13Ec5D144F829656BeEc294c8F2647F"; // ETH Bet contract

export default function BetButton() {
  const [msg, setMsg] = useState("");
  const [hash, setHash] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const { address, connector } = useAccount();

  const handleBet = async () => {
    if (!address || !connector) {
      setMsg("❌ Please connect wallet first");
      return;
    }

    try {
      setMsg("⏳ Placing bet from Sub Account...");
      setIsPending(true);
      
      const provider = await connector.getProvider();
      
      // Type assertion for provider with request method
      type EIP1193Provider = {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
      
      // Use wallet_sendCalls to send ETH from sub-account
      const result = await (provider as EIP1193Provider).request({
        method: 'wallet_sendCalls',
        params: [{
          version: '1.0',
          chainId: `0x${Number(84532).toString(16)}`, // Base Sepolia
          from: address, // This is the sub-account address
          calls: [{
            to: CONTRACT_ADDRESS,
            value: `0x${parseEther("0.001").toString(16)}`, // Convert to hex string with 0x prefix
            data: '0x' // No calldata, just sending ETH
          }]
        }]
      });

      if (result) {
        setHash(result as string);
        setIsConfirming(true);
        setMsg("⏳ Confirming transaction...");
        
        // Wait a bit then mark as success
        setTimeout(() => {
          setIsConfirming(false);
          setIsSuccess(true);
          setMsg("✅ Bet placed! Check Basescan.");
        }, 3000);
      }
      
    } catch (err) {
      console.error("❌ Bet failed:", err);
      setMsg("❌ Bet failed — check console.");
    } finally {
      setIsPending(false);
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
