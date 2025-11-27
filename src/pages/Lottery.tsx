import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, ExternalLink, Sparkles } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAccount, useSwitchChain, useReadContract } from "wagmi";
import { toast } from "@/hooks/use-toast";
import { FIFTY_FIFTY_RAFFLE_ADDRESS } from "@/constants/lottery";
import { useLotteryContract } from "@/hooks/useLotteryContract";
import { base } from "wagmi/chains";
import FiftyFiftyRaffleABI from "@/contracts/FiftyFiftyRaffle.json";

const Lottery = () => {
  const { isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const [timeLeft, setTimeLeft] = useState(0);
  const [showUSDCParticles, setShowUSDCParticles] = useState(false);
  const [showURIMParticles, setShowURIMParticles] = useState(false);

  const {
    roundId,
    totalUSDC,
    totalPlayers,
    roundTimeLeft,
    isOpen,
    roundState,
    handleBuyTicket,
    isLoading,
  } = useLotteryContract();

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

  const handleSwitchToBase = () => {
    switchChain({ chainId: base.id });
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(FIFTY_FIFTY_RAFFLE_ADDRESS);
    toast({ title: "Address copied!" });
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Quantum Sparkle Grid Background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.15]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--primary)) 2px, transparent 2px)`,
          backgroundSize: '50px 50px',
        }}>
          {Array.from({ length: 80 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-primary rounded-full blur-sm"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                opacity: [0, 0.8, 0],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 2 + Math.random() * 3,
                repeat: Infinity,
                delay: Math.random() * 3,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
      
      <Navigation />
      
      <main className="pt-28 sm:pt-32 pb-12 px-4 md:px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12 sm:mb-16 relative"
          >
            {/* Quantum Orbit Effect - More Visible */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
              {/* Particle 1 - Purple */}
              <motion.div
                className="absolute w-96 h-96"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <motion.div
                  className="absolute w-6 h-6 rounded-full blur-md"
                  style={{
                    background: "linear-gradient(135deg, #a78bfa, #c084fc)",
                    opacity: 0.8,
                    top: "10%",
                    left: "50%",
                    boxShadow: "0 0 20px #a78bfa",
                  }}
                />
              </motion.div>
              {/* Particle 2 - Pink */}
              <motion.div
                className="absolute w-[28rem] h-[28rem]"
                animate={{ rotate: -360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              >
                <motion.div
                  className="absolute w-5 h-5 rounded-full blur-md"
                  style={{
                    background: "linear-gradient(135deg, #ec6bf0, #f472b6)",
                    opacity: 0.7,
                    top: "15%",
                    left: "50%",
                    boxShadow: "0 0 15px #ec6bf0",
                  }}
                />
              </motion.div>
              {/* Particle 3 - Light Purple */}
              <motion.div
                className="absolute w-80 h-80"
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              >
                <motion.div
                  className="absolute w-4 h-4 rounded-full blur-sm"
                  style={{
                    background: "linear-gradient(135deg, #c084fc, #e879f9)",
                    opacity: 0.9,
                    top: "20%",
                    left: "50%",
                    boxShadow: "0 0 12px #c084fc",
                  }}
                />
              </motion.div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-primary/10 border border-primary/20 mb-4 md:mb-6">
              <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
              <span className="text-[10px] md:text-xs text-primary font-medium tracking-wide">
                Powered by Chainlink VRF • Base Sepolia
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-3 md:mb-4 relative z-10 px-2 leading-tight">
              Quantum 50/50 Lottery
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto relative z-10 px-4">
              Enter a provably fair, quantum-themed 50/50 draw. One winner, half the pot.
            </p>
          </motion.div>

          {/* Main Content */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 mb-12 md:mb-16">
            {/* Current Round Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="relative"
            >
              {/* Enhanced Pulsing Halo Glow */}
              <motion.div 
                className="absolute inset-0 rounded-3xl blur-3xl"
                style={{
                  background: "radial-gradient(circle, rgba(167, 139, 250, 0.4), rgba(236, 107, 240, 0.3), transparent)"
                }}
                animate={{ 
                  opacity: [0.5, 0.8, 0.5],
                  scale: [1, 1.15, 1]
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              {/* Secondary glow layer */}
              <motion.div 
                className="absolute inset-0 rounded-3xl blur-2xl"
                style={{
                  background: "radial-gradient(circle, rgba(192, 132, 252, 0.3), transparent)"
                }}
                animate={{ 
                  opacity: [0.4, 0.7, 0.4],
                  scale: [1.05, 1.2, 1.05]
                }}
                transition={{
                  duration: 7,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5
                }}
              />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/50 rounded-full blur-3xl animate-pulse" />
              
              <div className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-5 md:mb-6">
                  <h2 className="text-xl md:text-2xl font-bold">Round #{roundId}</h2>
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

                <div className="space-y-3 md:space-y-4 mb-6 md:mb-8">
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm text-muted-foreground">Time Left</span>
                    <span className="text-lg md:text-xl font-semibold text-primary">{formatTime(timeLeft)}</span>
                  </div>
                  
                  <div className="h-px bg-border/50" />
                  
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground mb-2">Total Pot</p>
                    <div className="space-y-1">
                      <p className="text-xl md:text-2xl font-bold">
                        {parseFloat(totalUSDC).toFixed(2)} <span className="text-base md:text-lg text-muted-foreground">USDC</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="h-px bg-border/50" />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm text-muted-foreground">Players</span>
                    <span className="text-lg md:text-xl font-semibold">{totalPlayers}</span>
                  </div>
                  
                  <p className="text-[11px] md:text-xs text-muted-foreground mt-3 md:mt-4">
                    Winner receives 50% of the pot. The other 50% funds URIM development.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Button
                      onClick={() => {
                        setShowUSDCParticles(true);
                        handleBuyTicket();
                        setTimeout(() => setShowUSDCParticles(false), 1000);
                      }}
                      disabled={isLoading}
                      className="w-full h-11 md:h-12 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold text-sm md:text-base rounded-lg transition-all hover:shadow-lg hover:shadow-secondary/20"
                    >
                      {isLoading ? "Processing..." : "Buy Ticket with USDC"}
                    </Button>
                    <AnimatePresence>
                      {showUSDCParticles && (
                        <>
                          {Array.from({ length: 12 }).map((_, i) => (
                            <motion.div
                              key={i}
                              className="absolute w-2 h-2 rounded-full bg-primary blur-sm pointer-events-none"
                              style={{
                                left: "50%",
                                top: "50%",
                              }}
                              initial={{ opacity: 0.8, x: 0, y: 0, scale: 1 }}
                              animate={{
                                opacity: 0,
                                x: Math.cos((i / 12) * Math.PI * 2) * 60,
                                y: Math.sin((i / 12) * Math.PI * 2) * 60,
                                scale: 0.5,
                              }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                            />
                          ))}
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="relative">
                    <Button
                      disabled={true}
                      className="w-full h-11 md:h-12 bg-primary/50 hover:bg-primary/50 text-primary-foreground font-semibold text-sm md:text-base rounded-lg transition-all opacity-50 cursor-not-allowed"
                    >
                      Coming Soon - URIM
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* How It Works Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl md:rounded-3xl p-5 md:p-8"
            >
              <h2 className="text-xl md:text-2xl font-bold mb-5 md:mb-6">How the Quantum 50/50 Works</h2>
              
              <div className="space-y-3 md:space-y-4 mb-6 md:mb-8">
                <div className="flex gap-2.5 md:gap-3">
                  <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] md:text-xs font-bold text-primary">1</span>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Each ticket costs <span className="font-semibold text-foreground">$5</span> (1 ticket = 1 entry into the current round).
                  </p>
                </div>
                <div className="flex gap-2.5 md:gap-3">
                  <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] md:text-xs font-bold text-primary">2</span>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    At the end of the round, 1 wallet is selected as the winner.
                  </p>
                </div>
                <div className="flex gap-2.5 md:gap-3">
                  <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] md:text-xs font-bold text-primary">3</span>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    The winner receives <span className="font-semibold text-foreground">50% of the total pot</span> (USDC + URIM).
                  </p>
                </div>
                <div className="flex gap-2.5 md:gap-3">
                  <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] md:text-xs font-bold text-primary">4</span>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    The remaining 50% goes to URIM for platform growth and development.
                  </p>
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                <div>
                  <h3 className="text-xs md:text-sm font-semibold mb-1.5 md:mb-2">Provable Randomness</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    We use <span className="font-semibold text-foreground">Chainlink VRF</span> to securely generate a random winner on-chain.
                  </p>
                </div>

                <div className="h-px bg-border/50" />

                <div>
                  <h3 className="text-xs md:text-sm font-semibold mb-2 md:mb-3">Smart Contract</h3>
                  <p className="text-xs md:text-sm text-muted-foreground mb-2">
                    All logic is handled by the lottery contract:
                  </p>
                  <div className="flex items-center gap-1.5 md:gap-2 p-2.5 md:p-3 bg-secondary/40 rounded-lg border border-border/30">
                    <code className="text-[10px] md:text-xs font-mono flex-1 truncate">
                      {FIFTY_FIFTY_RAFFLE_ADDRESS}
                    </code>
                    <button
                      onClick={copyAddress}
                      className="p-1 md:p-1.5 hover:bg-secondary rounded transition-colors flex-shrink-0"
                    >
                      <Copy className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    </button>
                    <a
                      href="https://basescan.org/address/0xFC448fF766bC5d4d01cF0d15cb20f5aA2400A3DA"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 md:p-1.5 hover:bg-secondary rounded transition-colors flex-shrink-0"
                    >
                      <ExternalLink className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    </a>
                  </div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-2">
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
            className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-xl md:rounded-2xl p-4 md:p-6"
          >
            <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Recent Winners</h3>
            <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {roundId && roundId > 0 ? (
                Array.from({ length: Math.min(3, roundId) }, (_, i) => {
                  const roundNum = roundId - i - 1;
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
    abi: FiftyFiftyRaffleABI as unknown as any,
    functionName: "getRoundResult",
    args: [BigInt(roundId)],
    chainId: 8453, // Base mainnet
  });

  if (!roundResult) return null;

  // RoundResult struct: { winner, totalPotUSDC, winnerPayoutUSDC, timestamp }
  const result = roundResult as { winner: string; totalPotUSDC: bigint; winnerPayoutUSDC: bigint; timestamp: bigint };
  const winner = result.winner;
  const winnerPayout = (parseFloat(result.winnerPayoutUSDC.toString()) / 1e6).toFixed(2);
  
  // If winner is zero address, round hasn't completed
  if (winner === "0x0000000000000000000000000000000000000000") return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex-shrink-0 bg-card border border-border rounded-lg p-2.5 md:p-3 min-w-[160px] md:min-w-[200px]"
    >
      <div className="flex items-center justify-between mb-1.5 md:mb-2">
        <span className="text-[10px] md:text-xs text-muted-foreground">Round #{roundId}</span>
        <Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3 text-primary" />
      </div>
      <p className="text-[10px] md:text-xs font-mono text-foreground/80 mb-1.5 md:mb-2">
        {winner.slice(0, 6)}...{winner.slice(-4)}
      </p>
      <div className="text-[10px] md:text-xs">
        <span className="text-primary font-semibold">{winnerPayout} USDC</span>
      </div>
    </motion.div>
  );
};

export default Lottery;
