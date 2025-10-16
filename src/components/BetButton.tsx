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
    setIsLoading(true);
    setStatus("⏳ Connecting Base Smart Wallet...");

    try {
      // 1. Get the provider lazily to avoid cross-origin issues
      const provider = getBaseProvider();
      if (!provider) {
        setStatus("❌ Provider not available.");
        setIsLoading(false);
        return;
      }

      // 2. Connect and get Sub Account (with auto-spend permissions)
      let accs = await provider.request({ method: "eth_accounts" }) as string[];
      if (accs.length < 2) {
        accs = await provider.request({ method: "eth_requestAccounts" }) as string[];
      }
      
      const universalAccount = accs[0];
      const subAccountAddress = accs[1]; // Sub account is the second account

      console.log(`🔵 Universal Account: ${universalAccount}`);
      console.log(`🟢 Sub Account: ${subAccountAddress}`);
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
      console.log(`Current USDC allowance: ${currentAllowance.toString()}`);

      // 4. Prepare calls array
      const calls = [];

      // Add approve call if needed
      if (currentAllowance < betAmount) {
        console.log("⚠️ Insufficient allowance, adding approve call");
        setStatus("⏳ Approving USDC...");
        
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

      setStatus("⏳ Placing bet with Auto-Spend...");

      // 5. Send transaction with wallet_sendCalls v2.0.0 (enables auto-spend)
      const result = await provider.request({
        method: "wallet_sendCalls",
        params: [{
          version: "2.0.0", // ✅ Critical: Use 2.0.0 for auto-spend permissions
          atomicRequired: true,
          from: subAccountAddress,
          chainId: `0x${baseSepolia.id.toString(16)}`,
          calls,
        }],
      }) as string;

      console.log("✅ SUCCESS! Transaction sent. Calls ID:", result);
      console.log("🎉 Auto-Spend enabled! Future bets won't need approval.");
      setCallsId(result);
      setStatus("✅ Bet placed! Auto-Spend enabled.");

    } catch (error) {
      console.error("❌ Bet placement failed:", error);
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
