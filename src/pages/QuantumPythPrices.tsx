"use client";

import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, TrendingDown, Wallet, Clock, Trophy, Loader2, History, Gift } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSolanaWallet } from "@/hooks/useSolanaWallet";
import { useUrimSolana, RoundData, UserBetData, HistoricalRound, ClaimableRound, UserBetHistory, getUrimPriceUsd, getMinimumUrim } from "@/hooks/useUrimSolana";
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

function formatUrimPool(amount: bigint): string {
  const value = Number(amount) / 1_000_000;
  return `${value.toFixed(2)} URIM`;
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
            Mainnet · Waiting for round initialization
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
  const totalPoolUrim = round.upPoolUrim + round.downPoolUrim;
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
              Mainnet
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
            <p className="text-xs text-green-400/70">{formatUrimPool(round.upPoolUrim)}</p>
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
            <p className="text-xs text-red-400/70">{formatUrimPool(round.downPoolUrim)}</p>
            <p className="text-xs text-red-400">{downPercent}%</p>
          </div>
        </div>

        {/* Total Pool */}
        <div className="text-center pt-4 border-t border-border/30">
          <p className="text-sm text-muted-foreground">Total Prize Pool</p>
          <p className="text-3xl font-bold bg-gradient-to-r from-green-400 via-primary to-red-400 bg-clip-text text-transparent">
            {formatUsdcPool(totalPool)}
          </p>
          <p className="text-sm text-muted-foreground">{formatUrimPool(totalPoolUrim)}</p>
        </div>
      </div>
    </Card>
  );
};

type TokenType = "USDC" | "URIM";

interface BettingCardProps {
  round: RoundData | null;
  userBet: UserBetData | null;
  connected: boolean;
  onPlaceBet: (amount: number, betUp: boolean, tokenType: TokenType) => Promise<void>;
  onClaim: () => Promise<void>;
  placing: boolean;
  usdcBalance: number;
  urimBalance: number;
}

