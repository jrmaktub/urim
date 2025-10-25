import { useEffect, useState } from "react";
import { EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";
import { TrendingUp, Sparkles } from "lucide-react";

const ETH_USD_BASE_SEPOLIA_ID = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const connection = new EvmPriceServiceConnection("https://hermes.pyth.network");

export default function PythPriceTicker() {
  const [ethPrice, setEthPrice] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [priceChanged, setPriceChanged] = useState(false);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const priceFeeds = await connection.getLatestPriceFeeds([ETH_USD_BASE_SEPOLIA_ID]);
        
        if (priceFeeds && priceFeeds.length > 0) {
          const priceFeed = priceFeeds[0];
          const price = priceFeed.getPriceUnchecked();
          const formattedPrice = (Number(price.price) * Math.pow(10, price.expo)).toFixed(2);
          
          if (formattedPrice !== ethPrice && ethPrice !== "") {
            setPriceChanged(true);
            setTimeout(() => setPriceChanged(false), 1000);
          }
          
          setEthPrice(formattedPrice);
        }
      } catch (error) {
        console.error("Error fetching Pyth price:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [ethPrice]);

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto mb-12 animate-fade-in">
        <div className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-background via-background to-primary/5 p-8 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse" />
          <div className="relative flex items-center justify-center gap-4">
            <div className="h-6 w-6 rounded-full bg-primary/20 animate-pulse" />
            <div className="h-8 w-48 rounded-lg bg-primary/10 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto mb-8 animate-fade-in">
      <div className="flex flex-col items-center gap-1.5">
        {/* Label */}
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary/50" />
          <span className="text-xs font-light tracking-wider text-muted-foreground/70 uppercase">
            ETH/USD — Pyth Oracle
          </span>
        </div>
        
        {/* Price Display */}
        <span 
          className={`text-4xl font-extralight bg-gradient-to-r from-primary/90 via-purple-400/90 to-primary/90 bg-clip-text text-transparent transition-all duration-300 ${
            priceChanged ? 'scale-105 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]' : 'scale-100'
          }`}
        >
          ${ethPrice}
        </span>
        
        {/* Update Status */}
        <div className="flex items-center gap-1.5 opacity-60">
          <div className="w-1 h-1 rounded-full bg-primary/70 animate-pulse" />
          <span className="text-[10px] text-muted-foreground/60 font-extralight italic">
            updated in real time
          </span>
        </div>
      </div>
    </div>
  );
}
