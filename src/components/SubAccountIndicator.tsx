import { useAccount } from "wagmi";
import { Shield, Zap, Wallet } from "lucide-react";

export default function SubAccountIndicator() {
  const { address, connector } = useAccount();

  if (!address || connector?.name !== "Base Account") {
    return null;
  }

  return (
    <div className="glass-card p-4 rounded-xl border border-primary/30 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Shield className="w-4 h-4 text-primary" />
        <span className="font-semibold text-primary">Sub Account Active</span>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Zap className="w-3 h-3" />
        <span>No wallet pop-ups after first approval!</span>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="w-3 h-3" />
          <span className="font-medium">Sub Account Address:</span>
        </div>
        <div className="text-xs font-mono text-foreground bg-background/50 rounded px-2 py-1 truncate">
          {address}
        </div>
      </div>
    </div>
  );
}
