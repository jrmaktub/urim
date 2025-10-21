import { Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import WalletButton from "./WalletButton";

const Navigation = () => {
  const location = useLocation();

  const navLinks = [
    { name: "Quantum Bets", path: "/" },
    { name: "Everything Bets", path: "/everything-bets" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-primary/25">
      <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <Sparkles className="w-6 h-6 text-primary" />
          <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
            URIM
          </span>
        </Link>

        {/* Center Navigation Tabs */}
        <div className="flex items-center gap-2">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-6 py-2.5 text-sm font-semibold uppercase tracking-wide rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>

        {/* Wallet Button */}
        <WalletButton />
      </div>
    </nav>
  );
};

export default Navigation;
