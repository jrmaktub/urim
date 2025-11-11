import React from "react";
import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const players = [
  { id: "A1", name: "Vega", odds: 3.4 },
  { id: "A2", name: "Ramos", odds: 2.8 },
  { id: "B1", name: "Luna", odds: 4.1 },
  { id: "B2", name: "Ortega", odds: 3.7 },
];

const finalMatch = [
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

function PlayerCard({ p }: { p: Player }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="group rounded-2xl border border-white/10 bg-white/3 backdrop-blur-sm p-4 flex items-center justify-between shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
    >
      <div>
        <div className="text-[15px] font-medium tracking-tight">{p.name}</div>
        <div className="text-xs text-white/60">{p.odds.toFixed(1)}x</div>
      </div>
      <BetButton onClick={() => console.log(`Bet on ${p.name} at ${p.odds}x`)} />
    </motion.div>
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
            className="mb-8"
          >
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Padel Cup 2025</h1>
            <p className="text-sm text-muted-foreground mt-1">live brackets • real odds • elegant betting</p>
          </motion.header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
            {/* Semifinals */}
            <section className="lg:col-span-2 space-y-4">
              <h2 className="text-sm uppercase tracking-wider text-muted-foreground/70">Semifinals</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {players.map((p) => (
                  <PlayerCard key={p.id} p={p} />
                ))}
              </div>
            </section>

            {/* Final */}
            <section className="lg:col-span-1 space-y-4">
              <h2 className="text-sm uppercase tracking-wider text-muted-foreground/70">Final</h2>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="rounded-2xl border border-purple-300/25 bg-white/5 backdrop-blur-sm p-4 shadow-[0_0_24px_rgba(168,85,247,0.18)]"
              >
                <div className="space-y-3">
                  {finalMatch.map((p) => (
                    <PlayerCard key={p.id} p={p} />
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground/80">
                  Odds are indicative and may update as bets settle.
                </p>
              </motion.div>
            </section>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
