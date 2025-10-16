import { useState } from "react";
import { encodeFunctionData, parseUnits } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { baseSepolia } from "viem/chains";
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
  const [loading, setLoading] = useState(false);
  const [callsId, setCallsId] = useState<string | null>(null);
  
  const { address: subAccountAddress } = useAccount();
  const { data: walletClient } = useWalletClient();

  // The SDK will automatically trigger the "Skip further approvals" popup
  // when the Sub Account needs funds for the first USDC transaction
  const handleBet = async () => {
    if (!walletClient || !subAccountAddress) {
      setMsg("❌ Please connect wallet first");
      return;
    }

    setMsg("⏳ Placing USDC bet from Sub Account...");
    setLoading(true);
    
    const betAmountString = '1.0';
    const usdcDecimals = 6;
    const betAmount = parseUnits(betAmountString, usdcDecimals);

    try {
      console.log(`Sending transaction from Sub Account: ${subAccountAddress}`);

      // Manually encode the function call data for placeBet
      const callData = encodeFunctionData({
        abi: NEW_URIM_CONTRACT_ABI,
        functionName: 'placeBet',
        args: [betAmount],
      });

      // Use wallet_sendCalls - this triggers Auto Spend Permissions
      const result = await walletClient.request({
        method: 'wallet_sendCalls',
        params: [{
          version: '2.0',
          from: subAccountAddress,
          chainId: `0x${baseSepolia.id.toString(16)}`,
          calls: [{
            to: NEW_URIM_CONTRACT_ADDRESS,
            data: callData,
            value: '0x0',
          }],
        }],
      });

      console.log("wallet_sendCalls successful! Calls ID:", result);
      setCallsId(result as string);
      setMsg("✅ Bet placed! Future bets won't need approval!");
      setLoading(false);

    } catch (error) {
      console.error("wallet_sendCalls failed:", error);
      setMsg("❌ Bet failed — check console.");
      setLoading(false);
    }
  };

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
      {callsId && (
        <p className="text-xs text-primary/80 text-center font-mono">
          Calls ID: {callsId.slice(0, 10)}...
        </p>
      )}
    </div>
  );
}
