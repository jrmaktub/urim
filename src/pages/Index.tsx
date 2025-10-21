import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Clock, TrendingUp, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAllMarkets, useMarketInfo, useOutcomePool } from "@/hooks/useMarkets";
import { URIM_QUANTUM_MARKET_ADDRESS, URIM_MARKET_ADDRESS, USDC_ADDRESS } from "@/constants/contracts";
import UrimQuantumMarketABI from "@/contracts/UrimQuantumMarket.json";
import UrimMarketABI from "@/contracts/UrimMarket.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { parseUnits, maxUint256 } from "viem";

interface Scenario {
  id: number;
  title: string;
  summary: string;
}

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  
  const [situation, setSituation] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [selectedMarketId, setSelectedMarketId] = useState<number | null>(null);
  const [selectedIsQuantum, setSelectedIsQuantum] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [betAmount, setBetAmount] = useState("");
  const [isCreatingMarket, setIsCreatingMarket] = useState(false);

  const { everythingMarketIds, quantumMarketIds } = useAllMarkets();

  const handleGenerateScenarios = async () => {
    if (!situation.trim()) {
      toast({
        title: "Enter a situation",
        description: "Please describe a situation for AI to analyze.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const generated: Scenario[] = [
        {
          id: 1,
          title: "Scenario 1: High Probability",
          summary: "Yes, within 30 days",
        },
        {
          id: 2,
          title: "Scenario 2: Medium Probability",
          summary: "Yes, but after 30 days",
        },
        {
          id: 3,
          title: "Scenario 3: Low Probability",
          summary: "No, it will not happen",
        },
      ];

      setScenarios(generated);
      toast({
        title: "Futures Generated ⚡",
        description: "AI has predicted 3 possible outcomes.",
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateQuantumMarket = async (selectedScenario: Scenario) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingMarket(true);

    try {
      const durationSeconds = BigInt(7 * 24 * 60 * 60); // 7 days
      
      // Use ALL scenarios but create market based on user's selection
      const scenarioTexts = scenarios.map(s => s.summary);
      const probabilitiesArray = [BigInt(33), BigInt(33), BigInt(34)]; // Equal probabilities summing to 100
      
      // Empty price feed (not using Pyth for now)
      const priceFeedId = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
      const priceBoundaries: bigint[] = [];

      const hash = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: 'createQuantumMarket',
        args: [situation, scenarioTexts, probabilitiesArray, durationSeconds, priceFeedId, priceBoundaries],
        gas: BigInt(3000000),
      } as any);

      toast({
        title: "Transaction Submitted",
        description: "Waiting for confirmation...",
      });

      toast({
        title: "Quantum Market Created! ⚡",
        description: "Your AI-generated market is now live on Base Sepolia.",
      });

      setScenarios([]);
      setSituation("");
      
      // Refresh to show new market
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error("Failed to create quantum market:", error);
      toast({
        title: "Transaction Failed",
        description: error?.shortMessage || error?.message || "Could not create market. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingMarket(false);
    }
  };

  const handlePlaceBet = (marketId: number, isQuantum: boolean) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    setSelectedMarketId(marketId);
    setSelectedIsQuantum(isQuantum);
    setSelectedOutcome("");
    setBetAmount("");
    setBetModalOpen(true);
  };

  const handleConfirmBet = async () => {
    if (!selectedOutcome || !betAmount || selectedMarketId === null) {
      toast({
        title: "Missing Information",
        description: "Please select an outcome and enter bet amount.",
        variant: "destructive",
      });
      return;
    }

    try {
      const amount = parseUnits(betAmount, 6); // USDC has 6 decimals
      const contractAddress = selectedIsQuantum ? URIM_QUANTUM_MARKET_ADDRESS : URIM_MARKET_ADDRESS;
      const abi = selectedIsQuantum ? UrimQuantumMarketABI.abi : UrimMarketABI.abi;
      const functionName = selectedIsQuantum ? 'buyScenarioShares' : 'buyShares';

      // Step 1: Approve USDC
      toast({
        title: "Step 1/2: Approving USDC",
        description: "Please confirm the approval transaction in your wallet.",
      });

      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: 'approve',
        args: [contractAddress, amount],
        gas: BigInt(100000),
      } as any);

      toast({
        title: "Approval Confirmed ✓",
        description: "Now placing your bet...",
      });

      // Step 2: Place bet
      toast({
        title: "Step 2/2: Placing Bet",
        description: "Please confirm the bet transaction in your wallet.",
      });

      // For Quantum markets, scenarioIndex is uint8 (Number), for Everything markets it's uint256 (BigInt)
      const outcomeIndex = selectedIsQuantum ? Number(selectedOutcome) : BigInt(selectedOutcome);
      
      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: abi as any,
        functionName,
        args: [BigInt(selectedMarketId), outcomeIndex, amount],
        gas: BigInt(3000000),
      } as any);

      toast({
        title: "Bet Placed Successfully! ⚡",
        description: `${betAmount} USDC bet placed. Refreshing markets...`,
      });
      
      setBetModalOpen(false);
      setSelectedOutcome("");
      setBetAmount("");
      
      // Refresh page to show updated markets
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error("Bet failed:", error);
      toast({
        title: "Transaction Failed",
        description: error?.shortMessage || error?.message || "Could not place bet. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <Navigation />

      {/* Quantum Bets Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center animate-fade-up">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-primary via-primary-dark to-primary bg-clip-text text-transparent">
              QUANTUM BETS
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
            Describe any situation — AI predicts the futures. You decide which becomes reality.
          </p>

          {/* Input Section */}
          <div className="max-w-2xl mx-auto space-y-6">
            <Input
              placeholder="e.g. Will Solana outperform Ethereum next month?"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              className="h-16 text-lg bg-card border-primary/25"
            />
            <div className="flex gap-4">
              <Button
                onClick={handleGenerateScenarios}
                disabled={isGenerating}
                size="lg"
                variant="outline"
                className="flex-1 h-14 border-2 border-primary hover:border-primary-glow hover:shadow-[0_0_30px_hsl(var(--primary)/0.6)] transition-all duration-300"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-5 h-5 animate-spin" />
                    Simulating possible futures...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    🧠 Generate Quantum Scenarios
                  </>
                )}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 h-14 border-2 border-secondary hover:shadow-[0_0_25px_hsl(var(--primary)/0.4)] transition-all duration-300"
                onClick={() => navigate('/everything-bets')}
              >
                🌍 Create Everything Bet
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Generated Scenarios */}
      {scenarios.length > 0 && (
        <section className="pb-20 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold mb-10 text-center text-primary">
              AI-Generated Futures
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {scenarios.map((scenario, index) => (
                <div
                  key={scenario.id}
                  className="glass-card p-8 animate-fade-up"
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  <div className="mb-6">
                    <div className="text-xs text-primary font-bold mb-2">
                      {scenario.title}
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-4">
                      {scenario.summary}
                    </h3>
                  </div>
                  <Button 
                    onClick={() => handleCreateQuantumMarket(scenario)}
                    disabled={isCreatingMarket}
                    className="w-full bg-gradient-to-r from-primary to-primary-dark glow-primary"
                  >
                    {isCreatingMarket ? "Creating..." : "Create Market"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Active Quantum Markets */}
      {quantumMarketIds.length > 0 && (
        <section className="pb-24 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold mb-10 text-center text-primary">
              Active Quantum Markets
            </h2>
            <div className="grid grid-cols-1 gap-8">
              {quantumMarketIds.map((marketId, index) => (
                <MarketCard
                  key={`quantum-${Number(marketId)}`}
                  marketId={Number(marketId)}
                  isQuantum={true}
                  onPlaceBet={handlePlaceBet}
                  index={index}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Active Everything Markets */}
      {everythingMarketIds.length > 0 && (
        <section className="pb-24 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold mb-10 text-center text-primary">
              Active Everything Markets
            </h2>
            <div className="grid grid-cols-1 gap-8">
              {everythingMarketIds.map((marketId, index) => (
                <MarketCard
                  key={`everything-${Number(marketId)}`}
                  marketId={Number(marketId)}
                  isQuantum={false}
                  onPlaceBet={handlePlaceBet}
                  index={index}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Bet Modal */}
      <Dialog open={betModalOpen} onOpenChange={setBetModalOpen}>
        <DialogContent className="bg-card border-primary/25">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Place Your Bet</DialogTitle>
          </DialogHeader>
          {selectedMarketId !== null && (
            <BetModalContent
              marketId={selectedMarketId}
              isQuantum={selectedIsQuantum}
              selectedOutcome={selectedOutcome}
              setSelectedOutcome={setSelectedOutcome}
              betAmount={betAmount}
              setBetAmount={setBetAmount}
              onConfirm={handleConfirmBet}
            />
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

interface MarketCardProps {
  marketId: number;
  isQuantum: boolean;
  onPlaceBet: (marketId: number, isQuantum: boolean) => void;
  index: number;
}

const MarketCard = ({ marketId, isQuantum, onPlaceBet, index }: MarketCardProps) => {
  const marketInfo = useMarketInfo(marketId, isQuantum);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!marketInfo) return;

    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = marketInfo.endTimestamp - now;

      if (diff <= 0) {
        setTimeLeft("Ended");
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else {
        setTimeLeft(`${hours}h`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [marketInfo]);

  if (!marketInfo) return null;

  return (
    <div
      className="glass-card p-8 animate-fade-up"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-2xl font-bold text-foreground flex-1">
          {marketInfo.question}
        </h3>
        {marketInfo.resolved && (
          <span className="text-primary font-bold text-sm">RESOLVED</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {marketInfo.outcomes.map((outcome, outcomeIndex) => (
          <OutcomeDisplay
            key={outcomeIndex}
            marketId={marketId}
            outcomeIndex={outcomeIndex}
            outcomeName={outcome}
            isQuantum={isQuantum}
            resolved={marketInfo.resolved}
            isWinner={marketInfo.resolved && marketInfo.winningIndex === outcomeIndex}
            onPlaceBet={() => onPlaceBet(marketId, isQuantum)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground border-t border-primary/25 pt-4">
        <Clock className="w-4 h-4" />
        <span>{timeLeft} remaining</span>
      </div>
    </div>
  );
};

interface OutcomeDisplayProps {
  marketId: number;
  outcomeIndex: number;
  outcomeName: string;
  isQuantum: boolean;
  resolved: boolean;
  isWinner: boolean;
  onPlaceBet: () => void;
}

const OutcomeDisplay = ({ marketId, outcomeIndex, outcomeName, isQuantum, resolved, isWinner, onPlaceBet }: OutcomeDisplayProps) => {
  const pool = useOutcomePool(marketId, outcomeIndex, isQuantum);
  const poolFormatted = (Number(pool) / 1e6).toFixed(2);

  return (
    <div className={`border ${isWinner ? 'border-primary border-2' : 'border-primary/25'} rounded-2xl p-6 hover:border-primary transition-all duration-300`}>
      <div className="text-xs text-primary font-bold mb-2">
        {isQuantum ? 'SCENARIO' : 'OUTCOME'} {outcomeIndex + 1}
      </div>
      <div className="text-lg font-bold mb-4">{outcomeName}</div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <TrendingUp className="w-4 h-4" />
        <span>{poolFormatted} USDC</span>
      </div>
      {!resolved && (
        <Button
          onClick={onPlaceBet}
          className="w-full bg-gradient-to-r from-primary to-primary-dark glow-primary"
        >
          Place Bet
        </Button>
      )}
    </div>
  );
};

interface BetModalContentProps {
  marketId: number;
  isQuantum: boolean;
  selectedOutcome: string;
  setSelectedOutcome: (value: string) => void;
  betAmount: string;
  setBetAmount: (value: string) => void;
  onConfirm: () => void;
}

const BetModalContent = ({ marketId, isQuantum, selectedOutcome, setSelectedOutcome, betAmount, setBetAmount, onConfirm }: BetModalContentProps) => {
  const marketInfo = useMarketInfo(marketId, isQuantum);

  if (!marketInfo) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">{marketInfo.question}</h3>
        <RadioGroup value={selectedOutcome} onValueChange={setSelectedOutcome}>
          {marketInfo.outcomes.map((outcome, index) => (
            <div key={index} className="flex items-center space-x-2 mb-3">
              <RadioGroupItem value={String(index)} id={`outcome-${index}`} />
              <Label htmlFor={`outcome-${index}`} className="cursor-pointer">
                {outcome}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <div>
        <Label htmlFor="amount">Amount (USDC)</Label>
        <Input
          id="amount"
          type="number"
          placeholder="100"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          className="mt-2 bg-background border-primary/25"
        />
      </div>
      <Button
        onClick={onConfirm}
        className="w-full h-14 bg-gradient-to-r from-primary to-primary-dark glow-primary"
      >
        <Zap className="w-5 h-5 mr-2" />
        Confirm Bet
      </Button>
    </div>
  );
};

export default Index;
