import { Sparkles } from "lucide-react";
import WalletButton from "./WalletButton";

const Navigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 group">
          <Sparkles className="w-6 h-6 text-primary group-hover:rotate-12 transition-transform" />
          <span className="text-xl font-bold tracking-tight">URIM</span>
        </a>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="/markets" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Markets
          </a>
          <a href="/create" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Create
          </a>
          <a href="/match-bet" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Match Bet
          </a>
          <a href="/docs" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Docs
          </a>
        </div>

        {/* Wallet Button */}
        <WalletButton />
      </div>
    </nav>
  );
};

export default Navigation;
