import { useState } from "react";
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

interface Scenario {
  id: number;
  title: string;
  summary: string;
  pool: string;
}

interface Market {
  id: number;
  question: string;
  timeLeft: string;
  scenarios: { text: string; pool: string }[];
}

const Index = () => {
  const { toast } = useToast();
  const [situation, setSituation] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [betAmount, setBetAmount] = useState("");

  // Active Quantum Markets
  const activeQuantumMarkets: Market[] = [
    {
      id: 1,
      question: "Will Bitcoin reach $150k in 2025?",
      timeLeft: "6d 14h",
      scenarios: [
        { text: "Yes, by Q2", pool: "12,400" },
        { text: "Yes, by Q4", pool: "8,300" },
        { text: "No", pool: "6,100" },
      ],
    },
    {
      id: 2,
      question: "Next Fed rate decision?",
      timeLeft: "3d 8h",
      scenarios: [
        { text: "Cut 0.25%", pool: "18,200" },
        { text: "Hold steady", pool: "24,100" },
        { text: "Raise 0.25%", pool: "3,800" },
      ],
    },
  ];

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
      // Simulate AI generation with particle animation
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const generated: Scenario[] = [
        {
          id: 1,
          title: "Scenario 1: High Probability",
          summary: "Yes, within 30 days",
          pool: "0",
        },
        {
          id: 2,
          title: "Scenario 2: Medium Probability",
          summary: "Yes, but after 30 days",
          pool: "0",
        },
        {
          id: 3,
          title: "Scenario 3: Low Probability",
          summary: "No, it will not happen",
          pool: "0",
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

  const handlePlaceBet = (market: Market) => {
    setSelectedMarket(market);
    setSelectedScenario("");
    setBetAmount("");
    setBetModalOpen(true);
  };

  const handleConfirmBet = () => {
    if (!selectedScenario || !betAmount) {
      toast({
        title: "Missing Information",
        description: "Please select a scenario and enter bet amount.",
        variant: "destructive",
      });
      return;
    }

    // Simulate on-chain bet
    toast({
      title: "Bet Placed! ⚡",
      description: `${betAmount} USDC on "${selectedScenario}"`,
    });
    setBetModalOpen(false);
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
                className="flex-1 h-14 border-2 border-primary hover:border-primary-glow glow-primary"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-5 h-5 animate-spin" />
                    Simulating possible futures...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Scenarios
                  </>
                )}
              </Button>
              <Button
                size="lg"
                className="flex-1 h-14 bg-gradient-to-r from-secondary to-secondary-glow hover:opacity-90 glow-teal"
                onClick={() => window.location.href = '/everything-bets'}
              >
                Everything Bets
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
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="w-4 h-4" />
                      <span>{scenario.pool} USDC</span>
                    </div>
                  </div>
                  <Button className="w-full bg-gradient-to-r from-primary to-primary-dark glow-primary">
                    Create Market
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Active Quantum Markets */}
      <section className="pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold mb-10 text-center text-primary">
            Active Quantum Markets
          </h2>
          <div className="grid grid-cols-1 gap-8">
            {activeQuantumMarkets.map((market, marketIndex) => (
              <div
                key={market.id}
                className="glass-card p-8 animate-fade-up"
                style={{ animationDelay: `${marketIndex * 0.1}s` }}
              >
                <h3 className="text-2xl font-bold mb-6 text-foreground">
                  {market.question}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  {market.scenarios.map((scenario, index) => (
                    <div
                      key={index}
                      className="border border-primary/25 rounded-2xl p-6 hover:border-primary transition-all duration-300"
                    >
                      <div className="text-xs text-primary font-bold mb-2">
                        SCENARIO {index + 1}
                      </div>
                      <div className="text-lg font-bold mb-4">{scenario.text}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                        <TrendingUp className="w-4 h-4" />
                        <span>{scenario.pool} USDC</span>
                      </div>
                      <Button
                        onClick={() => handlePlaceBet(market)}
                        className="w-full bg-gradient-to-r from-primary to-primary-dark glow-primary"
                      >
                        Place Bet
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground border-t border-primary/25 pt-4">
                  <Clock className="w-4 h-4" />
                  <span>{market.timeLeft} remaining</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bet Modal */}
      <Dialog open={betModalOpen} onOpenChange={setBetModalOpen}>
        <DialogContent className="bg-card border-primary/25">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Place Your Bet</DialogTitle>
          </DialogHeader>
          {selectedMarket && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">{selectedMarket.question}</h3>
                <RadioGroup value={selectedScenario} onValueChange={setSelectedScenario}>
                  {selectedMarket.scenarios.map((scenario, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-3">
                      <RadioGroupItem value={scenario.text} id={`scenario-${index}`} />
                      <Label htmlFor={`scenario-${index}`} className="cursor-pointer">
                        {scenario.text} ({scenario.pool} USDC)
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
                onClick={handleConfirmBet}
                className="w-full h-14 bg-gradient-to-r from-primary to-primary-dark glow-primary"
              >
                <Zap className="w-5 h-5 mr-2" />
                Confirm Bet
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Index;
