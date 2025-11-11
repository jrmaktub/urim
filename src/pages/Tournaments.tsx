import React from "react";
import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const quarterfinalists = [
  { id: "Q1", name: "Silva", odds: 2.1 },
  { id: "Q2", name: "Vega", odds: 2.4 },
  { id: "Q3", name: "Ramos", odds: 1.9 },
  { id: "Q4", name: "Torres", odds: 2.6 },
  { id: "Q5", name: "Luna", odds: 2.3 },
  { id: "Q6", name: "Morales", odds: 2.8 },
  { id: "Q7", name: "Ortega", odds: 2.2 },
  { id: "Q8", name: "Cruz", odds: 2.5 },
];

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
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
      className="group rounded-xl border border-white/10 bg-white/3 backdrop-blur-sm p-3 flex items-center justify-between shadow-[0_0_0_1px_rgba(255,255,255,0.04)] min-w-[140px]"
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
      transition={{ delay: 0.8, duration: 0.5 }}
      className="rounded-2xl border border-purple-300/30 bg-white/5 backdrop-blur-sm p-6 shadow-[0_0_32px_rgba(168,85,247,0.25)] relative overflow-hidden"
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative text-center">
        <div className="text-xs uppercase tracking-wider text-purple-300/70 mb-2">Champion</div>
        <div className="text-2xl font-semibold tracking-tight">TBD</div>
        <div className="text-sm text-white/50 mt-1">awaiting final</div>
      </div>
    </motion.div>
  );
}

function BracketConnector({ delay = 0 }: { delay?: number }) {
  return (
    <motion.svg
      className="hidden lg:block"
      width="60"
      height="100"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.6 }}
    >
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(168, 85, 247, 0.1)" />
          <stop offset="50%" stopColor="rgba(168, 85, 247, 0.3)" />
          <stop offset="100%" stopColor="rgba(168, 85, 247, 0.1)" />
        </linearGradient>
      </defs>
      <motion.path
        d="M 0 25 L 30 25 Q 40 25 40 35 L 40 65 Q 40 75 30 75 L 0 75"
        stroke="url(#lineGradient)"
        strokeWidth="1.5"
        fill="none"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.line
        x1="40"
        y1="50"
        x2="60"
        y2="50"
        stroke="url(#lineGradient)"
        strokeWidth="1.5"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
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
      
      <div className="relative min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-10 py-10 pt-24 text-foreground overflow-x-auto">
        {/* Background gradient */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(139,92,246,0.12),transparent_60%)]" />
        
        <div className="mx-auto w-full max-w-7xl relative">
          <NeonCourtLines />
          <DottedPadelHalo />

          <motion.header
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Padel Cup 2025</h1>
            <p className="text-sm text-muted-foreground mt-1">live brackets • real odds</p>
          </motion.header>

          {/* Winner at top center - desktop only */}
          <div className="hidden lg:flex justify-center mb-8">
            <div className="w-64">
              <WinnerCard />
            </div>
          </div>

          {/* Tournament Bracket Tree */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-center gap-8 lg:gap-0 min-w-max lg:min-w-0">
            
            {/* Quarterfinals */}
            <div className="flex flex-col justify-center gap-6 lg:gap-12">
              <div className="space-y-2">
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-3">Quarterfinals</h2>
                <div className="space-y-3">
                  <PlayerCard p={quarterfinalists[0]} delay={0.1} />
                  <PlayerCard p={quarterfinalists[1]} delay={0.15} />
                </div>
              </div>
              <div className="space-y-3">
                <PlayerCard p={quarterfinalists[2]} delay={0.2} />
                <PlayerCard p={quarterfinalists[3]} delay={0.25} />
              </div>
              <div className="space-y-3">
                <PlayerCard p={quarterfinalists[4]} delay={0.3} />
                <PlayerCard p={quarterfinalists[5]} delay={0.35} />
              </div>
              <div className="space-y-3">
                <PlayerCard p={quarterfinalists[6]} delay={0.4} />
                <PlayerCard p={quarterfinalists[7]} delay={0.45} />
              </div>
            </div>

            {/* Connector to Semifinals */}
            <div className="hidden lg:flex flex-col justify-center gap-12 mx-4">
              <BracketConnector delay={0.3} />
              <BracketConnector delay={0.4} />
              <BracketConnector delay={0.5} />
              <BracketConnector delay={0.6} />
            </div>

            {/* Semifinals */}
            <div className="flex flex-col justify-center gap-12 lg:gap-24">
              <div className="space-y-2">
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-3 lg:hidden">Semifinals</h2>
                <div className="space-y-3">
                  <PlayerCard p={semifinalists[0]} delay={0.5} />
                  <PlayerCard p={semifinalists[1]} delay={0.55} />
                </div>
              </div>
              <div className="space-y-3">
                <PlayerCard p={semifinalists[2]} delay={0.6} />
                <PlayerCard p={semifinalists[3]} delay={0.65} />
              </div>
            </div>

            {/* Connector to Final */}
            <div className="hidden lg:flex flex-col justify-center gap-24 mx-4">
              <BracketConnector delay={0.6} />
              <BracketConnector delay={0.7} />
            </div>

            {/* Final */}
            <div className="flex flex-col justify-center">
              <div className="space-y-2">
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-3">Final</h2>
                <motion.div
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.7 }}
                  className="rounded-xl border border-purple-300/25 bg-white/5 backdrop-blur-sm p-4 shadow-[0_0_24px_rgba(168,85,247,0.18)] space-y-3"
                >
                  <PlayerCard p={finalists[0]} delay={0.75} />
                  <PlayerCard p={finalists[1]} delay={0.8} />
                  <p className="mt-3 text-xs text-muted-foreground/80">
                    Odds update as bets settle
                  </p>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Winner at bottom - mobile only */}
          <div className="lg:hidden mt-12">
            <WinnerCard />
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
