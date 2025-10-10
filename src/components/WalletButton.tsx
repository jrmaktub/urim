import { Wallet, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { useWallet } from "@/hooks/useWallet";

const WalletButton = () => {
  const { address, balance, isConnecting, isCorrectNetwork, connect, switchToEthereumSepolia } = useWallet();

  if (!isCorrectNetwork && address) {
    return (
      <Button 
        size="sm" 
        variant="outline"
        onClick={switchToEthereumSepolia}
        className="rounded-full border-destructive/50 text-destructive hover:bg-destructive/10"
      >
        <AlertCircle className="w-4 h-4 mr-2" />
        Switch to Ethereum Sepolia
      </Button>
    );
  }

  if (address) {
    return (
      <div className="flex items-center gap-3 glass-card px-4 py-2 rounded-full">
        <div className="text-sm">
          <div className="font-medium">{balance} ETH</div>
          <div className="text-xs text-muted-foreground">
            {address.slice(0, 6)}...{address.slice(-4)}
          </div>
        </div>
        <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <Button 
      size="sm" 
      onClick={connect}
      disabled={isConnecting}
      className="rounded-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 glow-primary transition-all duration-300"
    >
      <Wallet className="w-4 h-4 mr-2" />
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
};

export default WalletButton;
