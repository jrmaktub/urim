import { Sparkles, History } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import WalletButton from "./WalletButton";
import { Button } from "./ui/button";
// import { useState } from 'react';
import { useAccount } from 'wagmi';
// import DeinitButton from '@/components/de-init-button';
// import { isInitialized } from '@/lib/nexus';
import { useTransactionPopup } from "@blockscout/app-sdk";

const Navigation = () => {
  const location = useLocation();
  const { isConnected, address } = useAccount();
  const { openPopup } = useTransactionPopup();
  // const [initialized, setInitialized] = useState(isInitialized());
  // const [balances, setBalances] = useState<any>(null);
  
  const btn =
    'px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';
  
  const navLinks = [
    { name: "Quantum Bets", path: "/" },
    { name: "Everything Bets", path: "/everything-bets" },
    { name: "Tournaments", path: "/tournaments" },
    { name: "50/50 Lottery", path: "/lottery" },
  ];

  const handleOpenTransactionHistory = () => {
    if (address) {
      openPopup({
        chainId: "84532", // Base Sepolia
        address: address,
      });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative">
            <Sparkles className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
            <div className="absolute inset-0 blur-md bg-primary/30 group-hover:bg-primary/50 transition-all" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            URIM
          </span>
        </Link>

        {/* Center Navigation Tabs */}
        <div className="flex items-center gap-2 bg-secondary/40 rounded-full p-1 border border-border/30">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-5 py-2 text-sm font-semibold rounded-full transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* Transaction History Button - Only shown when wallet is connected */}
          {isConnected && address && (
            <Button
              onClick={handleOpenTransactionHistory}
              variant="outline"
              size="sm"
              className="gap-2 border-primary/30 hover:border-primary/50 hover:bg-primary/10 transition-all"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Transactions</span>
            </Button>
          )}
          
          <WalletButton />
        </div>
      </div>
    </nav>
  );
};

export default Navigation;