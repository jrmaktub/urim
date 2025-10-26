import { useState, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuantumBetMarketCount, useQuantumBetMarket, QuantumBetMarket } from '@/hooks/useQuantumBetMarkets';
import { QUANTUM_BET_ADDRESS, USDC_ADDRESS } from '@/constants/contracts';
import QuantumBetABI from '@/contracts/QuantumBet.json';
import ERC20ABI from '@/contracts/ERC20.json';
import { formatUsdc, parseUsdc } from '@/lib/erc20';
import { useNotification } from "@blockscout/app-sdk";
import { Clock, User } from 'lucide-react';

const ActiveQuantumMarkets = () => {
  const { address, isConnected, chain } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const { openTxToast } = useNotification();
  const { count, refetch: refetchCount } = useQuantumBetMarketCount();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Auto-refresh every 20 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
      refetchCount();
    }, 20000);
    return () => clearInterval(interval);
  }, [refetchCount]);

  // Get the latest 5 markets (in reverse order)
  const marketIds = count > 0 
    ? Array.from({ length: Math.min(5, count) }, (_, i) => count - i)
    : [];

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Connect your wallet to view active markets</p>
      </div>
    );
  }

  if (chain?.id !== 84532) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Please switch to Base Sepolia network</p>
      </div>
    );
  }

  if (marketIds.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No markets created yet. Generate one above!</p>
      </div>
    );
  }

  return (
    <MarketsList marketIds={marketIds} refreshTrigger={refreshTrigger} />
  );
};

const MarketsList = ({ marketIds, refreshTrigger }: { marketIds: number[], refreshTrigger: number }) => {
  const [markets, setMarkets] = useState<(QuantumBetMarket & { id: number })[]>([]);

  // Fetch all markets and sort them
  useEffect(() => {
    const fetchMarkets = async () => {
      const marketPromises = marketIds.map(id => 
        fetch(`/api/market/${id}`).catch(() => null)
      );
      // We'll collect markets inline instead
    };
    fetchMarkets();
  }, [marketIds, refreshTrigger]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <MarketCardList marketIds={marketIds} refreshTrigger={refreshTrigger} />
    </div>
  );
};

const MarketCardList = ({ marketIds, refreshTrigger }: { marketIds: number[], refreshTrigger: number }) => {
  return (
    <>
      {marketIds.map(id => (
        <MarketCard key={`${id}-${refreshTrigger}`} marketId={id} />
      ))}
    </>
  );
};

const useTimeRemaining = (closeTime: number) => {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = closeTime - now;
      
      if (diff <= 0) {
        setTimeRemaining('Closed');
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [closeTime]);

  return timeRemaining;
};

