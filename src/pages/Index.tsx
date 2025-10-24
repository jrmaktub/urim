import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      <Navigation />

      {/* Hero Section */}
      <section className="relative max-w-6xl mx-auto px-6 pt-32 pb-20">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-6 shimmer-text">
            Predict. Bet. Win.
          </h1>
          <p className="text-muted-foreground text-xl max-w-2xl mx-auto">
            AI-powered prediction markets on Base Sepolia. Simple, fast, and transparent.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Quantum Markets Card */}
          <div className="glass-card p-8 space-y-6 group hover:border-primary/50 transition-all duration-300">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center glow-gold">
              <Sparkles className="w-7 h-7 text-background" />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-3xl font-bold">Quantum Markets</h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                AI-generated prediction markets with multiple scenarios. Bet on complex outcomes with intelligent probability distributions.
              </p>
            </div>

            <Button
              onClick={() => navigate('/quantum-market/0')}
              className="w-full group-hover:shadow-[0_0_25px_hsl(var(--primary)/0.5)] transition-all"
              size="lg"
            >
              Go to Markets
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Everything Bets Card */}
          <div className="glass-card p-8 space-y-6 group hover:border-primary/50 transition-all duration-300">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center glow-gold">
              <TrendingUp className="w-7 h-7 text-background" />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-3xl font-bold">Everything Bets</h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Traditional binary prediction markets. Simple Yes/No questions with real-time odds and instant settlement.
              </p>
            </div>

            <Button
              onClick={() => navigate('/everything-market/0')}
              className="w-full group-hover:shadow-[0_0_25px_hsl(var(--primary)/0.5)] transition-all"
              size="lg"
            >
              Go to Markets
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
