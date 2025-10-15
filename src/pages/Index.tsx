import { useState } from "react";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Clock, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { toast } = useToast();
  const [situation, setSituation] = useState("");
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Mock active markets
  const activeMarkets = [
    {
      id: 1,
      question: "Will Bitcoin reach $150k in 2025?",
      outcomes: [
        { text: "Yes, by Q2", pool: "12,400" },
        { text: "Yes, by Q4", pool: "8,300" },
        { text: "No", pool: "6,100" },
      ],
      timeLeft: "6d 14h",
    },
    {
      id: 2,
      question: "Next Fed rate decision?",
      outcomes: [
        { text: "Cut 0.25%", pool: "18,200" },
        { text: "Hold steady", pool: "24,100" },
        { text: "Raise 0.25%", pool: "3,800" },
      ],
      timeLeft: "3d 8h",
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
      // Simulate AI generation
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock AI-generated scenarios
      const generated = [
        {
          id: 1,
          outcome: "Yes, within 30 days",
          pool: "0",
          probability: "45%",
        },
        {
          id: 2,
          outcome: "Yes, but after 30 days",
          pool: "0",
          probability: "30%",
        },
        {
          id: 3,
          outcome: "No, it will not happen",
          pool: "0",
          probability: "25%",
        },
      ];

      setScenarios(generated);
      toast({
        title: "Scenarios Generated ⚡",
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

  return (
    <div className="min-h-screen w-full bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center animate-fade-up">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-6 text-primary">
            QUANTUM BETS
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
            Describe any situation — AI predicts the possibilities. You decide the outcome.
          </p>

          {/* Input Section */}
          <div className="max-w-2xl mx-auto space-y-4">
            <Input
              placeholder="e.g. Will Solana outperform Ethereum next month?"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              className="h-16 text-lg"
            />
            <div className="flex gap-4">
              <Button
                onClick={handleGenerateScenarios}
                disabled={isGenerating}
                size="lg"
                className="flex-1 h-14"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-5 h-5 animate-spin" />
                    Generating Scenarios...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Scenarios
                  </>
                )}
              </Button>
              <Link to="/everything-bets" className="flex-1">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-14 border-2 border-primary hover:bg-primary hover:text-black transition-all"
                >
                  Create Classic Bet
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Generated Scenarios */}
      {scenarios.length > 0 && (
        <section className="pb-16 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-primary">AI-Generated Outcomes</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {scenarios.map((scenario, index) => (
                <div
                  key={scenario.id}
                  className="gold-card p-6 animate-fade-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="mb-4">
                    <div className="text-xs text-muted-foreground mb-2">OUTCOME {index + 1}</div>
                    <h3 className="text-lg font-bold text-foreground mb-3">
                      {scenario.outcome}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-primary mb-4">
                      <TrendingUp className="w-4 h-4" />
                      <span>{scenario.pool} PYUSD</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full">
                    Bet on this outcome
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
          <h2 className="text-3xl font-bold mb-8 text-primary">Active Quantum Markets</h2>
          <div className="space-y-8">
            {activeMarkets.map((market, marketIndex) => (
              <div
                key={market.id}
                className="gold-card p-6 animate-fade-up"
                style={{ animationDelay: `${marketIndex * 0.1}s` }}
              >
                <h3 className="text-xl font-bold mb-6 text-foreground">{market.question}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {market.outcomes.map((outcome, index) => (
                    <div key={index} className="border border-primary/30 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-2">OUTCOME {index + 1}</div>
                      <div className="text-base font-bold mb-3">{outcome.text}</div>
                      <div className="flex items-center gap-2 text-sm text-primary mb-3">
                        <TrendingUp className="w-4 h-4" />
                        <span>{outcome.pool} PYUSD</span>
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        Bet on this
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground border-t border-primary/20 pt-4">
                  <Clock className="w-4 h-4" />
                  <span>{market.timeLeft} remaining</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
