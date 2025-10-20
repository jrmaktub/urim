import { useState } from "react";
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
import { CheckCircle2, Clock, TrendingUp } from "lucide-react";

import FetchUnifiedBalanceButton from '@/components/fetch-unified-balance-button';
import BridgeButton from '@/components/BridgeButton';
import Bridge from "@/components/BridgeButton";


const EverythingBets = () => {
  const { toast } = useToast();
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
  const [balances, setBalances] = useState<any>(null);

    const btn =
    'px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';
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
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setIsSuccess(true);
      toast({
        title: "Market Created ⚡",
        description: "Your market is live on the blockchain.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
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
          <div className="max-w-md w-full gold-card p-8 text-center animate-fade-up">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4 text-primary">
              Your market is live ⚡
            </h2>
            <p className="text-muted-foreground mb-8">
              Your bet is now on the blockchain. Share it or create another.
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
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12 animate-fade-up">
            <h1 className="text-5xl font-bold mb-4 text-primary">
              CREATE A BET
            </h1>
            <p className="text-lg text-muted-foreground">
              Define a question, set two sides, and open your market to everyone.
            </p>
          </div>
                  {balances && (
          <pre className="whitespace-pre-wrap">{JSON.stringify(balances, null, 2)}</pre>
        )}
        <FetchUnifiedBalanceButton className={btn} onResult={(r) => setBalances(r)} />
          <BridgeButton />
          <div className="gold-card p-8 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <div className="space-y-6">
              <div>
                <Label htmlFor="question" className="text-foreground font-bold mb-2 block">
                  QUESTION
                </Label>
                <Input
                  id="question"
                  placeholder="What event do you want to predict?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="optionA" className="text-foreground font-bold mb-2 block">
                  OPTION A
                </Label>
                <Input
                  id="optionA"
                  placeholder="First outcome (e.g., Yes)"
                  value={optionA}
                  onChange={(e) => setOptionA(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="optionB" className="text-foreground font-bold mb-2 block">
                  OPTION B
                </Label>
                <Input
                  id="optionB"
                  placeholder="Second outcome (e.g., No)"
                  value={optionB}
                  onChange={(e) => setOptionB(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="duration" className="text-foreground font-bold mb-2 block">
                  DURATION
                </Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="h-12 border-2 border-primary/50 bg-transparent text-foreground focus:border-primary focus:shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
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

              <div>
                <Label htmlFor="stake" className="text-foreground font-bold mb-2 block">
                  INITIAL STAKE (USDC)
                </Label>
                <Input
                  id="stake"
                  type="number"
                  placeholder="100"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                />
              </div>

              <Button
                onClick={handleCreateMarket}
                disabled={isProcessing}
                className="w-full h-14 text-base mt-8"
              >
                {isProcessing ? "CREATING MARKET..." : "CREATE MARKET"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Active Markets Section */}
      <section className="pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-primary">ACTIVE USER MARKETS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeMarkets.map((market, index) => (
              <div
                key={market.id}
                className="gold-card p-6 animate-fade-up hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all duration-300"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <h3 className="text-lg font-bold text-foreground mb-4">{market.question}</h3>
                
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{market.optionA} Pool</span>
                    <span className="text-primary font-bold">{market.poolA} USDC</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{market.optionB} Pool</span>
                    <span className="text-primary font-bold">{market.poolB} USDC</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Clock className="w-4 h-4" />
                  <span>{market.timeLeft}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className="border-2 border-primary hover:bg-primary hover:text-black transition-all"
                    onClick={() => {
                      setSelectedMarket(market);
                      setSelectedOption(market.optionA);
                      setStakeModalOpen(true);
                    }}
                  >
                    Bet on {market.optionA}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="border-2 border-primary hover:bg-primary hover:text-black transition-all"
                    onClick={() => {
                      setSelectedMarket(market);
                      setSelectedOption(market.optionB);
                      setStakeModalOpen(true);
                    }}
                  >
                    Bet on {market.optionB}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stake Modal */}
      <Dialog open={stakeModalOpen} onOpenChange={setStakeModalOpen}>
        <DialogContent className="bg-card border-primary/30">
          <DialogHeader>
            <DialogTitle className="text-primary">Place Your Bet</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedMarket?.question}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-foreground font-bold mb-2 block">BETTING ON</Label>
              <div className="p-4 border-2 border-primary rounded-md bg-primary/10">
                <span className="text-primary font-bold text-lg">{selectedOption}</span>
              </div>
            </div>
            <div>
              <Label className="text-foreground font-bold mb-2 block">STAKE AMOUNT (USDC)</Label>
              <Input type="number" placeholder="100" />
            </div>
            <Button 
              className="w-full"
              onClick={() => {
                toast({
                  title: "Bet Placed ⚡",
                  description: `You bet on "${selectedOption}"`,
                });
                setStakeModalOpen(false);
              }}
            >
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
