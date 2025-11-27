import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const QuantumPythPrices = () => {
  const [amounts, setAmounts] = useState<{ [key: number]: string }>({
    0: "",
    1: "",
    2: "",
  });

  const handleDemoBet = (marketIndex: number, prediction: "YES" | "NO") => {
    if (!amounts[marketIndex] || parseFloat(amounts[marketIndex]) <= 0) {
      toast({
        title: "Enter Amount",
        description: "Please enter a valid USDC amount",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Demo Only",
      description: "Quantum Pyth simulation — real betting coming soon!",
      variant: "default",
    });
  };

  const markets = [
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
              AI-generated futures from live Pyth price feeds (Demo)
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

              <div className="text-center space-y-2">
                <div className="text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  $131.96
                </div>
                <Badge variant="outline" className="border-primary/50 text-primary">
                  Updated in real time
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/30">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">24h High</p>
                  <p className="text-lg font-semibold text-green-500">$134.12</p>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">24h Low</p>
                  <p className="text-lg font-semibold text-red-500">$129.45</p>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">24h Change</p>
                  <p className="text-lg font-semibold text-primary">+1.87%</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Prediction Markets */}
          <div className="grid md:grid-cols-3 gap-6">
            {markets.map((market, index) => (
              <Card
                key={index}
                className="p-6 border-2 border-border/50 hover:border-primary/50 transition-all duration-300 bg-card/50 backdrop-blur-sm"
              >
                <div className="space-y-5">
                  {/* Question */}
                  <div className="flex items-start gap-3">
                    {market.icon}
                    <h3 className="text-lg font-semibold leading-tight">
                      {market.question}
                    </h3>
                  </div>

                  {/* Input */}
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">
                      Amount (USDC)
                    </label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amounts[index]}
                      onChange={(e) =>
                        setAmounts({ ...amounts, [index]: e.target.value })
                      }
                      className="bg-background/50"
                    />
                  </div>

                  {/* YES/NO Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => handleDemoBet(index, "YES")}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                    >
                      YES
                    </Button>
                    <Button
                      onClick={() => handleDemoBet(index, "NO")}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                    >
                      NO
                    </Button>
                  </div>

                  {/* Demo Badge */}
                  <div className="flex justify-center">
                    <Badge variant="outline" className="text-xs">
                      Demo Mode
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>

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
