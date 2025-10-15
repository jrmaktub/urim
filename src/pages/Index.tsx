import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Clock, TrendingUp } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  // Mock market data
  const markets = [
    {
      id: 1,
      question: "Will ETH reach $5000 by end of 2025?",
      optionA: "Yes",
      optionB: "No",
      poolA: "12,500",
      poolB: "8,300",
      timeLeft: "6d 14h",
    },
    {
      id: 2,
      question: "Will Bitcoin ETF approval boost BTC above $100k?",
      optionA: "Yes",
      optionB: "No",
      poolA: "24,100",
      poolB: "15,900",
      timeLeft: "3d 8h",
    },
    {
      id: 3,
      question: "Base network to surpass 10M daily transactions?",
      optionA: "Yes",
      optionB: "No",
      poolA: "7,200",
      poolB: "5,800",
      timeLeft: "12d 4h",
    },
    {
      id: 4,
      question: "PYUSD to become top stablecoin on Base?",
      optionA: "Yes",
      optionB: "No",
      poolA: "9,400",
      poolB: "11,200",
      timeLeft: "8d 16h",
    },
    {
      id: 5,
      question: "Next Fed rate cut in Q1 2025?",
      optionA: "Yes",
      optionB: "No",
      poolA: "18,600",
      poolB: "14,300",
      timeLeft: "2d 12h",
    },
    {
      id: 6,
      question: "AI tokens to outperform major crypto?",
      optionA: "Yes",
      optionB: "No",
      poolA: "6,700",
      poolB: "9,100",
      timeLeft: "15d 20h",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-background">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-6xl mx-auto text-center animate-fade-up">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
            QUANTUM BETS
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Predict the future. Earn PYUSD. Built on Base.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => navigate("/create")}
              className="min-w-[200px]"
            >
              Create Bet
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/markets")}
              className="min-w-[200px]"
            >
              Explore Markets
            </Button>
          </div>
        </div>
      </section>

      {/* Markets Grid */}
      <section className="pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market, index) => (
              <div
                key={market.id}
                className="gold-card p-6 animate-fade-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Question */}
                <h3 className="text-lg font-bold mb-6 text-foreground leading-tight">
                  {market.question}
                </h3>

                {/* Bet Options */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
                    <span className="text-xs opacity-60">STAKE A</span>
                    <span className="text-base font-bold">{market.optionA}</span>
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <TrendingUp className="w-3 h-3" />
                      <span>{market.poolA} PYUSD</span>
                    </div>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
                    <span className="text-xs opacity-60">STAKE B</span>
                    <span className="text-base font-bold">{market.optionB}</span>
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <TrendingUp className="w-3 h-3" />
                      <span>{market.poolB} PYUSD</span>
                    </div>
                  </Button>
                </div>

                {/* Time Left */}
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
