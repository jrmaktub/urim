import React from "react";
import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const semifinalists = [
  { id: "S1", name: "Vega", odds: 3.4 },
  { id: "S2", name: "Ramos", odds: 2.8 },
  { id: "S3", name: "Luna", odds: 4.1 },
  { id: "S4", name: "Ortega", odds: 3.7 },
];

const finalists = [
  { id: "F1", name: "Condor", odds: 6.9 },
  { id: "F2", name: "Pecho", odds: 4.2 },
];

function BetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-xl text-sm bg-white/5 hover:bg-white/10 border border-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      Bet Now
    </button>
  );
}

interface Player {
  id: string;
  name: string;
  odds: number;
}

function PlayerCard({ p, delay = 0 }: { p: Player; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ scale: 1.03, y: -2 }}
      className="group rounded-xl border border-white/10 bg-white/3 backdrop-blur-sm p-4 flex items-center justify-between shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:border-purple-400/30 hover:shadow-[0_0_16px_rgba(168,85,247,0.15)] transition-all duration-300 w-full max-w-[240px]"
    >
      <div>
        <div className="text-[15px] font-medium tracking-tight">{p.name}</div>
        <div className="text-xs text-white/60">{p.odds.toFixed(1)}x</div>
      </div>
      <BetButton onClick={() => console.log(`Bet on ${p.name} at ${p.odds}x`)} />
    </motion.div>
  );
}

function WinnerCard() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1, duration: 0.5 }}
      className="rounded-2xl border border-purple-300/30 bg-white/5 backdrop-blur-sm p-8 shadow-[0_0_32px_rgba(168,85,247,0.25)] relative overflow-hidden w-full max-w-[280px]"
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

