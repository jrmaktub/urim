import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
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
          <Link to="/quantum-bets" className="glass-card p-8 space-y-6 hover:border-primary/50 transition-all block">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center glow-gold">
              <Sparkles className="w-7 h-7 text-background" />
            </div>
            <h2 className="text-3xl font-bold">Quantum Bets</h2>
            <p className="text-muted-foreground">Type a situation/question, trigger the effect, then pick one of 3 AI scenarios.</p>
          </Link>

          {/* Right: Everything Bets */}
          <Link to="/everything-bets" className="glass-card p-8 space-y-6 hover:border-primary/50 transition-all block">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center glow-gold">
              <TrendingUp className="w-7 h-7 text-background" />
            </div>
            <h2 className="text-3xl font-bold">Everything Bets</h2>
            <p className="text-muted-foreground">Traditional Yes/No markets. Keep using the existing flow.</p>
          </Link>
        </div>

      </section>

      <Footer />
    </div>
  );
};

export default Index;
