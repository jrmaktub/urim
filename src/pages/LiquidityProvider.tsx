import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Droplets } from "lucide-react";

const LiquidityProvider = () => {
  const [amount, setAmount] = useState("");

  const quickAmounts = [1, 5, 20, 100];

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
  };

  const handleMax = () => {
    // Demo: set a placeholder max value
    setAmount("1000");
  };

  const handleDeposit = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    toast.success("Liquidity deposited successfully. Thank you for supporting URIM.");
    setAmount("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Droplets className="w-8 h-8 text-primary" />
              <h1 className="text-4xl font-bold text-foreground">
                Liquidity Provider
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Support the URIM ecosystem by providing capital for seed liquidity, market depth, and operational growth.
            </p>
          </div>

          {/* Main Card */}
          <Card className="border-primary/30 shadow-lg shadow-primary/10">
            <CardHeader>
              <CardTitle className="text-2xl">Deposit Liquidity</CardTitle>
              <CardDescription className="text-base leading-relaxed pt-2">
                Funds deposited here are used to provide seed liquidity for markets, cover bet fee payouts, 
                strengthen market depth, and support URIM's overall growth. This is an optional contribution 
                page. Your deposit helps fuel more markets and bigger payouts.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Amount (USDC)
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-lg"
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map((value) => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAmount(value)}
                    className="border-primary/30 hover:border-primary/50 hover:bg-primary/10"
                  >
                    +{value}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMax}
                  className="border-primary/30 hover:border-primary/50 hover:bg-primary/10"
                >
                  Max
                </Button>
              </div>

              {/* Deposit Button */}
              <Button
                onClick={handleDeposit}
                className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg py-6 rounded-xl shadow-lg shadow-primary/30"
              >
                Deposit Liquidity
              </Button>
            </CardContent>
          </Card>

          {/* Benefits Section */}
          <div className="mt-12 space-y-6">
            <h2 className="text-3xl font-bold text-center text-foreground">
              Why Become a Liquidity Provider?
            </h2>
            <p className="text-center text-muted-foreground text-lg">
              URIM rewards the people who power the markets. When you deposit funds, you earn a share of the platform's real economic activity:
            </p>

            <div className="grid gap-4 mt-8">
              {/* Market Creation Fees */}
              <Card className="border-primary/20 hover:border-primary/40 transition-colors">
                <CardHeader>
                  <CardTitle className="text-xl">Market Creation Fees</CardTitle>
                  <CardDescription className="text-base">
                    Earn a percentage every time a new prediction market is launched.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Trading Fees */}
              <Card className="border-primary/20 hover:border-primary/40 transition-colors">
                <CardHeader>
                  <CardTitle className="text-xl">Trading Fees</CardTitle>
                  <CardDescription className="text-base">
                    Receive a share of the fees generated from every YES/NO trade executed on the platform.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Settlement Fees */}
              <Card className="border-primary/20 hover:border-primary/40 transition-colors">
                <CardHeader>
                  <CardTitle className="text-xl">Settlement Fees</CardTitle>
                  <CardDescription className="text-base">
                    When markets resolve, LPs receive part of the settlement costs.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Spread Capture */}
              <Card className="border-primary/20 hover:border-primary/40 transition-colors">
                <CardHeader>
                  <CardTitle className="text-xl">Spread Capture</CardTitle>
                  <CardDescription className="text-base">
                    You profit from the natural gap between YES and NO prices taken by traders.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Passive Income */}
              <Card className="border-primary/20 hover:border-primary/40 transition-colors">
                <CardHeader>
                  <CardTitle className="text-xl">Passive Income, Active Growth</CardTitle>
                  <CardDescription className="text-base">
                    Your liquidity helps expand URIM markets, and you earn automatically as activity increases.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Transparency */}
              <Card className="border-primary/20 hover:border-primary/40 transition-colors">
                <CardHeader>
                  <CardTitle className="text-xl">Fully Transparent & On-Chain</CardTitle>
                  <CardDescription className="text-base">
                    Every LP balance, fee distribution, and payout is visible and verifiable.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LiquidityProvider;
