import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAccount, useWriteContract } from "wagmi";
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, DollarSign, ExternalLink, ArrowLeft } from 'lucide-react';
import { useMarketInfo, useOutcomePool } from '@/hooks/useMarkets';
import { useToast } from '@/hooks/use-toast';
import { URIM_QUANTUM_MARKET_ADDRESS, USDC_ADDRESS } from "@/constants/contracts";
import UrimQuantumMarketABI from "@/contracts/UrimQuantumMarket.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { parseUnits, formatUnits } from "viem";

interface UserBet {
  marketId: number;
  question: string;
  outcome: string;
  amount: string;
  scenarioIndex: number;
  timestamp: number;
  txHash: string;
  status: 'active' | 'resolved';
}

export default function QuantumMarketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const marketId = id ? parseInt(id) : 0;
  
  const market = useMarketInfo(marketId, true);
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [userBets, setUserBets] = useState<UserBet[]>([]);

  // Load user's bets from localStorage
  useEffect(() => {
    if (address) {
      const savedBets = localStorage.getItem(`quantumBets_${address}`);
      if (savedBets) {
        setUserBets(JSON.parse(savedBets));
      }
    }
  }, [address]);

  const saveBetToLocalStorage = (bet: UserBet) => {
    if (!address) return;
    const newBets = [...userBets, bet];
    setUserBets(newBets);
    localStorage.setItem(`quantumBets_${address}`, JSON.stringify(newBets));
  };

  const handleConfirmBet = async () => {
    if (selectedScenario === null || !betAmount) {
      toast({
        title: "Missing Information",
        description: "Please select a scenario and enter bet amount.",
        variant: "destructive",
      });
      return;
    }

    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const amount = parseUnits(betAmount, 6);

      // Step 1: Approve USDC
      toast({
        title: "Step 1/2: Approving USDC",
        description: "Please confirm the approval transaction in your wallet.",
      });

      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: 'approve',
        args: [URIM_QUANTUM_MARKET_ADDRESS, amount],
        gas: BigInt(100000),
      } as any);

      toast({
        title: "Approval Confirmed ✓",
        description: "Now placing your bet...",
      });

      // Step 2: Place bet
      const tx = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: 'buyScenarioShares',
        args: [BigInt(marketId), BigInt(selectedScenario), amount],
        gas: BigInt(3000000),
      } as any);

      // Save bet to localStorage
      const newBet: UserBet = {
        marketId,
        question: market?.question || `Market #${marketId}`,
        outcome: `Scenario ${selectedScenario + 1}`,
        amount: betAmount,
        scenarioIndex: selectedScenario,
        timestamp: Date.now(),
        txHash: tx,
        status: 'active',
      };
      saveBetToLocalStorage(newBet);

      toast({
        title: "Bet Placed Successfully! ⚡",
        description: "✅ Bet placed successfully.",
      });

      setSelectedScenario(null);
      setBetAmount('');
    } catch (error: any) {
      console.error("Bet failed:", error);
      toast({
        title: "Transaction Failed",
        description: error?.shortMessage || error?.message || "Could not place bet. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!market) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Loading market...</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      <Navigation />

      <main className="relative max-w-4xl mx-auto px-6 pt-32 pb-20">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Button>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-muted-foreground">Quantum Market #{marketId}</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">{market.question}</h1>
          {market.resolved && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30">
              <span className="text-primary font-bold text-xs uppercase">Resolved</span>
            </div>
          )}
        </div>

        {/* Scenarios */}
        <div className="space-y-4 mb-12">
          {market.outcomes.map((scenario, index) => (
            <ScenarioCard
              key={index}
              marketId={marketId}
              scenarioIndex={index}
              scenarioText={scenario}
              isSelected={selectedScenario === index}
              isWinner={market.resolved && market.winningIndex === index}
              onSelect={() => !market.resolved && setSelectedScenario(index)}
            />
          ))}
        </div>

        {/* Bet Input */}
        {!market.resolved && selectedScenario !== null && (
          <div className="glass-card p-6 space-y-4 animate-fade-in">
            <div className="space-y-2">
              <Label htmlFor="bet-amount">Bet Amount</Label>
              <div className="flex gap-2">
                <Input
                  id="bet-amount"
                  type="number"
                  placeholder="0.00"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="flex-1"
                />
                <div className="px-4 py-3 bg-card/40 border-2 border-primary/50 rounded-md text-sm font-semibold">
                  USDC
                </div>
              </div>
            </div>

            <Button
              onClick={handleConfirmBet}
              className="w-full"
              size="lg"
            >
              Confirm Bet ⚡
            </Button>
          </div>
        )}

        {/* User's Bets */}
        {userBets.filter(bet => bet.marketId === marketId).length > 0 && (
          <div className="mt-12 space-y-4">
            <h2 className="text-2xl font-bold">Your Bets</h2>
            {userBets.filter(bet => bet.marketId === marketId).map((bet, idx) => (
              <div key={idx} className="glass-card p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Market #{bet.marketId}</div>
                    <h3 className="text-lg font-semibold">{bet.question}</h3>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                    bet.status === 'active' 
                      ? 'bg-primary/15 border border-primary/30'
                      : 'bg-muted/50 border border-border'
                  }`}>
                    <span className={`font-bold text-xs uppercase ${
                      bet.status === 'active' ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {bet.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Wallet</div>
                    <div className="font-mono text-xs">{address?.slice(0, 6)}...{address?.slice(-4)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Outcome</div>
                    <div className="font-semibold text-primary">{bet.outcome}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Amount</div>
                    <div className="font-semibold flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {bet.amount} USDC
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Transaction</div>
                    <a
                      href={`https://sepolia.basescan.org/tx/${bet.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 text-xs"
                    >
                      View on Basescan
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

interface ScenarioCardProps {
  marketId: number;
  scenarioIndex: number;
  scenarioText: string;
  isSelected: boolean;
  isWinner: boolean;
  onSelect: () => void;
}

const ScenarioCard = ({ marketId, scenarioIndex, scenarioText, isSelected, isWinner, onSelect }: ScenarioCardProps) => {
  const pool = useOutcomePool(marketId, scenarioIndex, true);
  const poolFormatted = Number(formatUnits(pool, 6)).toFixed(2);

  return (
    <button
      onClick={onSelect}
      className={`w-full p-6 rounded-xl border-2 transition-all text-left ${
        isWinner
          ? 'border-primary bg-primary/10 shadow-[0_0_25px_hsl(var(--primary)/0.5)]'
          : isSelected
          ? 'border-primary bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.3)]'
          : 'border-border/50 bg-card/40 hover:border-primary/50'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
            isWinner || isSelected
              ? 'bg-primary/20 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}>
            {scenarioIndex + 1}
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold">Scenario {scenarioIndex + 1}</div>
            {isWinner && <span className="text-xs font-bold text-primary">WINNER</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Pool</div>
          <div className="text-lg font-bold text-primary">{poolFormatted} USDC</div>
        </div>
      </div>
      
      <p className="text-sm text-foreground/90">{scenarioText}</p>
    </button>
  );
}
