import { useState } from "react";
import { baseSepolia } from "viem/chains";
import { encodeFunctionData, parseUnits, maxUint256 } from 'viem';
import { Button } from "./ui/button";
import { getBaseProvider } from "@/lib/baseAccount";

// --- OUR CONTRACT DETAILS ---
const OUR_CONTRACT_ADDRESS = '0xa926eD649871b21dd4C18AbD379fE82C8859b21E';
const OUR_CONTRACT_ABI = [{"inputs":[{"internalType":"uint256","name":"usdcAmount","type":"uint256"}],"name":"placeBet","outputs":[],"stateMutability":"nonpayable","type":"function"}] as const;
const USDC_TOKEN_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const ERC20_APPROVE_ABI = [{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"type":"function"}] as const;

// --- THE COMPLETE REACT COMPONENT ---
export default function BetButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [callsId, setCallsId] = useState<string | null>(null);

  // Main function for the "Place Bet" button
  const handleBet = async () => {
    setIsLoading(true);
    setStatus("⏳ Connecting...");

    try {
      // 1. Get the provider lazily to avoid cross-origin issues
      const provider = getBaseProvider();
      if (!provider) {
        setStatus("❌ Provider not available.");
        setIsLoading(false);
        return;
      }

      // 2. Connect and get Sub Account
      let accs = await provider.request({ method: "eth_accounts" }) as string[];
      if (accs.length < 2) {
        accs = await provider.request({ method: "eth_requestAccounts" }) as string[];
      }
      const subAccountAddress = accs[1]; // Sub account is the second account

      console.log(`Sending from Sub Account: ${subAccountAddress}`);
      setStatus("⏳ Preparing transaction...");

      // 2. Prepare the two calls: approve AND placeBet
      const betAmount = parseUnits('1.0', 6);

      // Call 1: Approve our contract to spend USDC
      const approveCallData = encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [OUR_CONTRACT_ADDRESS, maxUint256], // Approve a large amount
      });

      // Call 2: Place the actual bet
      const placeBetCallData = encodeFunctionData({
        abi: OUR_CONTRACT_ABI,
        functionName: 'placeBet',
        args: [betAmount],
      });

      setStatus("⏳ Placing bet...");

      // 3. Send both calls in a single batch transaction
      const result = await provider.request({
        method: "wallet_sendCalls",
        params: [{
          version: "2.0",
          from: subAccountAddress,
          chainId: `0x${baseSepolia.id.toString(16)}`,
          calls: [
            // First, approve the USDC token
            {
              to: USDC_TOKEN_ADDRESS,
              data: approveCallData,
              value: '0x0',
            },
            // Second, call our contract's placeBet function
            {
              to: OUR_CONTRACT_ADDRESS,
              data: placeBetCallData,
              value: '0x0',
            },
          ],
        }],
      }) as string;

      console.log("SUCCESS! Transaction sent. Calls ID:", result);
      setCallsId(result);
      setStatus("✅ Bet placed successfully!");

    } catch (error) {
      console.error("Bet placement failed:", error);
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleBet}
        disabled={isLoading}
        className="w-full rounded-xl border border-primary/40 bg-background/50 text-foreground hover:bg-primary/20 disabled:opacity-50"
      >
        {isLoading ? "Processing..." : "Place Bet (1 USDC)"}
      </Button>
      {status && <p className="text-xs text-muted-foreground text-center">{status}</p>}
      {callsId && (
        <p className="text-xs text-primary/80 text-center font-mono">
          Calls ID: {callsId.slice(0, 10)}...
        </p>
      )}
    </div>
  );
}
