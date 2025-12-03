"use client";

import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE_PRICE = 131.96;

type DemoSide = "YES" | "NO";

interface Market {
  question: string;
  icon: JSX.Element;
  color: "green" | "red" | "yellow";
}

interface DemoBet {
  question: string;
  side: DemoSide;
  amount: number;
  priceSnapshot: number;
  timestamp: Date;
}

interface PredictionCardProps {
  market: Market;
  onDemoBet: (data: { question: string; side: DemoSide; amount: number }) => void;
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const PredictionCard = ({ market, onDemoBet }: PredictionCardProps) => {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<DemoSide | null>(null);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);

  const handleClick = (side: DemoSide) => {
    const numericAmount = parseFloat(amount);

    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      setError("Please enter an amount to simulate a bet.");
      setLastFeedback(null);
      setLastAction(null);
      return;
    }

    setError(null);
    setLastAction(side);

    const formattedAmount = numericAmount.toFixed(2);
    const feedback = `Demo bet placed: You chose ${side} on “${market.question}” with $${formattedAmount}.`;
    setLastFeedback(feedback);

    onDemoBet({ question: market.question, side, amount: numericAmount });

    toast({
      title: "Demo bet placed",
      description: "Simulation only – no real funds moved.",
    });
  };

  return (
    <Card className="p-6 border-2 border-border/50 hover:border-primary/50 transition-all duration-300 bg-card/50 backdrop-blur-sm">
      <div className="space-y-5">
        {/* Question */}
        <div className="flex items-start gap-3">
          {market.icon}
          <h3 className="text-lg font-semibold leading-tight">{market.question}</h3>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Amount (USDC)</label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-background/50"
          />
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>

        {/* YES/NO Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => handleClick("YES")}
            className={cn(
              "bg-green-600 hover:bg-green-700 text-white font-semibold",
              lastAction === "YES" && "ring-2 ring-offset-2 ring-primary/60 ring-offset-background",
            )}
          >
            YES
          </Button>
          <Button
            onClick={() => handleClick("NO")}
            className={cn(
              "bg-red-600 hover:bg-red-700 text-white font-semibold",
              lastAction === "NO" && "ring-2 ring-offset-2 ring-primary/60 ring-offset-background",
            )}
          >
            NO
          </Button>
        </div>

        {/* Demo Badge & Feedback */}
        <div className="space-y-2">
          <div className="flex justify-center">
            <Badge variant="outline" className="text-xs">
              Demo Mode
            </Badge>
          </div>
          {lastFeedback && (
            <p className="text-xs text-muted-foreground text-center">
              ✅ Demo only – no real funds moved. {lastFeedback}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

const QuantumPythPrices = () => {
  const [currentPrice, setCurrentPrice] = useState<number>(BASE_PRICE);
  const [high24h, setHigh24h] = useState<number>(BASE_PRICE);
  const [low24h, setLow24h] = useState<number>(BASE_PRICE);
  const [change24hPercent, setChange24hPercent] = useState<number>(0);
  const [demoBets, setDemoBets] = useState<DemoBet[]>([]);

  useEffect(() => {
    // Initialize values on mount
    setCurrentPrice(BASE_PRICE);
    setHigh24h(BASE_PRICE);
    setLow24h(BASE_PRICE);
    setChange24hPercent(0);

    const interval = setInterval(() => {
      setCurrentPrice((prev) => {
        const maxDelta = prev * 0.003; // ±0.3%
        const delta = (Math.random() * 2 - 1) * maxDelta;
        const rawNext = prev + delta;
        const next = Math.max(0.01, parseFloat(rawNext.toFixed(2)));

        setHigh24h((h) => Math.max(h, next));
        setLow24h((l) => Math.min(l, next));
        setChange24hPercent(((next - BASE_PRICE) / BASE_PRICE) * 100);

        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const markets: Market[] = [
    {
      question: "Will SOL close above $132 tomorrow?",
      icon: <TrendingUp className="w-5 h-5 text-green-500" />,
      color: "green",
    },
    {
      question: "Will SOL drop below $129 in 24h?",
      icon: <TrendingDown className="w-5 h-5 text-red-500" />,
      color: "red",
    },
    {
      question: "Will SOL stay between $129–$132 for 24h?",
      icon: <Minus className="w-5 h-5 text-yellow-500" />,
      color: "yellow",
    },
  ];

  const handleRecordDemoBet = (data: { question: string; side: DemoSide; amount: number }) => {
    setDemoBets((prev) => [
      ...prev,
      {
        question: data.question,
        side: data.side,
        amount: data.amount,
        priceSnapshot: currentPrice,
        timestamp: new Date(),
      },
    ]);
  };

  const isChangePositive = change24hPercent > 0.05;
  const isChangeNegative = change24hPercent < -0.05;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="pt-28 sm:pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Quantum Pyth Prices
            </h1>
            <p className="text-muted-foreground text-lg">
              AI-generated futures from live-feeling Pyth-style price feeds (Demo)
            </p>
          </div>

          {/* Oracle Price Display */}
          <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-background via-background to-primary/5">
            <div className="absolute inset-0 bg-grid-pattern opacity-5" />
            <div className="relative p-8 space-y-6">
              <div className="flex items-center justify-center gap-3">
                <Activity className="w-8 h-8 text-primary animate-pulse" />
                <h2 className="text-2xl font-bold text-foreground">SOL/USD Oracle Price</h2>
              </div>

              <div className="text-center space-y-3">
                <div className="text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent glow-primary">
                  ${currentPrice.toFixed(2)}
                </div>
                <Badge variant="outline" className="border-primary/50 text-primary">
                  Simulated Pyth-style feed · Demo only
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/30">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">24h High</p>
                  <p className="text-lg font-semibold text-green-500">${high24h.toFixed(2)}</p>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">24h Low</p>
                  <p className="text-lg font-semibold text-red-500">${low24h.toFixed(2)}</p>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">24h Change</p>
                  <p
                    className={cn(
                      "text-lg font-semibold",
                      isChangePositive && "text-green-500",
                      isChangeNegative && "text-red-500",
                      !isChangePositive && !isChangeNegative && "text-muted-foreground",
                    )}
                  >
                    {change24hPercent >= 0 ? "+" : ""}
                    {change24hPercent.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Prediction Markets */}
          <div className="grid md:grid-cols-3 gap-6">
            {markets.map((market, index) => (
              <PredictionCard
                key={index}
                market={market}
                onDemoBet={handleRecordDemoBet}
              />
            ))}
          </div>

          {/* Your Demo Activity */}
          <Card className="p-6 border-2 border-border/60 bg-card/60 backdrop-blur-sm space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Your Demo Activity</h3>
              <p className="text-sm text-muted-foreground">
                Simulated positions based on your YES/NO clicks. This is only a preview of how live markets would feel.
              </p>
            </div>

            {demoBets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center border border-dashed border-border/50 rounded-xl py-6">
                No demo bets yet. Try placing a YES or NO on one of the cards above.
              </p>
            ) : (
              <div className="space-y-2">
                {demoBets
                  .slice()
                  .reverse()
                  .map((bet, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{bet.question}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full font-medium",
                            bet.side === "YES"
                              ? "bg-green-500/10 text-green-400"
                              : "bg-red-500/10 text-red-400",
                          )}
                        >
                          {bet.side}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-primary/5 text-primary font-medium">
                          ${bet.amount.toFixed(2)}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                          SOL ${bet.priceSnapshot.toFixed(2)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(bet.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>

          {/* Info Banner */}
          <Card className="p-6 border-2 border-accent/30 bg-accent/5">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-accent">
                Coming Soon: Live Pyth Oracle Markets
              </h3>
              <p className="text-sm text-muted-foreground">
                Real-time price-based predictions powered by Pyth Network oracles.
                Connect your wallet to get notified when live markets launch.
              </p>
            </div>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default QuantumPythPrices;
