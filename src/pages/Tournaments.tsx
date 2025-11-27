import React, { useState } from "react";
import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { toast } from "sonner";

interface Player {
  id: string;
  name: string;
  pool: number;
}

const calculateOdds = (pool: number, totalPool: number) => {
  if (pool === 0) return 99.9;
  return Math.max(1.1, totalPool / pool);
};

const INITIAL_SEMIFINALISTS: Player[] = [
  { id: "S1", name: "Vega", pool: 1000 },
  { id: "S2", name: "Ramos", pool: 1200 },
  { id: "S3", name: "Luna", pool: 800 },
  { id: "S4", name: "Ortega", pool: 900 },
];

const INITIAL_FINALISTS: Player[] = [
  { id: "F1", name: "Condor", pool: 500 },
  { id: "F2", name: "Pecho", pool: 800 },
];

function BetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 md:px-3 md:py-1.5 rounded-lg md:rounded-xl text-xs md:text-sm uppercase md:normal-case tracking-wide md:tracking-normal bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300 hover:shadow-[0_0_12px_rgba(168,85,247,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      Bet Now
    </button>
  );
}

interface PlayerCardProps {
  p: Player;
  totalPool: number;
  delay?: number;
  onBet: (playerId: string) => void;
}

function PlayerCard({ p, totalPool, delay = 0, onBet }: PlayerCardProps) {
  const odds = calculateOdds(p.pool, totalPool);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ scale: 1.03, y: -2 }}
      className="group rounded-xl border border-white/10 bg-white/3 backdrop-blur-sm p-3 md:p-4 flex items-center justify-between shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:border-purple-400/30 hover:shadow-[0_0_16px_rgba(168,85,247,0.15)] transition-all duration-300 w-full md:w-[200px]"
    >
      <div className="flex-1">
        <div className="text-[14px] md:text-[15px] font-medium tracking-tight">{p.name}</div>
        <div className="text-sm md:text-xs text-purple-300/90 font-medium shadow-[0_0_8px_rgba(168,85,247,0.2)]">{odds.toFixed(1)}x</div>
        <div className="text-[10px] text-muted-foreground/60 mt-0.5">${p.pool.toLocaleString()} pool</div>
      </div>
      <BetButton onClick={() => onBet(p.id)} />
    </motion.div>
  );
}

interface MatchPairProps {
  players: [Player, Player];
  totalPool: number;
  delay?: number;
  onBet: (playerId: string) => void;
}

function MatchPair({ players, totalPool, delay = 0, onBet }: MatchPairProps) {
  return (
    <div className="md:hidden w-full max-w-md">
      <div className="flex gap-3 items-center justify-center">
        <PlayerCard p={players[0]} totalPool={totalPool} delay={delay} onBet={onBet} />
        <div className="text-white/30 font-bold text-sm">VS</div>
        <PlayerCard p={players[1]} totalPool={totalPool} delay={delay + 0.05} onBet={onBet} />
      </div>
    </div>
  );
}

function MobileMatchConnector() {
  return (
    <div className="md:hidden flex justify-center my-2">
      <div className="w-px h-6 bg-gradient-to-b from-purple-400/40 via-purple-400/60 to-purple-400/40 shadow-[0_0_8px_rgba(168,85,247,0.3)]" />
    </div>
  );
}

function WinnerCard() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1, duration: 0.5 }}
      className="rounded-2xl border border-purple-300/30 bg-white/5 backdrop-blur-sm p-8 shadow-[0_0_32px_rgba(168,85,247,0.25)] relative overflow-hidden w-[85%] sm:w-[280px] max-w-[280px]"
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative text-center">
        <div className="text-xs uppercase tracking-wider text-purple-300/70 mb-3">Champion</div>
        <div className="text-3xl font-semibold tracking-tight">TBD</div>
        <div className="text-sm text-white/50 mt-2">awaiting final</div>
      </div>
    </motion.div>
  );
}

