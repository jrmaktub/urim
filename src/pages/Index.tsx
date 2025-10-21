import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Clock, TrendingUp, Zap, ChevronRight } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

interface Scenario {
  id: number;
  title: string;
  summary: string;
  probability: number;
  explanation: string;
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
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null);

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
    setScenarios([]);
    setSelectedScenarioId(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-scenarios', {
        body: { question: situation }
      });

      if (error) throw error;

      if (data?.scenarios) {
        const generatedScenarios = data.scenarios.map((s: any, idx: number) => ({
          id: idx + 1,
          title: `Scenario ${idx + 1}`,
          summary: s.description,
          probability: s.probability,
          explanation: s.explanation
        }));
        
        setScenarios(generatedScenarios);
        toast({
          title: "Scenarios generated!",
          description: "Review the quantum predictions below",
        });
      }
    } catch (error) {
      console.error('Error generating scenarios:', error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate scenarios",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateQuantumMarket = async () => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    if (selectedScenarioId === null) {
      toast({
        title: "No Scenario Selected",
        description: "Please select a scenario first.",
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
      setSelectedScenarioId(null);
      
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
      <Hero />

      {/* Main Action Cards Section */}
      <section className="max-w-6xl mx-auto px-6 pb-24 -mt-16">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Quantum Bet Card */}
          <div className="card-glow p-10 relative overflow-hidden group">
            {/* AI Particle Effect Background */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/15 rounded-full blur-3xl animate-float opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-primary/10 rounded-full blur-2xl animate-pulse" />
            
            <div className="relative z-10 space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 border border-primary/30">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">AI Powered</span>
              </div>
              
              {/* Heading */}
              <div>
                <h2 className="text-3xl font-bold mb-3 tracking-tight">Quantum Scenarios</h2>
                <p className="text-muted-foreground leading-relaxed">
                  AI generates 3 possible futures based on your question. Choose your prediction and place your bet.
                </p>
              </div>
              
              {/* Input */}
              <div className="space-y-3">
                <Input
                  placeholder="What event do you want to predict?"
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                  className="h-14 text-base border-border/50 focus:border-primary/60 bg-input/50 rounded-xl transition-all"
                />
                
                {/* Generate Button */}
                <Button
                  onClick={handleGenerateScenarios}
                  disabled={isGenerating || !situation.trim()}
                  variant="default"
                  className="w-full group/btn relative overflow-hidden"
                  size="lg"
                >
                  <span className="relative z-10 flex items-center">
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                        <span className="animate-pulse">Quantum AI Processing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 group-hover/btn:rotate-12 transition-transform animate-pulse" />
                        Generate Quantum Scenarios
                        <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                      </>
                    )}
                  </span>
                  {isGenerating && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-primary via-purple-500 to-primary bg-[length:200%_100%] animate-shimmer" />
                      <div className="absolute inset-0 animate-glow-pulse" />
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-2 h-2 bg-white rounded-full animate-particle-float"
                          style={{
                            left: `${Math.random() * 100}%`,
                            animationDelay: `${i * 0.2}s`,
                            animationDuration: `${1.5 + Math.random()}s`
                          }}
                        />
                      ))}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Everything Bet Card */}
          <div className="glass-card p-10 relative overflow-hidden group hover:border-primary/30 transition-all">
            <div className="relative z-10 space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border/50">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Traditional</span>
              </div>
              
              {/* Heading */}
              <div>
                <h2 className="text-3xl font-bold mb-3 tracking-tight">Everything Bets</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Create simple Yes/No prediction markets on any topic. Perfect for binary outcomes.
                </p>
              </div>
              
              {/* Placeholder Visual */}
              <div className="space-y-3">
                <div className="h-14 flex items-center justify-center rounded-xl border border-border/30 bg-muted/20">
                  <p className="text-sm text-muted-foreground font-medium">
                    Yes / No binary markets
                  </p>
                </div>
                
                {/* Create Button */}
                <Button
                  onClick={() => navigate('/everything-bets')}
                  variant="secondary"
                  className="w-full group/btn"
                  size="lg"
                >
                  Create Everything Bet
                  <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Generated Scenarios - AI Effect */}
      {scenarios.length > 0 && (
        <section className="pb-20 px-6 relative">
          {/* Glow Background for AI Section */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[600px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />
          </div>
          
          <div className="max-w-6xl mx-auto relative z-10">
            {/* Section Header */}
            <div className="text-center mb-12 space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 border border-primary/30 mb-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">AI Generated</span>
              </div>
              <h2 className="text-4xl font-bold tracking-tight">
                Your Quantum Scenarios
              </h2>
              <p className="text-muted-foreground text-lg">
                Select a scenario to create your market
              </p>
            </div>
            
            {/* Scenario Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {scenarios.map((scenario, index) => {
                const isSelected = selectedScenarioId === scenario.id;
                return (
                  <div
                    key={scenario.id}
                    onClick={() => setSelectedScenarioId(scenario.id)}
                    className={`cursor-pointer p-8 rounded-2xl border-2 transition-all duration-300 animate-fade-up ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-[0_8px_32px_hsl(var(--primary)/0.3)] scale-[1.02]'
                        : 'border-border/50 bg-card/40 hover:border-primary/40 hover:bg-card/60'
                    }`}
                    style={{ animationDelay: `${index * 0.15}s` }}
                  >
                    <div className="space-y-5">
                      {/* Probability Badge */}
                      <div className={`text-5xl font-bold mb-3 transition-all duration-300 ${
                        isSelected ? 'text-primary scale-110' : 'text-primary/70'
                      }`}>
                        {scenario.probability}%
                      </div>
                      
                      {/* Summary */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3 leading-tight">
                          {scenario.summary}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {scenario.explanation}
                        </p>
                      </div>
                      
                      {/* Selection Indicator */}
                      {isSelected && (
                        <div className="mt-4 pt-4 border-t border-primary/20 text-center">
                          <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                            Selected
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Create Market Button - Below Cards */}
            <div className="flex justify-center">
              <Button 
                onClick={handleCreateQuantumMarket}
                disabled={isCreatingMarket || selectedScenarioId === null}
                className="px-12 group/create"
                size="lg"
              >
                {isCreatingMarket ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                    Creating Market...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Create Quantum Market
                    <ChevronRight className="w-4 h-4 ml-1 group-hover/create:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Active Quantum Markets */}
      {quantumMarketIds.length > 0 && (
        <section className="pb-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12 flex items-center justify-between">
              <div>
                <h2 className="text-4xl font-bold tracking-tight mb-2">
                  Quantum Markets
                </h2>
                <p className="text-muted-foreground">AI-generated prediction markets</p>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-semibold text-primary">{quantumMarketIds.length} Active</span>
              </div>
            </div>
            <div className="space-y-6">
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
            <div className="mb-12 flex items-center justify-between">
              <div>
                <h2 className="text-4xl font-bold tracking-tight mb-2">
                  Everything Markets
                </h2>
                <p className="text-muted-foreground">Traditional binary prediction markets</p>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border/50">
                <span className="text-sm font-semibold text-muted-foreground">{everythingMarketIds.length} Active</span>
              </div>
            </div>
            <div className="space-y-6">
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
  const navigate = useNavigate();
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
      onClick={() => navigate(isQuantum ? `/quantum-market/${marketId}` : `/everything-market/${marketId}`)}
      className="glass-card p-8 animate-fade-up hover:border-primary/40 transition-all cursor-pointer"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      {/* Question Header */}
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-2xl font-bold text-foreground flex-1 leading-tight">
          {marketInfo.question}
        </h3>
        {marketInfo.resolved && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-primary font-bold text-xs uppercase tracking-wider">Resolved</span>
          </div>
        )}
      </div>

      {/* Outcomes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

      {/* Time Remaining */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground border-t border-border/30 pt-4">
        <Clock className="w-4 h-4" />
        <span className="font-medium">{timeLeft} remaining</span>
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
    <div 
      onClick={(e) => {
        e.stopPropagation();
        onPlaceBet();
      }}
      className={`relative border-2 ${
        isWinner 
          ? 'border-primary bg-primary/10' 
          : 'border-border/50 bg-card/40'
      } rounded-xl p-5 hover:border-primary/60 transition-all group cursor-pointer`}
    >
      {/* Winner Badge */}
      {isWinner && (
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
          <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
      )}
      
      <div className="space-y-4">
        {/* Label */}
        <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
          {isQuantum ? 'Scenario' : 'Outcome'} {outcomeIndex + 1}
        </div>
        
        {/* Outcome Name */}
        <div className="text-lg font-bold leading-tight min-h-[3rem] flex items-center">
          {outcomeName}
        </div>
        
        {/* Pool Size */}
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/30">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-foreground">{poolFormatted}</span>
            <span className="text-muted-foreground">USDC</span>
          </div>
        </div>
        
        {/* Bet Button */}
        {!resolved && (
          <Button
            onClick={onPlaceBet}
            size="sm"
            className="w-full group/bet"
            variant={isWinner ? "default" : "outline"}
          >
            Place Bet
            <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover/bet:translate-x-1 transition-transform" />
          </Button>
        )}
      </div>
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
      {/* Market Question */}
      <div className="pb-4 border-b border-border/50">
        <h3 className="text-xl font-bold leading-snug text-foreground">
          {marketInfo.question}
        </h3>
      </div>
      
      {/* Outcome Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Select Outcome
        </Label>
        <RadioGroup value={selectedOutcome} onValueChange={setSelectedOutcome} className="space-y-2">
          {marketInfo.outcomes.map((outcome, index) => (
            <div 
              key={index} 
              className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedOutcome === String(index)
                  ? 'border-primary bg-primary/10'
                  : 'border-border/50 hover:border-primary/40 bg-card/40'
              }`}
            >
              <RadioGroupItem value={String(index)} id={`outcome-${index}`} />
              <Label htmlFor={`outcome-${index}`} className="cursor-pointer text-base font-semibold flex-1">
                {outcome}
              </Label>
              {selectedOutcome === String(index) && (
                <Sparkles className="w-4 h-4 text-primary" />
              )}
            </div>
          ))}
        </RadioGroup>
      </div>
      
      {/* Amount Input */}
      <div className="space-y-3">
        <Label htmlFor="amount" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Bet Amount
        </Label>
        <div className="relative">
          <Input
            id="amount"
            type="number"
            placeholder="100"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            className="h-14 text-lg font-semibold pr-16 bg-input/50 border-border/50 focus:border-primary/60 rounded-xl"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
            USDC
          </div>
        </div>
      </div>
      
      {/* Confirm Button */}
      <Button
        onClick={onConfirm}
        className="w-full group/confirm"
        size="lg"
      >
        <Zap className="w-4 h-4 mr-2" />
        Confirm Bet
        <ChevronRight className="w-4 h-4 ml-1 group-hover/confirm:translate-x-1 transition-transform" />
      </Button>
    </div>
  );
};

export default Index;
