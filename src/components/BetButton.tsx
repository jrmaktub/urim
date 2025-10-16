import { useState, useEffect } from "react";
import { encodeFunctionData, parseUnits, maxUint256 } from "viem";
import { useAccount, useWalletClient, useReadContract } from "wagmi";
import { baseSepolia } from "viem/chains";
import { Button } from "./ui/button";

const USDC_TOKEN_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
const OUR_MARKET_CONTRACT_ADDRESS = '0xdBaDF64Fd3070b18C036d477F0e203007BA8C692' as const;

const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  }
] as const;

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
  }
] as const;

export default function BetButton() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [callsId, setCallsId] = useState<string | null>(null);
  const [hasAllowance, setHasAllowance] = useState(false);
  const [isCheckingAllowance, setIsCheckingAllowance] = useState(true);
  
  const { address: subAccountAddress } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Continuously check the USDC allowance for our contract
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: subAccountAddress ? [subAccountAddress, OUR_MARKET_CONTRACT_ADDRESS] : undefined,
    query: {
      enabled: !!subAccountAddress,
    }
  });

  // Update state whenever the allowance changes
  useEffect(() => {
    if (currentAllowance !== undefined) {
      setIsCheckingAllowance(false);
      const requiredAmount = parseUnits('1.0', 6);
      setHasAllowance(BigInt(currentAllowance.toString()) >= requiredAmount);
    }
  }, [currentAllowance]);

  const handleSmartBet = async () => {
    if (!walletClient || !subAccountAddress) {
      setMsg("❌ Wallet not connected");
      return;
    }

    setLoading(true);

    try {
      if (hasAllowance) {
        // We have allowance, so place the bet
        setMsg("⏳ Placing bet...");
        console.log("Allowance sufficient. Placing bet...");
        
        const betAmount = parseUnits('1.0', 6);
        const callData = encodeFunctionData({
          abi: OUR_MARKET_CONTRACT_ABI,
          functionName: 'placeBet',
          args: [betAmount]
        });

        const result = await walletClient.request({
          method: 'wallet_sendCalls',
          params: [{
            version: '2.0',
            from: subAccountAddress,
            chainId: `0x${baseSepolia.id.toString(16)}`,
            calls: [{
              to: OUR_MARKET_CONTRACT_ADDRESS,
              data: callData,
              value: '0x0'
            }],
          }],
        });

        console.log("Bet placed! Calls ID:", result);
        setCallsId(result as string);
        setMsg("✅ Bet placed successfully!");
        
      } else {
        // We don't have allowance, so request it
        setMsg("⏳ Requesting approval...");
        console.log("Allowance needed. Requesting approval...");
        
        const approveCallData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [OUR_MARKET_CONTRACT_ADDRESS, maxUint256]
        });

        await walletClient.request({
          method: 'wallet_sendCalls',
          params: [{
            version: '2.0',
            from: subAccountAddress,
            chainId: `0x${baseSepolia.id.toString(16)}`,
            calls: [{
              to: USDC_TOKEN_ADDRESS,
              data: approveCallData,
              value: '0x0'
            }],
          }],
        });

        setMsg("✅ Approval successful! Click again to place bet.");
        refetchAllowance();
      }

      setLoading(false);

    } catch (error) {
      console.error("Action failed:", error);
      setMsg(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  const getButtonText = () => {
    if (loading) return "Processing…";
    if (isCheckingAllowance) return "Checking permissions…";
    return hasAllowance ? "Place Bet (1 USDC)" : "Approve USDC to Bet";
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleSmartBet}
        disabled={loading || isCheckingAllowance}
        className="w-full rounded-xl border border-primary/40 bg-background/50 text-foreground hover:bg-primary/20 disabled:opacity-50"
      >
        {getButtonText()}
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