const MarketCard = ({ marketId }: { marketId: number }) => {
  const { address } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const { openTxToast } = useNotification();
  const { market, refetch } = useQuantumBetMarket(marketId);
  const [betAmount, setBetAmount] = useState('');
  const [betting, setBetting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<boolean | null>(null);
  const timeRemaining = useTimeRemaining(market?.closeTime || 0);

  if (!market) return null;

  const now = Math.floor(Date.now() / 1000);
  const isOpen = !market.resolved && now < market.closeTime;
  const isAwaitingResolution = !market.resolved && now >= market.closeTime;
  const closeDate = new Date(market.closeTime * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const totalPool = market.yesPool + market.noPool;
  const yesOdds = totalPool > 0n ? Number((market.yesPool * 100n) / totalPool) : 50;
  const noOdds = 100 - yesOdds;

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const description = market.question.length > 120 ? market.question.slice(0, 120) + '...' : market.question;

  const handleBet = async () => {
    if (selectedOutcome === null) {
      toast({ title: "Select YES or NO", variant: "destructive" });
      return;
    }

    if (!betAmount || parseFloat(betAmount) <= 0) {
      toast({ title: "Enter bet amount", variant: "destructive" });
      return;
    }

    setBetting(true);
    try {
      const amountWei = parseUsdc(betAmount);

      // Approve USDC
      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [QUANTUM_BET_ADDRESS, amountWei],
      } as any);

      // Place bet
      const hash = await writeContractAsync({
        address: QUANTUM_BET_ADDRESS as `0x${string}`,
        abi: QuantumBetABI.abi as any,
        functionName: "bet",
        args: [BigInt(marketId), selectedOutcome, amountWei],
      } as any);

      openTxToast("84532", hash);
      setBetAmount('');
      setSelectedOutcome(null);
      
      // Refresh market data
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      toast({
        title: "Bet failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setBetting(false);
    }
  };

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const hash = await writeContractAsync({
        address: QUANTUM_BET_ADDRESS as `0x${string}`,
        abi: QuantumBetABI.abi as any,
        functionName: "claim",
        args: [BigInt(marketId)],
      } as any);

      openTxToast("84532", hash);
      setClaimed(true);
      
      // Refresh market data
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      toast({
        title: "Claim failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="group relative bg-gradient-to-br from-background/95 to-background/80 backdrop-blur-xl p-6 rounded-3xl border border-border/50 hover:border-primary/40 transition-all duration-300 shadow-lg hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.15)]">
      <div className="space-y-5">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-bold text-xl leading-tight text-foreground">{market.question}</h3>
            {isOpen ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 whitespace-nowrap">
                🟢 Open
              </Badge>
            ) : isAwaitingResolution ? (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 whitespace-nowrap">
                🕒 Awaiting
              </Badge>
            ) : (
              <Badge 
                className={market.outcome 
                  ? "bg-green-500/20 text-green-400 border-green-500/30 whitespace-nowrap" 
                  : "bg-red-500/20 text-red-400 border-red-500/30 whitespace-nowrap"
                }
              >
                {market.outcome ? "✅ YES Won" : "❌ NO Won"}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span className="text-xs">Created by {shortenAddress(market.creator)}</span>
            </div>
            {isOpen && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-xs">{timeRemaining} left</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Pools Display */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Market Pools</span>
            <span>{formatUsdc(totalPool)} USDC Total</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="relative overflow-hidden bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl p-4 border border-green-500/20">
              <div className="relative z-10">
                <p className="text-xs text-green-400/80 mb-1">YES</p>
                <p className="font-bold text-lg text-green-400">{yesOdds}%</p>
                <p className="text-xs text-muted-foreground mt-1">{formatUsdc(market.yesPool)} USDC</p>
              </div>
              <div 
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500/20 to-transparent transition-all duration-300"
                style={{ height: `${yesOdds}%` }}
              />
            </div>
            
            <div className="relative overflow-hidden bg-gradient-to-br from-red-500/10 to-red-500/5 rounded-xl p-4 border border-red-500/20">
              <div className="relative z-10">
                <p className="text-xs text-red-400/80 mb-1">NO</p>
                <p className="font-bold text-lg text-red-400">{noOdds}%</p>
                <p className="text-xs text-muted-foreground mt-1">{formatUsdc(market.noPool)} USDC</p>
              </div>
              <div 
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-red-500/20 to-transparent transition-all duration-300"
                style={{ height: `${noOdds}%` }}
              />
            </div>
          </div>
        </div>

        {/* Betting Interface */}
        {isOpen && (
          <div className="space-y-4 pt-2">
            {/* Selection Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedOutcome(true)}
                className={`relative p-4 rounded-xl font-semibold transition-all duration-200 ${
                  selectedOutcome === true
                    ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-105'
                    : 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20'
                }`}
              >
                💜 YES
              </button>
              <button
                onClick={() => setSelectedOutcome(false)}
                className={`relative p-4 rounded-xl font-semibold transition-all duration-200 ${
                  selectedOutcome === false
                    ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] scale-105'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                }`}
              >
                ⚫ NO
              </button>
            </div>

            {/* Bet Amount Input */}
            {selectedOutcome !== null && (
              <div className="space-y-3 animate-fade-in">
                <Input
                  type="number"
                  placeholder="Bet Amount (USDC)"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="h-12 text-base"
                />
                <Button
                  onClick={handleBet}
                  disabled={betting}
                  className="w-full h-12 bg-gradient-to-r from-primary to-primary-glow hover:shadow-[0_0_25px_rgba(var(--primary-rgb),0.5)] transition-all duration-300"
                >
                  {betting ? "Placing Bet..." : "Place Bet"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Claim Button */}
        {market.resolved && !claimed && (
          <Button
            onClick={handleClaim}
            disabled={claiming}
            className="w-full h-12 bg-gradient-to-r from-primary to-primary-glow hover:shadow-[0_0_25px_rgba(var(--primary-rgb),0.5)] transition-all duration-300"
          >
            {claiming ? "Claiming..." : "Claim Rewards"}
          </Button>
        )}

        {claimed && (
          <div className="text-center py-3 px-4 bg-green-500/10 rounded-xl border border-green-500/30">
            <span className="text-green-400 font-semibold">✅ Claimed Successfully</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveQuantumMarkets;
