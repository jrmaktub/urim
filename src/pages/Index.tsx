import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import PythPriceTicker from "@/components/PythPriceTicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Clock, TrendingUp, Zap, ChevronRight, Users, DollarSign, Brain, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
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
  reasoning: string;
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
  const [showQuantumEffect, setShowQuantumEffect] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [expandedReasoning, setExpandedReasoning] = useState<number | null>(null);

  const { everythingMarketIds, quantumMarketIds } = useAllMarkets();

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 1500);
    return () => clearTimeout(timer);
  }, []);

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
    setShowQuantumEffect(true);
    setScenarios([]);
    setSelectedScenarioId(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-scenarios', {
        body: { question: situation }
      });

      if (error) throw error;

      if (data?.scenarios) {
        // Calculate probabilities that sum to 100
        const scenarioCount = data.scenarios.length;
        const baseProb = Math.floor(100 / scenarioCount);
        const remainder = 100 - (baseProb * scenarioCount);
        
        const generatedScenarios = data.scenarios.map((s: any, idx: number) => ({
          id: idx + 1,
          title: s.title || `Scenario ${idx + 1}`,
          summary: s.description,
          probability: baseProb + (idx === 0 ? remainder : 0), // Add remainder to first scenario
          reasoning: s.reasoning || `AI predicts a ${baseProb + (idx === 0 ? remainder : 0)}% likelihood based on current trends and historical patterns.`
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
      setTimeout(() => setShowQuantumEffect(false), 2000);
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
        title: "Quantum Bet placed successfully! ⚡",
        description: "Your bet is placed on your selected future.",
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

      const successMessage = selectedIsQuantum 
        ? "✅ Bet placed successfully on your selected Quantum outcome!"
        : "✅ Bet placed successfully!";
      
      toast({
        title: "Bet Placed Successfully! ⚡",
        description: successMessage,
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
      {/* Intro Animation Overlay */}
      {showIntro && (
        <div className="fixed inset-0 z-50 bg-background flex items-center justify-center animate-fade-out" style={{ animationDelay: '1s' }}>
          <div className="text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary animate-glow" />
            </div>
            <h1 className="text-4xl font-bold shimmer-text">URIM</h1>
          </div>
        </div>
      )}

      {/* Quantum Ripple Effect Overlay */}
      {showQuantumEffect && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center overflow-hidden">
          {/* Central text */}
          <div className="absolute z-20 text-center space-y-4 animate-fade-in">
            <div className="flex items-center justify-center gap-3">
              <Brain className="w-8 h-8 text-primary animate-pulse" />
              <span className="text-2xl font-bold text-primary shimmer-text">
                Running quantum simulation
              </span>
            </div>
            <div className="flex gap-2 justify-center">
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
          
          {/* Quantum ripples */}
          <div className="absolute w-32 h-32 rounded-full border-4 border-primary/40 animate-quantum-ripple" />
          <div className="absolute w-24 h-24 rounded-full border-4 border-primary/60 animate-quantum-ripple" style={{ animationDelay: '0.3s' }} />
          <div className="absolute w-40 h-40 rounded-full bg-primary/5 animate-quantum-burst" />
          
          {/* Particle swirls */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full bg-primary/60 animate-particle-swirl"
              style={{
                left: '50%',
                top: '50%',
                animationDelay: `${i * 0.25}s`,
                animationDuration: '3s'
              }}
            />
          ))}
        </div>
      )}

      <Navigation />
      <PythPriceTicker />
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
                <h2 className="text-3xl font-bold mb-3 tracking-tight">Quantum Futures</h2>
                <p className="text-muted-foreground leading-relaxed">
                  AI will predict 3 possible outcomes. Choose the one you believe will happen.
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
                  className="w-full group/btn relative overflow-hidden hover:scale-[1.02] transition-all duration-300"
                  size="lg"
                >
                  <span className="relative z-10 flex items-center">
                     {isGenerating ? (
                      <>
                        <Brain className="w-4 h-4 mr-2 animate-pulse" />
                        <span className="flex items-center gap-2">
                          Running quantum simulation
                          <span className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-primary-foreground rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                            <span className="w-1.5 h-1.5 bg-primary-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                            <span className="w-1.5 h-1.5 bg-primary-foreground rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                          </span>
                        </span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 group-hover/btn:rotate-12 transition-transform" />
                        Generate Quantum Futures
                        <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                      </>
                    )}
                  </span>
                  {isGenerating && (
                    <>
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-1.5 h-1.5 bg-primary-foreground rounded-full animate-quantum-burst"
                          style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 0.3}s`,
                            animationDuration: '1s'
                          }}
                        />
                      ))}
                      <div className="absolute inset-0 border-2 border-primary-foreground/30 rounded-xl opacity-0 animate-ping" style={{ animationDuration: '1.5s' }} />
                    </>
                  )}
                </Button>
                
                {/* Price Feed Warning */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-yellow-600 dark:text-yellow-400">
                    ⚠️ Missing Pyth Price Feed ID — winnings cannot be calculated until a valid feed is used.
                  </p>
                </div>
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
                Your Quantum Futures
              </h2>
              <p className="text-muted-foreground text-lg">
                Select the future you believe will happen
              </p>
            </div>
            
            {/* Scenario Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {scenarios.map((scenario, index) => {
                const isSelected = selectedScenarioId === scenario.id;
                const isReasoningExpanded = expandedReasoning === scenario.id;
                const glowIntensity = scenario.probability / 100;
                
                return (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    index={index}
                    isSelected={isSelected}
                    isReasoningExpanded={isReasoningExpanded}
                    glowIntensity={glowIntensity}
                    onSelect={() => setSelectedScenarioId(scenario.id)}
                    onToggleReasoning={() => setExpandedReasoning(isReasoningExpanded ? null : scenario.id)}
                  />
                );
              })}
            </div>

            {/* Create Market & Place Bet Button - Below Cards */}
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
                    Create Market & Place Bet
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

interface ScenarioCardProps {
  scenario: Scenario;
  index: number;
  isSelected: boolean;
  isReasoningExpanded: boolean;
  glowIntensity: number;
  onSelect: () => void;
  onToggleReasoning: () => void;
}

const ScenarioCard = ({ 
  scenario, 
  index, 
  isSelected, 
  isReasoningExpanded, 
  glowIntensity,
  onSelect, 
  onToggleReasoning 
}: ScenarioCardProps) => {
  const [displayedProb, setDisplayedProb] = useState(0);

  // Animate probability count-up
  useEffect(() => {
    let start = 0;
    const end = scenario.probability;
    const duration = 1500; // 1.5 seconds
    const startTime = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out curve
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (end - start) * easeOut);
      
      setDisplayedProb(current);
      
      if (progress >= 1) {
        clearInterval(timer);
        setDisplayedProb(end);
      }
    }, 16); // ~60fps

    return () => clearInterval(timer);
  }, [scenario.probability]);

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer p-8 rounded-2xl border-2 transition-all duration-300 animate-slide-in hover-glow relative overflow-hidden ${
        isSelected
          ? 'border-primary bg-primary/10 shadow-xl shadow-primary/30 scale-105'
          : 'border-border/50 bg-card/40 hover:border-primary/40 hover:bg-card/60 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10'
      }`}
      style={{ 
        animationDelay: `${index * 0.15}s`,
        boxShadow: isSelected 
          ? `0 0 ${20 + glowIntensity * 40}px hsl(var(--primary) / ${0.2 + glowIntensity * 0.3})`
          : undefined
      }}
    >
      {/* Dynamic glow based on probability */}
      <div 
        className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 0%, hsl(var(--primary) / ${glowIntensity * 0.2}), transparent 70%)`
        }}
      />
      
      <div className="space-y-5 relative z-10">
        {/* Probability Chip */}
        <div className="flex items-center justify-between mb-2">
          <div 
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
              isSelected 
                ? 'bg-primary/20 border-primary/60' 
                : 'bg-muted/50 border-border/50'
            }`}
          >
            <Brain className={`w-3 h-3 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={`text-sm font-bold tabular-nums ${isSelected ? 'text-primary' : 'text-foreground'}`}>
              {displayedProb}%
            </span>
          </div>
          <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30'}`} />
        </div>

        {/* Scenario Content */}
        <div className="relative">
          <div className={`absolute -left-4 top-0 w-1 h-full rounded-full transition-all duration-300`}
            style={{
              background: isSelected 
                ? `linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--primary) / ${glowIntensity}))`
                : `hsl(var(--primary) / 0.2)`
            }}
          />
          <h3 className={`text-lg font-semibold mb-3 leading-tight transition-all ${
            isSelected ? 'text-primary shimmer-text' : ''
          }`}>
            {scenario.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {scenario.summary}
          </p>
        </div>
        
        {/* AI Reasoning Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleReasoning();
          }}
          className="w-full mt-4 pt-4 border-t border-border/30 flex items-center justify-between text-xs font-semibold text-primary hover:text-primary-glow transition-colors group"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-3 h-3" />
            AI Reasoning
          </span>
          {isReasoningExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
          )}
        </button>

        {/* Expanded Reasoning */}
        {isReasoningExpanded && (
          <div className="mt-3 p-4 rounded-xl bg-primary/5 border border-primary/20 animate-fade-in">
            <p className="text-xs text-muted-foreground leading-relaxed italic">
              "{scenario.reasoning}"
            </p>
          </div>
        )}
        
        {/* Selection Indicator */}
        {isSelected && (
          <div className="mt-4 pt-4 border-t border-primary/20 flex items-center justify-center gap-2 animate-fade-in">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Selected
            </span>
          </div>
        )}
      </div>
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
      className="glass-card p-8 animate-slide-in hover:border-primary/40 hover-glow cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 transition-all"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      {/* Question Header */}
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-2xl font-bold flex-1 leading-tight shimmer-text bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text">
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
          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' 
          : 'border-border/50 bg-card/40'
      } rounded-xl p-5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 transition-all group cursor-pointer`}
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
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/30 group-hover:border-primary/30 transition-all">
            <TrendingUp className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-foreground shimmer-text">{poolFormatted}</span>
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
