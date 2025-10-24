import { useState, useEffect } from "react";
import { useAccount, useWriteContract } from "wagmi";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, ChevronRight, DollarSign } from "lucide-react";
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
import { parseUnits } from "viem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const handlePlaceBet = () => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    setSelectedMarketId(0); // Placeholder, will be filled from form
    setSelectedIsQuantum(activeTab === "quantum");
    setSelectedOutcome("");
    setBetAmount("");
    setBetModalOpen(true);
  };

  const handleConfirmBet = async () => {
    if (!selectedOutcome || !betAmount || selectedMarketId === null || selectedMarketId === 0) {
      toast({
        title: "Missing Information",
        description: "Please enter market ID, select an outcome, and enter bet amount.",
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
        description: "✅ Bet placed successfully on your selected outcome!",
      });
      
      setBetModalOpen(false);
      setSelectedOutcome("");
      setBetAmount("");
      setSelectedMarketId(null);
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
            {/* Place Bet Button */}
            <div className="glass-card p-8">
              <Button
                onClick={handlePlaceBet}
                className="w-full"
                size="lg"
              >
                <Zap className="w-4 h-4 mr-2" />
                Place Bet
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

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

          <TabsContent value="quantum" className="space-y-8">
            {/* Place Bet Button */}
            <div className="glass-card p-8">
              <Button
                onClick={handlePlaceBet}
                className="w-full"
                size="lg"
              >
                <Zap className="w-4 h-4 mr-2" />
                Place Bet
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

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
              <Label>Market ID</Label>
              <Input
                type="number"
                placeholder="Enter market ID"
                value={selectedMarketId || ""}
                onChange={(e) => setSelectedMarketId(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Select Outcome</Label>
              <RadioGroup value={selectedOutcome} onValueChange={setSelectedOutcome}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="yes" />
                  <Label htmlFor="yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="no" />
                  <Label htmlFor="no">No</Label>
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

export default Index;
