"use client";

import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, TrendingDown, Wallet, Clock, Trophy, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSolanaWallet } from "@/hooks/useSolanaWallet";
import { useUrimSolana, RoundData, UserBetData } from "@/hooks/useUrimSolana";
import { CopyableError, parseSolanaError } from "@/components/CopyableErrorToast";

const BASE_PRICE = 131.96;

interface RoundCardProps {
  round: RoundData | null;
  currentPrice: number;
  loading: boolean;
  error: string | null;
}

// Price is stored in CENTS - divide by 100 for dollars
function formatPrice(cents: bigint): string {
  const price = Number(cents) / 100;
  return `$${price.toFixed(2)}`;
}

// Token amounts have 6 decimals
function formatUsdcPool(amount: bigint): string {
  const value = Number(amount) / 1_000_000;
  return `$${value.toFixed(2)}`;
}

// USD value pools are in cents
function formatUsdValue(cents: bigint): string {
  const value = Number(cents) / 100;
  return `$${value.toFixed(2)}`;
}

function formatTimeRemaining(endTime: bigint, resolved: boolean): string {
  const now = Math.floor(Date.now() / 1000);
  const end = Number(endTime);
  const secondsLeft = end - now;

  if (secondsLeft > 0) {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } else if (!resolved) {
    return "Awaiting Resolution";
  }
  return "Ended";
}

