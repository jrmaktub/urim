import { useState } from "react";
import { encodeFunctionData, parseUnits } from "viem";
import { useWalletClient } from "wagmi";
import { baseSepolia } from "viem/chains";
import { Button } from "./ui/button";

const OUR_MARKET_CONTRACT_ADDRESS = '0xdBaDF64Fd3070b18C036d477F0e203007BA8C692' as const;
const OUR_MARKET_CONTRACT_ABI = [
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
  
  const { data: walletClient } = useWalletClient();

  const handleFinalBet = async () => {
    if (!walletClient) {
      setMsg("❌ Wallet not connected");
      return;
    }

    setMsg("⏳ Placing USDC bet from Sub Account...");
    setLoading(true);

    try {
      // Get ALL accounts. For Sub Accounts, this returns [universal_address, sub_account_address].
      const accounts = await walletClient.request({ 
        method: 'eth_accounts',
        params: []
      }) as `0x${string}`[];
      
      if (!accounts || accounts.length < 2) {
        setMsg("❌ Sub Account not found. Please reconnect your wallet.");
        setLoading(false);
        return;
      }
      const subAccountAddress = accounts[1]; // The second address is the Sub Account.

      console.log(`Sending from Sub Account: ${subAccountAddress}`);

      // Define the transaction details
      const betAmount = parseUnits('1.0', 6); // 1 USDC

      const callData = encodeFunctionData({
        abi: OUR_MARKET_CONTRACT_ABI,
        functionName: 'placeBet',
        args: [betAmount],
      });

      // Build and send the wallet_sendCalls request
      const result = await walletClient.request({
        method: 'wallet_sendCalls',
        params: [{
          version: '2.0',
          from: subAccountAddress,
          chainId: `0x${baseSepolia.id.toString(16)}`,
          calls: [{
            to: OUR_MARKET_CONTRACT_ADDRESS,
            data: callData,
            value: '0x0',
          }],
        }],
      });

      console.log("SUCCESS! The transaction was sent. Calls ID:", result);
      setCallsId(result as string);
      setMsg("✅ Bet placed! Future bets won't need approval!");
      setLoading(false);

    } catch (error) {
      console.error("FINAL ATTEMPT FAILED:", error);
      setMsg(`❌ Bet failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
