import { Shield, TrendingUp } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { 
  URIM_QUANTUM_MARKET_ADDRESS, 
  USDC_ADDRESS
} from "@/constants/contracts";
import { getExplorerContractUrl } from "@/constants/blockscout";

const Footer = () => {
  return (
    <footer className="border-t border-border/30 py-12 px-6 mt-32 bg-background/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">U</span>
            </div>
            <span className="text-lg font-bold text-foreground">URIM</span>
          </div>
          
          {/* Sponsor Integration Section */}
          <div className="flex flex-col md:flex-row items-center gap-6 text-sm">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/5 border border-primary/20 hover:border-primary/40 transition-all group">
              <TrendingUp className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-muted-foreground">Powered by <span className="text-primary font-semibold">Pyth Network</span></span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/5 border border-primary/20 hover:border-primary/40 transition-all group">
              <Shield className="w-4 h-4 text-primary group-hover:scale-110 transition-transform animate-glow" />
              <span className="text-muted-foreground">Secured by <span className="text-primary font-semibold">Avail DA</span></span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/5 border border-primary/20 hover:border-primary/40 transition-all group">
              <ExternalLink className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-muted-foreground">Verified by <span className="text-primary font-semibold">Blockscout</span></span>
            </div>
          </div>

          {/* Smart Contracts Section - NEW */}
          <div className="w-full max-w-2xl border-t border-border/40 pt-6">
            <div className="text-sm text-muted-foreground space-y-3">
              <div className="font-semibold text-foreground text-center mb-3">Smart Contracts on Base Sepolia</div>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                
                <a
                  href={getExplorerContractUrl(URIM_QUANTUM_MARKET_ADDRESS)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <span>Quantum Market</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={getExplorerContractUrl(USDC_ADDRESS)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <span>USDC Token</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="text-center max-w-2xl space-y-3">
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              Urim is an AI-powered quantum prediction market built on Base, with live oracle data from Pyth Network, verified infrastructure by Avail, and transparent blockchain exploration via Blockscout.
            </p>
          </div>
          
          {/* Copyright */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground font-medium">
              © 2025 Urim — Built with AI & Blockchain
            </p>
            <p className="text-xs text-muted-foreground/60">
              Powered by Pyth Network | Avail | Blockscout | Base Sepolia
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;