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
import { Sparkles, TrendingUp, Clock, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAllMarkets, useMarketInfo } from "@/hooks/useMarkets";
import { URIM_QUANTUM_MARKET_ADDRESS, USDC_ADDRESS } from "@/constants/contracts";
import UrimQuantumMarketABI from "@/contracts/UrimQuantumMarket.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { parseUnits } from "viem";
import ExplorerLink from "@/components/ExplorerLink";
import { getExplorerTxUrl, getExplorerAddressUrl } from "@/constants/blockscout";
import PythPriceTicker from "@/components/PythPriceTicker";

const ETH_USD_PRICE_FEED = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

interface UserBet {
  marketId: number;
  question: string;
  outcome: string;
  amount: string;
  isQuantum: boolean;
  timestamp: number;
}

const Index = () => {
  const { address } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const [question, setQuestion] = useState("");
  const [generating, setGenerating] = useState(false);
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [betAmounts, setBetAmounts] = useState<string[]>(["", ""]);
  const [lowerBoundary, setLowerBoundary] = useState("3500");
  const [upperBoundary, setUpperBoundary] = useState("4000");
  const [bettingIdx, setBettingIdx] = useState<number | null>(null);

  const { quantumMarketIds } = useAllMarkets();

  const handleGenerate = () => {
    if (!question.trim()) return;
    setGenerating(true);
    setScenarios([]);
    setTimeout(() => {
      setScenarios([
        `${question} — YES`,
        `${question} — NO`,
      ]);
      setGenerating(false);
      toast({ title: "Scenarios generated!", description: "2 quantum scenarios ready. Select one to bet." });
    }, 1500);
  };

  const createMarketAndBet = async (scenarioIndex: number) => {
    if (!address) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    const amount = betAmounts[scenarioIndex];
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Enter bet amount", variant: "destructive" });
      return;
    }

    setBettingIdx(scenarioIndex);

    try {
      const duration = BigInt(24 * 60 * 60); // 1 day
      const probs = [BigInt(50), BigInt(50)]; // 50/50 for YES/NO
      // Auto-fetch price boundaries from Pyth (using placeholder values)
      const currentPrice = 3750; // This would be fetched from Pyth in production
      const delta = 250;
      const priceBoundaries = [
        BigInt((currentPrice - delta) * 1e8), 
        BigInt((currentPrice + delta) * 1e8)
      ];

      const createTx = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "createQuantumMarket",
        args: [question, scenarios, probs, duration, ETH_USD_PRICE_FEED as `0x${string}`, priceBoundaries],
        gas: BigInt(3_000_000),
      } as any);

      toast({ title: "Market created! Now placing bet..." });
      
      // Wait for market creation
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
      
      const txHash = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyScenarioShares",
        args: [newMarketId, scenarioIndex, amountWei],
        gas: BigInt(500_000),
      } as any);

      toast({
        title: "✅ Bet placed!",
        description: (
          <div className="space-y-2">
            <p>{amount} USDC on "{question}" — {scenarios[scenarioIndex]}</p>
            <button
              onClick={() => window.open(getExplorerTxUrl(txHash as string), '_blank')}
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
      toast({ title: "Transaction failed", description: error?.shortMessage || "Try again", variant: "destructive" });
    } finally {
      setBettingIdx(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      <Navigation />
      <PythPriceTicker />

      <section className="relative max-w-6xl mx-auto px-6 pt-32 pb-16">
        {/* Two cards side-by-side */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Left: Quantum Bets with Generator */}
          <div className="glass-card p-8 space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center glow-gold">
              <Sparkles className="w-7 h-7 text-background" />
            </div>
            <h2 className="text-3xl font-bold">Quantum Pyth</h2>
            <p className="text-sm text-muted-foreground">AI-generated futures from live Pyth prices.</p>

            {/* Generator UI */}
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Your Question</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Will ETH go up tomorrow?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleGenerate} disabled={generating}>Generate</Button>
                </div>
              </div>


              {generating && (
                <div className="relative h-32 rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden">
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

              {!generating && scenarios.length > 0 && (
                <div className="space-y-3 animate-fade-in">
                  {scenarios.map((sc, i) => (
                    <Card
                      key={i}
                      className={`p-4 border-2 cursor-pointer transition-all ${selectedScenario === i
                        ? 'border-primary bg-primary/10 shadow-lg'
                        : 'border-primary/20 hover:border-primary/50'
                        }`}
                      onClick={() => setSelectedScenario(i)}
                    >
                      <div className="text-xs font-bold text-primary mb-1">SCENARIO {i + 1}</div>
                      <div className="text-sm mb-3">{sc}</div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Amount (USDC)"
                          value={betAmounts[i]}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newAmounts = [...betAmounts];
                            newAmounts[i] = e.target.value;
                            setBetAmounts(newAmounts);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-background/50"
                        />
                        <Button
                          className={selectedScenario === i ? 'bg-gradient-to-r from-primary to-primary-glow' : 'bg-muted'}
                          disabled={bettingIdx !== null}
                          onClick={(e) => {
                            e.stopPropagation();
                            createMarketAndBet(i);
                          }}
                        >
                          {bettingIdx === i ? "Placing..." : "Place Bet"}
                        </Button>
                      </div>

                      {/* Bridge & Execute Button with Avail */}
                      <div className="mt-3 pt-3 border-t border-border/30">
                        <p className="text-xs text-muted-foreground mb-2 text-center">
                          Have tokens on another network? Bridge and bet instantly with Avail.
                        </p>
                        <Button
                          variant="outline"
                          className="w-full border-primary/30 hover:bg-primary/5 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast({ title: "Bridge & Execute", description: "Avail integration will be handled by Riki" });
                          }}
                        >
                          🌉 Bridge & Execute Bet with Avail
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Everything Bets */}
          <Link to="/everything-bets" className="glass-card p-8 space-y-6 hover:border-primary/50 transition-all block">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center glow-gold">
              <TrendingUp className="w-7 h-7 text-background" />
            </div>
            <h2 className="text-3xl font-bold">Everything Bets</h2>
            <p className="text-muted-foreground">Traditional Yes/No markets. Keep using the existing flow.</p>
          </Link>
        </div>

        {/* Quantum Markets Section */}
        <div className="space-y-6 mb-12">
          <h2 className="text-2xl font-bold">Quantum Markets</h2>
          <div className="grid gap-4">
            {quantumMarketIds.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                No markets yet. Create one above!
              </Card>
            ) : (
              quantumMarketIds.map((id) => <MarketCard key={id.toString()} marketId={id} address={address} />)
            )}
          </div>
        </div>

        {/* Your Quantum Bets Section */}
        {address && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Your Quantum Bets</h2>
            <div className="grid gap-4">
              {quantumMarketIds.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  No bets placed yet.
                </Card>
              ) : (
                quantumMarketIds.map((id) => <UserBetsCard key={id.toString()} marketId={id} userAddress={address} />)
              )}
            </div>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
};

function MarketCard({ marketId, address }: { marketId: bigint; address: `0x${string}` | undefined }) {
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const [bettingScenario, setBettingScenario] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const marketInfo = useMarketInfo(Number(marketId), true);

  if (!marketInfo) return null;

  const { question, endTimestamp, resolved, winningIndex, outcomes } = marketInfo;
  const now = Math.floor(Date.now() / 1000);
  const status = resolved ? "Resolved" : now < endTimestamp ? "Active" : "Ended";

  const placeBet = async (scenarioIdx: number) => {
    if (!address) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    if (!betAmount || parseFloat(betAmount) <= 0) {
      toast({ title: "Enter bet amount", variant: "destructive" });
      return;
    }

    setBettingScenario(scenarioIdx);

    try {
      const amountWei = parseUnits(betAmount, 6);

      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_QUANTUM_MARKET_ADDRESS, amountWei],
      } as any);

      const result = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyScenarioShares",
        args: [marketId, scenarioIdx, amountWei],
        gas: BigInt(500_000),
      } as any);

      // Capture the transaction hash
      const txHash = result as string; // The result is the tx hash
      setLastTxHash(txHash);

      toast({
        title: "✅ Bet placed!",
        description: (
          <div className="space-y-2">
            <p>{betAmount} USDC on {outcomes[scenarioIdx]}</p>
            {txHash && (
              <button
                onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View on BlockScout →
              </button>
            )}
          </div>
        )
      });
      setBetAmount("");
    } catch (error: any) {
      console.error(error);
      toast({ title: "Transaction failed", description: error?.shortMessage || "Try again", variant: "destructive" });
    } finally {
      setBettingScenario(null);
    }
  };

  return (
    <Card className="p-6 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs text-muted-foreground">Market #{marketId.toString()}</div>
          <div className="text-lg font-semibold">{question}</div>
        </div>
        <Badge variant={status === "Active" ? "default" : "secondary"}>{status}</Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>Ends {new Date(endTimestamp * 1000).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="space-y-3">
        {outcomes.map((scenario, idx) => (
          <div key={idx} className={`p-4 rounded-lg border-2 ${resolved && winningIndex === idx ? 'border-green-500 bg-green-500/10' : 'border-primary/20 bg-background/50'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">{scenario}</div>
              {resolved && winningIndex === idx && <Badge className="bg-green-500">Winner</Badge>}
            </div>
            {!resolved && status === "Active" && (
              <div className="flex gap-2 mt-3">
                <Input
                  type="number"
                  placeholder="Amount"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => placeBet(idx)}
                  disabled={bettingScenario !== null}
                  className="bg-gradient-to-r from-primary to-primary-glow"
                >
                  {bettingScenario === idx ? "Placing..." : "Place Bet"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      {lastTxHash && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Latest Transaction:</span>
            <button
              onClick={() => window.open(getExplorerTxUrl(lastTxHash), '_blank')}
              className="text-primary hover:underline flex items-center gap-1 font-mono text-xs"
            >
              {lastTxHash.slice(0, 6)}...{lastTxHash.slice(-4)}
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function UserBetsCard({ marketId, userAddress }: { marketId: bigint; userAddress: `0x${string}` }) {
  const [blockscoutTxs, setBlockscoutTxs] = useState<any[]>([]);

  const { data: userShares } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getUserBalances",
    args: [marketId, userAddress],
  });

  const marketInfo = useMarketInfo(Number(marketId), true);

  useEffect(() => {
    const fetchBlockscoutData = async () => {
      try {
        const response = await fetch(
          `https://base-sepolia.blockscout.com/api?module=account&action=txlist&address=${userAddress}`
        );
        const data = await response.json();
        
        if (data.status === "1" && data.result) {
          const filteredTxs = data.result.filter(
            (tx: any) => tx.to?.toLowerCase() === URIM_QUANTUM_MARKET_ADDRESS.toLowerCase()
          );
          setBlockscoutTxs(filteredTxs);
        }
      } catch (error) {
        console.error("Error fetching BlockScout data:", error);
      }
    };

    if (userAddress) {
      fetchBlockscoutData();
    }
  }, [userAddress]);

  if (!marketInfo || !userShares) return null;

  const { question, resolved, winningIndex, outcomes } = marketInfo;
  const shares = userShares as bigint[];
  const hasShares = shares.some(share => share > 0n);

  if (!hasShares) return null;

  return (
    <Card className="p-6 border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent">
      <div className="mb-4">
        <div className="text-xs text-primary font-semibold mb-1">MARKET #{marketId.toString()}</div>
        <div className="text-lg font-bold mb-3">{question}</div>
        
        {/* On-chain Details */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Market ID:</span>
            <span className="font-mono font-semibold">{marketId.toString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Bettor Wallet:</span>
            <button
              onClick={() => window.open(getExplorerAddressUrl(userAddress), '_blank')}
              className="font-mono text-primary hover:underline flex items-center gap-1"
            >
              {userAddress.slice(0, 8)}...{userAddress.slice(-6)}
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Network:</span>
            <Badge variant="outline" className="text-xs">Base Sepolia</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-3 mt-4">
        <div className="text-xs font-semibold text-primary mb-2">YOUR BETS:</div>
        {outcomes.map((scenario, idx) => {
          if (shares[idx] === 0n) return null;
          const amount = Number(shares[idx]) / 1e6;
          
          // Find matching BlockScout transaction
          const relatedTx = blockscoutTxs.find(tx => {
            const txTimestamp = parseInt(tx.timeStamp) * 1000;
            const now = Date.now();
            return now - txTimestamp < 7 * 24 * 60 * 60 * 1000; // Last 7 days
          });

          return (
            <div key={idx} className="p-4 rounded-lg bg-primary/5 border-2 border-primary/20">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium">{scenario}</div>
                {resolved && winningIndex === idx && (
                  <Badge className="bg-green-500 text-xs">Won</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Bet Amount: <span className="font-semibold text-foreground">{amount.toFixed(2)} USDC</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Network: <span className="font-semibold text-foreground">Base Sepolia</span>
              </div>
              {relatedTx && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <button
                    onClick={() => window.open(getExplorerTxUrl(relatedTx.hash), '_blank')}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    View Transaction on BlockScout
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default Index;
