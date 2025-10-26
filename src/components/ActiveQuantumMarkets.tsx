import { useState, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useQuantumBetMarketCount, useQuantumBetMarket } from '@/hooks/useQuantumBetMarkets';
import { QUANTUM_BET_ADDRESS, USDC_ADDRESS } from '@/constants/contracts';
import QuantumBetABI from '@/contracts/QuantumBet.json';
import ERC20ABI from '@/contracts/ERC20.json';
import { formatUsdc, parseUsdc } from '@/lib/erc20';
import { useNotification } from "@blockscout/app-sdk";

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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {marketIds.map(id => (
        <MarketCard key={`${id}-${refreshTrigger}`} marketId={id} />
      ))}
    </div>
  );
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

  if (!market) return null;

  const isOpen = !market.resolved && Date.now() / 1000 < market.closeTime;
  const closeDate = new Date(market.closeTime * 1000).toLocaleString();

  const totalPool = market.yesPool + market.noPool;
  const yesOdds = totalPool > 0n ? Number((market.yesPool * 100n) / totalPool) : 50;
  const noOdds = 100 - yesOdds;

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
        <h3 className="font-semibold text-lg">{market.question}</h3>
        
        {/* Status */}
        <div className="flex items-center gap-2 text-sm">
          {isOpen ? (
            <span className="text-green-500">🟢 Open until {closeDate}</span>
          ) : market.resolved ? (
            <span className={market.outcome ? "text-green-500" : "text-red-500"}>
              {market.outcome ? "✅ YES Won" : "❌ NO Won"}
            </span>
          ) : (
            <span className="text-yellow-500">⏱ Awaiting Resolution</span>
          )}
        </div>

        {/* Pools */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">YES Pool</p>
            <p className="font-semibold">{formatUsdc(market.yesPool)} USDC ({yesOdds}%)</p>
          </div>
          <div>
            <p className="text-muted-foreground">NO Pool</p>
            <p className="font-semibold">{formatUsdc(market.noPool)} USDC ({noOdds}%)</p>
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

        {market.resolved && (
          <Button
            onClick={handleClaim}
            disabled={claiming}
            className="w-full h-10"
          >
            {claiming ? "Claiming..." : "Claim Winnings"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ActiveQuantumMarkets;
