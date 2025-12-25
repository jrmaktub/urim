import { Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const Navigation = () => {
  const location = useLocation();
  
  const navLinks = [
    { name: "Elections", path: "/" },
    { name: "Quantum Bets", path: "/quantum-bets" },
    { name: "Quantum Pyth Prices", path: "/quantum-pyth-prices" },
    { name: "50/50 Lottery", path: "/lottery" },
    { name: "Everything Bets", path: "/everything-bets" },
    { name: "Tournaments", path: "/tournaments" },
    { name: "Liquidity Provider", path: "/liquidity-provider" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
          <div className="relative">
            <Sparkles className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
            <div className="absolute inset-0 blur-md bg-primary/30 group-hover:bg-primary/50 transition-all" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            URIM
          </span>
        </Link>

        {/* Center Navigation Tabs - Scrollable on mobile */}
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 bg-secondary/40 rounded-full p-1 border border-border/30 w-max">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-full transition-all whitespace-nowrap ${
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
        </div>

        {/* Wallet Connect Button */}
        <div className="flex-shrink-0">
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
};

export default Navigation;