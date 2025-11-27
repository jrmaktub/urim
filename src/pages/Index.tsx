import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useSwitchChain, useWalletClient } from "wagmi";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Zap, RefreshCw, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAllMarkets } from "@/hooks/useMarkets";
import { URIM_QUANTUM_MARKET_ADDRESS, URIM_MARKET_ADDRESS, USDC_ADDRESS, QUANTUM_BET_ADDRESS } from "@/constants/contracts";
import UrimQuantumMarketABI from "@/contracts/UrimQuantumMarket.json";
import UrimMarketABI from "@/contracts/UrimMarket.json";
import QuantumBetABI from "@/contracts/QuantumBet.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { parseUnits } from "viem";
// import { initializeWithProvider, isInitialized, getUnifiedBalances } from "@/lib/nexus";
// import { BridgeAndExecuteButton } from '@avail-project/nexus-widgets';
import { supabase } from "@/integrations/supabase/client";
import { optimismSepolia, baseSepolia } from 'wagmi/chains';
// import Bridge from '@/components/BridgeButton';
import { useNotification } from "@blockscout/app-sdk";

import ActiveQuantumMarkets from "@/components/ActiveQuantumMarkets";
import QuantumBets from "@/components/QuantumBets";


type ProcessedBalance = {
  symbol: string;
  icon: string;
  totalBalance: string;
  chains: {
    chainName: string;
    balance: string;
    icon: string;
  }[];
};

