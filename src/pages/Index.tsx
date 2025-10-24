import { useState, useEffect } from "react";
import { useAccount, useWriteContract } from "wagmi";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, ChevronRight, DollarSign, Clock, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { URIM_QUANTUM_MARKET_ADDRESS, URIM_MARKET_ADDRESS, USDC_ADDRESS } from "@/constants/contracts";
import UrimQuantumMarketABI from "@/contracts/UrimQuantumMarket.json";
import UrimMarketABI from "@/contracts/UrimMarket.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { parseUnits, formatUnits } from "viem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAllMarkets, useMarketInfo, useOutcomePool } from "@/hooks/useMarkets";

interface UserBet {
  marketId: number;
  question: string;
  outcome: string;
  amount: string;
  isQuantum: boolean;
  timestamp: number;
}

const Index = () => {
  const { toast } = useToast();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [selectedMarketId, setSelectedMarketId] = useState<number | null>(null);
  const [selectedIsQuantum, setSelectedIsQuantum] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [betAmount, setBetAmount] = useState("");
  const [userBets, setUserBets] = useState<UserBet[]>([]);
  const [activeTab, setActiveTab] = useState("everything");
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch all markets from blockchain
  const { everythingMarketIds, quantumMarketIds } = useAllMarkets();

  // Load user's bets from localStorage
  useEffect(() => {
    if (address) {
      const savedBets = localStorage.getItem(`userBets_${address}`);
      if (savedBets) {
        setUserBets(JSON.parse(savedBets));
      }
    }
  }, [address]);

  const saveBetToLocalStorage = (bet: UserBet) => {
    if (!address) return;
    const newBets = [...userBets, bet];
    setUserBets(newBets);
    localStorage.setItem(`userBets_${address}`, JSON.stringify(newBets));
  };

  const handlePlaceBet = (marketId: number, isQuantum: boolean) => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    setSelectedMarketId(marketId);
    setSelectedIsQuantum(isQuantum);
    setSelectedOutcome("");
    setBetAmount("");
    setBetModalOpen(true);
  };

  const handleConfirmBet = async () => {
    if (!selectedOutcome || !betAmount || selectedMarketId === null) {
      toast({
        title: "Missing Information",
        description: "Please select an outcome and enter bet amount.",
        variant: "destructive",
      });
      return;
    }

    try {
      const amount = parseUnits(betAmount, 6); // USDC has 6 decimals
      const contractAddress = selectedIsQuantum ? URIM_QUANTUM_MARKET_ADDRESS : URIM_MARKET_ADDRESS;
      const abi = selectedIsQuantum ? UrimQuantumMarketABI.abi : UrimMarketABI.abi;
      const functionName = selectedIsQuantum ? 'buyScenarioShares' : 'buyShares';

      // Step 1: Approve USDC
      toast({
        title: "Step 1/2: Approving USDC",
        description: "Please confirm the approval transaction in your wallet.",
      });

      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: 'approve',
        args: [contractAddress, amount],
        gas: BigInt(100000),
      } as any);

      toast({
        title: "Approval Confirmed ✓",
        description: "Now placing your bet...",
      });

      // Step 2: Place bet
      const isYes = selectedOutcome === "yes";
      const outcomeIndex = selectedIsQuantum ? Number(selectedOutcome) : (isYes ? BigInt(0) : BigInt(1));
      
      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: abi as any,
        functionName,
        args: [BigInt(selectedMarketId), outcomeIndex, amount],
        gas: BigInt(3000000),
      } as any);

      // Save bet to localStorage
      const newBet: UserBet = {
        marketId: selectedMarketId,
        question: `Market #${selectedMarketId}`,
        outcome: selectedIsQuantum ? `Scenario ${Number(selectedOutcome) + 1}` : (isYes ? "Yes" : "No"),
        amount: betAmount,
        isQuantum: selectedIsQuantum,
        timestamp: Date.now(),
      };
      saveBetToLocalStorage(newBet);

      toast({
        title: "Bet Placed Successfully! ⚡",
        description: "✅ Bet placed successfully.",
      });
      
      setBetModalOpen(false);
      setSelectedOutcome("");
      setBetAmount("");
      setSelectedMarketId(null);
      
      // Refresh markets to show updated pools
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error("Bet failed:", error);
      toast({
        title: "Transaction Failed",
        description: error?.shortMessage || error?.message || "Could not place bet. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <Navigation />

      {/* Main Content */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 shimmer-text">Place Your Bet</h1>
          <p className="text-muted-foreground text-lg">Simple Yes/No prediction markets</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="everything">Everything Bets</TabsTrigger>
            <TabsTrigger value="quantum">Quantum Bets</TabsTrigger>
          </TabsList>

          <TabsContent value="everything" className="space-y-8">
            {/* Live Markets from Blockchain */}
            {everythingMarketIds.length > 0 ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Live Markets</h2>
                {everythingMarketIds.map((marketId) => (
                  <MarketCard
                    key={`everything-${Number(marketId)}-${refreshKey}`}
                    marketId={Number(marketId)}
                    isQuantum={false}
                    onPlaceBet={handlePlaceBet}
                  />
                ))}
              </div>
            ) : (
              <div className="glass-card p-8 text-center">
                <p className="text-muted-foreground">No active markets found on-chain</p>
              </div>
            )}

            {/* User's Bets */}
            {userBets.filter(bet => !bet.isQuantum).length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Your Bets</h2>
                {userBets.filter(bet => !bet.isQuantum).map((bet, idx) => (
                  <div key={idx} className="glass-card p-6 space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-semibold">{bet.question}</h3>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30">
                        <span className="text-primary font-bold text-xs uppercase">Active</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Outcome:</span>
                        <span className="font-semibold text-primary">{bet.outcome}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">{bet.amount} USDC</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="quantum" className="min-h-[60vh] flex items-center justify-center">
            {quantumMarketIds.length > 0 ? (
              <div className="w-full max-w-md mx-auto space-y-6">
                {quantumMarketIds.map((marketId) => (
                  <QuantumBettingCard
                    key={`quantum-${Number(marketId)}-${refreshKey}`}
                    marketId={Number(marketId)}
                    onPlaceBet={handlePlaceBet}
                  />
                ))}
              </div>
            ) : (
              <div className="glass-card p-8 text-center">
                <p className="text-muted-foreground">No active quantum markets found on-chain</p>
              </div>
            )}

            {/* User's Quantum Bets */}
            {userBets.filter(bet => bet.isQuantum).length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Your Quantum Bets</h2>
                {userBets.filter(bet => bet.isQuantum).map((bet, idx) => (
                  <div key={idx} className="glass-card p-6 space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-semibold">{bet.question}</h3>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30">
                        <span className="text-primary font-bold text-xs uppercase">Active</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Outcome:</span>
                        <span className="font-semibold text-primary">{bet.outcome}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">{bet.amount} USDC</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* Bet Modal */}
      <Dialog open={betModalOpen} onOpenChange={setBetModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Place Bet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Outcome</Label>
              <RadioGroup value={selectedOutcome} onValueChange={setSelectedOutcome}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="0" id="outcome-0" />
                  <Label htmlFor="outcome-0">{selectedIsQuantum ? "Scenario 1" : "Yes"}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1" id="outcome-1" />
                  <Label htmlFor="outcome-1">{selectedIsQuantum ? "Scenario 2" : "No"}</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USDC)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
              />
            </div>

            <Button onClick={handleConfirmBet} className="w-full" size="lg">
              Confirm Bet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

interface MarketCardProps {
  marketId: number;
  isQuantum: boolean;
  onPlaceBet: (marketId: number, isQuantum: boolean) => void;
}

const MarketCard = ({ marketId, isQuantum, onPlaceBet }: MarketCardProps) => {
  const marketInfo = useMarketInfo(marketId, isQuantum);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!marketInfo) return;

    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = marketInfo.endTimestamp - now;

      if (diff <= 0) {
        setTimeLeft("Ended");
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else {
        setTimeLeft(`${hours}h`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [marketInfo]);

  if (!marketInfo) return null;

  return (
    <div className="glass-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Market #{marketId}</span>
            {marketInfo.resolved && (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30">
                <span className="text-primary font-bold text-xs uppercase">Resolved</span>
              </div>
            )}
          </div>
          <h3 className="text-xl font-bold">{marketInfo.question}</h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{timeLeft}</span>
        </div>
      </div>

      {/* Outcomes */}
      <div className="grid grid-cols-2 gap-3">
        {marketInfo.outcomes.map((outcome, index) => (
          <OutcomeCard
            key={index}
            marketId={marketId}
            outcomeIndex={index}
            outcomeName={outcome}
            isQuantum={isQuantum}
            resolved={marketInfo.resolved}
            isWinner={marketInfo.resolved && marketInfo.winningIndex === index}
            onPlaceBet={() => onPlaceBet(marketId, isQuantum)}
          />
        ))}
      </div>
    </div>
  );
};

interface OutcomeCardProps {
  marketId: number;
  outcomeIndex: number;
  outcomeName: string;
  isQuantum: boolean;
  resolved: boolean;
  isWinner: boolean;
  onPlaceBet: () => void;
}

const OutcomeCard = ({ marketId, outcomeIndex, outcomeName, isQuantum, resolved, isWinner, onPlaceBet }: OutcomeCardProps) => {
  const pool = useOutcomePool(marketId, outcomeIndex, isQuantum);
  const poolFormatted = Number(formatUnits(pool, 6)).toFixed(2);

  return (
    <div className={`p-4 rounded-xl border-2 space-y-3 ${
      isWinner 
        ? 'border-primary bg-primary/10' 
        : 'border-border/50 bg-card/40'
    }`}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{outcomeName}</span>
          {isWinner && <span className="text-xs font-bold text-primary">WINNER</span>}
        </div>
        
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground">Pool</div>
            <div className="text-lg font-bold text-primary">{poolFormatted} USDC</div>
          </div>
        </div>
      </div>

      {!resolved && (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onPlaceBet();
          }}
          variant="outline"
          size="sm"
          className="w-full"
        >
          Place Bet
        </Button>
      )}
    </div>
  );
};

interface QuantumBettingCardProps {
  marketId: number;
  onPlaceBet: (marketId: number, isQuantum: boolean) => void;
}

const QuantumBettingCard = ({ marketId, onPlaceBet }: QuantumBettingCardProps) => {
  const marketInfo = useMarketInfo(marketId, true);
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);

  if (!marketInfo) return null;

  const yesPool = useOutcomePool(marketId, 0, true);
  const noPool = useOutcomePool(marketId, 1, true);
  const yesPoolFormatted = Number(formatUnits(yesPool, 6)).toFixed(2);
  const noPoolFormatted = Number(formatUnits(noPool, 6)).toFixed(2);

  return (
    <div className="space-y-6 text-center">
      {/* Question */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">Market #{marketId}</div>
        <h2 className="text-2xl font-bold">{marketInfo.question}</h2>
      </div>

      {/* Yes/No Options */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setSelectedOutcome(0)}
          className={`p-6 rounded-xl border-2 transition-all ${
            selectedOutcome === 0
              ? 'border-primary bg-primary/10 shadow-[0_0_25px_hsl(var(--primary)/0.5)]'
              : 'border-border/50 bg-card/40 hover:border-primary/50'
          }`}
        >
          <div className="text-3xl mb-2">✅</div>
          <div className="text-xl font-bold">Yes</div>
          <div className="text-xs text-muted-foreground mt-2">{yesPoolFormatted} USDC</div>
        </button>

        <button
          onClick={() => setSelectedOutcome(1)}
          className={`p-6 rounded-xl border-2 transition-all ${
            selectedOutcome === 1
              ? 'border-primary bg-primary/10 shadow-[0_0_25px_hsl(var(--primary)/0.5)]'
              : 'border-border/50 bg-card/40 hover:border-primary/50'
          }`}
        >
          <div className="text-3xl mb-2">❌</div>
          <div className="text-xl font-bold">No</div>
          <div className="text-xs text-muted-foreground mt-2">{noPoolFormatted} USDC</div>
        </button>
      </div>

      {/* Bet Amount Input */}
      {selectedOutcome !== null && (
        <div className="space-y-4 animate-fade-in">
          <div className="space-y-2">
            <Label htmlFor="bet-amount" className="text-left block">Bet Amount</Label>
            <div className="flex gap-2">
              <Input
                id="bet-amount"
                type="number"
                placeholder="0.00"
                className="flex-1"
              />
              <div className="px-4 py-3 bg-card/40 border-2 border-primary/50 rounded-md text-sm font-semibold">
                USDC
              </div>
            </div>
          </div>

          <Button
            onClick={() => onPlaceBet(marketId, true)}
            className="w-full"
            size="lg"
          >
            Confirm Bet ⚡
          </Button>
        </div>
      )}
    </div>
  );
};

export default Index;
