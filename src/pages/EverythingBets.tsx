import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, TrendingUp, Zap } from "lucide-react";
import { URIM_MARKET_ADDRESS, USDC_ADDRESS } from "@/constants/contracts";
import UrimMarketABI from "@/contracts/UrimMarket.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { parseUnits, formatUnits } from "viem";
import { useAllMarkets, useMarketInfo, useOutcomePool } from "@/hooks/useMarkets";


const EverythingBets = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("Yes");
  const [optionB, setOptionB] = useState("No");
  const [duration, setDuration] = useState("");
  const [stakeAmount, setStakeAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [stakeModalOpen, setStakeModalOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number>(0);
  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState<number>(0);
  const [betAmount, setBetAmount] = useState("");
  const [balances, setBalances] = useState<any>(null);
  const [isBetting, setIsBetting] = useState(false);

  const btn =
    'px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

  // Load live markets from contract
  const { everythingMarketIds } = useAllMarkets();

  const handleCreateMarket = async () => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    if (!question || !optionA || !optionB || !duration || !stakeAmount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Convert duration to timestamp
      const durationMap: { [key: string]: number } = {
        "1d": 1 * 24 * 60 * 60,
        "3d": 3 * 24 * 60 * 60,
        "1w": 7 * 24 * 60 * 60,
        "2w": 14 * 24 * 60 * 60,
        "1m": 30 * 24 * 60 * 60,
      };
      
      const now = Math.floor(Date.now() / 1000);
      const endTimestamp = BigInt(now + durationMap[duration]);
      const outcomes = [optionA, optionB];

      toast({
        title: "Creating Market",
        description: "Please confirm the transaction in your wallet.",
      });

      await writeContractAsync({
        address: URIM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimMarketABI.abi as any,
        functionName: 'createMarket',
        args: [question, outcomes, endTimestamp],
        gas: BigInt(3000000),
      } as any);

      toast({
        title: "Market Created! ⚡",
        description: "Your market is now live on Base Sepolia.",
      });

      setIsSuccess(true);
    } catch (error: any) {
      console.error("Failed to create market:", error);
      toast({
        title: "Transaction Failed",
        description: error?.shortMessage || error?.message || "Could not create market. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlaceBet = async () => {
    if (!address || !selectedMarket || !betAmount) {
      toast({
        title: "Missing Information",
        description: "Please enter a bet amount.",
        variant: "destructive",
      });
      return;
    }

    setIsBetting(true);

    try {
      // First approve USDC
      const amount = parseUnits(betAmount, 6);
      
      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: 'approve',
        args: [URIM_MARKET_ADDRESS, amount],
      } as any);

      toast({
        title: "Approval Confirmed",
        description: "Now placing your bet...",
      });

      // Then buy shares
      await writeContractAsync({
        address: URIM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimMarketABI.abi as any,
        functionName: 'buyShares',
        args: [BigInt(selectedMarket.id), BigInt(selectedOutcomeIndex), amount],
        gas: BigInt(500000),
      } as any);

      toast({
        title: "Quantum Bet placed successfully! ⚡",
        description: `You bet ${betAmount} USDC on "${selectedMarket.outcomes[selectedOutcomeIndex]}"`,
      });

      setStakeModalOpen(false);
      setBetAmount("");
    } catch (error: any) {
      console.error("Failed to place bet:", error);
      toast({
        title: "Transaction Failed",
        description: error?.shortMessage || error?.message || "Could not place bet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBetting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen w-full bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-6">
          <div className="max-w-lg w-full card-glow p-12 text-center animate-fade-up">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 border-2 border-primary mb-6">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-4xl font-bold mb-4 tracking-tight">
              Market Created! ⚡
            </h2>
            <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
              Your market is now live on Base Sepolia. Users can start placing bets immediately.
            </p>
            <Button
              onClick={() => {
                setIsSuccess(false);
                setQuestion("");
                setOptionA("Yes");
                setOptionB("No");
                setDuration("");
                setStakeAmount("");
              }}
              className="w-full"
              size="lg"
            >
              Create Another Market
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <Navigation />

      {/* Create Section */}
      <section className="pt-28 sm:pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 animate-fade-up space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border/50 mb-4">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Binary Market</span>
            </div>
            <h1 className="text-6xl font-bold tracking-tight">
              Create Everything Bet
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              AI will create 2 possible future outcomes. Choose one to place your bet.
            </p>
          </div>
                  {balances && (
          <pre className="whitespace-pre-wrap">{JSON.stringify(balances, null, 2)}</pre>
        )}
          {/* Form Card */}
          <div className="card-glow p-10 animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <div className="space-y-7">
              {/* Question */}
              <div className="space-y-3">
                <Label htmlFor="question" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Market Question
                </Label>
                <Input
                  id="question"
                  placeholder="What event do you want to predict?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="h-14 text-base border-border/50 focus:border-primary/60 bg-input/50 rounded-xl"
                />
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="optionA" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Option A
                  </Label>
                  <Input
                    id="optionA"
                    placeholder="Yes"
                    value={optionA}
                    onChange={(e) => setOptionA(e.target.value)}
                    className="h-14 text-base border-border/50 focus:border-primary/60 bg-input/50 rounded-xl"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="optionB" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Option B
                  </Label>
                  <Input
                    id="optionB"
                    placeholder="No"
                    value={optionB}
                    onChange={(e) => setOptionB(e.target.value)}
                    className="h-14 text-base border-border/50 focus:border-primary/60 bg-input/50 rounded-xl"
                  />
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-3">
                <Label htmlFor="duration" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Market Duration
                </Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="h-14 border-2 border-border/50 bg-input/50 text-foreground focus:border-primary/60 rounded-xl">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1d">1 Day</SelectItem>
                    <SelectItem value="3d">3 Days</SelectItem>
                    <SelectItem value="1w">1 Week</SelectItem>
                    <SelectItem value="2w">2 Weeks</SelectItem>
                    <SelectItem value="1m">1 Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Initial Stake */}
              <div className="space-y-3">
                <Label htmlFor="stake" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Initial Stake
                </Label>
                <div className="relative">
                  <Input
                    id="stake"
                    type="number"
                    placeholder="100"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    className="h-14 text-lg font-semibold pr-16 border-border/50 focus:border-primary/60 bg-input/50 rounded-xl"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                    USDC
                  </div>
                </div>
              </div>

              {/* Create Button */}
              <Button
                onClick={handleCreateMarket}
                disabled={isProcessing}
                className="w-full mt-4"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                    Creating Market...
                  </>
                ) : (
                  "Create Everything Market"
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Active Markets Section */}
      <section className="pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <h2 className="text-4xl font-bold tracking-tight mb-2">Active Markets</h2>
            <p className="text-muted-foreground text-lg">Live binary prediction markets</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {everythingMarketIds.map((marketId, index) => (
              <LiveMarketCard 
                key={marketId.toString()} 
                marketId={Number(marketId)} 
                index={index}
                onBetClick={(market, outcomeIndex) => {
                  setSelectedMarket(market);
                  setSelectedOutcomeIndex(outcomeIndex);
                  setStakeModalOpen(true);
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Stake Modal */}
      <Dialog open={stakeModalOpen} onOpenChange={setStakeModalOpen}>
        <DialogContent className="bg-card border-border/50 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Place Your Bet</DialogTitle>
            <DialogDescription className="text-muted-foreground text-base">
              {selectedMarket?.question}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            {/* Selected Option */}
            <div className="space-y-3">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Betting On
              </Label>
              <div className="p-5 border-2 border-primary rounded-xl bg-primary/10">
                <span className="text-primary font-bold text-xl">
                  {selectedMarket?.outcomes?.[selectedOutcomeIndex]}
                </span>
              </div>
            </div>
            
            {/* Amount Input */}
            <div className="space-y-3">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Stake Amount
              </Label>
              <div className="relative">
                <Input 
                  type="number" 
                  placeholder="100"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="h-14 text-lg font-semibold pr-16 bg-input/50 border-border/50 focus:border-primary/60 rounded-xl"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                  USDC
                </div>
              </div>
            </div>
            
            {/* Confirm Button */}
            <Button 
              className="w-full"
              size="lg"
              onClick={handlePlaceBet}
              disabled={isBetting || !betAmount}
            >
              {isBetting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                  Placing Bet...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Confirm Bet
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

// Component to display live market cards
function LiveMarketCard({ marketId, index, onBetClick }: { 
  marketId: number; 
  index: number;
  onBetClick: (market: any, outcomeIndex: number) => void;
}) {
  const marketInfo = useMarketInfo(marketId, false);
  const pool0 = useOutcomePool(marketId, 0, false);
  const pool1 = useOutcomePool(marketId, 1, false);

  if (!marketInfo) {
    return (
      <div className="glass-card p-8 animate-fade-up" style={{ animationDelay: `${index * 0.1}s` }}>
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-muted/30 rounded"></div>
          <div className="h-12 bg-muted/30 rounded"></div>
          <div className="h-12 bg-muted/30 rounded"></div>
        </div>
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const timeLeft = marketInfo.endTimestamp - now;
  const days = Math.floor(timeLeft / 86400);
  const hours = Math.floor((timeLeft % 86400) / 3600);
  const timeLeftStr = timeLeft > 0 ? `${days}d ${hours}h` : "Ended";

  return (
    <div
      className="glass-card p-8 animate-fade-up hover:border-primary/40 transition-all group"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Question */}
      <h3 className="text-xl font-bold text-foreground mb-6 leading-tight min-h-[3.5rem]">
        {marketInfo.question}
      </h3>
      
      {/* Pools */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
          <span className="text-sm font-semibold text-muted-foreground">{marketInfo.outcomes[0]}</span>
          <span className="text-primary font-bold">{formatUnits(pool0, 6)} USDC</span>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
          <span className="text-sm font-semibold text-muted-foreground">{marketInfo.outcomes[1]}</span>
          <span className="text-primary font-bold">{formatUnits(pool1, 6)} USDC</span>
        </div>
      </div>

      {/* Time Left */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 pb-6 border-b border-border/30">
        <Clock className="w-4 h-4" />
        <span className="font-medium">{timeLeftStr} remaining</span>
      </div>

      {/* Bet Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button 
          variant="outline" 
          size="sm"
          className="group/btn"
          onClick={() => onBetClick(marketInfo, 0)}
          disabled={marketInfo.resolved || timeLeft <= 0}
        >
          {marketInfo.outcomes[0]}
        </Button>
        <Button 
          variant="outline"
          size="sm" 
          className="group/btn"
          onClick={() => onBetClick(marketInfo, 1)}
          disabled={marketInfo.resolved || timeLeft <= 0}
        >
          {marketInfo.outcomes[1]}
        </Button>
      </div>
    </div>
  );
}

export default EverythingBets;