function VerticalConnector({ fromCount, toCount, delay = 0 }: { fromCount: number; toCount: number; delay?: number }) {
  const height = 80;
  const spacing = fromCount === 4 ? 120 : 240;
  
  return (
    <motion.svg
      className="w-full"
      height={height}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.6 }}
    >
      <defs>
        <linearGradient id={`verticalGradient-${delay}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(168, 85, 247, 0.1)" />
          <stop offset="50%" stopColor="rgba(168, 85, 247, 0.3)" />
          <stop offset="100%" stopColor="rgba(168, 85, 247, 0.1)" />
        </linearGradient>
        <filter id={`glow-${delay}`}>
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {fromCount === 4 && toCount === 2 && (
        <>
          {/* Left pair to left finalist */}
          <motion.path
            d={`M ${spacing * 0.5} 0 L ${spacing * 0.5} ${height * 0.3} Q ${spacing * 0.5} ${height * 0.5} ${spacing * 0.75} ${height * 0.5} L ${spacing * 1.25} ${height * 0.5} Q ${spacing * 1.5} ${height * 0.5} ${spacing * 1.5} ${height * 0.7} L ${spacing * 1.5} ${height}`}
            stroke={`url(#verticalGradient-${delay})`}
            strokeWidth="1.5"
            fill="none"
            filter={`url(#glow-${delay})`}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d={`M ${spacing * 1.5} 0 L ${spacing * 1.5} ${height * 0.3} Q ${spacing * 1.5} ${height * 0.5} ${spacing * 1.25} ${height * 0.5} L ${spacing * 0.75} ${height * 0.5} Q ${spacing * 0.5} ${height * 0.5} ${spacing * 0.5} ${height * 0.7} L ${spacing * 0.5} ${height}`}
            stroke={`url(#verticalGradient-${delay})`}
            strokeWidth="1.5"
            fill="none"
            filter={`url(#glow-${delay})`}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />
          {/* Right pair to right finalist */}
          <motion.path
            d={`M ${spacing * 2.5} 0 L ${spacing * 2.5} ${height * 0.3} Q ${spacing * 2.5} ${height * 0.5} ${spacing * 2.75} ${height * 0.5} L ${spacing * 3.25} ${height * 0.5} Q ${spacing * 3.5} ${height * 0.5} ${spacing * 3.5} ${height * 0.7} L ${spacing * 3.5} ${height}`}
            stroke={`url(#verticalGradient-${delay})`}
            strokeWidth="1.5"
            fill="none"
            filter={`url(#glow-${delay})`}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          <motion.path
            d={`M ${spacing * 3.5} 0 L ${spacing * 3.5} ${height * 0.3} Q ${spacing * 3.5} ${height * 0.5} ${spacing * 3.25} ${height * 0.5} L ${spacing * 2.75} ${height * 0.5} Q ${spacing * 2.5} ${height * 0.5} ${spacing * 2.5} ${height * 0.7} L ${spacing * 2.5} ${height}`}
            stroke={`url(#verticalGradient-${delay})`}
            strokeWidth="1.5"
            fill="none"
            filter={`url(#glow-${delay})`}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          />
        </>
      )}
      
      {fromCount === 2 && toCount === 1 && (
        <>
          {/* Left finalist to winner */}
          <motion.path
            d={`M ${spacing * 1.5} 0 L ${spacing * 1.5} ${height * 0.3} Q ${spacing * 1.5} ${height * 0.5} ${spacing * 1.75} ${height * 0.5} L ${spacing * 2.25} ${height * 0.5} Q ${spacing * 2.5} ${height * 0.5} ${spacing * 2.5} ${height * 0.7} L ${spacing * 2.5} ${height}`}
            stroke={`url(#verticalGradient-${delay})`}
            strokeWidth="1.5"
            fill="none"
            filter={`url(#glow-${delay})`}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Right finalist to winner */}
          <motion.path
            d={`M ${spacing * 3.5} 0 L ${spacing * 3.5} ${height * 0.3} Q ${spacing * 3.5} ${height * 0.5} ${spacing * 3.25} ${height * 0.5} L ${spacing * 2.75} ${height * 0.5} Q ${spacing * 2.5} ${height * 0.5} ${spacing * 2.5} ${height * 0.7} L ${spacing * 2.5} ${height}`}
            stroke={`url(#verticalGradient-${delay})`}
            strokeWidth="1.5"
            fill="none"
            filter={`url(#glow-${delay})`}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />
        </>
      )}
    </motion.svg>
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
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="relative min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-10 py-10 pt-24 text-foreground">
        {/* Background gradient */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(139,92,246,0.12),transparent_60%)]" />
        
        <div className="mx-auto w-full max-w-6xl relative">
          <NeonCourtLines />
          <DottedPadelHalo />

          <motion.header
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Padel Cup 2025</h1>
            <p className="text-sm text-muted-foreground mt-1">live brackets • real odds</p>
          </motion.header>

          {/* Vertical Tournament Tree */}
          <div className="flex flex-col items-center gap-0">
            
            {/* Winner (Top) */}
            <div className="flex justify-center mb-4">
              <WinnerCard />
            </div>

            {/* Connector: Final to Winner */}
            <VerticalConnector fromCount={2} toCount={1} delay={0.8} />

            {/* Final */}
            <div className="flex justify-center gap-8 sm:gap-32 mb-4">
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-3">Final</div>
                <PlayerCard p={finalists[0]} delay={0.6} />
              </div>
              <PlayerCard p={finalists[1]} delay={0.65} />
            </div>

            {/* Connector: Semifinals to Final */}
            <VerticalConnector fromCount={4} toCount={2} delay={0.4} />

            {/* Semifinals */}
            <div className="flex justify-center gap-4 sm:gap-8 flex-wrap max-w-4xl">
              <div className="text-center sm:text-left">
                <div className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-3">Semifinals</div>
              </div>
              <div className="w-full flex justify-center gap-4 sm:gap-8 flex-wrap">
                {semifinalists.map((p, idx) => (
                  <PlayerCard key={p.id} p={p} delay={0.1 + idx * 0.1} />
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
