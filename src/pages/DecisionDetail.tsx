import { useState } from "react";
import { ArrowLeft, ExternalLink, Clock, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import OutcomeCard from "@/components/OutcomeCard";
import BetModal from "@/components/BetModal";

const DecisionDetail = () => {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);

  const mockDecision = {
    id: 1,
    title: "Should I launch my product next week?",
    context: "Currently have MVP ready, 500 waitlist signups, limited marketing budget.",
    created: "2h ago",
    totalPool: "12.4 ETH",
    participants: 28,
    outcomes: [
      { id: 1, title: "Launch next week - early advantage", odds: 42, pool: "5.2 ETH" },
      { id: 2, title: "Wait 1 month - better product fit", odds: 28, pool: "3.5 ETH" },
      { id: 3, title: "Launch + pivot in 2 weeks", odds: 20, pool: "2.5 ETH" },
      { id: 4, title: "Wait 3 months - lose momentum", odds: 10, pool: "1.2 ETH" },
    ],
  };

  const handleBet = (outcomeTitle: string) => {
    setSelectedOutcome(outcomeTitle);
  };

  return (
    <div className="min-h-screen w-full">
      <Navigation />
      
      <section className="min-h-screen px-6 pt-32 pb-12">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Back Button */}
          <a href="/markets" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Markets
          </a>

          {/* Decision Header */}
          <div className="glass-card p-8 md:p-12 rounded-2xl space-y-6 animate-fade-up">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                {mockDecision.title}
              </h1>
              
              <p className="text-lg text-muted-foreground">
                {mockDecision.context}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-border/50">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  <span>Total Pool</span>
                </div>
                <div className="text-2xl font-bold text-primary">{mockDecision.totalPool}</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>Participants</span>
                </div>
                <div className="text-2xl font-bold">{mockDecision.participants}</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Created</span>
                </div>
                <div className="text-lg font-semibold">{mockDecision.created}</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ExternalLink className="w-4 h-4" />
                  <span>Contract</span>
                </div>
                <a 
                  href="https://sepolia.etherscan.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View on Etherscan
                </a>
              </div>
            </div>
          </div>

          {/* Outcomes */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Outcome Branches
              </span>
            </h2>

            <div className="grid gap-6 md:grid-cols-2 animate-scale-in">
              {mockDecision.outcomes.map((outcome, i) => (
                <div key={outcome.id} style={{ animationDelay: `${i * 100}ms` }}>
                  <OutcomeCard
                    title={outcome.title}
                    odds={outcome.odds}
                    poolSize={outcome.pool}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Simple Chart Placeholder */}
          <div className="glass-card p-8 rounded-2xl space-y-4">
            <h3 className="text-xl font-semibold">Odds Over Time</h3>
            <div className="h-64 flex items-end justify-between gap-2">
              {[45, 52, 48, 55, 42, 38, 42, 45, 48, 42].map((height, i) => (
                <div key={i} className="flex-1 bg-gradient-to-t from-primary/20 to-primary rounded-t" style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>2h ago</span>
              <span>1h ago</span>
              <span>30m ago</span>
              <span>Now</span>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {selectedOutcome && (
        <BetModal
          outcomeName={selectedOutcome}
          onClose={() => setSelectedOutcome(null)}
        />
      )}
    </div>
  );
};

export default DecisionDetail;
