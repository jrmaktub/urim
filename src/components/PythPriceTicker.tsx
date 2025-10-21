import { useEffect, useState } from "react";
import { EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";
import { TrendingUp } from "lucide-react";

const ETH_USD_BASE_SEPOLIA_ID = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const connection = new EvmPriceServiceConnection("https://hermes.pyth.network");

export default function PythPriceTicker() {
  const [ethPrice, setEthPrice] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const priceFeeds = await connection.getLatestPriceFeeds([ETH_USD_BASE_SEPOLIA_ID]);
        
        if (priceFeeds && priceFeeds.length > 0) {
          const priceFeed = priceFeeds[0];
          const price = priceFeed.getPriceUnchecked();
          const formattedPrice = (Number(price.price) * Math.pow(10, price.expo)).toFixed(2);
          setEthPrice(formattedPrice);
        }
      } catch (error) {
        console.error("Error fetching Pyth price:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  if (isLoading) return null;

  return (
    <div className="fixed top-20 right-6 z-40 animate-slide-in">
      <div className="glass-card px-4 py-2 flex items-center gap-2 border-primary/30 shadow-lg shadow-primary/10">
        <TrendingUp className="w-4 h-4 text-primary animate-glow" />
        <span className="text-xs text-muted-foreground">Live ETH:</span>
        <span className="text-sm font-bold text-primary shimmer-text">${ethPrice}</span>
        <span className="text-xs text-muted-foreground/60">via Pyth</span>
      </div>
    </div>
  );
}
