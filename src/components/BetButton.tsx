import { useState } from "react";
import { encodeFunctionData, parseUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { createBaseAccountSDK } from "@base-org/account";
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

  const handleFinalBet = async () => {
    setLoading(true);
    setMsg("⏳ Initializing SDK...");

    try {
      // 1. Initialize a fresh, raw SDK instance
      const sdk = createBaseAccountSDK({
        appName: "Urim",
        appChainIds: [baseSepolia.id],
        subAccounts: {
          creation: 'on-connect',
          defaultAccount: 'sub',
        },
      });
      const provider = sdk.getProvider();

      // 2. Connect and get the accounts directly from the raw provider
      setMsg("⏳ Connecting to Sub Account...");
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      if (!accounts || accounts.length < 2) {
        setMsg("❌ Sub Account not found. The provider did not return two accounts.");
        setLoading(false);
        return;
      }
      const subAccountAddress = accounts[1]; // Sub account is the second account

      console.log(`Sending from Sub Account: ${subAccountAddress}`);

      // 3. Define the transaction details
      setMsg("⏳ Placing bet...");
      const betAmount = parseUnits('1.0', 6);
      const callData = encodeFunctionData({
        abi: NEW_CONTRACT_ABI,
        functionName: 'placeBet',
        args: [betAmount],
      });

      // 4. Send the wallet_sendCalls request using the raw provider
      const result = await provider.request({
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
      console.error("FINAL ATTEMPT FAILED:", error);
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
