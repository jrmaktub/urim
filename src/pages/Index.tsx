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

      {/* Main Hero Section */}
      <section className="pt-28 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-tight">
            Predict the Future.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Create AI-powered markets where every decision becomes a bet.
          </p>

          {/* Primary CTAs */}
          <div className="max-w-2xl mx-auto space-y-4 pt-4">
            <Input
              placeholder="Will ETH surpass $4,000 next week?"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              className="h-14 text-base bg-card/50 border-border focus:border-primary"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                onClick={handleGenerateScenarios}
                disabled={isGenerating}
                size="lg"
                variant="outline"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Quantum Scenarios
                  </>
                )}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate('/everything-bets')}
              >
                Create Everything Bet
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Generated Scenarios */}
      {scenarios.length > 0 && (
        <section className="pb-16 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-semibold mb-8 text-center">
              AI Scenarios
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {scenarios.map((scenario, index) => (
                <div
                  key={scenario.id}
                  className="card-minimal p-6 animate-fade-in hover:border-primary/50 transition-all"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="mb-4">
                    <div className="text-xs text-muted-foreground font-medium mb-2">
                      {scenario.title}
                    </div>
                    <h3 className="text-lg font-medium text-foreground">
                      {scenario.summary}
                    </h3>
                  </div>
                  <Button 
                    onClick={() => handleCreateQuantumMarket(scenario)}
                    disabled={isCreatingMarket}
                    className="w-full"
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
        <section className="pb-16 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-semibold mb-8 text-center">
              Quantum Markets
            </h2>
            <div className="space-y-4">
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
        <section className="pb-16 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-semibold mb-8 text-center">
              Everything Markets
            </h2>
            <div className="space-y-4">
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
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Place Bet</DialogTitle>
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
      className="card-minimal p-6 animate-fade-in"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-start justify-between mb-5">
        <h3 className="text-xl font-medium text-foreground flex-1 leading-snug">
          {marketInfo.question}
        </h3>
        {marketInfo.resolved && (
          <span className="text-primary font-medium text-xs">RESOLVED</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
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

      <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-3">
        <Clock className="w-3.5 h-3.5" />
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
    <div className={`border ${isWinner ? 'border-primary' : 'border-border'} rounded-lg p-4 hover:border-primary/60 transition-all bg-card/30`}>
      <div className="text-xs text-muted-foreground font-medium mb-2">
        {isQuantum ? 'Scenario' : 'Outcome'} {outcomeIndex + 1}
      </div>
      <div className="text-base font-medium mb-3 leading-tight">{outcomeName}</div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        <TrendingUp className="w-3.5 h-3.5" />
        <span>{poolFormatted} USDC</span>
      </div>
      {!resolved && (
        <Button
          onClick={onPlaceBet}
          size="sm"
          className="w-full"
        >
          Bet
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
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-medium mb-3 leading-snug">{marketInfo.question}</h3>
        <RadioGroup value={selectedOutcome} onValueChange={setSelectedOutcome}>
          {marketInfo.outcomes.map((outcome, index) => (
            <div key={index} className="flex items-center space-x-2 mb-2">
              <RadioGroupItem value={String(index)} id={`outcome-${index}`} />
              <Label htmlFor={`outcome-${index}`} className="cursor-pointer text-sm">
                {outcome}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <div>
        <Label htmlFor="amount" className="text-sm">Amount (USDC)</Label>
        <Input
          id="amount"
          type="number"
          placeholder="100"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          className="mt-1.5 bg-background border-border"
        />
      </div>
      <Button
        onClick={onConfirm}
        className="w-full"
        size="lg"
      >
        <Zap className="w-4 h-4 mr-2" />
        Confirm Bet
      </Button>
    </div>
  );
};

export default Index;
