import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useSwitchChain, useWalletClient } from "wagmi";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Clock, ExternalLink, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAllMarkets, useMarketInfo } from "@/hooks/useMarkets";
import { URIM_QUANTUM_MARKET_ADDRESS, URIM_MARKET_ADDRESS, USDC_ADDRESS } from "@/constants/contracts";
import UrimQuantumMarketABI from "@/contracts/UrimQuantumMarket.json";
import UrimMarketABI from "@/contracts/UrimMarket.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { parseUnits, formatUnits } from "viem";
import { getExplorerTxUrl } from "@/constants/blockscout";
import PythPriceTicker from "@/components/PythPriceTicker";
import { EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";
import { initializeWithProvider, isInitialized, getUnifiedBalances } from "@/lib/nexus";
import { BridgeAndExecuteButton } from '@avail-project/nexus-widgets';
import { supabase } from "@/integrations/supabase/client";
import { optimismSepolia, baseSepolia } from 'wagmi/chains';

const ETH_USD_PRICE_FEED = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const connection = new EvmPriceServiceConnection("https://hermes.pyth.network");

const Index = () => {
  const { switchChain } = useSwitchChain();
  const { address, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  
  // Quantum Bets state
  const [question, setQuestion] = useState("");
  const [generating, setGenerating] = useState(false);
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [betAmounts, setBetAmounts] = useState<string[]>(["", ""]);
  const [bettingIdx, setBettingIdx] = useState<number | null>(null);
  
  // Avail Nexus state - FIXED
  const [nexusInitialized, setNexusInitialized] = useState(false);
  const [unifiedBalance, setUnifiedBalance] = useState<string | null>(null);
  const [initializingNexus, setInitializingNexus] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  
  // Pyth state
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [pythBetAmount, setPythBetAmount] = useState("");
  const [selectedPythOutcome, setSelectedPythOutcome] = useState<number | null>(null);

  const isOnOptimismSepolia = chain?.id === optimismSepolia.id;

  const { quantumMarketIds, everythingMarketIds } = useAllMarkets();

  // Check Nexus initialization on mount - FIXED
  useEffect(() => {
    const checkInit = async () => {
      const initialized = isInitialized();
      setNexusInitialized(initialized);
      
      if (initialized) {
        setBalanceLoading(true);
        setBalanceError(null);
        try {
          const balances = await getUnifiedBalances();
          console.log("Unified balances:", balances);
          
          if (Array.isArray(balances) && balances.length > 0) {
            const usdcBalance = balances.find((b: any) => b.asset === 'USDC' || b.symbol === 'USDC');
            if (usdcBalance) {
              setUnifiedBalance(usdcBalance.balance || usdcBalance.balance || "0");
            } else {
              // No USDC found, set to "0" instead of null
              setUnifiedBalance("0");
            }
          } else {
            setUnifiedBalance("0");
          }
        } catch (e: any) {
          console.error("Failed to fetch balances:", e);
          setBalanceError(e.message || "Failed to fetch balance");
          setUnifiedBalance("0");
        } finally {
          setBalanceLoading(false);
        }
      }
    };
    checkInit();
  }, []);

  // Fetch Pyth price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const priceFeeds = await connection.getLatestPriceFeeds([ETH_USD_PRICE_FEED]);
        if (priceFeeds && priceFeeds.length > 0) {
          const priceFeed = priceFeeds[0];
          const price = priceFeed.getPriceUnchecked();
          const formattedPrice = Number(price.price) * Math.pow(10, price.expo);
          setCurrentPrice(formattedPrice);
        }
      } catch (error) {
        console.error("Error fetching price:", error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

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
      
      setBalanceLoading(true);
      const balances = await getUnifiedBalances();
      console.log("Unified balances after init:", balances);
      
      if (Array.isArray(balances) && balances.length > 0) {
        const usdcBalance = balances.find((b: any) => b.asset === 'USDC' || b.symbol === 'USDC');
        if (usdcBalance) {
          setUnifiedBalance(usdcBalance.balance || usdcBalance.balance || "0");
        } else {
          setUnifiedBalance("0");
        }
      } else {
        setUnifiedBalance("0");
      }
      
      toast({ title: "🌉 Nexus Initialized", description: "Avail bridge ready!" });
    } catch (error: any) {
      console.error("Nexus init failed:", error);
      setBalanceError(error.message || "Initialization failed");
      toast({ title: "Initialization failed", description: error.message, variant: "destructive" });
    } finally {
      setInitializingNexus(false);
      setBalanceLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!question.trim()) {
      toast({ title: "Enter a question", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setScenarios([]);

    try {
      const { data, error } = await supabase.functions.invoke('generate-scenarios', {
        body: { question: question.trim() }
      });

      if (error) throw error;

      const scenarioDescriptions = data?.scenarios?.map((s: any) => s.description) || [];

      if (scenarioDescriptions.length >= 2) {
        setScenarios(scenarioDescriptions.slice(0, 2));
        toast({
          title: "✨ Scenarios generated!",
          description: "2 AI-powered scenarios ready. Place your bet below."
        });
      } else {
        throw new Error("Not enough scenarios generated");
      }
    } catch (error: any) {
      console.error("AI generation error:", error);
      toast({
        title: "Generation failed",
        description: "Using fallback scenarios: YES/NO",
        variant: "destructive"
      });
      setScenarios(["Yes, it will happen", "No, it will not happen"]);
    } finally {
      setGenerating(false);
    }
  };

  const createMarketAndBet = async (scenarioIndex: number) => {
    if (!address) {
      toast({ title: "Connect Wallet", description: "Please connect your wallet first.", variant: "destructive" });
      return;
    }

    const amount = betAmounts[scenarioIndex];
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Enter bet amount", variant: "destructive" });
      return;
    }

    setBettingIdx(scenarioIndex);

    try {
      toast({ title: "Creating market...", description: "Confirm transaction in wallet" });

      // Create Quantum Market (no target price)
      const duration = BigInt(7 * 24 * 60 * 60); // 7 days
      const probs = [BigInt(50), BigInt(50)];
      const priceFeedId = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

      await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "createQuantumMarket",
        args: [question, scenarios, probs, duration, priceFeedId, []],
        gas: BigInt(3_000_000),
      } as any);

      toast({ title: "🧠 AI-generated market created!", description: "Now placing your bet..." });

      // Approve and buy shares
      const amountWei = parseUnits(amount, 6);
      
      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_QUANTUM_MARKET_ADDRESS, amountWei],
      } as any);

      const lastMarketId = quantumMarketIds.length > 0 ? quantumMarketIds[quantumMarketIds.length - 1] : BigInt(0);

      await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyScenarioShares",
        args: [lastMarketId, BigInt(scenarioIndex), amountWei],
        gas: BigInt(3_000_000),
      } as any);

      toast({
        title: "✅ Bet placed!",
        description: `You bet ${amount} USDC on outcome #${scenarioIndex + 1}`,
      });
    } catch (error: any) {
      console.error("Error placing bet:", error);
      toast({
        title: "Transaction failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setBettingIdx(null);
    }
  };

  const threshold = Math.round(currentPrice + (currentPrice * 0.02));

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-purple-950/10">
      <Navigation />
      
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-12 text-center">
        <Badge variant="outline" className="mb-4 text-xs uppercase tracking-wider border-primary">
          Quantum prediction markets
        </Badge>
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
          URIM
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Quantum prediction markets powered by AI and Pyth oracles
        </p>
      </section>

      {/* Avail Nexus Integration - FIXED */}
      <section className="max-w-2xl mx-auto px-6 pb-16">
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600/20 to-purple-700/20 border border-purple-500/30">
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold">⚡ Avail Nexus Integration</h3>
          </div>

          {!nexusInitialized ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Initialize Avail Nexus to access your unified balance across chains and enable seamless bridging.
              </p>
              <Button 
                onClick={handleInitNexus}
                disabled={initializingNexus || !isConnected}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                size="lg"
              >
                {initializingNexus ? "Initializing..." : "Initialize Nexus"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gradient-to-r from-purple-600/10 to-purple-700/10 border border-purple-500/20">
                <div className="text-sm text-muted-foreground mb-1">Unified Balance</div>
                {balanceLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-lg font-bold">Loading...</span>
                  </div>
                ) : balanceError ? (
                  <div className="text-red-400 text-sm">{balanceError}</div>
                ) : (
                  <div className="text-2xl font-bold">
                    {parseFloat(unifiedBalance || "0").toFixed(2)} USDC
                  </div>
                )}
              </div>

              {!isOnOptimismSepolia ? (
                <Button 
                  onClick={() => switchChain({ chainId: optimismSepolia.id })}
                  className="w-full"
                  size="lg"
                  variant="outline"
                >
                  Switch to Optimism Sepolia
                </Button>
              ) : (
                <BridgeAndExecuteButton
                  contractAddress={URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`}
                  contractAbi={UrimQuantumMarketABI.abi as any}
                  functionName="buyScenarioShares"
                  buildFunctionParams={() => ({
                    functionParams: [BigInt(0), BigInt(0), parseUnits("1", 6)]
                  })}
                  prefill={{
                    toChainId: baseSepolia.id,
                    token: 'USDC',
                    amount: '1'
                  }}
                >
                  {({ onClick, isLoading, disabled }) => (
                    <Button
                      onClick={onClick}
                      disabled={isLoading || disabled}
                      className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                      size="lg"
                    >
                      {isLoading ? "🌉 Bridging..." : "Bridge & Bet with Avail"}
                    </Button>
                  )}
                </BridgeAndExecuteButton>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Quantum Bets Section */}
      <section className="max-w-2xl mx-auto px-6 py-16">
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
              placeholder="Will ETH hit $4000 this week?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              className="h-14 text-base bg-background/50"
            />
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
                Generating AI scenarios...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate
              </>
            )}
          </Button>

          {scenarios.length > 0 && (
            <div className="grid grid-cols-2 gap-4 pt-4 animate-fade-in">
              {scenarios.map((scenario, idx) => (
                <div 
                  key={idx}
                  className="p-6 rounded-xl border-2 border-primary/30 bg-primary/5 hover:border-primary/50 transition-all"
                >
                  <div className="text-xs font-bold text-primary mb-2 uppercase">
                    {idx === 0 ? "Yes" : "No"}
                  </div>
                  <div className="text-sm mb-4 min-h-[3rem]">{scenario}</div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">💰</span>
                      <Input 
                        type="number"
                        placeholder="0.1"
                        value={betAmounts[idx]}
                        onChange={(e) => {
                          const newAmounts = [...betAmounts];
                          newAmounts[idx] = e.target.value;
                          setBetAmounts(newAmounts);
                        }}
                        className="flex-1 bg-background/50"
                      />
                      <span className="text-xs font-bold text-muted-foreground">USDC</span>
                    </div>
                    <Button 
                      onClick={() => createMarketAndBet(idx)}
                      disabled={bettingIdx !== null}
                      className="w-full bg-gradient-to-r from-primary to-primary-glow"
                      size="sm"
                    >
                      {bettingIdx === idx ? "Placing..." : "Bridge & Bet with Avail"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Quantum Pyth Section */}
      <PythPriceTicker />
      <section className="max-w-2xl mx-auto px-6 pb-24">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider">Oracle-Powered</span>
          </div>
          <h2 className="text-4xl font-bold mb-3">✦ Quantum Pyth</h2>
          <p className="text-muted-foreground text-lg">AI-generated futures from live Pyth price feeds.</p>
        </div>

        <div className="glass-card p-8">
          <div className="space-y-6">
            {/* Live Pyth Market */}
            <div className="p-6 rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
              <div className="text-lg font-semibold mb-4">
                Will ETH close above ${threshold} tomorrow?
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Button 
                  variant="outline" 
                  className={`border-2 transition-all ${
                    selectedPythOutcome === 0 
                      ? 'border-green-500 bg-green-500/20' 
                      : 'border-green-500/50 hover:bg-green-500/10'
                  }`}
                  onClick={() => setSelectedPythOutcome(0)}
                >
                  Yes
                </Button>
                <Button 
                  variant="outline"
                  className={`border-2 transition-all ${
                    selectedPythOutcome === 1 
                      ? 'border-red-500 bg-red-500/20' 
                      : 'border-red-500/50 hover:bg-red-500/10'
                  }`}
                  onClick={() => setSelectedPythOutcome(1)}
                >
                  No
                </Button>
              </div>

              {selectedPythOutcome !== null && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">💰 Amount:</span>
                    <Input 
                      type="number" 
                      placeholder="0.1" 
                      value={pythBetAmount}
                      onChange={(e) => setPythBetAmount(e.target.value)}
                      className="flex-1 bg-background/50"
                    />
                    <span className="text-sm font-bold text-muted-foreground">USDC</span>
                  </div>

                  <Button 
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                    disabled={!pythBetAmount || parseFloat(pythBetAmount) <= 0}
                  >
                    Bridge & Bet with Avail
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;