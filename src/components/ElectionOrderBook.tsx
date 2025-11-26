import { useHondurasElectionEvents } from "@/hooks/useHondurasElectionEvents";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ElectionOrderBookProps {
  candidateId: number;
  candidateName: string;
}

const ElectionOrderBook = ({ candidateId, candidateName }: ElectionOrderBookProps) => {
  const { orders, isLoading } = useHondurasElectionEvents(candidateId);

  const formatAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const bids = orders.filter((o) => o.type === "BID");
  const asks = orders.filter((o) => o.type === "ASK");

  const openBaseScan = (txHash: string) => {
    window.open(`https://basescan.org/tx/${txHash}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="mt-6 p-6 rounded-xl border border-border/30 bg-background/20 backdrop-blur-sm">
        <h3 className="text-lg font-semibold mb-4 text-foreground">
          Order Book - {candidateName}
        </h3>
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 p-6 rounded-xl border border-border/30 bg-background/20 backdrop-blur-sm shadow-[0_0_20px_rgba(139,92,246,0.15)]">
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        Order Book - {candidateName}
      </h3>

      {/* Bids Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <h4 className="text-sm font-medium text-green-500">Bids (Buy Orders)</h4>
        </div>
        
        <div className="space-y-1">
          <div className="grid grid-cols-6 gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border/20">
            <div>Price (¢)</div>
            <div>Shares</div>
            <div>Total (USDC)</div>
            <div>Trader</div>
            <div>Time</div>
            <div>Tx</div>
          </div>
          
          {bids.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              No buy orders yet
            </div>
          ) : (
            bids.slice(0, 10).map((order, idx) => (
              <div
                key={idx}
                className="grid grid-cols-6 gap-3 px-3 py-2 text-sm rounded-lg hover:bg-primary/5 hover:shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all duration-200"
              >
                <div className="font-medium text-green-400">{order.price}¢</div>
                <div className="text-foreground">{order.shares}</div>
                <div className="text-foreground">${order.totalUSDC}</div>
                <div className="text-muted-foreground font-mono text-xs">
                  {formatAddress(order.trader)}
                </div>
                <div className="text-muted-foreground text-xs">{new Date(order.timestamp * 1000).toLocaleTimeString()}</div>
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => window.open(`https://basescan.org/block/${order.timestamp}`, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Asks Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <h4 className="text-sm font-medium text-red-500">Asks (Sell Orders)</h4>
        </div>
        
        <div className="space-y-1">
          <div className="grid grid-cols-6 gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border/20">
            <div>Price (¢)</div>
            <div>Shares</div>
            <div>Total (USDC)</div>
            <div>Trader</div>
            <div>Time</div>
            <div>Tx</div>
          </div>
          
          {asks.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              No sell orders yet
            </div>
          ) : (
            asks.slice(0, 10).map((order, idx) => (
              <div
                key={idx}
                className="grid grid-cols-6 gap-3 px-3 py-2 text-sm rounded-lg hover:bg-primary/5 hover:shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all duration-200"
              >
                <div className="font-medium text-red-400">{order.price}¢</div>
                <div className="text-foreground">{order.shares}</div>
                <div className="text-foreground">${order.totalUSDC}</div>
                <div className="text-muted-foreground font-mono text-xs">
                  {formatAddress(order.trader)}
                </div>
                <div className="text-muted-foreground text-xs">{new Date(order.timestamp * 1000).toLocaleTimeString()}</div>
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => window.open(`https://basescan.org/block/${order.timestamp}`, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ElectionOrderBook;
