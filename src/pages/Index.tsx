import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, TrendingUp } from "lucide-react";

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
  const [question, setQuestion] = useState("");
  const [generating, setGenerating] = useState(false);
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [userBets, setUserBets] = useState<UserBet[]>([]);

  // Restore previously placed bets (local)
  useEffect(() => {
    if (!address) return;
    const savedQuantum = localStorage.getItem(`quantumBets_${address}`);
    const savedEverything = localStorage.getItem(`userBets_${address}`);
    const q = savedQuantum ? JSON.parse(savedQuantum) : [];
    const e = savedEverything ? JSON.parse(savedEverything) : [];
    setUserBets([...(q || []), ...(e || [])]);
  }, [address]);

  const handleGenerate = () => {
    if (!question.trim()) return;
    setGenerating(true);
    setScenarios([]);
    setTimeout(() => {
      // Minimal placeholder for the original animation/effect
      setScenarios([
        `Scenario 1: ${question} — optimistic outcome`,
        `Scenario 2: ${question} — base case`,
        `Scenario 3: ${question} — downside risk`,
      ]);
      setGenerating(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      <Navigation />

      <section className="relative max-w-6xl mx-auto px-6 pt-28 pb-16">
        {/* Two cards side-by-side */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Quantum Bets */}
          <Link to="/" className="glass-card p-8 space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center glow-gold">
              <Sparkles className="w-7 h-7 text-background" />
            </div>
            <h2 className="text-3xl font-bold">Quantum Bets</h2>
            <p className="text-muted-foreground">Type a situation/question, trigger the effect, then pick one of 3 AI scenarios.</p>

            <div className="space-y-3">
              <Label htmlFor="q" className="text-sm font-semibold">Your Question</Label>
              <div className="flex gap-2">
                <Input id="q" placeholder="Will ETH hit $4k this month?" value={question} onChange={(e) => setQuestion(e.target.value)} />
                <Button onClick={handleGenerate}>Generate</Button>
              </div>
            </div>

            {/* Cool visual effect + scenarios */}
            {generating && (
              <div className="h-24 rounded-xl border border-primary/30 bg-primary/5 animate-enter" />
            )}
            {!generating && scenarios.length > 0 && (
              <div className="space-y-3 animate-fade-in">
                {scenarios.map((sc, i) => (
                  <div key={i} className="p-4 rounded-xl border-2 border-border/50 bg-card/40">
                    <div className="text-sm font-semibold mb-1">Scenario {i + 1}</div>
                    <div className="text-sm text-foreground/90">{sc}</div>
                  </div>
                ))}
              </div>
            )}
          </Link>

          {/* Right: Everything Bets */}
          <Link to="/everything-bets" className="glass-card p-8 space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center glow-gold">
              <TrendingUp className="w-7 h-7 text-background" />
            </div>
            <h2 className="text-3xl font-bold">Everything Bets</h2>
            <p className="text-muted-foreground">Traditional Yes/No markets. Keep using the existing flow.</p>
          </Link>
        </div>

        {/* Your Quantum Bets list (restored) */}
        {userBets.filter((b) => b.isQuantum).length > 0 && (
          <div className="mt-12 space-y-4">
            <h3 className="text-2xl font-bold">Your Quantum Bets</h3>
            {userBets.filter((b) => b.isQuantum).map((bet, idx) => (
              <div key={idx} className="glass-card p-6 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Market #{bet.marketId}</div>
                    <div className="text-lg font-semibold">{bet.question}</div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30">
                    <span className="text-primary font-bold text-xs uppercase">Active</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-muted-foreground">Outcome: </span>
                    <span className="font-semibold text-primary">{bet.outcome}</span>
                  </div>
                  <div>
                    <span className="font-semibold">{bet.amount} USDC</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
};

export default Index;
