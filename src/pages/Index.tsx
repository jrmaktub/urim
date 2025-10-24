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
  const [betAmounts, setBetAmounts] = useState<string[]>(["", "", ""]);
  const [bettingIdx, setBettingIdx] = useState<number | null>(null);

  const { quantumMarketIds } = useAllMarkets();

  const handleGenerate = () => {
    if (!question.trim()) return;
    setGenerating(true);
    setScenarios([]);
    setTimeout(() => {
      setScenarios([
        `Scenario 1: ${question} — optimistic outcome`,
        `Scenario 2: ${question} — base case`,
        `Scenario 3: ${question} — downside risk`,
      ]);
      setGenerating(false);
    }, 1200);
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
      const duration = BigInt(7 * 24 * 60 * 60);
      const equalProb = Math.floor(100 / scenarios.length);
      const remainder = 100 - equalProb * scenarios.length;
      const probs = scenarios.map((_, i) => BigInt(i === 0 ? equalProb + remainder : equalProb));
      const priceFeedId = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

      await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "createQuantumMarket",
        args: [question, scenarios, probs, duration, priceFeedId, []],
        gas: BigInt(3_000_000),
      } as any);

      toast({ title: "Market created! Now placing bet..." });

      const amountWei = parseUnits(amount, 6);
      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_QUANTUM_MARKET_ADDRESS, amountWei],
      } as any);

      const latestId = quantumMarketIds.length > 0 ? quantumMarketIds[quantumMarketIds.length - 1] : 0n;
      await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyScenarioShares",
        args: [latestId, scenarioIndex, amountWei],
        gas: BigInt(500_000),
      } as any);

      toast({ title: "Bet placed!", description: `${amount} USDC on ${scenarios[scenarioIndex]}` });
      setBetAmounts(["", "", ""]);
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

      <section className="relative max-w-6xl mx-auto px-6 pt-36 pb-16">
        {/* Two cards side-by-side */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Left: Quantum Bets with Generator */}
          <div className="glass-card p-8 space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center glow-gold">
              <Sparkles className="w-7 h-7 text-background" />
            </div>
            <h2 className="text-3xl font-bold">Quantum Bets</h2>
            <p className="text-muted-foreground">Type a situation/question, trigger the effect, then pick one of 3 AI scenarios.</p>
            
            {/* Generator UI */}
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Your Question</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Will Solana go up tomorrow?" 
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
                      className={`p-4 border-2 cursor-pointer transition-all ${
                        selectedScenario === i 
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

      await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyScenarioShares",
        args: [marketId, scenarioIdx, amountWei],
        gas: BigInt(500_000),
      } as any);

      toast({ title: "Bet placed!", description: `${betAmount} USDC on ${outcomes[scenarioIdx]}` });
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
    </Card>
  );
}

function UserBetsCard({ marketId, userAddress }: { marketId: bigint; userAddress: `0x${string}` }) {
  const { data: userShares } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getUserShares",
    args: [marketId, userAddress],
  });

  const marketInfo = useMarketInfo(Number(marketId), true);

  if (!marketInfo || !userShares) return null;

  const { question, resolved, winningIndex, outcomes } = marketInfo;
  const shares = userShares as bigint[];
  const hasShares = shares.some(share => share > 0n);
  
  if (!hasShares) return null;

  return (
    <Card className="p-6 border border-border/50">
      <div className="mb-4">
        <div className="text-xs text-muted-foreground mb-1">Market #{marketId.toString()}</div>
        <div className="text-lg font-semibold mb-2">{question}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{userAddress.slice(0, 6)}...{userAddress.slice(-4)}</span>
          <span>•</span>
          <Badge variant="outline" className="text-xs">Base Sepolia</Badge>
        </div>
      </div>

      <div className="space-y-2">
        {outcomes.map((scenario, idx) => {
          if (shares[idx] === 0n) return null;
          const amount = Number(shares[idx]) / 1e6;
          
          return (
            <div key={idx} className="p-3 rounded-lg bg-muted/50 border border-border/30">
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
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default Index;
