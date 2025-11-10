/**
 * ARCHIVED AVAIL NEXUS CODE BACKUP
 * This file contains all the removed Avail Nexus integration code
 * Archived on: 2025-11-10
 * DO NOT DELETE - Kept for reference
 */

// ============ ARCHIVED COMPONENTS ============

// WalletBridge.tsx
export const ArchivedWalletBridge = `
import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useNexus } from '@avail-project/nexus-widgets';

/**
 * CRITICAL: This component bridges the gap between RainbowKit/Wagmi and Nexus SDK
 * It manually sets the wallet provider so Nexus can detect it
 */
export function WalletBridge() {
  const { connector, isConnected } = useAccount();
  const { setProvider } = useNexus();

  useEffect(() => {
    if (isConnected && connector?.getProvider) {
      console.log('🌉 Setting provider for Nexus SDK...');
      connector.getProvider().then((provider:any) => {
        console.log('✅ Provider set:', provider);
        setProvider(provider);
      });
    }
  }, [isConnected, connector, setProvider]);

  return null; // This component doesn't render anything
}

export default WalletBridge;
`;

// de-init-button.tsx
export const ArchivedDeinitButton = `
'use client';
 
import { deinit, isInitialized } from '../lib/nexus';
 
export default function DeinitButton({
  className,
  onDone,
}: { className?: string; onDone?: () => void }) {
  const onClick = async () => {
    await deinit();
    onDone?.();
    alert('Nexus de-initialized');
  };
  return <button className={className} onClick={onClick} disabled={!isInitialized()}>De-initialize</button>;
}
`;

// init-button.tsx
export const ArchivedInitButton = `
'use client';
 
import { useAccount } from 'wagmi';
import { initializeWithProvider, isInitialized } from '../lib/nexus';
 
export default function InitButton({
  className,
  onReady,
}: { className?: string; onReady?: () => void }) {
  const { connector } = useAccount();
  
  const onClick = async () => {
    try {
      // Get the provider from the connected wallet
      const provider = await connector?.getProvider();
      if (!provider) throw new Error('No provider found');
      
      // We're calling our wrapper function from the lib/nexus.ts file here.
      await initializeWithProvider(provider);
      onReady?.();
      alert('Nexus initialized');
    } catch (e: any) {
      alert(e?.message ?? 'Init failed');
    }
  };
  return <button className={className} onClick={onClick} disabled={isInitialized()}>Initialize Nexus</button>;
}
`;

// BridgeButton.tsx
export const ArchivedBridgeButton = `
import { BridgeButton } from '@avail-project/nexus-widgets';
import { useAccount, useSwitchChain } from 'wagmi';
import { optimismSepolia } from 'wagmi/chains';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';

function Bridge() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const [bridgeAmount, setBridgeAmount] = useState("1");
  
  const isOnCorrectChain = chain?.id === optimismSepolia.id;

  if (!isConnected) {
    return (
      <div className="glass-card p-6 border-2 border-red-500/30 bg-gradient-to-r from-red-500/10 to-red-600/10">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400 font-medium">
            Please connect your wallet first
          </p>
        </div>
      </div>
    );
  }

  if (!isOnCorrectChain) {
    return (
      <div className="glass-card p-6 space-y-4">
        <div className="p-4 rounded-lg bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-medium mb-1">
                You need to be on Optimism Sepolia to bridge to Base Sepolia
              </p>
              <p className="text-sm text-yellow-400/80">
                Current network: {chain?.name}
              </p>
            </div>
          </div>
        </div>
        
        <Button
          onClick={() => switchChain({ chainId: optimismSepolia.id })}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          size="lg"
        >
          Switch to Optimism Sepolia
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Amount to Bridge
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={bridgeAmount}
            onChange={(e) => setBridgeAmount(e.target.value)}
            placeholder="1.0"
            className="flex-1 h-12 text-lg bg-background/50"
            min="0"
            step="0.1"
          />
          <span className="text-sm font-bold text-muted-foreground px-3">USDC</span>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-purple-400">From:</span> Optimism Sepolia → <span className="font-medium text-purple-400">To:</span> Base Sepolia
        </p>
      </div>

      <BridgeButton
        prefill={{
          chainId: 84532,
          token: 'USDC',
          amount: bridgeAmount || '1',
        }}
      >
        {({ onClick, isLoading }) => (
          <Button
            onClick={onClick}
            disabled={isLoading || !bridgeAmount || parseFloat(bridgeAmount) <= 0}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
            size="lg"
          >
            {isLoading ? '⏳ Bridging…' : \`🌉 Bridge \${bridgeAmount || '0'} USDC to Base Sepolia\`}
          </Button>
        )}
      </BridgeButton>
    </div>
  );
}

export default Bridge;
`;

