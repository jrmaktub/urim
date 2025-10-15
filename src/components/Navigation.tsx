import { Sparkles } from "lucide-react";
import WalletButton from "./WalletButton";

const Navigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/30 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-background" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            URIM
          </span>
        </a>

        {/* Wallet Button */}
        <WalletButton />
      </div>
    </nav>
  );
};

export default Navigation;