const RoundInfoCard = ({ round, currentPrice, loading, error }: RoundCardProps) => {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    if (!round) return;
    
    const updateTime = () => {
      setTimeRemaining(formatTimeRemaining(round.endTime, round.resolved));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [round]);

  if (loading) {
    return (
      <Card className="p-8 border-2 border-primary/30 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading contract data...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8 border-2 border-yellow-500/30 bg-yellow-500/5">
        <div className="text-center space-y-2">
          <p className="text-yellow-500 font-medium">Contract Status</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Badge variant="outline" className="border-yellow-500/50 text-yellow-500">
            Devnet · Waiting for round initialization
          </Badge>
        </div>
      </Card>
    );
  }

  if (!round) {
    return (
      <Card className="p-8 border-2 border-border/30">
        <div className="text-center text-muted-foreground">
          No active round. Waiting for admin to start a new round.
        </div>
      </Card>
    );
  }

  const totalPool = round.upPool + round.downPool;
  const upPercent = totalPool > 0n ? Number(round.upPool * 100n / totalPool) : 50;
  const downPercent = 100 - upPercent;

  return (
    <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      <div className="relative p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-primary animate-pulse" />
            <div>
              <h2 className="text-xl font-bold text-foreground">Round #{round.roundId.toString()}</h2>
              <p className="text-sm text-muted-foreground">SOL/USD Prediction</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={round.resolved ? "secondary" : "default"} className={cn(
              round.resolved ? "bg-green-500/20 text-green-400" : "bg-primary/20 text-primary"
            )}>
              {round.resolved ? `Resolved: ${round.outcome}` : "Live"}
            </Badge>
            <Badge variant="outline" className="border-primary/50">
              Devnet
            </Badge>
          </div>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 rounded-xl bg-background/50 border border-border/30">
            <p className="text-sm text-muted-foreground mb-1">Locked Price</p>
            <p className="text-2xl font-bold text-foreground">{formatPrice(round.lockedPrice)}</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-background/50 border border-border/30">
            <p className="text-sm text-muted-foreground mb-1">Current Price</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              ${currentPrice.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Time & Pools */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <TrendingUp className="w-5 h-5 mx-auto text-green-500 mb-1" />
            <p className="text-xs text-muted-foreground">UP Pool</p>
            <p className="font-semibold text-green-500">{formatUsdcPool(round.upPool)}</p>
            <p className="text-xs text-green-400">{upPercent}%</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/30">
            <Clock className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-xs text-muted-foreground">Time Left</p>
            <p className="font-semibold text-primary">{timeRemaining}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <TrendingDown className="w-5 h-5 mx-auto text-red-500 mb-1" />
            <p className="text-xs text-muted-foreground">DOWN Pool</p>
            <p className="font-semibold text-red-500">{formatUsdcPool(round.downPool)}</p>
            <p className="text-xs text-red-400">{downPercent}%</p>
          </div>
        </div>

        {/* Total Pool */}
        <div className="text-center pt-4 border-t border-border/30">
          <p className="text-sm text-muted-foreground">Total Prize Pool</p>
          <p className="text-3xl font-bold bg-gradient-to-r from-green-400 via-primary to-red-400 bg-clip-text text-transparent">
            {formatUsdcPool(totalPool)}
          </p>
        </div>
      </div>
    </Card>
  );
};

interface BettingCardProps {
  round: RoundData | null;
  userBet: UserBetData | null;
  connected: boolean;
  onPlaceBet: (amount: number, betUp: boolean) => Promise<void>;
  onClaim: () => Promise<void>;
  placing: boolean;
}

const BettingCard = ({ round, userBet, connected, onPlaceBet, onClaim, placing }: BettingCardProps) => {
  const [amount, setAmount] = useState("");

  const handleBet = async (betUp: boolean) => {
    const numericAmount = parseFloat(amount);
    if (!amount || isNaN(numericAmount) || numericAmount < 1) {
      toast({ title: "Minimum bet is $1 USDC", variant: "destructive" });
      return;
    }
    await onPlaceBet(numericAmount, betUp);
    setAmount("");
  };

  if (!connected) {
    return (
      <Card className="p-6 border-2 border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="text-center space-y-4">
          <Wallet className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Connect your Solana wallet to place bets</p>
        </div>
      </Card>
    );
  }

  if (!round) {
    return (
      <Card className="p-6 border-2 border-border/50 bg-card/50">
        <div className="text-center text-muted-foreground">
          No active round to bet on
        </div>
      </Card>
    );
  }

  const canBet = !round.resolved && !userBet;
  const canClaim = round.resolved && userBet && !userBet.claimedUsdc;
  const isWinner = round.resolved && userBet && (
    (round.outcome === "Up" && userBet.betUp) ||
    (round.outcome === "Down" && !userBet.betUp) ||
    round.outcome === "Draw"
  );

  return (
    <Card className="p-6 border-2 border-border/50 bg-card/50 backdrop-blur-sm space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Place Your Bet</h3>
        <Badge variant="outline">USDC</Badge>
      </div>

      {userBet ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
            <p className="text-sm text-muted-foreground mb-2">Your Position</p>
            <div className="flex items-center justify-between">
              <span className={cn(
                "px-3 py-1 rounded-full font-semibold",
                userBet.betUp ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              )}>
                {userBet.betUp ? "UP" : "DOWN"}
              </span>
              <span className="font-bold">{formatUsdcPool(userBet.amount)}</span>
            </div>
          </div>

          {round.resolved && (
            <div className={cn(
              "p-4 rounded-xl border",
              isWinner ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className={cn("w-5 h-5", isWinner ? "text-green-500" : "text-red-500")} />
                <span className={cn("font-semibold", isWinner ? "text-green-400" : "text-red-400")}>
                  {isWinner ? "You Won!" : "Better luck next time"}
                </span>
              </div>
              {canClaim && (
                <Button 
                  onClick={onClaim} 
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={placing}
                >
                  {placing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Claim Winnings
                </Button>
              )}
            </div>
          )}
        </div>
      ) : canBet ? (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Amount (USDC)</label>
            <Input
              type="number"
              placeholder="Min $1.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-background/50"
              min="1"
              step="0.01"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[1, 5, 10, 50].map((val) => (
              <Button
                key={val}
                variant="outline"
                size="sm"
                onClick={() => setAmount(val.toString())}
                className="text-xs"
              >
                ${val}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => handleBet(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-6"
              disabled={placing}
            >
              {placing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TrendingUp className="w-4 h-4 mr-2" />}
              UP
            </Button>
            <Button
              onClick={() => handleBet(false)}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-6"
              disabled={placing}
            >
              {placing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TrendingDown className="w-4 h-4 mr-2" />}
              DOWN
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            0.5% fee on all bets · Min $1.00 USDC
          </p>
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-4">
          {round.resolved ? "Round ended. Wait for the next round." : "Betting closed for this round."}
        </div>
      )}
    </Card>
  );
};

const QuantumPythPrices = () => {
  const [currentPrice, setCurrentPrice] = useState<number>(BASE_PRICE);
  const [high24h, setHigh24h] = useState<number>(BASE_PRICE);
  const [low24h, setLow24h] = useState<number>(BASE_PRICE);
  const [change24hPercent, setChange24hPercent] = useState<number>(0);
  const [placing, setPlacing] = useState(false);

  const { connected, publicKey, connect, disconnect, provider, isPhantomInstalled } = useSolanaWallet();
  const { config, currentRound, userBet, loading, error, placeBet, claimAll, refetch } = useUrimSolana(publicKey);

  // Fetch live price
  useEffect(() => {
    let isMounted = true;

    const fetchPrice = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("getSolPrice");
        if (error || !data || !isMounted) return;

        const { price, high24h, low24h, change24h } = data as {
          price: number;
          high24h: number;
          low24h: number;
          change24h: number;
        };

        setCurrentPrice(price);
        setHigh24h(high24h);
        setLow24h(low24h);
        setChange24hPercent(change24h);
      } catch (err) {
        console.error("Error fetching SOL price:", err);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handlePlaceBet = async (amount: number, betUp: boolean) => {
    if (!provider) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }

    setPlacing(true);
    try {
      const signature = await placeBet(amount, betUp, provider);
      toast({
        title: "Bet placed successfully!",
        description: `Transaction: ${signature.slice(0, 8)}...`,
      });
    } catch (err: unknown) {
      console.error("Bet error:", err);
      const { userMessage, fullError } = parseSolanaError(err);
      toast({ 
        title: "Error", 
        description: <CopyableError message={fullError} />,
        variant: "destructive",
        duration: 15000,
      });
    } finally {
      setPlacing(false);
    }
  };

  const handleClaim = async () => {
    if (!provider) return;

    setPlacing(true);
    try {
      const signature = await claimAll(provider);
      toast({
        title: "Claimed successfully!",
        description: `Transaction: ${signature.slice(0, 8)}...`,
      });
    } catch (err: unknown) {
      console.error("Claim error:", err);
      const { userMessage, fullError } = parseSolanaError(err);
      toast({ 
        title: "Error", 
        description: <CopyableError message={fullError} />,
        variant: "destructive",
        duration: 15000,
      });
    } finally {
      setPlacing(false);
    }
  };

  const isChangePositive = change24hPercent > 0.05;
  const isChangeNegative = change24hPercent < -0.05;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="pt-28 sm:pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Quantum Pyth Markets
              </h1>
              <p className="text-muted-foreground">
                SOL/USD price predictions powered by Pyth Oracle on Solana
              </p>
            </div>

            {/* Wallet Connection */}
            <div className="flex items-center gap-3">
              {connected && publicKey ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-green-500/50 text-green-400 py-2 px-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                    {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={disconnect}>
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={connect}
                  className="bg-gradient-to-r from-purple-600 to-primary hover:opacity-90"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  {isPhantomInstalled ? "Connect Phantom" : "Install Phantom"}
                </Button>
              )}
            </div>
          </div>

          {/* Live Price Display */}
          <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Activity className="w-6 h-6 text-primary animate-pulse" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Live SOL/USD</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  ${currentPrice.toFixed(2)}
                </p>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground">24h High</p>
                  <p className="text-green-500 font-medium">${high24h.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">24h Low</p>
                  <p className="text-red-500 font-medium">${low24h.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">24h Change</p>
                  <p className={cn(
                    "font-medium",
                    isChangePositive && "text-green-500",
                    isChangeNegative && "text-red-500",
                    !isChangePositive && !isChangeNegative && "text-muted-foreground"
                  )}>
                    {change24hPercent >= 0 ? "+" : ""}{change24hPercent.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Main Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            <RoundInfoCard 
              round={currentRound} 
              currentPrice={currentPrice} 
              loading={loading} 
              error={error} 
            />
            <BettingCard
              round={currentRound}
              userBet={userBet}
              connected={connected}
              onPlaceBet={handlePlaceBet}
              onClaim={handleClaim}
              placing={placing}
            />
          </div>

          {/* Info */}
          <Card className="p-6 border-2 border-accent/30 bg-accent/5">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-accent">
                Solana Devnet Testing
              </h3>
              <p className="text-sm text-muted-foreground">
                This is running on Solana Devnet. Use{" "}
                <a 
                  href="https://faucet.solana.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Solana Faucet
                </a>
                {" "}to get test SOL. USDC devnet tokens required for betting.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Badge variant="outline" className="text-xs">
                  Program: 5KqMa...BTQG
                </Badge>
                <Button variant="ghost" size="sm" onClick={refetch}>
                  Refresh Data
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default QuantumPythPrices;
