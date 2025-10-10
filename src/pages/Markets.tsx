import { TrendingUp, Users, Clock } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const Markets = () => {
  const mockMarkets = [
    {
      id: 1,
      title: "Should I launch my product next week?",
      outcomes: 4,
      totalPool: "12.4 ETH",
      participants: 28,
      created: "2h ago",
    },
    {
      id: 2,
      title: "Will interest rates drop in Q2?",
      outcomes: 3,
      totalPool: "8.7 ETH",
      participants: 42,
      created: "5h ago",
    },
    {
      id: 3,
      title: "Should I accept the job offer?",
      outcomes: 2,
      totalPool: "5.2 ETH",
      participants: 15,
      created: "1d ago",
    },
  ];

  return (
    <div className="min-h-screen w-full">
      <Navigation />
      
      <section className="min-h-screen px-6 pt-32 pb-12">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4 animate-fade-up">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Active Markets
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Trade on decision outcomes across the quantum prediction market.
            </p>
          </div>

          {/* Markets Grid */}
          <div className="grid gap-6 animate-scale-in">
            {mockMarkets.map((market, i) => (
              <a
                key={market.id}
                href={`/decision/${market.id}`}
                className="glass-card p-8 rounded-2xl border border-border hover:border-primary/50 transition-all duration-300 group"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="space-y-4">
                  {/* Title */}
                  <h3 className="text-2xl font-semibold group-hover:text-primary transition-colors">
                    {market.title}
                  </h3>

                  {/* Stats */}
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <TrendingUp className="w-4 h-4" />
                      <span>{market.outcomes} outcomes</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{market.participants} participants</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{market.created}</span>
                    </div>
                  </div>

                  {/* Pool Size */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <span className="text-sm text-muted-foreground">Total Pool</span>
                    <span className="text-xl font-bold text-primary">{market.totalPool}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Markets;
