import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract } from "wagmi";
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
import { parseUnits } from "viem";

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
  const [selectedOption, setSelectedOption] = useState<string>("");

  // Mock active markets
  const activeMarkets = [
    {
      id: 1,
      question: "Will ETH reach $5000 by end of 2025?",
      optionA: "Yes",
      optionB: "No",
      poolA: "12,500",
      poolB: "8,300",
      timeLeft: "6d 14h",
    },
    {
      id: 2,
      question: "Bitcoin ETF approval boost BTC above $100k?",
      optionA: "Yes",
      optionB: "No",
      poolA: "24,100",
      poolB: "15,900",
      timeLeft: "3d 8h",
    },
    {
      id: 3,
      question: "Base network to surpass 10M daily transactions?",
      optionA: "Yes",
      optionB: "No",
      poolA: "7,200",
      poolB: "5,800",
      timeLeft: "12d 4h",
    },
  ];

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

  const handleMarketClick = (market: any) => {
    setSelectedMarket(market);
    setStakeModalOpen(true);
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
      <section className="pt-32 pb-20 px-6">
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
              Simple Yes/No prediction markets on any topic
            </p>
          </div>

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
                  "Create Market"
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
            {activeMarkets.map((market, index) => (
              <div
                key={market.id}
                className="glass-card p-8 animate-fade-up hover:border-primary/40 transition-all group"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Question */}
                <h3 className="text-xl font-bold text-foreground mb-6 leading-tight min-h-[3.5rem]">
                  {market.question}
                </h3>
                
                {/* Pools */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                    <span className="text-sm font-semibold text-muted-foreground">{market.optionA}</span>
                    <span className="text-primary font-bold">{market.poolA} USDC</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                    <span className="text-sm font-semibold text-muted-foreground">{market.optionB}</span>
                    <span className="text-primary font-bold">{market.poolB} USDC</span>
                  </div>
                </div>

                {/* Time Left */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 pb-6 border-b border-border/30">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">{market.timeLeft} remaining</span>
                </div>

                {/* Bet Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="group/btn"
                    onClick={() => {
                      setSelectedMarket(market);
                      setSelectedOption(market.optionA);
                      setStakeModalOpen(true);
                    }}
                  >
                    {market.optionA}
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm" 
                    className="group/btn"
                    onClick={() => {
                      setSelectedMarket(market);
                      setSelectedOption(market.optionB);
                      setStakeModalOpen(true);
                    }}
                  >
                    {market.optionB}
                  </Button>
                </div>
              </div>
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
                <span className="text-primary font-bold text-xl">{selectedOption}</span>
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
              onClick={() => {
                toast({
                  title: "Bet Placed ⚡",
                  description: `You bet on "${selectedOption}"`,
                });
                setStakeModalOpen(false);
              }}
            >
              <Zap className="w-4 h-4 mr-2" />
              Confirm Bet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default EverythingBets;
