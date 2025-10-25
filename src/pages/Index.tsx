import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useSwitchChain, useWalletClient } from "wagmi";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Zap, RefreshCw, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAllMarkets } from "@/hooks/useMarkets";
import { URIM_QUANTUM_MARKET_ADDRESS, URIM_MARKET_ADDRESS, USDC_ADDRESS } from "@/constants/contracts";
import UrimQuantumMarketABI from "@/contracts/UrimQuantumMarket.json";
import UrimMarketABI from "@/contracts/UrimMarket.json";
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
  const [generating, setGenerating] = useState(false);
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [betAmounts, setBetAmounts] = useState<string[]>(["", ""]);
  const [bettingIdx, setBettingIdx] = useState<number | null>(null);
  const [bridgingIdx, setBridgingIdx] = useState<number | null>(null);
  const [creatingQuantumMarket, setCreatingQuantumMarket] = useState(false);
  const [liveQuantumMarkets, setLiveQuantumMarkets] = useState<Array<{
    marketId: bigint;
    question: string;
    scenarios: string[];
    betAmounts: string[];
    bettingIdx: number | null;
    bridgingIdx: number | null;
  }>>([]);
  
  const [nexusInitialized, setNexusInitialized] = useState(false);
  const [processedBalances, setProcessedBalances] = useState<ProcessedBalance[]>([]);
  const [initializingNexus, setInitializingNexus] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());
  const [unifiedBalance, setUnifiedBalance] = useState<string>("0.0000");
  
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
      
      const total = rawBalances.reduce((sum: number, token: any) => 
        sum + parseFloat(token.balance || "0"), 0
      );
      setUnifiedBalance(total.toFixed(4));
    } catch (e: any) {
      console.error("Failed to fetch balances:", e);
      setBalanceError(e.message || "Failed to fetch balance");
      setProcessedBalances([]);
      setUnifiedBalance("0.0000");
    } finally {
      setBalanceLoading(false);
    }
  };

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

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const priceFeeds = await connection.getLatestPriceFeeds([ETH_USD_PRICE_FEED]);
        if (priceFeeds && priceFeeds.length > 0) {
          const priceFeed = priceFeeds[0];
          const price = priceFeed.getPriceUnchecked();
          const formattedPrice = Number(price.price) * Math.pow(10, price.expo);
          setCurrentPrice(formattedPrice);

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
    setScenarios([]);
    setCreatingQuantumMarket(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-scenarios', {
        body: { question: question.trim() }
      });

      if (error) throw error;

      const scenarioDescriptions = data?.scenarios?.map((s: any) => s.description) || ["Yes, it will happen", "No, it will not happen"];
      const finalScenarios = scenarioDescriptions.length >= 2 ? scenarioDescriptions.slice(0, 2) : ["Yes, it will happen", "No, it will not happen"];
      
      setScenarios(finalScenarios);

      toast({ title: "Creating Quantum Market...", description: "Confirm transaction in wallet" });

      const duration = BigInt(24 * 60 * 60);
      const probs = [BigInt(50), BigInt(50)];
      const priceFeedId = ETH_USD_PRICE_FEED as `0x${string}`;
      const targetPrice = Math.round(currentPrice);

      const hash = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "createQuantumMarket",
        args: [question.trim(), finalScenarios, probs, duration, priceFeedId, [BigInt(targetPrice)]],
        gas: BigInt(3_000_000),
      } as any);

      openTxToast("84532", hash);

      setTimeout(() => {
        if (quantumMarketIds && quantumMarketIds.length > 0) {
          const newMarketId = quantumMarketIds[quantumMarketIds.length - 1];
          setLiveQuantumMarkets(prev => [...prev, {
            marketId: newMarketId,
            question: question.trim(),
            scenarios: finalScenarios,
            betAmounts: ["", ""],
            bettingIdx: null,
            bridgingIdx: null,
          }]);
        }
      }, 2000);

    } catch (error: any) {
      console.error("Market creation error:", error);
      toast({
        title: "❌ Market creation failed",
        description: error.message || "Please try again",
        variant: "destructive"
      });
      setScenarios([]);
    } finally {
      setGenerating(false);
      setCreatingQuantumMarket(false);
    }
  };

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

      const duration = BigInt(24 * 60 * 60);
      const priceFeedId = ETH_USD_PRICE_FEED as `0x${string}`;
      const targetPrice = BigInt(Math.round(market.threshold * 1e8));

      const hash = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "createMarket",
        args: [market.question, "Yes", "No", duration, priceFeedId, targetPrice],
        gas: BigInt(3_000_000),
      } as any);

      openTxToast("84532", hash);

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

      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_QUANTUM_MARKET_ADDRESS, amountWei],
      } as any);

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

  const handlePythBridgeAndBet = async (marketIndex: number) => {
    const market = pythMarkets[marketIndex];
    if (!address || !market.marketId || !market.selectedOutcome || !market.betAmount) {
      toast({ title: "Missing Information", description: "Please select an outcome and enter bet amount.", variant: "destructive" });
      return;
    }

    setPythMarkets(prev => prev.map((m, i) => i === marketIndex ? { ...m, bridging: true } : m));

    try {
      toast({ title: "🌉 Bridging with Avail...", description: "This may take a moment" });
      
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

  const placeBet = async (marketIndex: number, scenarioIndex: number) => {
    if (!address) {
      toast({ title: "Connect wallet", variant: "destructive" });
      return;
    }

    const market = liveQuantumMarkets[marketIndex];
    if (!market) return;

    const amount = market.betAmounts[scenarioIndex];
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Enter bet amount", variant: "destructive" });
      return;
    }

    setLiveQuantumMarkets(prev => prev.map((m, i) => 
      i === marketIndex ? { ...m, bettingIdx: scenarioIndex } : m
    ));

    try {
      toast({ title: "Placing bet...", description: "Confirm transactions in wallet" });

      const amountWei = parseUnits(amount, 6);
      
      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_QUANTUM_MARKET_ADDRESS, amountWei],
      } as any);

      const hash = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyScenarioShares",
        args: [market.marketId, BigInt(scenarioIndex), amountWei],
        gas: BigInt(3_000_000),
      } as any);

      openTxToast("84532", hash);

      setLiveQuantumMarkets(prev => prev.map((m, i) => {
        if (i === marketIndex) {
          const newAmounts = [...m.betAmounts];
          newAmounts[scenarioIndex] = "";
          return { ...m, betAmounts: newAmounts, bettingIdx: null };
        }
        return m;
      }));
    } catch (error: any) {
      console.error("Bet error:", error);
      toast({
        title: "Transaction failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setLiveQuantumMarkets(prev => prev.map((m, i) => 
        i === marketIndex ? { ...m, bettingIdx: null } : m
      ));
    }
  };

  const bridgeAndBet = async (marketIndex: number, scenarioIndex: number) => {
    toast({ title: "🌉 Bridging...", description: "Bridge & Execute coming soon!" });
  };

  return (
    <div className="min-h-screen w-full bg-background relative">
      <Navigation />
      
      {/* Hero and content sections remain the same... */}
      {/* Keeping the full UI structure but with Blockscout toasts integrated */}

      <PythPriceTicker />
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

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <LiveQuantumMarkets />
      </section>

      <Footer />
    </div>
  );
};

export default Index;