import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, TrendingUp, Users, Clock, Loader2, X } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { parseUnits } from "viem";
import {
  useHondurasElectionPrices,
  useUserPosition,
  useMarketTimeRemaining,
  useMarketState,
  useApproveUSDC,
  useBuyShares,
  useSellShares,
  useClaimWinnings,
  useUSDCAllowance,
} from "@/hooks/useHondurasElection";
import { CANDIDATE_IDS, MARKET_STATES } from "@/constants/hondurasElection";
import ElectionOrderBook from "@/components/ElectionOrderBook";

const candidatesBase = [
  {
    id: CANDIDATE_IDS.NASRALLA,
    name: "Salvador Nasralla",
    image: "/placeholder.svg",
    color: "#FFFFFF",
  },
  {
    id: CANDIDATE_IDS.MONCADA,
    name: "Rixi Moncada",
    image: "/placeholder.svg",
    color: "#FF3B30",
  },
  {
    id: CANDIDATE_IDS.ASFURA,
    name: "Nasry Asfura",
    image: "/placeholder.svg",
    color: "#0073CF",
  },
];


const Elections = () => {
  const { address, isConnected } = useAccount();
  const [timeRange, setTimeRange] = useState("1D");
  const [selectedCandidateId, setSelectedCandidateId] = useState<number>(CANDIDATE_IDS.NASRALLA);
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradeType, setTradeType] = useState<"YES" | "NO">("YES");
  const [isApproving, setIsApproving] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isOrderBookExpanded, setIsOrderBookExpanded] = useState(false);

  // Contract hooks
  const prices = useHondurasElectionPrices();
  const marketState = useMarketState();
  const timeRemaining = useMarketTimeRemaining();
  const nasrallaPosition = useUserPosition(CANDIDATE_IDS.NASRALLA);
  const moncadaPosition = useUserPosition(CANDIDATE_IDS.MONCADA);
  const asfuraPosition = useUserPosition(CANDIDATE_IDS.ASFURA);
  const { allowance, refetch: refetchAllowance } = useUSDCAllowance();

  const { approve, isPending: isApprovingTx, isConfirming: isApprovalConfirming, isSuccess: isApprovalSuccess } = useApproveUSDC();
  const { buyShares, isConfirming: isBuying, isPending: isBuyingPending } = useBuyShares();
  const { sellShares, isConfirming: isSelling, isPending: isSellingPending } = useSellShares();
  const { claimWinnings, isConfirming: isClaiming, isPending: isClaimingPending } = useClaimWinnings();

  // Map candidates with live data
  const candidates = candidatesBase.map((candidate) => {
    let percentage = 0;
    let position = "0.00";

    if (candidate.id === CANDIDATE_IDS.NASRALLA) {
      percentage = prices.nasralla;
      position = nasrallaPosition;
    } else if (candidate.id === CANDIDATE_IDS.MONCADA) {
      percentage = prices.moncada;
      position = moncadaPosition;
    } else if (candidate.id === CANDIDATE_IDS.ASFURA) {
      percentage = prices.asfura;
      position = asfuraPosition;
    }

    return {
      ...candidate,
      percentage: Math.round(percentage * 100) / 100,
      position,
    };
  });

  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId) || candidates[0];

  // Format time remaining
  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return "Market Closed";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const handleTrade = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (marketState !== MARKET_STATES.OPEN) {
      toast.error("Market is not open for trading");
      return;
    }

    try {
      if (tradeType === "YES") {
        const requiredAmount = parseUnits(tradeAmount, 6);
        
        // Check current allowance
        await refetchAllowance();
        const hasAllowance = allowance >= requiredAmount;
        
        if (!hasAllowance) {
          // Step 1: Approve unlimited USDC (one-time approval)
          setIsApproving(true);
          toast.info("Step 1/2: Approving USDC (one-time unlimited approval)...");
          await approve();
          
          // Wait for approval to be mined by checking allowance
          toast.info("Waiting for approval confirmation...");
          let confirmed = false;
          let attempts = 0;
          const maxAttempts = 3; // 3 seconds max
          
          while (!confirmed && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const { data: freshAllowance } = await refetchAllowance();
            confirmed = (freshAllowance as bigint || BigInt(0)) >= requiredAmount;
            attempts++;
          }
          
          if (!confirmed) {
            throw new Error("Approval transaction did not confirm in time");
          }
          
          setIsApproving(false);
          toast.success("USDC approved!");
        }
        
        // Step 2: Buy shares
        toast.info(hasAllowance ? "Buying shares..." : "Step 2/2: Buying shares...");
        await buyShares(selectedCandidateId, tradeAmount);
        toast.success("Shares purchased successfully!");
      } else {
        // Selling doesn't need approval
        toast.info("Selling shares...");
        await sellShares(selectedCandidateId, tradeAmount);
        toast.success("Shares sold successfully!");
      }

      setTradeAmount("");
    } catch (error: any) {
      console.error("Trade error:", error);
      toast.error(error?.shortMessage || error?.message || "Transaction failed");
      setIsApproving(false);
    }
  };

  const handleClaimWinnings = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      toast.info("Claiming winnings...");
      await claimWinnings();
      toast.success("Winnings claimed successfully!");
    } catch (error: any) {
      console.error("Claim error:", error);
      toast.error(error?.message || "Claim failed");
    }
  };

  const isProcessing = isApproving || isApprovingTx || isApprovalConfirming || isBuying || isSelling || isClaiming || isBuyingPending || isSellingPending || isClaimingPending;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-28 sm:pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-3 text-foreground">
                Honduras Presidential 2025
                <span className="text-primary ml-3">– Prediction Market</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                Trade the future. Live on Base Mainnet.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-sm text-muted-foreground">Time Remaining</div>
              <div className="text-2xl font-bold text-primary">
                {formatTimeRemaining(timeRemaining)}
              </div>
              {marketState === MARKET_STATES.RESOLVED && (
                <Button onClick={handleClaimWinnings} disabled={isClaiming} className="mt-2">
                  {isClaiming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Claim Winnings
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Graph Section */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Price Chart</h2>
                <Tabs value={timeRange} onValueChange={setTimeRange}>
                  <TabsList className="bg-secondary/40">
                    {["1H", "6H", "1D", "1W", "1M", "ALL"].map((range) => (
                      <TabsTrigger
                        key={range}
                        value={range}
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      >
                        {range}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              
              {/* Placeholder Graph */}
              <div className="relative h-64 sm:h-80 bg-card/50 rounded-xl border border-border/50 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 800 300">
                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map((i) => (
                      <line
                        key={i}
                        x1="0"
                        y1={i * 60 + 30}
                        x2="800"
                        y2={i * 60 + 30}
                        stroke="hsl(var(--border))"
                        strokeWidth="1"
                        opacity="0.3"
                      />
                    ))}
                    
                    {/* All candidate lines */}
                    {candidates.map((candidate, idx) => {
                      const points = Array.from({ length: 20 }, (_, i) => {
                        const x = (i * 800) / 19;
                        const baseY = 150 - (candidate.percentage - 32) * 3;
                        const variance = Math.sin(i * 0.5 + idx) * 20;
                        return `${x},${baseY + variance}`;
                      }).join(" ");
                      
                      return (
                        <polyline
                          key={candidate.id}
                          points={points}
                          fill="none"
                          stroke={candidate.color}
                          strokeWidth="3"
                          className="animate-fade-in"
                          style={{ animationDelay: `${idx * 200}ms` }}
                        />
                      );
                    })}
                  </svg>
                </div>
                
                {/* Legend */}
                <div className="absolute bottom-4 left-4 flex flex-wrap gap-3">
                  {candidates.map((candidate) => (
                    <div key={candidate.id} className="flex items-center gap-2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border/50">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: candidate.color }}
                      />
                      <span className="text-xs font-medium text-foreground">{candidate.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Candidate Cards */}
            <div className="space-y-4 animate-fade-up">
              {candidates.map((candidate, index) => (
                <div key={candidate.id} style={{ animationDelay: `${index * 100}ms` }}>
                  <div
                    onClick={() => setSelectedCandidateId(candidate.id)}
                    className={`glass-card p-6 hover:border-primary/50 transition-all cursor-pointer ${
                      selectedCandidateId === candidate.id ? "border-primary" : ""
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary overflow-hidden border-2 border-primary/30">
                          <img
                            src={candidate.image}
                            alt={candidate.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-foreground mb-1">
                            {candidate.name}
                          </h3>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <TrendingUp className="w-4 h-4" />
                              <span className="text-primary font-bold text-lg">{candidate.percentage}%</span>
                            </div>
                            {isConnected && parseFloat(candidate.position) > 0 && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Users className="w-4 h-4" />
                                <span>Your position: ${candidate.position}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                          onClick={() => {
                            setSelectedCandidateId(candidate.id);
                            setTradeType("YES");
                            if (window.innerWidth < 1024) {
                              setIsMobileDrawerOpen(true);
                            }
                          }}
                          className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white border-0"
                          disabled={marketState !== MARKET_STATES.OPEN}
                        >
                          Buy
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedCandidateId(candidate.id);
                            setTradeType("NO");
                            if (window.innerWidth < 1024) {
                              setIsMobileDrawerOpen(true);
                            }
                          }}
                          className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white border-0"
                          disabled={marketState !== MARKET_STATES.OPEN}
                        >
                          Sell
                        </Button>
                      </div>
                    </div>
                    {/* Percentage bar */}
                    <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${candidate.percentage}%`,
                          backgroundColor: candidate.color,
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Order Book - Only show for selected candidate */}
                  {selectedCandidateId === candidate.id && (
                    <ElectionOrderBook 
                      candidateId={candidate.id}
                      candidateName={candidate.name}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Rules Summary */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Rules Summary</h2>
              <div className="space-y-4">
                <p className="text-foreground leading-relaxed">
                  Presidential elections in Honduras are scheduled for November 30, 2025. This market resolves to the candidate who is publicly confirmed as the winner. If no winner is determined by December 31, 2026 at 11:59 PM ET, the market resolves to 'Other'.
                </p>
                <p className="text-foreground leading-relaxed">
                  Winner determination is based on a consensus of credible reporting — including outlets such as The New York Times, Reuters, AP, Politico, Semafor, CNN, ABC, Fox News, and others — together with the official announcement from the Honduran National Electoral Council (Consejo Nacional Electoral, CNE). If major sources temporarily conflict, resolution will pause until a clear and consistent public consensus emerges.
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className="glass-card p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Timeline & Payout</h2>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-border" />
                
                {/* Timeline items */}
                <div className="space-y-8">
                  <div className="relative pl-16">
                    <div className="absolute left-0 w-12 h-12 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Market Opens</p>
                      <p className="font-semibold text-foreground">November 24, 2025</p>
                    </div>
                  </div>
                  
                  <div className="relative pl-16">
                    <div className="absolute left-0 w-12 h-12 rounded-full bg-secondary/50 border-2 border-border flex items-center justify-center">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Market Closes</p>
                      <p className="font-semibold text-foreground">November 30, 2025 at 10:00 PM Honduras time</p>
                      <p className="text-xs text-muted-foreground mt-1">Winner may not be immediately declared. Payout happens once a winner is publicly confirmed.</p>
                    </div>
                  </div>
                  
                  <div className="relative pl-16">
                    <div className="absolute left-0 w-12 h-12 rounded-full bg-secondary/50 border-2 border-border flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Payout</p>
                      <p className="font-semibold text-foreground">Once winner is publicly confirmed</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Resolver / Verification Link */}
            <div className="glass-card p-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">Resolver / Verification</h2>
              <p className="text-muted-foreground mb-4">
                Market resolution is verified through decentralized oracle consensus.
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">Resolver (UMA)</p>
                    <a 
                      href="https://basescan.org/address/0x2aBf1Bd76655de80eDB3086114315Eec75AF500c" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      0x2aBf...500c
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <Button variant="outline" className="gap-2 border-primary/30 hover:border-primary/50 w-full">
                  View Oracle Resolver
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Purchase Widget (Desktop Only) */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24 glass-card p-4 space-y-4">
              {/* Candidate Info */}
              <div className="flex items-center gap-3 pb-3 border-b border-border/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary overflow-hidden border-2 border-primary/30">
                  <img
                    src={selectedCandidate.image}
                    alt={selectedCandidate.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{selectedCandidate.name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedCandidate.percentage}% probability</p>
                </div>
              </div>

              {/* Buy/Sell Toggle */}
              <div className="flex gap-2">
                <Button
                  onClick={() => setTradeType("YES")}
                  className={`flex-1 ${
                    tradeType === "YES"
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                  disabled={marketState !== MARKET_STATES.OPEN}
                >
                  Buy
                </Button>
                <Button
                  onClick={() => setTradeType("NO")}
                  className={`flex-1 ${
                    tradeType === "NO"
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                  disabled={marketState !== MARKET_STATES.OPEN}
                >
                  Sell
                </Button>
              </div>

              {/* User Position */}
              {isConnected && parseFloat(selectedCandidate.position) > 0 && (
                <div className="bg-card/50 rounded-lg p-3 border border-border/30">
                  <div className="text-xs text-muted-foreground mb-1">Your Position</div>
                  <div className="text-lg font-bold text-primary">${selectedCandidate.position}</div>
                </div>
              )}

              {/* Price Display */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Current Price</span>
                  <span className="font-semibold text-primary">{selectedCandidate.percentage}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Market Status</span>
                  <span className={`font-semibold ${marketState === MARKET_STATES.OPEN ? 'text-green-500' : marketState === MARKET_STATES.RESOLVED ? 'text-blue-500' : 'text-red-500'}`}>
                    {marketState === MARKET_STATES.OPEN ? 'OPEN' : marketState === MARKET_STATES.RESOLVED ? 'RESOLVED' : 'CLOSED'}
                  </span>
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Quick Amount</label>
                <div className="flex gap-2">
                  {[1, 5, 20, 50].map((amount) => (
                    <Button
                      key={amount}
                      size="sm"
                      variant="outline"
                      onClick={() => setTradeAmount(amount.toString())}
                      className="flex-1 text-xs h-8"
                      disabled={marketState !== MARKET_STATES.OPEN || isProcessing}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Transaction Summary */}
              <div className="bg-card/50 rounded-lg p-3 space-y-1.5 border border-border/30">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">You {tradeType === "YES" ? "pay" : "receive"}</span>
                  <span className="font-semibold text-foreground">
                    ${tradeAmount || "0.00"} USDC
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Expected value</span>
                  <span className="font-semibold text-primary">
                    ${tradeAmount ? (parseFloat(tradeAmount) / (selectedCandidate.percentage / 100)).toFixed(2) : "0.00"}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1.5 border-t border-border/30">
                  <span className="text-muted-foreground">Current Price</span>
                  <span className="font-medium text-foreground">{selectedCandidate.percentage}%</span>
                </div>
              </div>

              {/* Trade Button */}
              <Button
                onClick={handleTrade}
                disabled={!isConnected || marketState !== MARKET_STATES.OPEN || isProcessing || !tradeAmount}
                className="w-full bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-white shadow-lg shadow-primary/25"
                size="lg"
              >
                {!isConnected ? (
                  "Connect Wallet"
                ) : marketState !== MARKET_STATES.OPEN ? (
                  "Market Closed"
                ) : isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isApproving || isApprovingTx || isApprovalConfirming
                      ? "Approving USDC..." 
                      : isBuying || isBuyingPending
                      ? "Buying Shares..."
                      : isSelling || isSellingPending
                      ? "Selling Shares..."
                      : "Processing..."}
                  </>
                ) : (
                  `${tradeType === "YES" ? "Buy" : "Sell"} Shares`
                )}
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">
                Trades execute on Base Mainnet with USDC
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Order Book (Collapsible) */}
        <div className="lg:hidden mt-6">
          <div className="glass-card p-4">
            <button
              onClick={() => setIsOrderBookExpanded(!isOrderBookExpanded)}
              className="w-full flex items-center justify-between text-foreground font-semibold mb-2"
            >
              <span>Order Book & Trades</span>
              <span className="text-muted-foreground text-xl">{isOrderBookExpanded ? '−' : '+'}</span>
            </button>
            {isOrderBookExpanded && (
              <div className="mt-4">
                <ElectionOrderBook 
                  candidateId={selectedCandidateId}
                  candidateName={selectedCandidate.name}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Trading Drawer */}
      <Drawer open={isMobileDrawerOpen} onOpenChange={setIsMobileDrawerOpen}>
        <DrawerContent className="bg-background/95 backdrop-blur-xl border-t border-border/50 rounded-t-[20px]">
          <DrawerHeader className="text-left border-b border-border/30 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary overflow-hidden border-2 border-primary/30">
                  <img
                    src={selectedCandidate.image}
                    alt={selectedCandidate.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <DrawerTitle className="text-lg text-foreground">{selectedCandidate.name}</DrawerTitle>
                  <DrawerDescription 
                    className="text-2xl font-bold mt-1"
                    style={{ color: candidates.find(c => c.id === selectedCandidateId)?.color }}
                  >
                    {selectedCandidate.percentage}%
                  </DrawerDescription>
                </div>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary/60">
                  <X className="h-5 w-5" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Buy/Sell Toggle */}
            <div className="flex gap-2 p-1 bg-secondary/40 rounded-lg">
              <button
                onClick={() => setTradeType("YES")}
                className={`flex-1 py-3 rounded-md font-semibold transition-all ${
                  tradeType === "YES"
                    ? "bg-green-600 text-white shadow-lg"
                    : "text-muted-foreground hover:bg-secondary/60"
                }`}
                disabled={marketState !== MARKET_STATES.OPEN}
              >
                Buy
              </button>
              <button
                onClick={() => setTradeType("NO")}
                className={`flex-1 py-3 rounded-md font-semibold transition-all ${
                  tradeType === "NO"
                    ? "bg-red-600 text-white shadow-lg"
                    : "text-muted-foreground hover:bg-secondary/60"
                }`}
                disabled={marketState !== MARKET_STATES.OPEN}
              >
                Sell
              </button>
            </div>

            {/* User Position */}
            {isConnected && parseFloat(selectedCandidate.position) > 0 && (
              <div className="bg-card/50 rounded-lg p-4 border border-border/30">
                <div className="text-xs text-muted-foreground mb-1">Your Position</div>
                <div className="text-xl font-bold text-primary">${selectedCandidate.position}</div>
              </div>
            )}

            {/* Quick Amount Buttons */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Select Amount (USDC)</label>
              <div className="grid grid-cols-4 gap-3">
                {[1, 5, 20, 50].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setTradeAmount(amount.toString())}
                    className={`py-4 px-3 rounded-xl text-base font-bold transition-all ${
                      tradeAmount === amount.toString()
                        ? "bg-primary text-primary-foreground shadow-lg scale-105"
                        : "bg-secondary/40 hover:bg-secondary/60 text-foreground"
                    }`}
                    disabled={marketState !== MARKET_STATES.OPEN || isProcessing}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated Payout */}
            {tradeAmount && parseFloat(tradeAmount) > 0 && (
              <div className="p-4 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">You {tradeType === "YES" ? "pay" : "receive"}:</span>
                  <span className="font-semibold text-foreground text-lg">
                    ${tradeAmount} USDC
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Expected value:</span>
                  <span className="font-semibold text-primary text-lg">
                    ${(parseFloat(tradeAmount) / (selectedCandidate.percentage / 100)).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-border/20">
                  <span className="text-muted-foreground">Avg price:</span>
                  <span className="text-muted-foreground">{selectedCandidate.percentage}¢</span>
                </div>
              </div>
            )}
          </div>

          <DrawerFooter className="border-t border-border/30 pt-4 px-6 pb-6">
            <Button
              onClick={() => {
                handleTrade();
                setIsMobileDrawerOpen(false);
              }}
              disabled={!isConnected || marketState !== MARKET_STATES.OPEN || isProcessing || !tradeAmount || parseFloat(tradeAmount) <= 0}
              className={`w-full py-6 text-lg font-bold shadow-lg ${
                tradeType === "YES"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
            >
              {!isConnected ? (
                "Connect Wallet"
              ) : marketState !== MARKET_STATES.OPEN ? (
                "Market Closed"
              ) : isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {isApproving || isApprovingTx || isApprovalConfirming
                    ? "Approving..." 
                    : isBuying || isBuyingPending
                    ? "Buying..."
                    : isSelling || isSellingPending
                    ? "Selling..."
                    : "Processing..."}
                </>
              ) : (
                `${tradeType === "YES" ? "Buy" : "Sell"} Shares`
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Trades execute on Base Mainnet with USDC
            </p>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Elections;
