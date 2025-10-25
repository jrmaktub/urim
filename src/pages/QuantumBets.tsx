import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Clock, Users } from "lucide-react";
import { URIM_QUANTUM_MARKET_ADDRESS, USDC_ADDRESS } from "@/constants/contracts";
import UrimQuantumMarketABI from "@/contracts/UrimQuantumMarket.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { parseUnits } from "viem";
import { useNotification } from "@blockscout/app-sdk";


export default function QuantumBets() {
  const { address } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const [question, setQuestion] = useState("");
  const [generating, setGenerating] = useState(false);
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [betAmounts, setBetAmounts] = useState<string[]>(["", "", ""]);
  const [bettingIdx, setBettingIdx] = useState<number | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
    const { openTxToast } = useNotification();

  // Fetch all market IDs
  const { data: marketIdsData, refetch: refetchMarkets } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getAllMarketIds",
  });

  const marketIds = (marketIdsData as bigint[]) || [];

  // Fetch user's bets - we'll need to listen to ScenarioPurchased events
  const [userBets, setUserBets] = useState<any[]>([]);

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
      // Create market
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

      // Get latest market ID
      await refetchMarkets();
      const latestId = marketIds.length > 0 ? marketIds[marketIds.length - 1] : 0n;

      // Approve USDC
      const amountWei = parseUnits(amount, 6);
      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_QUANTUM_MARKET_ADDRESS, amountWei],
      } as any);

      // Buy shares
            const handleBuyScenarioShares = async () => {
              try{
            const tx = await writeContractAsync({
              address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
              abi: UrimQuantumMarketABI.abi as any,
              functionName: "buyScenarioShares",
              args: [latestId, scenarioIndex, amountWei],
              gas: BigInt(500_000),
            } as any);
      
              openTxToast("84532", tx)
            console.log("Transaction sent:", tx);
              }
              catch (error) {
                console.error("Transaction failed: ", error)
              }
            }
      
            await handleBuyScenarioShares();
      
            toast({ title: "Bet placed!", description: `${amount} USDC on ${scenarios[scenarioIndex]}` });
            setBetAmounts(["", "", ""]);
            await refetchMarkets();
    } catch (error: any) {
      console.error(error);
      toast({ title: "Transaction failed", description: error?.shortMessage || "Try again", variant: "destructive" });
    } finally {
      setBettingIdx(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-6 pt-28 pb-16">
        {/* Generator */}
        <div className="glass-card p-8 mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center glow-gold">
              <Sparkles className="w-6 h-6 text-background" />
            </div>
            <h1 className="text-3xl font-bold">Quantum Bets</h1>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Your Question</Label>
              <div className="flex gap-2">
                <Input placeholder="Will ETH hit $4k this month?" value={question} onChange={(e) => setQuestion(e.target.value)} className="flex-1" />
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
              <div className="grid md:grid-cols-3 gap-4 animate-fade-in">
                {scenarios.map((sc, i) => (
                  <Card 
                    key={i} 
                    className={`p-6 border-2 cursor-pointer transition-all ${
                      selectedScenario === i 
                        ? 'border-primary bg-primary/10 shadow-lg' 
                        : 'border-primary/20 hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedScenario(i)}
                  >
                    <div className="text-xs font-bold text-primary mb-1">SCENARIO {i + 1}</div>
                    <div className="text-sm mb-4 min-h-[3rem]">{sc}</div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Amount (USDC)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={betAmounts[i]}
                        onChange={(e) => {
                          e.stopPropagation();
                          const newAmounts = [...betAmounts];
                          newAmounts[i] = e.target.value;
                          setBetAmounts(newAmounts);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-background/50"
                      />
                    </div>
                    <Button
                      className={`mt-4 w-full ${
                        selectedScenario === i 
                          ? 'bg-gradient-to-r from-primary to-primary-glow' 
                          : 'bg-muted'
                      }`}
                      disabled={bettingIdx !== null}
                      onClick={(e) => {
                        e.stopPropagation();
                        createMarketAndBet(i);
                      }}
                    >
                      {bettingIdx === i ? "Placing..." : "Place Bet"}
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quantum Markets */}
        <div className="space-y-6 mb-12">
          <h2 className="text-2xl font-bold">Quantum Markets</h2>
          <div className="grid gap-4">
            {marketIds.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                No markets yet. Create one above!
              </Card>
            ) : (
              marketIds.map((id) => <MarketCard key={id.toString()} marketId={id} address={address} />)
            )}
          </div>
        </div>

        {/* Your Quantum Bets */}
        {address && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Your Quantum Bets</h2>
            <div className="grid gap-4">
              {marketIds.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  No bets placed yet.
                </Card>
              ) : (
                marketIds.map((id) => <UserBetsCard key={id.toString()} marketId={id} userAddress={address} />)
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function MarketCard({ marketId, address }: { marketId: bigint; address: `0x${string}` | undefined }) {
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const [bettingScenario, setBettingScenario] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const { data: basicInfo } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getMarketBasicInfo",
    args: [marketId],
  });

  const { data: scenarios } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getScenarios",
    args: [marketId],
  });

  if (!basicInfo || !scenarios) return null;

  const [question, endTime, resolved, winningScenario] = basicInfo as [string, bigint, boolean, number];
  const scenarioList = scenarios as string[];
  const now = Math.floor(Date.now() / 1000);
  const status = resolved ? "Resolved" : now < Number(endTime) ? "Active" : "Ended";

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
      
      // Approve USDC
      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_QUANTUM_MARKET_ADDRESS, amountWei],
      } as any);

      // Buy shares
      await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyScenarioShares",
        args: [marketId, scenarioIdx, amountWei],
        gas: BigInt(500_000),
      } as any);

      toast({ title: "Bet placed!", description: `${betAmount} USDC on ${scenarioList[scenarioIdx]}` });
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
          <span>Ends {new Date(Number(endTime) * 1000).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="space-y-3">
        {scenarioList.map((scenario, idx) => (
          <div key={idx} className={`p-4 rounded-lg border-2 ${resolved && winningScenario === idx ? 'border-green-500 bg-green-500/10' : 'border-primary/20 bg-background/50'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">{scenario}</div>
              {resolved && winningScenario === idx && <Badge className="bg-green-500">Winner</Badge>}
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
  const { data: basicInfo } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getMarketBasicInfo",
    args: [marketId],
  });

  const { data: scenarios } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getScenarios",
    args: [marketId],
  });

  const { data: userShares } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getUserShares",
    args: [marketId, userAddress],
  });

  if (!basicInfo || !scenarios || !userShares) return null;

  const [question, endTime, resolved, winningScenario] = basicInfo as [string, bigint, boolean, number];
  const scenarioList = scenarios as string[];
  const shares = userShares as bigint[];

  // Only show if user has shares in this market
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
        {scenarioList.map((scenario, idx) => {
          if (shares[idx] === 0n) return null;
          const amount = Number(shares[idx]) / 1e6; // Convert from 6 decimals
          
          return (
            <div key={idx} className="p-3 rounded-lg bg-muted/50 border border-border/30">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium">{scenario}</div>
                {resolved && winningScenario === idx && (
                  <Badge className="bg-green-500 text-xs">Won</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Bet Amount: <span className="font-semibold text-foreground">{amount.toFixed(2)} USDC</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
