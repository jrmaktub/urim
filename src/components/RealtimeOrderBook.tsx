import { RealtimeTrade } from "@/hooks/useRealtimeTrades";
import { Loader2 } from "lucide-react";

interface RealtimeOrderBookProps {
  candidateId: number;
  candidateName: string;
  trades: RealtimeTrade[];
  isLoadingHistory: boolean;
}

const RealtimeOrderBook = ({ candidateId, candidateName, trades, isLoadingHistory }: RealtimeOrderBookProps) => {
  const candidateTrades = trades.filter((t) => t.candidateId === candidateId);

  const formatAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="mt-6 p-6 rounded-xl border border-border/30 bg-background/20 backdrop-blur-sm shadow-[0_0_20px_rgba(139,92,246,0.15)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          Recent Trades - {candidateName}
        </h3>
        {isLoadingHistory && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading history...
          </div>
        )}
      </div>

      {!isLoadingHistory && candidateTrades.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No trades yet. Trades will appear here in real-time.
        </div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-3 gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border/20">
            <div>Price (¢)</div>
            <div>Shares</div>
            <div>Total (USDC)</div>
          </div>

          {candidateTrades.map((trade, idx) => (
            <div
              key={`${trade.txHash}-${idx}`}
              className={`grid grid-cols-3 gap-3 px-3 py-2 text-sm rounded-lg hover:bg-primary/5 hover:shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all duration-200 ${
                trade.type === "BUY" ? "border-l-2 border-green-500" : "border-l-2 border-red-500"
              }`}
            >
              <div className="text-foreground font-medium">{(parseFloat(trade.price) * 100).toFixed(1)}¢</div>
              <div className="text-foreground">{parseFloat(trade.shares).toFixed(2)}</div>
              <div className="text-foreground">${parseFloat(trade.usdcAmount).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RealtimeOrderBook;
