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
    <div className="fixed top-5 right-6 z-40 animate-fade-in">
      <div className="px-5 py-3 flex items-center gap-3 rounded-lg border-2 border-primary/50 bg-background/95 backdrop-blur-sm shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all">
        <TrendingUp className="w-5 h-5 text-primary animate-pulse" />
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground font-medium">ETH/USD:</span>
          <span className="text-xl font-bold bg-gradient-to-r from-primary via-purple-400 to-primary bg-clip-text text-transparent">
            ${ethPrice}
          </span>
        </div>
        <span className="text-xs text-primary/60 font-semibold">Pyth</span>
      </div>
    </div>
  );
}