// BridgeAndExecute.tsx
export const ArchivedBridgeAndExecute = `
import { BridgeAndExecuteButton } from '@avail-project/nexus-widgets';
import { useAccount, useSwitchChain } from 'wagmi';
import { optimismSepolia } from 'wagmi/chains';
import { Button } from '@/components/ui/button';
import { AlertCircle, ExternalLink } from 'lucide-react';

// Contract ABI for the buyScenarioShares function
const QUANTUM_MARKET_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "marketId", type: "uint256" },
      { internalType: "uint8", name: "scenarioIndex", type: "uint8" },
      { internalType: "uint256", name: "usdcAmount", type: "uint256" }
    ],
    name: "buyScenarioShares",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];

function BridgeAndExecute() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  
  const isOnCorrectChain = chain?.id === optimismSepolia.id;

  if (!isConnected) {
    return (
      <div className="glass-card p-6 border-2 border-red-500/30 bg-gradient-to-r from-red-500/10 to-red-600/10">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400 font-medium">
            Please connect your wallet first
          </p>
        </div>
      </div>
    );
  }

  if (!isOnCorrectChain) {
    return (
      <div className="glass-card p-6 space-y-4">
        <div className="p-4 rounded-lg bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-medium mb-1">
                You need to be on Optimism Sepolia to bridge to Base Sepolia
              </p>
              <p className="text-sm text-yellow-400/80">
                Current network: {chain?.name}
              </p>
            </div>
          </div>
        </div>
        
        <Button
          onClick={() => switchChain({ chainId: optimismSepolia.id })}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          size="lg"
        >
          Switch to Optimism Sepolia
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30">
        <h3 className="font-bold text-blue-400 mb-2">⚠️ Manual USDC Approval Workaround</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Due to a known bug, you must manually approve USDC before bridging.
        </p>
        <ol className="text-xs text-muted-foreground space-y-1.5 mb-3 list-decimal list-inside">
          <li>Go to Optimism Sepolia Etherscan USDC contract</li>
          <li>Click "Write Contract" → "approve"</li>
          <li>Spender: <code className="text-purple-400">0x123...</code> (bridge address)</li>
          <li>Amount: 1000000 (for 1 USDC)</li>
          <li>Click "Write" and confirm</li>
        </ol>
        <a
          href="https://sepolia-optimism.etherscan.io/address/0x5fd84259d66Cd46123540766Be93DFE6D43130D7#writeContract"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Open Etherscan
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <BridgeAndExecuteButton
        contractAddress="0xYOUR_QUANTUM_MARKET_CONTRACT"
        contractAbi={QUANTUM_MARKET_ABI}
        functionName="buyScenarioShares"
        prefill={{
          chainId: 84532,
          token: 'USDC',
          amount: '1',
        }}
        args={[1, 0, 1000000]}
      >
        {({ onClick, isLoading }) => (
          <Button
            onClick={onClick}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
            size="lg"
          >
            {isLoading ? '⏳ Processing…' : '🌉 Bridge & Execute'}
          </Button>
        )}
      </BridgeAndExecuteButton>
    </div>
  );
}

export default BridgeAndExecute;
`;

// ============ ARCHIVED LIB CODE ============

// lib/nexus.ts
export const ArchivedNexusLib = `
 import { NexusSDK } from '@avail-project/nexus-core';

 export const sdk = new NexusSDK({ network: 'testnet' });

// Thin wrapper that calls sdk.isInitialized() from the SDK
export function isInitialized() {
  return sdk.isInitialized();
}
 
export async function initializeWithProvider(provider: any) {
  if (!provider) throw new Error('No EIP-1193 provider (e.g., MetaMask) found');
  
  //If the SDK is already initialized, return
  if (sdk.isInitialized()) return;
 
  //If the SDK is not initialized, initialize it with the provider passed as a parameter
  await sdk.initialize(provider);
}
 
export async function deinit() {
  
  //If the SDK is not initialized, return
  if (!sdk.isInitialized()) return;
 
  //If the SDK is initialized, de-initialize it
  await sdk.deinit();
}
 
export async function getUnifiedBalances() {
 
  //Get the unified balances from the SDK
  return await sdk.getUnifiedBalances();
}
`;

// ============ ARCHIVED INDEX.TSX NEXUS CODE ============