const BettingCard = ({ round, userBet, connected, onPlaceBet, onClaim, placing, usdcBalance, urimBalance }: BettingCardProps) => {
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<TokenType>("USDC");
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [minUrimDisplay, setMinUrimDisplay] = useState("~125,000 URIM");
  const [urimPriceUsd, setUrimPriceUsd] = useState<number | null>(null);

  // Fetch URIM price for minimum display
  useEffect(() => {
    getUrimPriceUsd().then(price => {
      setUrimPriceUsd(price);
      const minTokens = getMinimumUrim(price);
      setMinUrimDisplay(`~${minTokens.toLocaleString()} URIM`);
    }).catch(() => {
      setMinUrimDisplay("~125,000 URIM"); // fallback
    });
  }, []);

  // Calculate time remaining
  useEffect(() => {
    if (!round) return;
    
    const updateTime = () => {
      const now = Math.floor(Date.now() / 1000);
      const end = Number(round.endTime);
      setTimeLeft(end - now);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [round]);

  const handleBet = async (betUp: boolean) => {
    const numericAmount = parseFloat(amount);
    const balance = selectedToken === "USDC" ? usdcBalance : urimBalance;
    const minBet = 1; // Min $1 value for both tokens
    const minUrimTokens = urimPriceUsd ? getMinimumUrim(urimPriceUsd) : 125000;
    
    if (!amount || isNaN(numericAmount) || numericAmount < minBet) {
      if (selectedToken === "URIM") {
        toast({ title: `Minimum bet is $1 (~${minUrimTokens.toLocaleString()} URIM)`, variant: "destructive" });
      } else {
        toast({ title: `Minimum bet is $${minBet} USDC`, variant: "destructive" });
      }
      return;
    }
    // For URIM, the amount entered is USD value, check if user has enough URIM tokens
    if (selectedToken === "URIM" && urimPriceUsd) {
      const requiredUrim = numericAmount / urimPriceUsd;
      if (requiredUrim > urimBalance) {
        toast({ 
          title: `Insufficient URIM balance`, 
          description: `You need ~${Math.ceil(requiredUrim).toLocaleString()} URIM for a $${numericAmount} bet. You have ${urimBalance.toFixed(0)} URIM.`,
          variant: "destructive" 
        });
        return;
      }
    } else if (selectedToken === "USDC" && numericAmount > balance) {
      toast({ 
        title: `Insufficient USDC balance`, 
        description: `You have $${balance.toFixed(2)} USDC.`,
        variant: "destructive" 
      });
      return;
    }
    // Check if betting window is still open
    if (timeLeft <= 0) {
      toast({ 
        title: "Betting closed", 
        description: "This round has ended. Wait for a new round.",
        variant: "destructive" 
      });
      return;
    }
    await onPlaceBet(numericAmount, betUp, selectedToken);
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

  // Check if betting is still open (time remaining > 0 AND not resolved AND no existing bet)
  const bettingOpen = timeLeft > 0 && !round.resolved;
  const canBet = bettingOpen && !userBet;
  const isWinner = round.resolved && userBet && (
    (round.outcome === "Up" && userBet.betUp) ||
    (round.outcome === "Down" && !userBet.betUp) ||
    round.outcome === "Draw"
  );
  // Can claim if winner and hasn't claimed both token types yet
  const canClaim = isWinner && userBet && (!userBet.claimedUsdc || !userBet.claimedUrim);

  // Format time for display
  const formatTime = (seconds: number) => {
    if (seconds <= 0) return "CLOSED";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-6 border-2 border-border/50 bg-card/50 backdrop-blur-sm space-y-5">
      {/* Timer Banner */}
      <div className={cn(
        "flex items-center justify-center gap-2 p-3 rounded-lg font-mono text-lg",
        bettingOpen 
          ? "bg-green-500/20 border border-green-500/50 text-green-400" 
          : "bg-red-500/20 border border-red-500/50 text-red-400"
      )}>
        <Clock className="w-5 h-5" />
        <span className="font-bold">{formatTime(timeLeft)}</span>
        <span className="text-sm opacity-75">
          {bettingOpen ? "until close" : "- Betting Closed"}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Place Your Bet</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">USDC: ${usdcBalance.toFixed(2)}</Badge>
          <Badge variant="outline" className="text-xs">URIM: {urimBalance.toFixed(2)}</Badge>
        </div>
      </div>

      {/* Token Selector */}
      <div className="flex gap-2">
        <Button
          variant={selectedToken === "USDC" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedToken("USDC")}
          className="flex-1"
        >
          USDC
        </Button>
        <Button
          variant={selectedToken === "URIM" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedToken("URIM")}
          className="flex-1"
        >
          URIM
        </Button>
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
            <label className="text-sm text-muted-foreground mb-2 block">
              {selectedToken === "USDC" ? "Amount (USDC)" : "Bet Value (USD)"}
            </label>
            <Input
              type="number"
              placeholder={selectedToken === "USDC" ? "Min $1 USDC" : `Min $1 (${minUrimDisplay})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-background/50"
              min="1"
              step="0.01"
            />
            {selectedToken === "URIM" && urimPriceUsd && (
              <p className="text-xs text-muted-foreground mt-1">
                ≈ {amount ? Math.ceil(parseFloat(amount || "0") / urimPriceUsd).toLocaleString() : "0"} URIM @ ${urimPriceUsd.toFixed(8)}/URIM
              </p>
            )}
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
            0.5% fee on all bets · Min $1 {selectedToken === "URIM" ? `(${minUrimDisplay})` : ""}
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

// Results History Component
interface ResultsHistoryProps {
  historicalRounds: HistoricalRound[];
}

const ResultsHistory = ({ historicalRounds }: ResultsHistoryProps) => {
  if (historicalRounds.length === 0) {
    return null;
  }

  const last10 = historicalRounds.slice(0, 10);
  const upCount = last10.filter(r => r.outcome === "Up").length;
  const downCount = last10.filter(r => r.outcome === "Down").length;
  const drawCount = last10.filter(r => r.outcome === "Draw").length;

  return (
    <Card className="p-6 border-2 border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Results History</h3>
      </div>

      {/* Outcome badges row */}
      <div className="flex flex-wrap gap-2 mb-4">
        {historicalRounds.slice(0, 15).map((round) => (
          <Badge
            key={round.roundId.toString()}
            className={cn(
              "px-3 py-1 font-semibold text-xs",
              round.outcome === "Up" && "bg-green-500/20 text-green-400 border-green-500/50",
              round.outcome === "Down" && "bg-pink-500/20 text-pink-400 border-pink-500/50",
              round.outcome === "Draw" && "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
            )}
          >
            {round.outcome === "Up" && <TrendingUp className="w-3 h-3 mr-1" />}
            {round.outcome === "Down" && <TrendingDown className="w-3 h-3 mr-1" />}
            {round.outcome}
          </Badge>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-center gap-4 pt-4 border-t border-border/30">
        <span className="text-sm text-muted-foreground">Last {last10.length} rounds:</span>
        <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
          {upCount} UP
        </Badge>
        <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/50">
          {downCount} DOWN
        </Badge>
        {drawCount > 0 && (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
            {drawCount} DRAW
          </Badge>
        )}
      </div>
    </Card>
  );
};

// Claimable Rounds Component
interface ClaimableRoundsProps {
  claimableRounds: ClaimableRound[];
  onClaim: (roundId: bigint) => Promise<void>;
  claiming: boolean;
  connected: boolean;
}

const ClaimableRounds = ({ claimableRounds, onClaim, claiming, connected }: ClaimableRoundsProps) => {
  console.log("[ClaimableRounds] Rendering with:", { connected, claimableRoundsCount: claimableRounds.length, claimableRounds });
  
  return (
    <Card className="p-6 border-2 border-green-500/30 bg-green-500/5 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <Gift className="w-5 h-5 text-green-400" />
        <h3 className="text-lg font-semibold text-green-400">Claimable Winnings</h3>
        {claimableRounds.length > 0 && (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/50 ml-auto">
            {claimableRounds.length} {claimableRounds.length === 1 ? 'round' : 'rounds'}
          </Badge>
        )}
      </div>

      {!connected ? (
        <div className="text-center py-4 text-muted-foreground">
          <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Connect your wallet to see claimable winnings</p>
        </div>
      ) : claimableRounds.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">No unclaimed winnings found.</p>
          <p className="text-xs mt-1">Win a round to see claimable rewards here!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {claimableRounds.map((round) => (
            <div 
              key={round.roundId.toString()} 
              className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-green-500/20"
            >
              <div className="flex items-center gap-3">
                <Badge className={cn(
                  "px-2 py-1",
                  round.outcome === "Up" && "bg-green-500/20 text-green-400",
                  round.outcome === "Down" && "bg-pink-500/20 text-pink-400",
                  round.outcome === "Draw" && "bg-yellow-500/20 text-yellow-400"
                )}>
                  {round.outcome === "Up" && <TrendingUp className="w-3 h-3 mr-1" />}
                  {round.outcome === "Down" && <TrendingDown className="w-3 h-3 mr-1" />}
                  {round.outcome}
                </Badge>
                <span className="text-sm text-muted-foreground">Round #{round.roundId.toString()}</span>
                <span className="text-sm font-medium">
                  You bet {round.userBet.betUp ? "UP" : "DOWN"} - Won!
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => onClaim(round.roundId)}
                disabled={claiming}
                className="bg-green-600 hover:bg-green-700"
              >
                {claiming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trophy className="w-3 h-3 mr-1" />}
                Claim
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

// User Bet History Component
interface UserBetHistoryProps {
  betHistory: UserBetHistory[];
  connected: boolean;
}

const UserBetHistoryComponent = ({ betHistory, connected }: UserBetHistoryProps) => {
  if (!connected) {
    return (
      <Card className="p-6 border-2 border-primary/30 bg-primary/5 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-primary">Your Bet History</h3>
        </div>
        <div className="text-center py-4 text-muted-foreground">
          <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Connect your wallet to see your betting history</p>
        </div>
      </Card>
    );
  }

  if (betHistory.length === 0) {
    return (
      <Card className="p-6 border-2 border-primary/30 bg-primary/5 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-primary">Your Bet History</h3>
        </div>
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">No bets placed yet.</p>
          <p className="text-xs mt-1">Place your first bet to see your history here!</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-2 border-primary/30 bg-primary/5 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-primary">Your Bet History</h3>
        <Badge className="bg-primary/20 text-primary border-primary/50 ml-auto">
          {betHistory.length} {betHistory.length === 1 ? 'bet' : 'bets'}
        </Badge>
      </div>

      <div className="space-y-3">
        {betHistory.map((bet) => {
          const betAmount = Number(bet.userBet.amount) / 1_000_000;
          const payout = Number(bet.estimatedPayout) / 1_000_000;
          const lockedPrice = Number(bet.lockedPrice) / 100;
          const finalPrice = Number(bet.finalPrice) / 100;
          const winningsAmount = payout - betAmount;
          const multiplier = betAmount > 0 ? payout / betAmount : 0;
          
          return (
            <div 
              key={bet.roundId.toString()} 
              className={cn(
                "p-4 rounded-lg border",
                !bet.resolved && "bg-yellow-500/5 border-yellow-500/20",
                bet.resolved && bet.isWinner && "bg-green-500/5 border-green-500/20",
                bet.resolved && !bet.isWinner && "bg-red-500/5 border-red-500/20"
              )}
            >
              {/* Header Row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Round #{bet.roundId.toString()}</span>
                  <Badge className={cn(
                    "px-2 py-0.5 text-xs",
                    bet.userBet.betUp ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  )}>
                    {bet.userBet.betUp ? "↑ UP" : "↓ DOWN"}
                  </Badge>
                </div>
                <Badge className={cn(
                  "px-2 py-0.5",
                  !bet.resolved && "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
                  bet.outcome === "Up" && "bg-green-500/20 text-green-400 border-green-500/50",
                  bet.outcome === "Down" && "bg-red-500/20 text-red-400 border-red-500/50",
                  bet.outcome === "Draw" && "bg-gray-500/20 text-gray-400 border-gray-500/50"
                )}>
                  {!bet.resolved ? (
                    <>
                      <Clock className="w-3 h-3 mr-1 inline" />
                      Pending
                    </>
                  ) : (
                    <>
                      {bet.outcome === "Up" && <TrendingUp className="w-3 h-3 mr-1 inline" />}
                      {bet.outcome === "Down" && <TrendingDown className="w-3 h-3 mr-1 inline" />}
                      {bet.outcome}
                    </>
                  )}
                </Badge>
              </div>

              {/* Price Info */}
              <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Locked Price: </span>
                  <span className="font-medium">${lockedPrice.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Final Price: </span>
                  <span className={cn(
                    "font-medium",
                    bet.resolved && finalPrice > lockedPrice && "text-green-400",
                    bet.resolved && finalPrice < lockedPrice && "text-red-400"
                  )}>
                    {bet.resolved ? `$${finalPrice.toFixed(2)}` : "—"}
                  </span>
                </div>
              </div>

              {/* Bet Details */}
              <div className="flex items-center justify-between pt-3 border-t border-border/30">
                <div>
                  <span className="text-sm text-muted-foreground">Bet: </span>
                  <span className="font-semibold">
                    {betAmount.toFixed(2)} {bet.userBet.tokenType}
                  </span>
                </div>
                
                {bet.resolved && (
                  <div className="text-right">
                    {bet.isWinner ? (
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-green-400" />
                        <div>
                          <span className="text-green-400 font-bold">
                            +{winningsAmount.toFixed(2)} {bet.userBet.tokenType}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({multiplier.toFixed(2)}x)
                          </span>
                        </div>
                      </div>
                    ) : bet.outcome === "Draw" ? (
                      <span className="text-yellow-400 font-medium">Refund</span>
                    ) : (
                      <span className="text-red-400 font-medium">-{betAmount.toFixed(2)}</span>
                    )}
                  </div>
                )}
                
                {!bet.resolved && (
                  <span className="text-sm text-yellow-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Awaiting result
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const QuantumPythPrices = () => {
  const [currentPrice, setCurrentPrice] = useState<number>(BASE_PRICE);
  const [high24h, setHigh24h] = useState<number>(BASE_PRICE);
  const [low24h, setLow24h] = useState<number>(BASE_PRICE);
  const [change24hPercent, setChange24hPercent] = useState<number>(0);
  const [placing, setPlacing] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [urimBalance, setUrimBalance] = useState<number>(0);

  const { connected, publicKey, connect, disconnect, provider, isPhantomInstalled } = useSolanaWallet();
  const { config, currentRound, userBet, historicalRounds, claimableRounds, userBetHistory, loading, error, placeBet, placeBetUrim, claimAll, claimForRound, refetch } = useUrimSolana(publicKey);

  // Fetch user's token balances
  useEffect(() => {
    if (!publicKey) {
      setUsdcBalance(0);
      setUrimBalance(0);
      return;
    }

    const fetchBalances = async () => {
      const { getUserUsdcBalance, getUserUrimBalance } = await import("@/hooks/useUrimSolana");
      const [usdc, urim] = await Promise.all([
        getUserUsdcBalance(publicKey),
        getUserUrimBalance(publicKey)
      ]);
      setUsdcBalance(usdc);
      setUrimBalance(urim);
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [publicKey]);

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

  const handlePlaceBet = async (amount: number, betUp: boolean, tokenType: TokenType) => {
    if (!provider) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }

    setPlacing(true);
    try {
      let signature: string;
      if (tokenType === "USDC") {
        signature = await placeBet(amount, betUp, provider);
      } else {
        // placeBetUrim now takes USD amount directly and fetches price internally
        signature = await placeBetUrim(amount, betUp, provider);
      }
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

  const handleClaimForRound = async (roundId: bigint) => {
    if (!provider) return;

    setPlacing(true);
    try {
      const signature = await claimForRound(roundId, provider);
      toast({
        title: "Claimed successfully!",
        description: `Round #${roundId.toString()} - Transaction: ${signature.slice(0, 8)}...`,
      });
    } catch (err: unknown) {
      console.error("Claim error:", err);
      const { fullError } = parseSolanaError(err);
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
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                DEVNET
              </Badge>
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
              usdcBalance={usdcBalance}
              urimBalance={urimBalance}
            />
          </div>

          {/* Claimable Winnings - Always show when connected */}
          <ClaimableRounds 
            claimableRounds={claimableRounds} 
            onClaim={handleClaimForRound} 
            claiming={placing}
            connected={connected}
          />

          {/* User Bet History */}
          <UserBetHistoryComponent 
            betHistory={userBetHistory} 
            connected={connected}
          />

          {/* Results History */}
          <ResultsHistory historicalRounds={historicalRounds} />

          {/* Info */}
          <Card className="p-6 border-2 border-accent/30 bg-accent/5">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-accent">
                Solana Devnet Testing
              </h3>
              <p className="text-sm text-muted-foreground">
                Get test SOL from{" "}
                <a 
                  href="https://faucet.solana.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Solana Faucet
                </a>
                {" "}and devnet USDC from{" "}
                <a 
                  href="https://faucet.circle.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Circle Faucet
                </a>
                {" "}(select Solana Devnet, mint: 4zMMC9...ncDU).
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Badge variant="outline" className="text-xs">
                  Program: 5KqMa...BTQG
                </Badge>
                <Badge variant="outline" className="text-xs">
                  USDC: 4zMMC9...ncDU
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
