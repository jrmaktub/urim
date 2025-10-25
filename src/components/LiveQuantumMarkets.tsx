import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock } from "lucide-react";
import { URIM_QUANTUM_MARKET_ADDRESS, USDC_ADDRESS } from "@/constants/contracts";
import UrimQuantumMarketABI from "@/contracts/UrimQuantumMarket.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { parseUnits, formatUnits } from "viem";

type MarketData = {
  marketId: bigint;
  question: string;
  optionA: string;
  optionB: string;
  endTime: bigint;
  outcome: number;
  totalOptionAShares: bigint;
  totalOptionBShares: bigint;
  resolved: boolean;
  cancelled: boolean;
};

export default function LiveQuantumMarkets() {
  const { address } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [betAmounts, setBetAmounts] = useState<Record<string, string>>({});
  const [bettingMarkets, setBettingMarkets] = useState<Record<string, 'yes' | 'no' | null>>({});

  // Fetch all market IDs
  const { data: marketIdsData, refetch: refetchMarketIds } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getAllMarketIds",
  });

  const marketIds = (marketIdsData as bigint[]) || [];

  // Fetch market info for each ID
  useEffect(() => {
    const fetchMarkets = async () => {
      if (!marketIds.length) return;

      const marketPromises = marketIds.map(async (id) => {
        try {
          const response = await fetch(
            `https://base-sepolia.blockscout.com/api/v2/smart-contracts/${URIM_QUANTUM_MARKET_ADDRESS}/methods-read-proxy?method_id=getMarketInfo&args[]=${id}`
          );
          
          // Fallback: use a hook-based approach instead
          return { marketId: id };
        } catch (error) {
          console.error(`Failed to fetch market ${id}:`, error);
          return null;
        }
      });

      const marketData = await Promise.all(marketPromises);
      setMarkets(marketData.filter(Boolean) as any[]);
    };

    fetchMarkets();
  }, [marketIds]);

  const placeBet = async (marketId: bigint, isYes: boolean) => {
    if (!address) {
      toast({ title: "Connect Wallet", description: "Please connect your wallet first.", variant: "destructive" });
      return;
    }

    const betAmount = betAmounts[marketId.toString()];
    if (!betAmount || parseFloat(betAmount) <= 0) {
      toast({ title: "Enter amount", description: "Please enter a valid bet amount.", variant: "destructive" });
      return;
    }

    setBettingMarkets(prev => ({ ...prev, [marketId.toString()]: isYes ? 'yes' : 'no' }));

    try {
      const amountWei = parseUnits(betAmount, 6);

      // Approve USDC
      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_QUANTUM_MARKET_ADDRESS, amountWei],
      } as any);

      toast({ title: "Placing bet...", description: "Confirm the transaction in your wallet" });

      // Buy shares
      const txHash = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyShares",
        args: [marketId, isYes, amountWei],
        gas: BigInt(500_000),
      } as any);

      toast({ 
        title: "✅ Bet placed successfully", 
        description: `You bet ${betAmount} USDC on ${isYes ? 'YES' : 'NO'}`
      });

      // Clear input and refetch
      setBetAmounts(prev => ({ ...prev, [marketId.toString()]: '' }));
      await refetchMarketIds();
    } catch (error: any) {
      console.error("Bet error:", error);
      const errorMsg = error?.shortMessage || error?.message || "Transaction failed";
      const fullError = JSON.stringify(error, null, 2);

      toast({
        title: "❌ Transaction failed",
        description: errorMsg,
        variant: "destructive",
        action: (
          <button
            onClick={() => {
              navigator.clipboard.writeText(fullError);
              toast({ title: "Error copied to clipboard" });
            }}
            className="ml-2 px-3 py-1 text-xs bg-destructive/20 hover:bg-destructive/30 rounded"
          >
            📋 Copy
          </button>
        ),
      });
    } finally {
      setBettingMarkets(prev => ({ ...prev, [marketId.toString()]: null }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">✨ Live Quantum Markets</h2>
      </div>

      <div className="grid gap-4">
        {marketIds.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No live markets yet. Create one in the Quantum Pyth section above!
          </Card>
        ) : (
          marketIds.map((marketId) => (
            <LiveMarketCard
              key={marketId.toString()}
              marketId={marketId}
              betAmount={betAmounts[marketId.toString()] || ''}
              onBetAmountChange={(value) => 
                setBetAmounts(prev => ({ ...prev, [marketId.toString()]: value }))
              }
              onPlaceBet={placeBet}
              bettingStatus={bettingMarkets[marketId.toString()]}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LiveMarketCard({ 
  marketId, 
  betAmount, 
  onBetAmountChange, 
  onPlaceBet,
  bettingStatus 
}: { 
  marketId: bigint;
  betAmount: string;
  onBetAmountChange: (value: string) => void;
  onPlaceBet: (marketId: bigint, isYes: boolean) => void;
  bettingStatus: 'yes' | 'no' | null;
}) {
  const { data: marketInfo, refetch } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getMarketInfo",
    args: [marketId],
  });

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (!marketInfo) {
    return (
      <Card className="p-6 border-2 border-primary/20 animate-pulse">
        <div className="h-20 bg-primary/5 rounded" />
      </Card>
    );
  }

  const [question, optionA, optionB, endTime, outcome, totalOptionAShares, totalOptionBShares, resolved, cancelled] = marketInfo as [
    string, string, string, bigint, number, bigint, bigint, boolean, boolean
  ];

  if (cancelled) return null;

  const now = Math.floor(Date.now() / 1000);
  const isActive = !resolved && now < Number(endTime);
  const isResolved = resolved;
  const winningOutcome = outcome; // 0 = OptionA, 1 = OptionB, 2 = Tie

  return (
    <Card className={`p-6 border-2 transition-all ${
      isResolved 
        ? 'border-border/50 bg-muted/50 opacity-75' 
        : 'border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-lg'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xs font-mono text-muted-foreground">
              Market #{marketId.toString()}
            </div>
            {isResolved && <Badge variant="secondary">Resolved</Badge>}
            {!isResolved && isActive && <Badge className="bg-green-500">Active</Badge>}
            {!isResolved && !isActive && <Badge variant="outline">Ended</Badge>}
          </div>
          <div className="text-lg font-semibold mb-2">🧠 {question}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Ends {new Date(Number(endTime) * 1000).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {isResolved && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <div className="text-sm font-semibold text-green-500">
            Market resolved: {winningOutcome === 0 ? optionA : winningOutcome === 1 ? optionB : 'Tie'}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <div className="p-4 rounded-lg border-2 border-primary/20 bg-background/50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <span className="text-lg">🔮</span>
              <span>{optionA || 'YES'}</span>
            </div>
            {isResolved && winningOutcome === 0 && (
              <Badge className="bg-green-500">Winner</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            💰 Total: {formatUnits(totalOptionAShares, 6)} USDC
          </div>
        </div>

        <div className="p-4 rounded-lg border-2 border-primary/20 bg-background/50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <span className="text-lg">🪶</span>
              <span>{optionB || 'NO'}</span>
            </div>
            {isResolved && winningOutcome === 1 && (
              <Badge className="bg-green-500">Winner</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            💰 Total: {formatUnits(totalOptionBShares, 6)} USDC
          </div>
        </div>
      </div>

      {isActive && !isResolved && (
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Amount (USDC)"
            value={betAmount}
            onChange={(e) => onBetAmountChange(e.target.value)}
            className="flex-1 bg-background/50"
          />
          <Button
            onClick={() => onPlaceBet(marketId, true)}
            disabled={bettingStatus !== null}
            className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90"
          >
            {bettingStatus === 'yes' ? "Betting..." : "Bet Yes"}
          </Button>
          <Button
            onClick={() => onPlaceBet(marketId, false)}
            disabled={bettingStatus !== null}
            className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90"
          >
            {bettingStatus === 'no' ? "Betting..." : "Bet No"}
          </Button>
        </div>
      )}
    </Card>
  );
}
