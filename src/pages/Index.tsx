import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
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

const ETH_USD_PRICE_FEED = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const connection = new EvmPriceServiceConnection("https://hermes.pyth.network");

interface AIBetIdea {
  question: string;
  outcomes: string[];
  threshold?: number;
}

const Index = () => {
  const { address } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const [question, setQuestion] = useState("");
  const [generating, setGenerating] = useState(false);
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [betAmounts, setBetAmounts] = useState<string[]>(["", ""]);
  const [bettingIdx, setBettingIdx] = useState<number | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [aiBetIdeas, setAiBetIdeas] = useState<AIBetIdea[]>([]);
  const [creatingAIBet, setCreatingAIBet] = useState<number | null>(null);

  const { quantumMarketIds, everythingMarketIds } = useAllMarkets();

  // Fetch current ETH price for AI bet generation
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
    const interval = setInterval(fetchPrice, 10000);
    return () => clearInterval(interval);
  }, []);

  // Generate AI bet ideas based on current price
  useEffect(() => {
    if (currentPrice > 0) {
      const roundedPrice = Math.round(currentPrice);
      const threshold1 = roundedPrice + 50;
      const threshold2 = roundedPrice - 50;
      
      setAiBetIdeas([
        {
          question: `Will ETH close above $${threshold1} tomorrow?`,
          outcomes: ["YES", "NO"],
          threshold: threshold1,
        },
        {
          question: `Will ETH drop below $${threshold2} in 24h?`,
          outcomes: ["YES", "NO"],
          threshold: threshold2,
        },
        {
          question: `Will ETH stay between $${threshold2}-$${threshold1} for 24h?`,
          outcomes: ["YES", "NO"],
        },
      ]);
    }
  }, [currentPrice]);

  const handleGenerate = async () => {
    if (!question.trim()) {
      toast({ title: "Enter a question", variant: "destructive" });
      return;
    }
    
    setGenerating(true);
    setScenarios([]);

    // Simulate AI generation with animation
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setScenarios(["YES", "NO"]);
    setGenerating(false);
    
    toast({ 
      title: "✨ Scenarios generated!", 
      description: "2 quantum scenarios ready (YES/NO). Place your bet below." 
    });
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
      // Auto-fetch price boundaries from current Pyth price
      const delta = 500; // $500 range
      const lowerBound = Math.floor(currentPrice - delta);
      const upperBound = Math.ceil(currentPrice + delta);
      const priceBoundaries = [BigInt(lowerBound * 100000000), BigInt(upperBound * 100000000)]; // 8 decimals

      // Create Quantum Market
      const duration = BigInt(86400); // 1 day
      const probs = [BigInt(50), BigInt(50)];

      const createTx = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "createQuantumMarket",
        args: [question, scenarios, probs, duration, ETH_USD_PRICE_FEED as `0x${string}`, priceBoundaries],
      } as any);

      toast({ 
        title: "⚡ Market created!", 
        description: (
          <div className="space-y-2">
            <p>Now placing your bet...</p>
            <button
              onClick={() => window.open(getExplorerTxUrl(createTx as string), '_blank')}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View on BlockScout →
            </button>
          </div>
        )
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const amountWei = parseUnits(amount, 6);
      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_QUANTUM_MARKET_ADDRESS, amountWei],
      } as any);

      const latestId = quantumMarketIds.length > 0 ? quantumMarketIds[quantumMarketIds.length - 1] : BigInt(0);
      const newMarketId = latestId + BigInt(1);
      
      const betTx = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyScenarioShares",
        args: [newMarketId, BigInt(scenarioIndex), amountWei],
      } as any);

      toast({
        title: "✅ Bet placed!",
        description: (
          <div className="space-y-2">
            <p>{amount} USDC on "{question}" — {scenarios[scenarioIndex]}</p>
            <button
              onClick={() => window.open(getExplorerTxUrl(betTx as string), '_blank')}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View on BlockScout →
            </button>
          </div>
        )
      });

      setBetAmounts(["", ""]);
      setQuestion("");
      setScenarios([]);
    } catch (error: any) {
      console.error(error);
      toast({ 
        title: "Transaction failed", 
        description: error?.shortMessage || "Please try again", 
        variant: "destructive" 
      });
    } finally {
      setBettingIdx(null);
    }
  };

  const createAIBet = async (ideaIndex: number) => {
    if (!address) {
      toast({ title: "Connect Wallet", variant: "destructive" });
      return;
    }

    setCreatingAIBet(ideaIndex);

    try {
      const idea = aiBetIdeas[ideaIndex];
      const duration = Math.floor(Date.now() / 1000) + 86400; // 24h from now

      const createTx = await writeContractAsync({
        address: URIM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimMarketABI.abi as any,
        functionName: "createMarket",
        args: [idea.question, idea.outcomes, BigInt(duration)],
      } as any);

      toast({
        title: "⚡ Market Created!",
        description: (
          <div className="space-y-2">
            <p>{idea.question}</p>
            <button
              onClick={() => window.open(getExplorerTxUrl(createTx as string), '_blank')}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View on BlockScout →
            </button>
          </div>
        )
      });
    } catch (error: any) {
      console.error(error);
      toast({ 
        title: "Transaction failed", 
        description: error?.shortMessage || "Try again", 
        variant: "destructive" 
      });
    } finally {
      setCreatingAIBet(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      <Navigation />
      <PythPriceTicker />

      <section className="relative max-w-6xl mx-auto px-6 pt-32 pb-16">
        {/* AI-Generated Bet Ideas */}
        {currentPrice > 0 && aiBetIdeas.length > 0 && (
          <div className="mb-12 space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">AI-Generated Bet Ideas</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {aiBetIdeas.map((idea, idx) => (
                <Card
                  key={idx}
                  className="p-5 border-primary/20 hover:border-primary/40 transition-all bg-background/95 hover:shadow-lg hover:shadow-primary/10 group"
                >
                  <div className="space-y-4">
                    <div className="text-sm font-semibold leading-snug">{idea.question}</div>
                    <div className="flex gap-2 text-xs">
                      {idea.outcomes.map((outcome, i) => (
                        <Badge key={i} variant="outline" className="border-primary/30">
                          {outcome}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      disabled={creatingAIBet !== null}
                      onClick={() => createAIBet(idx)}
                      className="w-full bg-gradient-to-r from-primary to-primary/70 hover:shadow-lg hover:shadow-primary/20"
                    >
                      {creatingAIBet === idx ? <Sparkles className="w-4 h-4 animate-spin" /> : "Create Market"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Two main cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          
          {/* QUANTUM PYTH CARD */}
          <div className="glass-card p-8 space-y-6 border-primary/20 hover:border-primary/40 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-7 h-7 text-background" />
            </div>
            
            <div>
              <h2 className="text-3xl font-bold mb-2">Quantum Pyth</h2>
              <p className="text-sm text-muted-foreground">AI-generated futures from live Pyth prices.</p>
            </div>

            {/* Question Input */}
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Your Question</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Will ETH go up tomorrow?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    className="flex-1 bg-background/50"
                  />
                  <Button 
                    onClick={handleGenerate} 
                    disabled={generating || !question.trim()}
                    className="px-6"
                  >
                    {generating ? <Sparkles className="w-4 h-4 animate-spin" /> : "Generate"}
                  </Button>
                </div>
              </div>

              {/* AI Generation Animation */}
              {generating && (
                <div className="relative h-32 rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden animate-fade-in">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                      <div className="text-primary font-semibold animate-pulse">Generating quantum scenarios...</div>
                      <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                    </div>
                  </div>
                </div>
              )}

              {/* Generated Scenarios */}
              {!generating && scenarios.length > 0 && (
                <div className="space-y-3 animate-fade-in">
                  {scenarios.map((scenario, i) => (
                    <Card
                      key={i}
                      className="p-4 border-2 border-primary/20 hover:border-primary/50 transition-all bg-background/50"
                    >
                      <div className="text-xs font-bold text-primary mb-2">SCENARIO {i + 1}</div>
                      <div className="text-sm font-semibold mb-3">{scenario}</div>
                      
                      <div className="flex gap-2 mb-3">
                        <Input
                          type="number"
                          placeholder="Amount (USDC)"
                          value={betAmounts[i]}
                          onChange={(e) => {
                            const newAmounts = [...betAmounts];
                            newAmounts[i] = e.target.value;
                            setBetAmounts(newAmounts);
                          }}
                          className="flex-1 bg-background/50"
                        />
                        <Button
                          disabled={bettingIdx !== null}
                          onClick={() => createMarketAndBet(i)}
                          className="bg-gradient-to-r from-primary to-primary/70 hover:shadow-lg hover:shadow-primary/20"
                        >
                          {bettingIdx === i ? "Placing..." : "Place Bet"}
                        </Button>
                      </div>

                      {/* Avail Bridge Button */}
                      <div className="pt-3 border-t border-border/30">
                        <Button
                          variant="outline"
                          className="w-full border-primary/30 hover:bg-primary/5 hover:border-primary/50 text-xs group"
                          onClick={() => {
                            toast({ 
                              title: "🪐 Bridge & Execute", 
                              description: "Cross-chain bridging with Avail coming soon!" 
                            });
                          }}
                        >
                          <span className="mr-2">🪐</span>
                          Bridge & Execute with Avail
                          <span className="ml-2 text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                            (Cross-chain in one click)
                          </span>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* EVERYTHING BETS CARD */}
          <Link 
            to="/everything-bets" 
            className="glass-card p-8 space-y-6 border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all block group"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/30 transition-all">
              <TrendingUp className="w-7 h-7 text-background" />
            </div>
            
            <div>
              <h2 className="text-3xl font-bold mb-2">Everything Bets</h2>
              <p className="text-sm text-muted-foreground">Traditional prediction markets for any question.</p>
            </div>

            <div className="flex items-center gap-2 text-sm text-primary">
              <span>Create custom market</span>
              <ExternalLink className="w-4 h-4" />
            </div>
          </Link>
        </div>

        {/* ACTIVE QUANTUM MARKETS */}
        <div className="space-y-6 mb-12 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Quantum Markets
          </h2>
          
          <div className="grid gap-4">
            {quantumMarketIds.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground border-dashed">
                No active Quantum markets yet. Create one above!
              </Card>
            ) : (
              quantumMarketIds.map((id) => (
                <QuantumMarketCard key={id.toString()} marketId={id} address={address} />
              ))
            )}
          </div>
        </div>

        {/* ACTIVE EVERYTHING MARKETS */}
        <div className="space-y-6 mb-12 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Everything Bets Markets
          </h2>
          
          <div className="grid gap-4">
            {everythingMarketIds.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground border-dashed">
                No active Everything Bets markets yet. <Link to="/everything-bets" className="text-primary hover:underline">Create one</Link>!
              </Card>
            ) : (
              everythingMarketIds.map((id) => (
                <EverythingMarketCard key={id.toString()} marketId={id} address={address} />
              ))
            )}
          </div>
        </div>

        {/* YOUR QUANTUM BETS */}
        {address && (
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              Your Quantum Bets
            </h2>
            
            <div className="grid gap-4">
              {quantumMarketIds.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground border-dashed">
                  No bets placed yet.
                </Card>
              ) : (
                quantumMarketIds.map((id) => (
                  <UserBetsCard key={id.toString()} marketId={id} userAddress={address} />
                ))
              )}
            </div>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
};

// Quantum Market Card Component
function QuantumMarketCard({ marketId, address }: { marketId: bigint; address: `0x${string}` | undefined }) {
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const [betAmount, setBetAmount] = useState("");
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  const marketInfo = useMarketInfo(Number(marketId), true);

  const placeBet = async (scenarioIdx: number) => {
    if (!address) {
      toast({ title: "Connect Wallet", variant: "destructive" });
      return;
    }

    if (!betAmount || parseFloat(betAmount) <= 0) {
      toast({ title: "Enter bet amount", variant: "destructive" });
      return;
    }

    setIsPlacingBet(true);

    try {
      const amountWei = parseUnits(betAmount, 6);

      // Approve USDC
      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_QUANTUM_MARKET_ADDRESS, amountWei],
      } as any);

      // Place bet
      const txHash = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyScenarioShares",
        args: [marketId, BigInt(scenarioIdx), amountWei],
      } as any);

      toast({
        title: "✅ Bet placed!",
        description: (
          <div className="space-y-2">
            <p>{betAmount} USDC on {marketInfo?.outcomes[scenarioIdx]}</p>
            <button
              onClick={() => window.open(getExplorerTxUrl(txHash as string), '_blank')}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View on BlockScout →
            </button>
          </div>
        )
      });

      setBetAmount("");
      setSelectedScenario(null);
    } catch (error: any) {
      console.error(error);
      toast({ title: "Transaction failed", description: error?.shortMessage || "Try again", variant: "destructive" });
    } finally {
      setIsPlacingBet(false);
    }
  };

  if (!marketInfo) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-4 bg-primary/10 rounded w-3/4 mb-4"></div>
        <div className="h-3 bg-primary/10 rounded w-1/2"></div>
      </Card>
    );
  }

  const { question, outcomes, endTimestamp, resolved, winningIndex } = marketInfo;
  const isExpired = endTimestamp < Math.floor(Date.now() / 1000);

  return (
    <Card className="p-6 border-primary/20 hover:border-primary/40 transition-all animate-fade-in">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold mb-2">{question}</h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Badge variant={resolved ? "default" : isExpired ? "secondary" : "outline"}>
              {resolved ? "Resolved" : isExpired ? "Expired" : "Active"}
            </Badge>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(endTimestamp * 1000).toLocaleDateString()}
            </span>
          </div>
        </div>

        {!resolved && !isExpired && (
          <div className="grid grid-cols-2 gap-3">
            {outcomes.map((outcome, idx) => (
              <div key={idx} className="space-y-2">
                <div className="text-sm font-semibold text-primary">{outcome}</div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="USDC"
                    value={selectedScenario === idx ? betAmount : ""}
                    onChange={(e) => {
                      setSelectedScenario(idx);
                      setBetAmount(e.target.value);
                    }}
                    className="flex-1 bg-background/50 text-xs"
                  />
                  <Button
                    size="sm"
                    disabled={isPlacingBet || selectedScenario !== idx || !betAmount}
                    onClick={() => placeBet(idx)}
                    className="bg-gradient-to-r from-primary to-primary/70"
                  >
                    {isPlacingBet && selectedScenario === idx ? "..." : "Bet"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {resolved && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <div className="text-sm font-semibold text-primary">
              ✅ Winner: {outcomes[winningIndex]}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Everything Market Card Component
function EverythingMarketCard({ marketId, address }: { marketId: bigint; address: `0x${string}` | undefined }) {
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const [betAmount, setBetAmount] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  const marketInfo = useMarketInfo(Number(marketId), false);

  const placeBet = async (outcomeIdx: number) => {
    if (!address) {
      toast({ title: "Connect Wallet", variant: "destructive" });
      return;
    }

    if (!betAmount || parseFloat(betAmount) <= 0) {
      toast({ title: "Enter bet amount", variant: "destructive" });
      return;
    }

    setIsPlacingBet(true);

    try {
      const amountWei = parseUnits(betAmount, 6);

      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_MARKET_ADDRESS, amountWei],
      } as any);

      const txHash = await writeContractAsync({
        address: URIM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimMarketABI.abi as any,
        functionName: "buyShares",
        args: [marketId, BigInt(outcomeIdx), amountWei],
      } as any);

      toast({
        title: "✅ Bet placed!",
        description: (
          <div className="space-y-2">
            <p>{betAmount} USDC on {marketInfo?.outcomes[outcomeIdx]}</p>
            <button
              onClick={() => window.open(getExplorerTxUrl(txHash as string), '_blank')}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View on BlockScout →
            </button>
          </div>
        )
      });

      setBetAmount("");
      setSelectedOutcome(null);
    } catch (error: any) {
      console.error(error);
      toast({ title: "Transaction failed", description: error?.shortMessage || "Try again", variant: "destructive" });
    } finally {
      setIsPlacingBet(false);
    }
  };

  if (!marketInfo) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-4 bg-primary/10 rounded w-3/4 mb-4"></div>
        <div className="h-3 bg-primary/10 rounded w-1/2"></div>
      </Card>
    );
  }

  const { question, outcomes, endTimestamp, resolved, winningIndex } = marketInfo;
  const isExpired = endTimestamp < Math.floor(Date.now() / 1000);

  return (
    <Card className="p-6 border-primary/20 hover:border-primary/40 transition-all animate-fade-in">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold mb-2">{question}</h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Badge variant={resolved ? "default" : isExpired ? "secondary" : "outline"}>
              {resolved ? "Resolved" : isExpired ? "Expired" : "Active"}
            </Badge>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(endTimestamp * 1000).toLocaleDateString()}
            </span>
          </div>
        </div>

        {!resolved && !isExpired && (
          <div className="grid grid-cols-2 gap-3">
            {outcomes.map((outcome, idx) => (
              <div key={idx} className="space-y-2">
                <div className="text-sm font-semibold text-primary">{outcome}</div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="USDC"
                    value={selectedOutcome === idx ? betAmount : ""}
                    onChange={(e) => {
                      setSelectedOutcome(idx);
                      setBetAmount(e.target.value);
                    }}
                    className="flex-1 bg-background/50 text-xs"
                  />
                  <Button
                    size="sm"
                    disabled={isPlacingBet || selectedOutcome !== idx || !betAmount}
                    onClick={() => placeBet(idx)}
                    className="bg-gradient-to-r from-primary to-primary/70"
                  >
                    {isPlacingBet && selectedOutcome === idx ? "..." : "Bet"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {resolved && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <div className="text-sm font-semibold text-primary">
              ✅ Winner: {outcomes[winningIndex]}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// User Bets Card Component
function UserBetsCard({ marketId, userAddress }: { marketId: bigint; userAddress: `0x${string}` }) {
  const { data: userShares } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getUserBalances",
    args: [marketId, userAddress],
  });

  const marketInfo = useMarketInfo(Number(marketId), true);

  if (!marketInfo || !userShares) return null;

  const shares = userShares as bigint[];
  const hasAnyBets = shares.some(s => s > 0n);

  if (!hasAnyBets) return null;

  const { question, outcomes, resolved, winningIndex } = marketInfo;

  return (
    <Card className="p-6 border-primary/20 animate-fade-in">
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold mb-1">{question}</h3>
          <div className="text-xs text-muted-foreground">Market ID: #{marketId.toString()}</div>
        </div>

        {outcomes.map((outcome, idx) => {
          if (shares[idx] === 0n) return null;
          const amount = formatUnits(shares[idx], 6);
          const isWinner = resolved && winningIndex === idx;

          return (
            <div 
              key={idx} 
              className={`p-3 rounded-lg border-2 ${isWinner ? 'border-primary bg-primary/10' : 'border-border/30 bg-background/50'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-semibold">{outcome}</div>
                {isWinner && <Badge className="bg-primary">Winner! ✅</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                Bet: <span className="font-semibold text-foreground">{amount} USDC</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Network: <span className="font-semibold text-foreground">Base Sepolia</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default Index;
