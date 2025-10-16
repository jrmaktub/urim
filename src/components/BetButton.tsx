import { useState } from "react";
import { baseSepolia } from "viem/chains";
import { encodeFunctionData, parseUnits, maxUint256, decodeFunctionResult } from 'viem';
import { Button } from "./ui/button";
import { getBaseProvider } from "@/lib/baseAccount";

// --- CONTRACT DETAILS ---
const OUR_CONTRACT_ADDRESS = '0xa926eD649871b21dd4C18AbD379fE82C8859b21E';
const OUR_CONTRACT_ABI = [{"inputs":[{"internalType":"uint256","name":"usdcAmount","type":"uint256"}],"name":"placeBet","outputs":[],"stateMutability":"nonpayable","type":"function"}] as const;
const USDC_TOKEN_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const ERC20_ABI = [
  {"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"type":"function"},
  {"constant":true,"inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"type":"function"}
] as const;

// --- THE COMPLETE REACT COMPONENT ---
export default function BetButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [callsId, setCallsId] = useState<string | null>(null);

  // Main function for the "Place Bet" button
  const handleBet = async () => {
    try {
      setIsLoading(true);
      setStatus("🔵 Connecting Base Smart Wallet...");

      // 1. Get the provider (initializes SDK with Sub Accounts)
      const provider = getBaseProvider();
      if (!provider) {
        throw new Error("Provider not available");
      }

      // 2. Connect and get Sub Account (Auto Spend enabled)
      setStatus("🟣 Requesting accounts...");
      let accs = await provider.request({ method: "eth_accounts" }) as string[];
      if (accs.length < 2) {
        accs = await provider.request({ method: "eth_requestAccounts" }) as string[];
      }
      
      const universalAccount = accs[0];
      const subAccountAddress = accs[1]; // Sub account is the second account

      console.log("🔵 Universal Account:", universalAccount);
      console.log("🟢 Sub Account (Auto-Spend):", subAccountAddress);
      
      setStatus("⏳ Checking USDC allowance...");

      // 3. Check current allowance
      const betAmount = parseUnits('1.0', 6);
      const allowanceCallData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [subAccountAddress as `0x${string}`, OUR_CONTRACT_ADDRESS as `0x${string}`],
      });

      const allowanceResult = await provider.request({
        method: "eth_call",
        params: [{
          to: USDC_TOKEN_ADDRESS,
          data: allowanceCallData,
        }, "latest"],
      }) as string;

      const currentAllowance = BigInt(allowanceResult);
      console.log(`💰 Current USDC allowance: ${currentAllowance.toString()}`);

      // 4. Prepare calls array
      const calls = [];

      // Add approve call if needed
      if (currentAllowance < betAmount) {
        console.log("⚠️ Insufficient allowance, adding approve call");
        setStatus("🟣 Approving USDC (first time enables Auto-Spend)...");
        
        const approveCallData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [OUR_CONTRACT_ADDRESS as `0x${string}`, maxUint256],
        });

        calls.push({
          to: USDC_TOKEN_ADDRESS,
          data: approveCallData,
          value: '0x0',
        });
      }

      // Add placeBet call
      const placeBetCallData = encodeFunctionData({
        abi: OUR_CONTRACT_ABI,
        functionName: 'placeBet',
        args: [betAmount],
      });

      calls.push({
        to: OUR_CONTRACT_ADDRESS,
        data: placeBetCallData,
        value: '0x0',
      });

      setStatus("⚙️ Placing bet with Auto-Spend...");

      // 5. Send transaction with wallet_sendCalls v2.0.0 (enables auto-spend)
      const result = await provider.request({
        method: "wallet_sendCalls",
        params: [{
          version: "2.0.0", // ✅ Critical: Use 2.0.0 for auto-spend permissions
          atomicRequired: true,
          chainId: `0x${baseSepolia.id.toString(16)}`,
          from: subAccountAddress,
          calls,
        }],
      }) as string;

      console.log("✅ Bet Tx:", result);
      console.log("✅ Auto-Spend enabled! Future transactions won't need approval.");
      setCallsId(result);
      setStatus("✅ Bet placed successfully! Auto-Spend enabled.");

    } catch (error) {
      console.error("❌ Error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`❌ Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 p-6 bg-background/30 rounded-2xl border border-primary/20">
      <Button
        onClick={handleBet}
        disabled={isLoading}
        size="lg"
        className="w-full rounded-xl text-lg"
      >
        {isLoading ? "Processing..." : "Place Bet (1 USDC)"}
      </Button>
      {status && (
        <p className="text-sm text-muted-foreground text-center">{status}</p>
      )}
      {callsId && (
        <p className="text-xs text-primary font-mono text-center break-all px-2">
          TX: {callsId}
        </p>
      )}
    </div>
  );
}
