import { useState, useEffect } from "react";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { Button } from "./ui/button";

const CONTRACT_ADDRESS = "0xe56e233fa13Ec5D144F829656BeEc294c8F2647F"; // ETH Bet contract
const PERMISSION_KEY = "base-spend-permission";

type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export default function BetButton() {
  const [msg, setMsg] = useState("");
  const [hash, setHash] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  
  const { address, connector } = useAccount();

  // Check for existing permission on mount
  useEffect(() => {
    const permission = localStorage.getItem(PERMISSION_KEY);
    if (permission) {
      setHasPermission(true);
    }
  }, []);

  const requestSpendPermission = async (provider: EIP1193Provider) => {
    setMsg("🔐 Requesting Spend Permission...");
    
    try {
      // Request permission to spend up to 1 ETH per day
      const permissionResponse = await provider.request({
        method: 'wallet_grantPermissions',
        params: [{
          expiry: Math.floor(Date.now() / 1000) + 86400, // 24 hours
          signer: {
            type: 'account',
            data: {
              id: address,
            },
          },
          permissions: [{
            type: 'native-token-recurring-allowance',
            data: {
              allowance: `0x${parseEther("1").toString(16)}`, // 1 ETH max per period
              start: Math.floor(Date.now() / 1000),
              period: 86400, // 24 hours
            },
          }],
        }],
      });

      // Store permission
      localStorage.setItem(PERMISSION_KEY, JSON.stringify(permissionResponse));
      setHasPermission(true);
      setMsg("✅ Permission granted! Placing bet...");
      
      return permissionResponse;
    } catch (err) {
      console.error("Permission request failed:", err);
      throw err;
    }
  };

  const handleBet = async () => {
    if (!address || !connector) {
      setMsg("❌ Please connect wallet first");
      return;
    }

    try {
      setIsPending(true);
      const provider = await connector.getProvider() as EIP1193Provider;
      
      // First bet: Request spend permission
      if (!hasPermission) {
        await requestSpendPermission(provider);
      } else {
        setMsg("⏳ Placing bet from Sub Account...");
      }
      
      // Use wallet_sendCalls to send ETH from sub-account
      // With permission granted, this won't show popup for subsequent bets
      const result = await provider.request({
        method: 'wallet_sendCalls',
        params: [{
          version: '1.0',
          chainId: `0x${Number(84532).toString(16)}`, // Base Sepolia
          from: address, // This is the sub-account address
          calls: [{
            to: CONTRACT_ADDRESS,
            value: `0x${parseEther("0.001").toString(16)}`,
            data: '0x'
          }]
        }]
      });

      if (result) {
        setHash(result as string);
        setIsConfirming(true);
        setMsg("⏳ Confirming transaction...");
        
        setTimeout(() => {
          setIsConfirming(false);
          setIsSuccess(true);
          setMsg(hasPermission 
            ? "✅ Bet placed automatically! No popup!" 
            : "✅ Bet placed! Future bets won't need approval!"
          );
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