function VerticalConnector({ type, delay = 0 }: { type: 'semifinals-to-final' | 'final-to-winner'; delay?: number }) {
  const height = 60;
  
  return (
    <div className="relative w-full flex justify-center opacity-30 md:opacity-100" style={{ height: `${height}px` }}>
      <svg
        className="absolute hidden md:block"
        width="600"
        height={height}
        style={{ left: '50%', transform: 'translateX(-50%)' }}
      >
        <defs>
          <linearGradient id={`vGrad-${type}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(168, 85, 247, 0.2)" />
            <stop offset="50%" stopColor="rgba(168, 85, 247, 0.4)" />
            <stop offset="100%" stopColor="rgba(168, 85, 247, 0.2)" />
          </linearGradient>
          <filter id={`glow-${type}`}>
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {type === 'semifinals-to-final' && (
          <>
            {/* Left semifinal pair to left finalist */}
            <motion.path
              d={`M 150 0 L 150 15 Q 150 20 155 20 L 195 20 Q 200 20 200 25 L 200 ${height}`}
              stroke={`url(#vGrad-${type})`}
              strokeWidth="1.5"
              fill="none"
              filter={`url(#glow-${type})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 0.9, 0.5] }}
              transition={{ delay, duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.path
              d={`M 250 0 L 250 15 Q 250 20 245 20 L 205 20 Q 200 20 200 25 L 200 ${height}`}
              stroke={`url(#vGrad-${type})`}
              strokeWidth="1.5"
              fill="none"
              filter={`url(#glow-${type})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 0.9, 0.5] }}
              transition={{ delay: delay + 0.3, duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            
            {/* Right semifinal pair to right finalist */}
            <motion.path
              d={`M 350 0 L 350 15 Q 350 20 355 20 L 395 20 Q 400 20 400 25 L 400 ${height}`}
              stroke={`url(#vGrad-${type})`}
              strokeWidth="1.5"
              fill="none"
              filter={`url(#glow-${type})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 0.9, 0.5] }}
              transition={{ delay: delay + 0.6, duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.path
              d={`M 450 0 L 450 15 Q 450 20 445 20 L 405 20 Q 400 20 400 25 L 400 ${height}`}
              stroke={`url(#vGrad-${type})`}
              strokeWidth="1.5"
              fill="none"
              filter={`url(#glow-${type})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 0.9, 0.5] }}
              transition={{ delay: delay + 0.9, duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}
        
        {type === 'final-to-winner' && (
          <>
            {/* Left finalist to winner */}
            <motion.path
              d={`M 200 0 L 200 15 Q 200 20 210 20 L 290 20 Q 300 20 300 25 L 300 ${height}`}
              stroke={`url(#vGrad-${type})`}
              strokeWidth="1.5"
              fill="none"
              filter={`url(#glow-${type})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 0.9, 0.5] }}
              transition={{ delay, duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Right finalist to winner */}
            <motion.path
              d={`M 400 0 L 400 15 Q 400 20 390 20 L 310 20 Q 300 20 300 25 L 300 ${height}`}
              stroke={`url(#vGrad-${type})`}
              strokeWidth="1.5"
              fill="none"
              filter={`url(#glow-${type})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 0.9, 0.5] }}
              transition={{ delay: delay + 0.3, duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}
      </svg>
    </div>
  );
}

function DottedPadelHalo() {
  return (
    <svg
      className="absolute -top-8 -right-10 w-56 h-56 opacity-15 pointer-events-none motion-reduce:hidden"
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <pattern id="dots" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" fill="currentColor" />
        </pattern>
      </defs>
      <circle cx="100" cy="100" r="90" fill="url(#dots)" className="text-purple-300" />
    </svg>
  );
}

function NeonCourtLines() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-2 rounded-[28px] border border-purple-400/20"
      style={{
        boxShadow: "0 0 32px 2px rgba(168, 85, 247, 0.12) inset",
      }}
    />
  );
}

export default function TournamentsPage() {
  const [semifinalists, setSemifinalists] = useState<Player[]>(INITIAL_SEMIFINALISTS);
  const [finalists, setFinalists] = useState<Player[]>(INITIAL_FINALISTS);

  const semifinalistsTotalPool = semifinalists.reduce((sum, p) => sum + p.pool, 0);
  const finalistsTotalPool = finalists.reduce((sum, p) => sum + p.pool, 0);

  const handleBet = (playerId: string, isSemifinal: boolean) => {
    const BET_AMOUNT = 100;
    
    if (isSemifinal) {
      setSemifinalists(prev => prev.map(p => 
        p.id === playerId 
          ? { ...p, pool: p.pool + BET_AMOUNT }
          : p
      ));
    } else {
      setFinalists(prev => prev.map(p => 
        p.id === playerId 
          ? { ...p, pool: p.pool + BET_AMOUNT }
          : p
      ));
    }
    
    const player = isSemifinal 
      ? semifinalists.find(p => p.id === playerId)
      : finalists.find(p => p.id === playerId);
    
    toast.success(`Demo bet placed on ${player?.name}!`, {
      description: `$${BET_AMOUNT} added to pool. Watch odds adjust!`
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="relative min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-10 py-10 pt-28 sm:pt-32 text-foreground">
        {/* Background gradient */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(139,92,246,0.12),transparent_60%)]" />
        
        <div className="mx-auto w-full max-w-6xl relative">
          <NeonCourtLines />
          <DottedPadelHalo />

          <motion.header
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-16 text-center"
          >
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Padel Cup 2025</h1>
            <p className="text-sm text-muted-foreground mt-1">live brackets • real odds</p>
          </motion.header>

          {/* Vertical Tournament Tree - Perfectly Centered */}
          <div className="flex flex-col items-center">
            
            {/* Champion Card (Top) */}
            <div className="flex justify-center mb-6">
              <WinnerCard />
            </div>

            {/* Connector: Final → Champion */}
            <VerticalConnector type="final-to-winner" delay={0.8} />

            {/* Final Round */}
            <div className="flex flex-col items-center gap-4 mb-6">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground/70">Final</h2>
              {/* Mobile: Paired Layout */}
              <MatchPair 
                players={[finalists[0], finalists[1]]} 
                totalPool={finalistsTotalPool}
                delay={0.6}
                onBet={(id) => handleBet(id, false)}
              />
              {/* Desktop: Side by Side */}
              <div className="hidden md:flex gap-12 justify-center items-center">
                <PlayerCard p={finalists[0]} totalPool={finalistsTotalPool} delay={0.6} onBet={(id) => handleBet(id, false)} />
                <PlayerCard p={finalists[1]} totalPool={finalistsTotalPool} delay={0.65} onBet={(id) => handleBet(id, false)} />
              </div>
            </div>

            {/* Connector: Semifinals → Final */}
            <VerticalConnector type="semifinals-to-final" delay={0.4} />

            {/* Semifinals Round */}
            <div className="flex flex-col items-center gap-4">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground/70">Semifinals</h2>
              {/* Mobile: Paired Layout with Connectors */}
              <div className="md:hidden flex flex-col gap-y-3 w-full items-center">
                <MatchPair 
                  players={[semifinalists[0], semifinalists[1]]} 
                  totalPool={semifinalistsTotalPool}
                  delay={0.1}
                  onBet={(id) => handleBet(id, true)}
                />
                <MobileMatchConnector />
                <MatchPair 
                  players={[semifinalists[2], semifinalists[3]]} 
                  totalPool={semifinalistsTotalPool}
                  delay={0.2}
                  onBet={(id) => handleBet(id, true)}
                />
              </div>
              {/* Desktop: All Side by Side */}
              <div className="hidden md:flex gap-12 justify-center items-center">
                {semifinalists.map((p, idx) => (
                  <PlayerCard 
                    key={p.id} 
                    p={p} 
                    totalPool={semifinalistsTotalPool}
                    delay={0.1 + idx * 0.1}
                    onBet={(id) => handleBet(id, true)}
                  />
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
