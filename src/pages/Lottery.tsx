import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, ExternalLink, Sparkles } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { toast } from "@/hooks/use-toast";
import FiftyFiftyRaffleABI from "@/contracts/FiftyFiftyRaffle.json";
import { FIFTY_FIFTY_RAFFLE_ADDRESS } from "@/constants/lottery";
import { BASE_SEPOLIA_CHAIN_ID } from "@/constants/contracts";
import { formatUnits } from "viem";
import { baseSepolia } from "wagmi/chains";

const Lottery = () => {
  const { address, isConnected, chain } = useAccount();
  const [timeLeft, setTimeLeft] = useState(0);

  // Read current round info
  const { data: roundInfo, refetch: refetchRoundInfo } = useReadContract({
    address: FIFTY_FIFTY_RAFFLE_ADDRESS as `0x${string}`,
    abi: FiftyFiftyRaffleABI,
    functionName: "getCurrentRoundInfo",
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });

  // Read current round ID
  const { data: currentRoundId } = useReadContract({
    address: FIFTY_FIFTY_RAFFLE_ADDRESS as `0x${string}`,
    abi: FiftyFiftyRaffleABI,
    functionName: "currentRoundId",
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });

  // Buy ticket with USDC
  const { writeContract: buyWithUSDC, data: usdcHash } = useWriteContract();
  const { isLoading: isUSDCLoading } = useWaitForTransactionReceipt({
    hash: usdcHash,
  });

  // Buy ticket with URIM
  const { writeContract: buyWithURIM, data: urimHash } = useWriteContract();
  const { isLoading: isURIMLoading } = useWaitForTransactionReceipt({
    hash: urimHash,
  });

  // Parse round info
  const roundId = roundInfo ? Number(roundInfo[0]) : 0;
  const totalUSDC = roundInfo ? formatUnits(roundInfo[1] as bigint, 6) : "0";
  const totalURIM = roundInfo ? formatUnits(roundInfo[2] as bigint, 6) : "0";
  const roundTimeLeft = roundInfo ? Number(roundInfo[3]) : 0;
  const isOpen = roundInfo ? roundInfo[4] : false;

  // Update countdown
  useEffect(() => {
    setTimeLeft(roundTimeLeft);
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [roundTimeLeft]);

  // Format time
  const formatTime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const handleBuyWithUSDC = async () => {
    if (!isConnected) {
      toast({ title: "Please connect your wallet", variant: "destructive" });
      return;
    }
    if (chain?.id !== BASE_SEPOLIA_CHAIN_ID) {
      toast({ title: "Please switch to Base Sepolia", variant: "destructive" });
      return;
    }
    if (!isOpen) {
      toast({ title: "Round is not open", variant: "destructive" });
      return;
    }

    try {
      buyWithUSDC({
        address: FIFTY_FIFTY_RAFFLE_ADDRESS as `0x${string}`,
        abi: FiftyFiftyRaffleABI,
        functionName: "buyTicketWithUSDC",
        account: address,
        chain: baseSepolia,
      });
      toast({ title: "Transaction submitted!" });
      setTimeout(() => refetchRoundInfo(), 2000);
    } catch (error: any) {
      toast({ title: "Transaction failed", description: error.message, variant: "destructive" });
    }
  };

  const handleBuyWithURIM = async () => {
    if (!isConnected) {
      toast({ title: "Please connect your wallet", variant: "destructive" });
      return;
    }
    if (chain?.id !== BASE_SEPOLIA_CHAIN_ID) {
      toast({ title: "Please switch to Base Sepolia", variant: "destructive" });
      return;
    }
    if (!isOpen) {
      toast({ title: "Round is not open", variant: "destructive" });
      return;
    }

    try {
      buyWithURIM({
        address: FIFTY_FIFTY_RAFFLE_ADDRESS as `0x${string}`,
        abi: FiftyFiftyRaffleABI,
        functionName: "buyTicketWithURIM",
        account: address,
        chain: baseSepolia,
      });
      toast({ title: "Transaction submitted!" });
      setTimeout(() => refetchRoundInfo(), 2000);
    } catch (error: any) {
      toast({ title: "Transaction failed", description: error.message, variant: "destructive" });
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(FIFTY_FIFTY_RAFFLE_ADDRESS);
    toast({ title: "Address copied!" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs text-primary font-medium tracking-wide">
                Powered by Chainlink VRF • Base Sepolia
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">
              Quantum 50/50 Lottery
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Enter a provably fair, quantum-themed 50/50 draw. One winner, half the pot.
            </p>
          </motion.div>

          {/* Main Content */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {/* Current Round Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="relative"
            >
              {/* Quantum Effect Background */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent opacity-50 blur-2xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-primary/30 rounded-full blur-3xl animate-pulse" />
              
              <div className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Round #{roundId}</h2>
                  {isOpen ? (
                    <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">
                      OPEN
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold">
                      CLOSED
                    </span>
                  )}
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Time Left</span>
                    <span className="text-xl font-semibold text-primary">{formatTime(timeLeft)}</span>
                  </div>
                  
                  <div className="h-px bg-border/50" />
                  
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Total Pot</p>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">
                        {parseFloat(totalUSDC).toFixed(2)} <span className="text-lg text-muted-foreground">USDC</span>
                      </p>
                      <p className="text-xl font-semibold text-primary/80">
                        {parseFloat(totalURIM).toFixed(2)} <span className="text-sm text-muted-foreground">URIM</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="h-px bg-border/50" />
                  
                  <p className="text-xs text-muted-foreground">
                    Winner receives 50% of the pot. The other 50% funds URIM development.
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={handleBuyWithUSDC}
                    disabled={!isConnected || !isOpen || isUSDCLoading}
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-primary/20"
                  >
                    {isUSDCLoading ? "Processing..." : "Buy Ticket with USDC"}
                  </Button>
                  <Button
                    onClick={handleBuyWithURIM}
                    disabled={!isConnected || !isOpen || isURIMLoading}
                    variant="outline"
                    className="w-full h-12 border-primary/30 hover:bg-primary/10 font-semibold rounded-lg transition-all"
                  >
                    {isURIMLoading ? "Processing..." : "Buy Ticket with URIM"}
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* How It Works Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-3xl p-8"
            >
              <h2 className="text-2xl font-bold mb-6">How the Quantum 50/50 Works</h2>
              
              <div className="space-y-4 mb-8">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">1</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Each ticket costs <span className="font-semibold text-foreground">$5</span> (1 ticket = 1 entry into the current round).
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">2</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    At the end of the round, 1 wallet is selected as the winner.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">3</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    The winner receives <span className="font-semibold text-foreground">50% of the total pot</span> (USDC + URIM).
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">4</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    The remaining 50% goes to URIM for platform growth and development.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Provable Randomness</h3>
                  <p className="text-sm text-muted-foreground">
                    We use <span className="font-semibold text-foreground">Chainlink VRF</span> to securely generate a random winner on-chain.
                  </p>
                </div>

                <div className="h-px bg-border/50" />

                <div>
                  <h3 className="text-sm font-semibold mb-3">Smart Contract</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    All logic is handled by the lottery contract:
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-secondary/40 rounded-lg border border-border/30">
                    <code className="text-xs font-mono flex-1 truncate">
                      {FIFTY_FIFTY_RAFFLE_ADDRESS}
                    </code>
                    <button
                      onClick={copyAddress}
                      className="p-1.5 hover:bg-secondary rounded transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={`https://base-sepolia.blockscout.com/address/${FIFTY_FIFTY_RAFFLE_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-secondary rounded transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    You can verify ticket purchases, payouts, and randomness on-chain.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Recent Winners Strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6"
          >
            <h3 className="text-lg font-semibold mb-4">Recent Winners</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {currentRoundId && Number(currentRoundId) > 0 ? (
                Array.from({ length: Math.min(3, Number(currentRoundId)) }, (_, i) => {
                  const roundNum = Number(currentRoundId) - i - 1;
                  return (
                    <RecentWinnerPill key={roundNum} roundId={roundNum} />
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No completed rounds yet</p>
              )}
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

// Recent Winner Pill Component
const RecentWinnerPill = ({ roundId }: { roundId: number }) => {
  const { data: roundResult } = useReadContract({
    address: FIFTY_FIFTY_RAFFLE_ADDRESS as `0x${string}`,
    abi: FiftyFiftyRaffleABI,
    functionName: "getRoundResult",
    args: [BigInt(roundId)],
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });

  if (!roundResult || !roundResult[3]) return null; // Not completed

  const winner = roundResult[0] as string;
  const usdcPayout = formatUnits(roundResult[1] as bigint, 6);
  const urimPayout = formatUnits(roundResult[2] as bigint, 6);

  return (
    <div className="flex-shrink-0 px-4 py-2 bg-secondary/40 border border-border/30 rounded-full">
      <span className="text-xs text-muted-foreground">
        Round #{roundId} • Winner:{" "}
        <span className="font-mono text-foreground">
          {winner.slice(0, 6)}...{winner.slice(-4)}
        </span>{" "}
        • Payout: {parseFloat(usdcPayout).toFixed(0)} USDC + {parseFloat(urimPayout).toFixed(0)} URIM
      </span>
    </div>
  );
};

export default Lottery;
