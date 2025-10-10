import { useState } from "react";
import { X, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useWallet } from "@/hooks/useWallet";

interface BetModalProps {
  outcomeName: string;
  onClose: () => void;
}

const BetModal = ({ outcomeName, onClose }: BetModalProps) => {
  const [amount, setAmount] = useState("");
  const { address, balance, isCorrectNetwork } = useWallet();
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleConfirm = () => {
    // Mock transaction
    const mockHash = "0x" + Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    setTxHash(mockHash);
  };

  const potentialReturn = amount ? (parseFloat(amount) * 2.38).toFixed(3) : "0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-card p-8 rounded-2xl max-w-md w-full space-y-6 animate-scale-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Place Bet</h2>
            <p className="text-sm text-muted-foreground">{outcomeName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!address && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">Please connect your wallet to place a bet.</p>
          </div>
        )}

        {address && !isCorrectNetwork && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">Please switch to Ethereum Sepolia testnet.</p>
          </div>
        )}

        {txHash ? (
          <div className="space-y-4">
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-6 space-y-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                  <div className="w-6 h-6 bg-accent rounded-full animate-pulse" />
                </div>
                <h3 className="font-semibold">Bet Placed!</h3>
                <p className="text-sm text-muted-foreground">Your transaction has been submitted.</p>
              </div>

              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
              >
                View on Etherscan
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <Button
              onClick={onClose}
              className="w-full rounded-full"
              variant="outline"
            >
              Close
            </Button>
          </div>
        ) : (
          <>
            {/* Balance */}
            {address && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your Balance</span>
                <span className="font-semibold">{balance} ETH</span>
              </div>
            )}

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Bet Amount</label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={!address || !isCorrectNetwork}
                  className="h-14 text-lg glass-card border-primary/30 pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                  ETH
                </span>
              </div>
            </div>

            {/* Potential Return */}
            <div className="glass-card p-4 rounded-lg bg-accent/10 border-accent/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Potential Return</span>
                <span className="text-xl font-bold text-accent">+{potentialReturn} ETH</span>
              </div>
              <p className="text-xs text-muted-foreground">
                If this outcome occurs, you'll receive your stake plus winnings
              </p>
            </div>

            {/* Confirm Button */}
            <Button
              onClick={handleConfirm}
              disabled={!address || !isCorrectNetwork || !amount || parseFloat(amount) <= 0}
              className="w-full h-12 rounded-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 glow-primary disabled:opacity-50"
            >
              Confirm Bet
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Ethereum Sepolia testnet • No real funds
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default BetModal;