export const ArchivedIndexNexusCode = `
// State variables for Nexus
const [nexusInitialized, setNexusInitialized] = useState(false);
const [processedBalances, setProcessedBalances] = useState<ProcessedBalance[]>([]);
const [initializingNexus, setInitializingNexus] = useState(false);
const [balanceLoading, setBalanceLoading] = useState(false);
const [balanceError, setBalanceError] = useState<string | null>(null);
const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());
const [unifiedBalance, setUnifiedBalance] = useState<string>("0.00");

// Fetch balances function
const fetchBalances = async () => {
  if (!isInitialized()) {
    return;
  }
  
  setBalanceLoading(true);
  setBalanceError(null);
  
  try {
    const rawBalances = await getUnifiedBalances();
    console.log('Raw Data from Nexus:', rawBalances);
    
    const processed: ProcessedBalance[] = rawBalances
      .filter((token: any) => parseFloat(token.balance) > 0)
      .map((token: any) => {
        const chainsWithBalance = token.breakdown
          .filter((chain: any) => parseFloat(chain.balance) > 0)
          .map((chain: any) => ({
            chainName: chain.chain.name || 'Unknown Chain',
            balance: chain.balance,
            icon: chain.chain.logo,
          }));

        return {
          symbol: token.symbol,
          icon: token.icon,
          totalBalance: token.balance,
          chains: chainsWithBalance,
        };
      });

    console.log('Processed Data for UI:', processed);
    setProcessedBalances(processed);
    
    // Calculate unified balance in USD
    const totalUSD = rawBalances.reduce((sum: number, token: any) => {
      const balance = parseFloat(token.balance || "0");
      if (token.symbol === 'USDC' || token.symbol === 'USDT' || token.symbol === 'DAI') {
        return sum + balance;
      } else {
        return sum + balance;
      }
    }, 0);
    setUnifiedBalance(totalUSD.toFixed(2));
  } catch (e: any) {
    console.error("Failed to fetch balances:", e);
    setBalanceError(e.message || "Failed to fetch balance");
    setProcessedBalances([]);
    setUnifiedBalance("0.00");
  } finally {
    setBalanceLoading(false);
  }
};

// Auto-initialize Nexus on wallet connection
useEffect(() => {
  const autoInitNexus = async () => {
    if (!isConnected || !walletClient) return;
    
    if (isInitialized()) {
      setNexusInitialized(true);
      await fetchBalances();
      return;
    }
    
    try {
      setInitializingNexus(true);
      await initializeWithProvider(walletClient);
      setNexusInitialized(true);
      await fetchBalances();
      console.log("✅ Nexus auto-initialized");
    } catch (error) {
      console.error("Auto-init failed:", error);
    } finally {
      setInitializingNexus(false);
    }
  };
  
  autoInitNexus();
}, [isConnected, walletClient]);

const handleInitNexus = async () => {
  if (!walletClient) {
    toast({ title: "Connect wallet first", variant: "destructive" });
    return;
  }

  setInitializingNexus(true);
  setBalanceError(null);
  try {
    await initializeWithProvider(walletClient);
    setNexusInitialized(true);
    await fetchBalances();
    toast({ title: "🌉 Bridge Initialized", description: "Cross-chain bridge ready!" });
  } catch (error: any) {
    console.error("Bridge init failed:", error);
    setBalanceError(error.message || "Initialization failed");
    toast({ title: "Initialization failed", description: error.message, variant: "destructive" });
  } finally {
    setInitializingNexus(false);
  }
};

const toggleTokenExpansion = (token: string) => {
  const newExpanded = new Set(expandedTokens);
  if (newExpanded.has(token)) {
    newExpanded.delete(token);
  } else {
    newExpanded.add(token);
  }
  setExpandedTokens(newExpanded);
};
`;

// ============ ARCHIVED APP.TSX NEXUS CODE ============

export const ArchivedAppNexusCode = `
import { NexusProvider } from '@avail-project/nexus-widgets';
import type { NexusNetwork } from '@avail-project/nexus-widgets';
import WalletBridge from './components/WalletBridge';

interface Web3ContextValue {
  network: NexusNetwork;
  setNetwork: React.Dispatch<React.SetStateAction<NexusNetwork>>;
}

const [network, setNetwork] = useState<NexusNetwork>('testnet');
const value = useMemo(() => ({ network, setNetwork }), [network]);

// In JSX:
<NexusProvider
  config={{
    debug: true,
    network: network,
  }}
>
  {/* CRITICAL: This component sets the provider for Nexus */}
  <WalletBridge />
  
  {/* Rest of app */}
</NexusProvider>
`;

// ============ ARCHIVED FOOTER TEXT ============

export const ArchivedFooterText = `
<span className="text-muted-foreground">Cross-Chain Transactions by <span className="text-primary font-semibold">Avail</span></span>

Urim is an AI-powered quantum prediction market built on Base, with live oracle data from Pyth Network, verified infrastructure by Avail, and transparent blockchain exploration via Blockscout.

Powered by Pyth Network | Avail | Blockscout | Base Sepolia
`;

// ============ END OF ARCHIVED CODE ============

export default {
  ArchivedWalletBridge,
  ArchivedDeinitButton,
  ArchivedInitButton,
  ArchivedBridgeButton,
  ArchivedBridgeAndExecute,
  ArchivedNexusLib,
  ArchivedIndexNexusCode,
  ArchivedAppNexusCode,
  ArchivedFooterText,
};
