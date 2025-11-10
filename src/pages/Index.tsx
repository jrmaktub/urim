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
import { initializeWithProvider, isInitialized, getUnifiedBalances } from "@/lib/nexus";
import { BridgeAndExecuteButton } from '@avail-project/nexus-widgets';
import { supabase } from "@/integrations/supabase/client";
import { optimismSepolia, baseSepolia } from 'wagmi/chains';
import Bridge from '@/components/BridgeButton';
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
  
  const [nexusInitialized, setNexusInitialized] = useState(false);
  const [processedBalances, setProcessedBalances] = useState<ProcessedBalance[]>([]);
  const [initializingNexus, setInitializingNexus] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());
  const [unifiedBalance, setUnifiedBalance] = useState<string>("0.00");
  

  const isOnOptimismSepolia = chain?.id === optimismSepolia.id;
  const { quantumMarketIds, everythingMarketIds } = useAllMarkets();

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
          // Stablecoins are already in USD
          return sum + balance;
        } else {
          // For other tokens, treat as USD value (you can add more conversions here)
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
      
      // Check if already initialized
      if (isInitialized()) {
        setNexusInitialized(true);
        await fetchBalances();
        return;
      }
      
      // Auto-initialize
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
      toast({ title: "🌉 Nexus Initialized", description: "Avail bridge ready!" });
    } catch (error: any) {
      console.error("Nexus init failed:", error);
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
      
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-12 text-center">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
          URIM
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          AI-powered quantum prediction markets on Base Sepolia
        </p>
      </section>

      {/* Main Content Area with Two-Column Layout */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* Main Content - Quantum Bets (Left/Primary) */}
          <div className="w-full lg:w-[60%] flex-shrink-0">
            <section className="max-w-2xl mx-auto">
              <QuantumBets />
            </section>
          </div>

          {/* Avail Nexus Integration Widget (Right Sidebar) */}
          {isConnected && (
            <aside className="w-full lg:w-[38%] lg:sticky lg:top-24">
              <div className="bg-black border border-purple-500/50 rounded-lg p-5 shadow-xl shadow-purple-500/10 animate-fade-in">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-purple-600/20 to-purple-700/20 border border-purple-500/30">
                      <Zap className="w-4 h-4 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-bold">⚡ Avail Nexus</h3>
                  </div>
                  {nexusInitialized && (
                    <Button
                      onClick={fetchBalances}
                      disabled={balanceLoading}
                      variant="ghost"
                      size="sm"
                      className="text-purple-400 hover:text-purple-300"
                    >
                      <RefreshCw className={`w-3 h-3 ${balanceLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mb-4">
                  Cross-chain unified balance
                </p>

                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-1">Unified Balance</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {balanceLoading || initializingNexus ? (
                      <span className="text-sm">Loading...</span>
                    ) : (
                      `$${unifiedBalance}`
                    )}
                  </p>
                </div>

                {nexusInitialized && (
                  <div className="space-y-3">
                    {balanceLoading ? (
                      <div className="flex items-center justify-center gap-2 py-6">
                        <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-muted-foreground">Loading...</span>
                      </div>
                    ) : balanceError ? (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                        <p className="text-red-400 text-xs">{balanceError}</p>
                      </div>
                    ) : processedBalances.length === 0 ? (
                      <div className="p-4 rounded-lg bg-gradient-to-r from-purple-600/10 to-purple-700/10 border border-purple-500/20 text-center">
                        <p className="text-muted-foreground text-xs">No balances found</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {processedBalances.map((token) => {
                          const isExpanded = expandedTokens.has(token.symbol);
                          
                          return (
                            <div key={token.symbol} className="rounded-lg border border-purple-500/20 overflow-hidden">
                              <button
                                onClick={() => toggleTokenExpansion(token.symbol)}
                                className="w-full p-3 bg-gradient-to-r from-purple-600/10 to-purple-700/10 hover:from-purple-600/15 hover:to-purple-700/15 transition-all flex items-center justify-between"
                              >
                                <div className="flex items-center gap-2">
                                  {token.icon && (
                                    <img src={token.icon} alt={token.symbol} className="w-6 h-6 rounded-full" />
                                  )}
                                  <div className="text-left">
                                    <span className="font-bold text-sm">{token.symbol}</span>
                                    <div className="text-lg font-bold text-purple-400">
                                      {parseFloat(token.totalBalance).toFixed(6)}
                                    </div>
                                  </div>
                                </div>
                                <ChevronUp className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? '' : 'rotate-180'}`} />
                              </button>
                              
                              {isExpanded && (
                                <div className="p-3 bg-background/50 space-y-1.5">
                                  {token.chains.map((chainBal, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-gray-500/20 to-gray-600/20 border border-gray-500/30"
                                    >
                                      <div className="flex items-center gap-2">
                                        {chainBal.icon && (
                                          <img src={chainBal.icon} alt={chainBal.chainName} className="w-4 h-4 rounded-full" />
                                        )}
                                        <span className="text-xs font-medium">{chainBal.chainName}</span>
                                      </div>
                                      <span className="text-xs font-bold">
                                        {parseFloat(chainBal.balance).toFixed(6)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="pt-3 border-t border-purple-500/20">
                      <div className="text-xs text-muted-foreground text-center mb-2">
                        Bridge from Optimism Sepolia
                      </div>
                    <Bridge/>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
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