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
import PythPriceTicker from "@/components/PythPriceTicker";
import { EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";
import { initializeWithProvider, isInitialized, getUnifiedBalances } from "@/lib/nexus";
import { BridgeAndExecuteButton } from '@avail-project/nexus-widgets';
import { supabase } from "@/integrations/supabase/client";
import { optimismSepolia, baseSepolia } from 'wagmi/chains';
import Bridge from '@/components/BridgeButton';
import { useNotification } from "@blockscout/app-sdk";

import LiveQuantumMarkets from "@/components/LiveQuantumMarkets";
import ActiveQuantumMarkets from "@/components/ActiveQuantumMarkets";

const ETH_USD_PRICE_FEED = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const connection = new EvmPriceServiceConnection("https://hermes.pyth.network");

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
  
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [pythMarkets, setPythMarkets] = useState<Array<{
    id: string;
    question: string;
    threshold: number;
    marketId: bigint | null;
    selectedOutcome: 'yes' | 'no' | null;
    betAmount: string;
    creating: boolean;
    betting: boolean;
    bridging: boolean;
  }>>([]);

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
        if (token.symbol === 'ETH' || token.symbol === 'WETH') {
          // Convert ETH to USD using current price
          return sum + (balance * currentPrice);
        } else if (token.symbol === 'USDC' || token.symbol === 'USDT' || token.symbol === 'DAI') {
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

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const priceFeeds = await connection.getLatestPriceFeeds([ETH_USD_PRICE_FEED]);
        if (priceFeeds && priceFeeds.length > 0) {
          const priceFeed = priceFeeds[0];
          const price = priceFeed.getPriceUnchecked();
          const formattedPrice = Number(price.price) * Math.pow(10, price.expo);
          setCurrentPrice(formattedPrice);

          // Initialize at least 2 Pyth markets on first price fetch
          if (pythMarkets.length === 0 && formattedPrice > 0) {
            const roundedPrice = Math.round(formattedPrice);
            const aboveThreshold = roundedPrice + Math.round(formattedPrice * 0.02);
            const belowThreshold = roundedPrice - Math.round(formattedPrice * 0.02);

            setPythMarkets([
              {
                id: 'pyth-above',
                question: `Will ETH close above $${aboveThreshold} tomorrow?`,
                threshold: aboveThreshold,
                marketId: null,
                selectedOutcome: null,
                betAmount: '',
                creating: false,
                betting: false,
                bridging: false,
              },
              {
                id: 'pyth-below',
                question: `Will ETH close below $${belowThreshold} tomorrow?`,
                threshold: belowThreshold,
                marketId: null,
                selectedOutcome: null,
                betAmount: '',
                creating: false,
                betting: false,
                bridging: false,
              }
            ]);
          }
        }
      } catch (error) {
        console.error("Error fetching price:", error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 10000);
    return () => clearInterval(interval);
  }, [pythMarkets.length]);

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

  // Handler to create UrimMarket for Pyth cards
  const createPythMarket = async (marketIndex: number) => {
    if (!address) {
      toast({ title: "Connect Wallet", description: "Please connect your wallet first.", variant: "destructive" });
      return;
    }

    const market = pythMarkets[marketIndex];
    if (!market) return;

    setPythMarkets(prev => prev.map((m, i) => i === marketIndex ? { ...m, creating: true } : m));

    try {
      toast({ title: "Creating Pyth Market...", description: "Confirm transaction in wallet" });

      const duration = BigInt(24 * 60 * 60); // 24 hours
      const priceFeedId = ETH_USD_PRICE_FEED as `0x${string}`;
      // Convert threshold to Pyth price format (price * 10^8)
      const targetPrice = BigInt(Math.round(market.threshold * 1e8));

      const hash = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "createMarket",
        args: [market.question, "Yes", "No", duration, priceFeedId, targetPrice],
        gas: BigInt(3_000_000),
      } as any);

      openTxToast("84532", hash);

      // Wait a bit for the blockchain to update, then fetch new market ID
      setTimeout(() => {
        if (quantumMarketIds && quantumMarketIds.length > 0) {
          const newMarketId = quantumMarketIds[quantumMarketIds.length - 1];
          setPythMarkets(prev => prev.map((m, i) => 
            i === marketIndex ? { ...m, marketId: newMarketId, creating: false } : m
          ));
        }
      }, 2000);
    } catch (error: any) {
      console.error("Error creating Pyth market:", error);
      toast({
        title: "Transaction failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setPythMarkets(prev => prev.map((m, i) => i === marketIndex ? { ...m, creating: false } : m));
    }
  };

  // Handler for primary Place Bet button (Pyth cards)
  const handlePythPlaceBet = async (marketIndex: number) => {
    const market = pythMarkets[marketIndex];
    if (!address || !market.marketId || !market.selectedOutcome || !market.betAmount) {
      toast({ title: "Missing Information", description: "Please select an outcome and enter bet amount.", variant: "destructive" });
      return;
    }

    setPythMarkets(prev => prev.map((m, i) => i === marketIndex ? { ...m, betting: true } : m));

    try {
      const amountWei = parseUnits(market.betAmount, 6);
      const outcomeIndex = market.selectedOutcome === 'yes' ? 0 : 1;

      // Approve USDC
      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_QUANTUM_MARKET_ADDRESS, amountWei],
      } as any);

      // Place bet
      const hash = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyScenarioShares",
        args: [market.marketId, BigInt(outcomeIndex), amountWei],
        gas: BigInt(3_000_000),
      } as any);

      openTxToast("84532", hash);

      setPythMarkets(prev => prev.map((m, i) => i === marketIndex ? { ...m, betAmount: '', betting: false } : m));
    } catch (error: any) {
      console.error("Error placing bet:", error);
      toast({
        title: "Transaction failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setPythMarkets(prev => prev.map((m, i) => i === marketIndex ? { ...m, betting: false } : m));
    }
  };

  // Handler for secondary Bridge & Bet button (Pyth cards)
  const handlePythBridgeAndBet = async (marketIndex: number) => {
    const market = pythMarkets[marketIndex];
    if (!address || !market.marketId || !market.selectedOutcome || !market.betAmount) {
      toast({ title: "Missing Information", description: "Please select an outcome and enter bet amount.", variant: "destructive" });
      return;
    }

    setPythMarkets(prev => prev.map((m, i) => i === marketIndex ? { ...m, bridging: true } : m));

    try {
      toast({ title: "🌉 Bridging with Avail...", description: "This may take a moment" });
      
      // For now, fall back to direct bet (bridge+execute integration to be added)
      await handlePythPlaceBet(marketIndex);
    } catch (error: any) {
      console.error("Bridge failed:", error);
      toast({
        title: "Bridge failed",
        description: "You can still place a bet directly.",
        variant: "destructive",
      });
      setPythMarkets(prev => prev.map((m, i) => i === marketIndex ? { ...m, bridging: false } : m));
    }
  };


  const threshold = Math.round(currentPrice + (currentPrice * 0.02));

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-purple-950/10">
      <Navigation />
      
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-12 text-center">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
          URIM
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Quantum prediction markets powered by AI and Pyth oracles
        </p>
      </section>

      {/* Main Content Area with Two-Column Layout */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* Main Content - Quantum Bets (Left/Primary) */}
          <div className="w-full lg:w-[60%] flex-shrink-0">
            <section className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 mb-4">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider">AI-Powered</span>
                </div>
                <h2 className="text-4xl font-bold mb-3">🧠 Quantum Bets</h2>
                <p className="text-muted-foreground text-lg">AI generates possible futures. You bet on outcomes.</p>
              </div>

        <div className="glass-card p-8 space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Describe your scenario:
            </label>
            <Input 
              placeholder="Will the Dodgers win the October 27 series?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              className="h-14 text-base bg-background/50"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Market Duration:
            </label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="h-14 text-base bg-background/50">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Day</SelectItem>
                <SelectItem value="2">2 Days</SelectItem>
                <SelectItem value="3">3 Days</SelectItem>
                <SelectItem value="7">7 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={generating || !question.trim()}
            className="w-full"
            size="lg"
          >
            {generating ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                Generating Market...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Quantum Market
              </>
            )}
          </Button>
        </div>

        {/* Active Quantum Markets Section */}
        <div className="mt-12">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-3">✨ Active Quantum Markets</h2>
            <p className="text-muted-foreground text-lg">Markets created by users like you</p>
          </div>
          <ActiveQuantumMarkets key={refreshMarkets} />
        </div>
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

      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider">Oracle-Powered</span>
          </div>
          <h2 className="text-4xl font-bold mb-3">✦ Quantum Pyth</h2>
          <p className="text-muted-foreground text-lg">AI-generated futures from live Pyth price feeds.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {pythMarkets.map((market, marketIndex) => (
            <div key={market.id} className="glass-card p-6">
              <div className="text-lg font-semibold mb-4">{market.question}</div>
              
              {!market.marketId ? (
                <Button 
                  onClick={() => createPythMarket(marketIndex)}
                  disabled={market.creating}
                  className="w-full bg-gradient-to-r from-primary to-primary-glow"
                >
                  {market.creating ? "Creating Market..." : "Create Market"}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      className={`border-2 transition-all ${
                        market.selectedOutcome === 'yes'
                          ? 'border-green-500 bg-green-500/20' 
                          : 'border-green-500/50 hover:bg-green-500/10'
                      }`}
                      onClick={() => setPythMarkets(prev => prev.map((m, i) => 
                        i === marketIndex ? { ...m, selectedOutcome: 'yes' } : m
                      ))}
                    >
                      Yes
                    </Button>
                    <Button 
                      variant="outline"
                      className={`border-2 transition-all ${
                        market.selectedOutcome === 'no'
                          ? 'border-red-500 bg-red-500/20' 
                          : 'border-red-500/50 hover:bg-red-500/10'
                      }`}
                      onClick={() => setPythMarkets(prev => prev.map((m, i) => 
                        i === marketIndex ? { ...m, selectedOutcome: 'no' } : m
                      ))}
                    >
                      No
                    </Button>
                  </div>

                  {market.selectedOutcome && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">💰</span>
                        <Input 
                          type="number" 
                          placeholder="0.1" 
                          value={market.betAmount}
                          onChange={(e) => setPythMarkets(prev => prev.map((m, i) => 
                            i === marketIndex ? { ...m, betAmount: e.target.value } : m
                          ))}
                          className="flex-1 font-semibold"
                          style={{
                            background: '#171218',
                            color: '#FFFFFF',
                            border: '1px solid #5B3FB8',
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#8B6DFF'}
                          onBlur={(e) => e.target.style.borderColor = '#5B3FB8'}
                        />
                        <span className="text-sm font-bold" style={{ color: '#D9CCFF', opacity: 0.9 }}>USDC</span>
                      </div>

                      <div className="space-y-2">
                        <Button 
                          onClick={() => handlePythPlaceBet(marketIndex)}
                          disabled={market.betting || !market.betAmount || parseFloat(market.betAmount) <= 0}
                          className="w-full bg-gradient-to-r from-primary to-primary-glow"
                        >
                          {market.betting ? "Placing..." : "Place Bet"}
                        </Button>

                        <Button 
                          onClick={() => handlePythBridgeAndBet(marketIndex)}
                          disabled={market.bridging || market.betting || !market.betAmount || parseFloat(market.betAmount) <= 0}
                          variant="outline"
                          className="w-full rounded-full"
                          style={{
                            border: '1px solid #8B6DFF',
                            color: '#CDBBFF',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139,109,255,0.15)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          {market.bridging ? "Bridging..." : "Bridge & Bet with Avail"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Live Quantum Markets */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <PythPriceTicker />
        <LiveQuantumMarkets />
      </section>

      <Footer />
    </div>
  );
};

export default Index;