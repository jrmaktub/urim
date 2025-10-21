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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="text-xl font-semibold tracking-tight text-foreground">
            URIM
          </span>
        </Link>

        {/* Center Navigation Tabs */}
        <div className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
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
