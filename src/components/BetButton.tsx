import { createBaseAccountSDK } from "@base-org/account";
import { useEffect, useState } from "react";
import { baseSepolia } from "viem/chains";
import { encodeFunctionData, parseUnits } from 'viem';
import { Button } from "./ui/button";

// --- TYPE DEFINITIONS FROM THE DOCS ---
interface SubAccount {
  address: `0x${string}`;
}
interface GetSubAccountsResponse {
  subAccounts: SubAccount[];
}
interface WalletAddSubAccountResponse {
  address: `0x${string}`;
}

// --- OUR CONTRACT DETAILS ---
const OUR_CONTRACT_ADDRESS = '0xa926eD649871b21dd4C18AbD379fE82C8859b21E';
const OUR_CONTRACT_ABI = [{"inputs":[{"internalType":"uint256","name":"usdcAmount","type":"uint256"}],"name":"placeBet","outputs":[],"stateMutability":"nonpayable","type":"function"}] as const;

// --- THE COMPLETE REACT COMPONENT ---
export default function BetButton() {
  const [provider, setProvider] = useState<any>(null);
  const [subAccount, setSubAccount] = useState<SubAccount | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("Initialize SDK to start");
  const [callsId, setCallsId] = useState<string | null>(null);

  // 1. INITIALIZE THE SDK ON COMPONENT MOUNT
  useEffect(() => {
    const sdkInstance = createBaseAccountSDK({
      appName: "Urim",
      appChainIds: [baseSepolia.id],
      subAccounts: {
        creation: 'on-connect',
        defaultAccount: 'sub',
      },
    });
    const providerInstance = sdkInstance.getProvider();
    setProvider(providerInstance);
    setStatus("Ready to connect");
  }, []);

  // 2. CONNECT WALLET AND FIND/CREATE SUB ACCOUNT
  const connectAndSetup = async () => {
    if (!provider) return;
    setIsLoading(true);
    setStatus("Connecting...");
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      const universalAddr = accounts[0];
      setIsConnected(true);

      const response = await provider.request({
        method: "wallet_getSubAccounts",
        params: [{ account: universalAddr, domain: window.location.origin }],
      }) as GetSubAccountsResponse;
      const existingSubAccount = response.subAccounts[0];

      if (existingSubAccount) {
        setSubAccount(existingSubAccount);
        setStatus("Ready to Bet");
      } else {
        setStatus("Creating Sub Account...");
        const newSubAccount = await provider.request({
          method: "wallet_addSubAccount",
          params: [{ account: { type: 'create' } }],
        }) as WalletAddSubAccountResponse;
        setSubAccount({ address: newSubAccount.address });
        setStatus("Ready to Bet");
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. PLACE THE BET FROM THE SUB ACCOUNT
  const placeBet = async () => {
    if (!provider || !subAccount) return;
    setIsLoading(true);
    setStatus("Placing bet...");
    try {
      const betAmount = parseUnits('1.0', 6);
      const callData = encodeFunctionData({
        abi: OUR_CONTRACT_ABI,
        functionName: 'placeBet',
        args: [betAmount],
      });

      const result = await provider.request({
        method: "wallet_sendCalls",
        params: [{
          version: "2.0",
          from: subAccount.address,
          chainId: `0x${baseSepolia.id.toString(16)}`,
          calls: [{ to: OUR_CONTRACT_ADDRESS, data: callData, value: '0x0' }],
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

  // 4. RENDER THE CORRECT BUTTON BASED ON STATE
  if (!isConnected) {
    return (
      <div className="space-y-2">
        <Button
          onClick={connectAndSetup}
          disabled={isLoading}
          className="w-full rounded-xl border border-primary/40 bg-background/50 text-foreground hover:bg-primary/20 disabled:opacity-50"
        >
          {isLoading ? "Connecting..." : "Connect Wallet to Bet"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">{status}</p>
      </div>
    );
  }
  
  if (!subAccount) {
    return (
      <div className="space-y-2">
        <Button
          onClick={connectAndSetup}
          disabled={isLoading}
          className="w-full rounded-xl border border-primary/40 bg-background/50 text-foreground hover:bg-primary/20 disabled:opacity-50"
        >
          {isLoading ? "Creating Account..." : "Setup Account to Bet"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">{status}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      <Button
        onClick={placeBet}
        disabled={isLoading}
        className="w-full rounded-xl border border-primary/40 bg-background/50 text-foreground hover:bg-primary/20 disabled:opacity-50"
      >
        {isLoading ? "Processing..." : "Place Bet (1 USDC)"}
      </Button>
      <p className="text-xs text-muted-foreground text-center">{status}</p>
      {callsId && (
        <p className="text-xs text-primary/80 text-center font-mono">
          Calls ID: {callsId.slice(0, 10)}...
        </p>
      )}
    </div>
  );
}
