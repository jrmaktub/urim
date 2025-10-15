import { Sparkles } from "lucide-react";
import WalletButton from "./WalletButton";

const Navigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-primary/20">
      <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 group">
          <Sparkles className="w-6 h-6 text-primary" />
          <span className="text-2xl font-bold tracking-tight text-primary">
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
