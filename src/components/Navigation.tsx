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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-primary/20">
      <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <Sparkles className="w-6 h-6 text-primary" />
          <span className="text-2xl font-bold tracking-tight text-primary">
            URIM
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-bold uppercase tracking-wide transition-all duration-200 relative ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-primary hover:shadow-[0_0_10px_rgba(212,175,55,0.3)]"
                } ${
                  isActive
                    ? "after:absolute after:bottom-[-8px] after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                    : ""
                }`}
              >
                {link.name}
              </Link>
            );
          })}

          {/* Wallet Button */}
          <WalletButton />
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
