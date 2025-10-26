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

  const handleGenerate = async () => {
    if (!question.trim()) {
      toast({ title: "Enter a question", variant: "destructive" });
      return;
    }
    
    setGenerating(true);
    setScenarios([]);
    
    // Use AI to generate 2 scenarios
    setTimeout(() => {
      setScenarios([
        "Yes, it will happen",
        "No, it will not happen"
      ]);
      setGenerating(false);
      toast({ title: "🧠 AI scenarios generated", description: "Choose one to bet on" });
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
      // Create market (no target price, just AI scenarios)
      const duration = BigInt(7 * 24 * 60 * 60);
      const probs = [BigInt(50), BigInt(50)]; // 50/50 for 2 scenarios
      const priceFeedId = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

      // Use new createMarket with optionA/optionB
      const optionA = scenarios[0] || "Yes";
      const optionB = scenarios[1] || "No";
      const targetPrice = BigInt(0); // Default target price
      
      await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "createMarket",
        args: [question, optionA, optionB, duration, priceFeedId, targetPrice],
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

      // Buy shares - use new buyShares function with isOptionA boolean
      const isOptionA = scenarioIndex === 0; // First scenario is Option A
      const tx = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyShares",
        args: [latestId, isOptionA, amountWei],
        gas: BigInt(500_000),
      } as any);

      // Open transaction toast notification (useNotification)
      openTxToast("84532", tx);
      console.log("Transaction sent:", tx);

      // Optionally open transaction popup to show transaction history
      // You can call this if you want to show the popup immediately after the transaction
      // openPopup({
      //   chainId: "84532",
      //   address: address,
      // });

      toast({ title: "Bet placed!", description: `${amount} USDC on ${scenarios[scenarioIndex]}` });
      setBetAmounts(["", "", ""]);
      await refetchMarkets();
    } catch (error: any) {
      console.error(error);
      const errorMsg = error?.shortMessage || error?.message || "Try again";
      const fullError = JSON.stringify(error, null, 2);
      
      toast({
        title: "Transaction failed",
        description: errorMsg,
        variant: "destructive",
        action: (
          <button
            onClick={() => {
              navigator.clipboard.writeText(fullError);
              toast({ title: "Error copied to clipboard" });
            }}
            className="ml-2 px-3 py-1 text-xs bg-destructive/20 hover:bg-destructive/30 rounded"
          >
            📋 Copy
          </button>
        ),
      });
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
                    <div className="mb-4">
                      <div className="text-sm font-semibold text-primary mb-2">Scenario {i + 1}</div>
                      <div className="text-base">{sc}</div>
                    </div>
                    <div className="space-y-2">
                      <Input
                        type="number"
                        placeholder="Bet amount (USDC)"
                        value={betAmounts[i]}
                        onChange={(e) => {
                          const newAmounts = [...betAmounts];
                          newAmounts[i] = e.target.value;
                          setBetAmounts(newAmounts);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          createMarketAndBet(i);
                        }}
                        disabled={bettingIdx !== null}
                        className="w-full bg-gradient-to-r from-primary to-primary-glow"
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

        {/* Active Markets */}
        {marketIds.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Active Markets</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {marketIds.map((id) => (
                <MarketCard key={id.toString()} marketId={id} address={address} />
              ))}
            </div>
          </div>
        )}

        {/* User Bets */}
        {address && marketIds.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Your Bets</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {marketIds.map((id) => (
                <UserBetsCard key={id.toString()} marketId={id} userAddress={address} />
              ))}
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
  const { openTxToast } = useNotification();

  const { data: marketInfo } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getMarketInfo",
    args: [marketId],
  });

  if (!marketInfo) return null;

  const [question, optionA, optionB, endTime, outcome, totalOptionAShares, totalOptionBShares, resolved, cancelled] = marketInfo as [
    string, string, string, bigint, number, bigint, bigint, boolean, boolean
  ];
  const scenarioList = [optionA, optionB];
  const now = Math.floor(Date.now() / 1000);
  const status = cancelled ? "Cancelled" : resolved ? "Resolved" : now < Number(endTime) ? "Active" : "Ended";
  const winningScenario = outcome; // outcome is enum: 0=OptionA, 1=OptionB, 2=Tie

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

      // Buy shares - use new buyShares function with isOptionA boolean
      const isOptionA = scenarioIdx === 0;
      const tx = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyShares",
        args: [marketId, isOptionA, amountWei],
        gas: BigInt(500_000),
      } as any);

      // Open transaction toast notification
      openTxToast("84532", tx);
      console.log("Transaction sent:", tx);

      toast({ title: "Bet placed!", description: `${betAmount} USDC on ${scenarioList[scenarioIdx]}` });
      setBetAmount("");
    } catch (error: any) {
      console.error(error);
      const errorMsg = error?.shortMessage || error?.message || "Try again";
      const fullError = JSON.stringify(error, null, 2);
      
      toast({
        title: "Transaction failed",
        description: errorMsg,
        variant: "destructive",
        action: (
          <button
            onClick={() => {
              navigator.clipboard.writeText(fullError);
              toast({ title: "Error copied to clipboard" });
            }}
            className="ml-2 px-3 py-1 text-xs bg-destructive/20 hover:bg-destructive/30 rounded"
          >
            📋 Copy
          </button>
        ),
      });
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
  const { data: marketInfo } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getMarketInfo",
    args: [marketId],
  });

  const { data: userSharesData } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getSharesBalance",
    args: [marketId, userAddress],
  });

  if (!marketInfo || !userSharesData) return null;

  const [question, optionA, optionB, endTime, outcome, totalOptionAShares, totalOptionBShares, resolved, cancelled] = marketInfo as [
    string, string, string, bigint, number, bigint, bigint, boolean, boolean
  ];
  const scenarioList = [optionA, optionB];
  const [optionAShares, optionBShares] = userSharesData as [bigint, bigint];
  const shares = [optionAShares, optionBShares];
  const winningScenario = outcome;

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