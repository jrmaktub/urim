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

  const handleBet = async (isYes: boolean) => {
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
        args: [BigInt(marketId), isYes, amountWei],
      } as any);

      openTxToast("84532", hash);
      setBetAmount('');
      
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
    <div className="glass-card p-6 rounded-2xl border border-border hover:border-primary/50 transition-all">
      <div className="space-y-4">
        {/* Title */}
        <h3 className="font-semibold text-lg leading-tight">{market.question}</h3>
        
        {/* Creator and Status Row */}
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="w-3.5 h-3.5" />
            <span className="text-xs">{shortenAddress(market.creator)}</span>
          </div>
          
          {isOpen ? (
            <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
              🟢 Open
            </Badge>
          ) : isAwaitingResolution ? (
            <Badge variant="default" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              ⚙️ Awaiting
            </Badge>
          ) : (
            <Badge 
              variant="default" 
              className={market.outcome 
                ? "bg-green-500/20 text-green-400 border-green-500/30" 
                : "bg-red-500/20 text-red-400 border-red-500/30"
              }
            >
              {market.outcome ? "✅ YES Won" : "❌ NO Won"}
            </Badge>
          )}
        </div>

        {/* Time Badge */}
        {isOpen && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Closes in {timeRemaining}</span>
            <span className="text-muted-foreground/60">• {closeDate}</span>
          </div>
        )}

        {/* Pools */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-muted-foreground text-xs mb-1">YES Pool</p>
            <p className="font-semibold">{formatUsdc(market.yesPool)} USDC</p>
            <p className="text-xs text-muted-foreground">{yesOdds}%</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-muted-foreground text-xs mb-1">NO Pool</p>
            <p className="font-semibold">{formatUsdc(market.noPool)} USDC</p>
            <p className="text-xs text-muted-foreground">{noOdds}%</p>
          </div>
        </div>

        {/* Actions */}
        {isOpen && (
          <div className="space-y-3">
            <Input
              type="number"
              placeholder="Amount in USDC"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="h-10"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => handleBet(true)}
                disabled={betting}
                className="h-10 bg-green-600 hover:bg-green-700"
              >
                {betting ? "Betting..." : "Bet YES"}
              </Button>
              <Button
                onClick={() => handleBet(false)}
                disabled={betting}
                className="h-10 bg-red-600 hover:bg-red-700"
              >
                {betting ? "Betting..." : "Bet NO"}
              </Button>
            </div>
          </div>
        )}

        {market.resolved && !claimed && (
          <Button
            onClick={handleClaim}
            disabled={claiming}
            className="w-full h-10"
          >
            {claiming ? "Claiming..." : "Claim Rewards"}
          </Button>
        )}

        {claimed && (
          <div className="text-center py-2 text-sm text-green-400">
            Claimed ✅
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveQuantumMarkets;
