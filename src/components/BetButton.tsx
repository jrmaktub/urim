import { useState } from "react";
import { encodeFunctionData, parseUnits } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { baseSepolia } from "viem/chains";
import { Button } from "./ui/button";

const NEW_CONTRACT_ADDRESS = '0xa926eD649871b21dd4C18AbD379fE82C8859b21E' as const;
const NEW_CONTRACT_ABI = [
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
  }
] as const;

export default function BetButton() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [callsId, setCallsId] = useState<string | null>(null);
  
  const { address: subAccountAddress } = useAccount();
  const { data: walletClient } = useWalletClient();

  const handleFinalBet = async () => {
    if (!walletClient || !subAccountAddress) {
      setMsg("❌ Sub Account not found. Reconnect wallet.");
      return;
    }

    setLoading(true);
    setMsg("⏳ Placing bet...");

    try {
      const betAmount = parseUnits('1.0', 6); // 1 USDC
      const callData = encodeFunctionData({
        abi: NEW_CONTRACT_ABI,
        functionName: 'placeBet',
        args: [betAmount],
      });

      // This triggers the Auto Spend Permissions pop-up
      const result = await walletClient.request({
        method: 'wallet_sendCalls',
        params: [{
          version: '2.0',
          from: subAccountAddress,
          chainId: `0x${baseSepolia.id.toString(16)}`,
          calls: [{
            to: NEW_CONTRACT_ADDRESS,
            data: callData,
            value: '0x0',
          }],
        }],
      });

      console.log("SUCCESS! Transaction sent. Calls ID:", result);
      setCallsId(result as string);
      setMsg("✅ Bet placed successfully!");
      setLoading(false);

    } catch (error) {
      console.error("FAILED:", error);
      setMsg(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleFinalBet}
        disabled={loading}
        className="w-full rounded-xl border border-primary/40 bg-background/50 text-foreground hover:bg-primary/20 disabled:opacity-50"
      >
        {loading ? "Processing…" : "Place Bet (1 USDC)"}
      </Button>
      {msg && <p className="text-xs text-muted-foreground text-center">{msg}</p>}
      {callsId && (
        <p className="text-xs text-primary/80 text-center font-mono">
          Calls ID: {callsId.slice(0, 10)}...
        </p>
      )}
    </div>
  );
}
