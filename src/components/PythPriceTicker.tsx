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
      <div className="w-full max-w-2xl mx-auto mb-8 animate-fade-in">
        <div className="rounded-[14px] border border-[rgba(180,150,255,0.35)] bg-[rgba(140,110,255,0.12)] p-[10px_24px] shadow-[0_0_12px_rgba(170,130,255,0.15)]">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="h-4 w-40 rounded bg-primary/10 animate-pulse" />
            <div className="h-10 w-56 rounded-lg bg-primary/10 animate-pulse" />
            <div className="h-3 w-32 rounded bg-primary/10 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto mb-8 animate-fade-in">
      <div className="rounded-[14px] border border-[rgba(180,150,255,0.35)] bg-[rgba(140,110,255,0.12)] shadow-[0_0_12px_rgba(170,130,255,0.15)] px-6 py-[10px]">
        <div className="flex flex-col items-center gap-1.5 text-center">
          {/* Label */}
          <span className="text-[0.9rem] font-normal uppercase tracking-[0.08em]" style={{ color: '#C8B7FF' }}>
            ETH/USD — Pyth Oracle
          </span>
          
          {/* Price Display */}
          <span 
            className="text-[clamp(2rem,4vw,3.6rem)] font-bold text-white transition-opacity duration-200"
            style={{ 
              opacity: priceChanged ? 0.7 : 1
            }}
          >
            ${ethPrice}
          </span>
          
          {/* Update Status */}
          <span className="text-[0.75rem] italic" style={{ color: '#a29cc7' }}>
            updated in real time
          </span>
        </div>
      </div>
    </div>
  );
}
