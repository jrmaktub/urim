import { useEffect, useState } from "react";
import { EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";

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
      <div className="mb-6 animate-fade-in">
        <div className="inline-flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-3 shadow-sm">
          <div className="h-2 w-2 rounded-full bg-primary/30 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
            <div className="h-6 w-32 rounded bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 animate-fade-in">
      <div className="inline-flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-shadow duration-300">
        {/* Live indicator dot */}
        <div className="relative pt-1.5">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <div className="absolute inset-0 h-2 w-2 rounded-full bg-green-400/50 animate-ping" />
        </div>
        
        {/* Price content */}
        <div className="flex flex-col items-start gap-0.5">
          {/* Label */}
          <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-foreground/50">
            ETH/USD — Pyth Oracle
          </span>
          
          {/* Price Display */}
          <span 
            className={`text-[1.75rem] font-semibold leading-none text-foreground transition-all duration-300 ${
              priceChanged ? 'opacity-70 scale-95' : 'opacity-100 scale-100'
            }`}
          >
            ${ethPrice}
          </span>
        </div>
      </div>
    </div>
  );
}
