import { useState } from "react";
import { Brain, TrendingUp, Coins, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

const DecisionFlow = () => {
  const [step, setStep] = useState(1);
  const [decision, setDecision] = useState("");

  const steps = [
    {
      number: 1,
      icon: Brain,
      title: "Input Decision",
      description: "Describe the choice you're facing",
    },
    {
      number: 2,
      icon: TrendingUp,
      title: "Generate Outcomes",
      description: "AI simulates all possible futures",
    },
    {
      number: 3,
      icon: Coins,
      title: "Predict & Bet",
      description: "Stake on the most likely outcome",
    },
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4 animate-fade-up">
          <h2 className="text-5xl font-bold tracking-tight">
            How It Works
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Three simple steps to explore the quantum multiverse of your decisions
          </p>
        </div>

        {/* Steps Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {steps.map((s) => {
            const Icon = s.icon;
            const isActive = step === s.number;
            const isCompleted = step > s.number;

            return (
              <button
                key={s.number}
                onClick={() => setStep(s.number)}
                className={`
                  relative p-6 rounded-2xl transition-all duration-500
                  ${isActive ? 'glass-card glow-primary scale-105' : 'glass-card opacity-60 hover:opacity-80'}
                `}
              >
                {/* Step Number Badge */}
                <div className={`
                  inline-flex items-center justify-center w-12 h-12 rounded-full mb-4
                  ${isActive ? 'bg-primary text-primary-foreground glow-primary' : 'bg-muted'}
                  ${isCompleted ? 'bg-accent text-accent-foreground' : ''}
                  transition-all duration-300
                `}>
                  {isCompleted ? (
                    <ArrowRight className="w-6 h-6" />
                  ) : (
                    <Icon className="w-6 h-6" />
                  )}
                </div>

                {/* Step Content */}
                <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.description}</p>

                {/* Active Indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-primary to-secondary rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Step Content Area */}
        <div className="glass-card p-8 md:p-12 rounded-3xl min-h-[400px] animate-scale-in">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <Brain className="w-16 h-16 mx-auto mb-4 text-primary animate-float" />
                <h3 className="text-3xl font-bold mb-2">What's Your Decision?</h3>
                <p className="text-muted-foreground">
                  Describe the choice or scenario you want to explore
                </p>
              </div>

              <div className="max-w-2xl mx-auto space-y-4">
                <Input
                  placeholder="e.g., Should I launch my startup now or wait 6 months?"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  className="h-14 text-lg glass-card border-primary/30"
                />
                
                <Textarea
                  placeholder="Add context (optional): current situation, constraints, goals..."
                  className="min-h-[120px] glass-card border-primary/30"
                />

                <Button
                  onClick={() => setStep(2)}
                  className="w-full h-14 text-lg rounded-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 glow-primary"
                >
                  Generate Quantum Paths
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 text-secondary animate-float" />
                <h3 className="text-3xl font-bold mb-2">Simulated Outcomes</h3>
                <p className="text-muted-foreground">
                  AI has generated 5 possible futures based on quantum probability
                </p>
              </div>

              <div className="grid gap-4">
                {[
                  { outcome: "Launch now, gain early market advantage", probability: 42, trend: "+$2.4M ARR" },
                  { outcome: "Wait 6 months, perfect product-market fit", probability: 28, trend: "+$1.8M ARR" },
                  { outcome: "Launch now, pivot after 3 months", probability: 15, trend: "+$900K ARR" },
                  { outcome: "Wait and lose market opportunity", probability: 10, trend: "-$500K" },
                  { outcome: "Launch now, viral growth unexpected", probability: 5, trend: "+$10M ARR" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="glass-card p-6 hover:border-primary/50 transition-all duration-300 cursor-pointer group"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-medium group-hover:text-primary transition-colors">
                        {item.outcome}
                      </span>
                      <span className={`text-sm font-bold ${item.trend.startsWith('+') ? 'text-accent' : 'text-destructive'}`}>
                        {item.trend}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-1000"
                          style={{ width: `${item.probability}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground min-w-[48px]">
                        {item.probability}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex-1 h-12 rounded-full glass-card border-primary/30"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="flex-1 h-12 rounded-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 glow-primary"
                >
                  Predict Outcomes
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <Coins className="w-16 h-16 mx-auto mb-4 text-accent animate-float" />
                <h3 className="text-3xl font-bold mb-2">Place Your Prediction</h3>
                <p className="text-muted-foreground">
                  Stake testnet tokens on the outcome you believe is most likely
                </p>
              </div>

              <div className="max-w-2xl mx-auto space-y-6">
                {/* Selected Outcome */}
                <div className="glass-card p-6 glow-primary">
                  <div className="text-sm text-muted-foreground mb-2">Selected Outcome</div>
                  <div className="text-lg font-semibold">Launch now, gain early market advantage</div>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-muted-foreground">Probability</span>
                    <span className="text-2xl font-bold text-primary">42%</span>
                  </div>
                </div>

                {/* Stake Amount */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Stake Amount (Testnet Tokens)</label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="100"
                      className="h-14 text-lg glass-card border-primary/30 pr-20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                      TEST
                    </span>
                  </div>
                </div>

                {/* Potential Returns */}
                <div className="glass-card p-6 bg-accent/10 border-accent/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Potential Return</span>
                    <span className="text-2xl font-bold text-accent">+238 TEST</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    If this outcome occurs, you'll receive your stake plus winnings
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={() => setStep(2)}
                    variant="outline"
                    className="flex-1 h-12 rounded-full glass-card border-primary/30"
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1 h-12 rounded-full bg-gradient-to-r from-accent to-primary hover:opacity-90 glow-primary"
                  >
                    Confirm Prediction
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DecisionFlow;
