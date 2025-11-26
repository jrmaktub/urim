import { RealtimeTrade } from "@/hooks/useRealtimeTrades";

interface RealtimeOrderBookProps {
  candidateId: number;
  candidateName: string;
  trades: RealtimeTrade[];
}

const RealtimeOrderBook = ({ candidateId, candidateName, trades }: RealtimeOrderBookProps) => {
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
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        Recent Trades - {candidateName}
      </h3>

      {candidateTrades.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No trades yet. Trades will appear here in real-time.
        </div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-7 gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border/20">
            <div>Type</div>
            <div>Shares</div>
            <div>USDC</div>
            <div>Price (¢)</div>
            <div>Trader</div>
            <div>Time</div>
            <div>Tx</div>
          </div>

          {candidateTrades.map((trade, idx) => (
            <div
              key={`${trade.txHash}-${idx}`}
              className="grid grid-cols-7 gap-3 px-3 py-2 text-sm rounded-lg hover:bg-primary/5 hover:shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all duration-200"
            >
              <div className={trade.type === "BUY" ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                {trade.type}
              </div>
              <div className="text-foreground">{parseFloat(trade.shares).toFixed(2)}</div>
              <div className="text-foreground">${parseFloat(trade.usdcAmount).toFixed(2)}</div>
              <div className="text-foreground">{(parseFloat(trade.price) * 100).toFixed(1)}¢</div>
              <div className="text-muted-foreground font-mono text-xs">
                {formatAddress(trade.trader)}
              </div>
              <div className="text-muted-foreground text-xs">{getTimeAgo(trade.timestamp)}</div>
              <div>
                <a
                  href={`https://basescan.org/tx/${trade.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 text-xs underline"
                >
                  View
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RealtimeOrderBook;