const Index = () => {
  const { switchChain } = useSwitchChain();
  const { address, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const { openTxToast } = useNotification();  
  const [question, setQuestion] = useState("");
  const [duration, setDuration] = useState("1"); // Duration in days
  const [generating, setGenerating] = useState(false);
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [betAmounts, setBetAmounts] = useState<string[]>(["", ""]);
  const [bettingIdx, setBettingIdx] = useState<number | null>(null);
  const [bridgingIdx, setBridgingIdx] = useState<number | null>(null);
  const [creatingQuantumMarket, setCreatingQuantumMarket] = useState(false);
  const [refreshMarkets, setRefreshMarkets] = useState(0);
  
  // const [nexusInitialized, setNexusInitialized] = useState(false);
  // const [processedBalances, setProcessedBalances] = useState<ProcessedBalance[]>([]);
  // const [initializingNexus, setInitializingNexus] = useState(false);
  // const [balanceLoading, setBalanceLoading] = useState(false);
  // const [balanceError, setBalanceError] = useState<string | null>(null);
  // const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());
  // const [unifiedBalance, setUnifiedBalance] = useState<string>("0.00");
  

  const isOnOptimismSepolia = chain?.id === optimismSepolia.id;
  const { quantumMarketIds, everythingMarketIds } = useAllMarkets();

  // const fetchBalances = async () => {
  //   if (!isInitialized()) {
  //     return;
  //   }
  //   
  //   setBalanceLoading(true);
  //   setBalanceError(null);
  //   
  //   try {
  //     const rawBalances = await getUnifiedBalances();
  //     console.log('Raw Data:', rawBalances);
  //     
  //     const processed: ProcessedBalance[] = rawBalances
  //       .filter((token: any) => parseFloat(token.balance) > 0)
  //       .map((token: any) => {
  //         const chainsWithBalance = token.breakdown
  //           .filter((chain: any) => parseFloat(chain.balance) > 0)
  //           .map((chain: any) => ({
  //             chainName: chain.chain.name || 'Unknown Chain',
  //             balance: chain.balance,
  //             icon: chain.chain.logo,
  //           }));
  //
  //         return {
  //           symbol: token.symbol,
  //           icon: token.icon,
  //           totalBalance: token.balance,
  //           chains: chainsWithBalance,
  //         };
  //       });
  //
  //     console.log('Processed Data for UI:', processed);
  //     setProcessedBalances(processed);
  //     
  //     const totalUSD = rawBalances.reduce((sum: number, token: any) => {
  //       const balance = parseFloat(token.balance || "0");
  //       if (token.symbol === 'USDC' || token.symbol === 'USDT' || token.symbol === 'DAI') {
  //         return sum + balance;
  //       } else {
  //         return sum + balance;
  //       }
  //     }, 0);
  //     setUnifiedBalance(totalUSD.toFixed(2));
  //   } catch (e: any) {
  //     console.error("Failed to fetch balances:", e);
  //     setBalanceError(e.message || "Failed to fetch balance");
  //     setProcessedBalances([]);
  //     setUnifiedBalance("0.00");
  //   } finally {
  //     setBalanceLoading(false);
  //   }
  // };

  // useEffect(() => {
  //   const autoInit = async () => {
  //     if (!isConnected || !walletClient) return;
  //     
  //     if (isInitialized()) {
  //       setNexusInitialized(true);
  //       await fetchBalances();
  //       return;
  //     }
  //     
  //     try {
  //       setInitializingNexus(true);
  //       await initializeWithProvider(walletClient);
  //       setNexusInitialized(true);
  //       await fetchBalances();
  //       console.log("✅ Auto-initialized");
  //     } catch (error) {
  //       console.error("Auto-init failed:", error);
  //     } finally {
  //       setInitializingNexus(false);
  //     }
  //   };
  //   
  //   autoInit();
  // }, [isConnected, walletClient]);


  // const handleInitNexus = async () => {
  //   if (!walletClient) {
  //     toast({ title: "Connect wallet first", variant: "destructive" });
  //     return;
  //   }
  //
  //   setInitializingNexus(true);
  //   setBalanceError(null);
  //   try {
  //     await initializeWithProvider(walletClient);
  //     setNexusInitialized(true);
  //     await fetchBalances();
  //     toast({ title: "🌉 Initialized", description: "Bridge ready!" });
  //   } catch (error: any) {
  //     console.error("Init failed:", error);
  //     setBalanceError(error.message || "Initialization failed");
  //     toast({ title: "Initialization failed", description: error.message, variant: "destructive" });
  //   } finally {
  //     setInitializingNexus(false);
  //   }
  // };

  // const toggleTokenExpansion = (token: string) => {
  //   const newExpanded = new Set(expandedTokens);
  //   if (newExpanded.has(token)) {
  //     newExpanded.delete(token);
  //   } else {
  //     newExpanded.add(token);
  //   }
  //   setExpandedTokens(newExpanded);
  // };

  const handleGenerate = async () => {
    if (!question.trim()) {
      toast({ title: "Enter a question", variant: "destructive" });
      return;
    }

    if (!address) {
      toast({ title: "Connect Wallet", description: "Please connect your wallet first.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setCreatingQuantumMarket(true);

    try {
      toast({ title: "Creating Quantum Market...", description: "Confirm transaction in wallet" });

      const durationSeconds = BigInt(Number(duration) * 86400); // Convert days to seconds

      const hash = await writeContractAsync({
        address: QUANTUM_BET_ADDRESS as `0x${string}`,
        abi: QuantumBetABI.abi as any,
        functionName: "createMarket",
        args: [question.trim(), durationSeconds],
      } as any);

      openTxToast("84532", hash);

      toast({
        title: "✅ Market Created!",
        description: "Your market is now live",
      });

      // Clear form and refresh markets
      setQuestion("");
      setDuration("1");
      setTimeout(() => setRefreshMarkets(prev => prev + 1), 2000);

    } catch (error: any) {
      console.error("Market creation error:", error);
      toast({
        title: "❌ Market creation failed",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
      setCreatingQuantumMarket(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-purple-950/10">
      <Navigation />
      
      <section className="max-w-4xl mx-auto px-6 pt-28 sm:pt-32 pb-12 text-center">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
          URIM
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          AI-powered quantum prediction markets on Base Sepolia
        </p>
      </section>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <section>
          <QuantumBets />
        </section>
      </div>


      {/* Active Quantum Markets */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <ActiveQuantumMarkets key={refreshMarkets} />
      </section>

      <Footer />
    </div>
  );
};

export default Index;