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
        <div className="relative overflow-hidden rounded-[18px] border border-[rgba(190,150,255,0.15)] bg-[rgba(100,60,160,0.05)] p-6 backdrop-blur-[6px]">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse" />
          <div className="relative flex flex-col items-center gap-2">
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
      <div 
        className="relative overflow-hidden rounded-[18px] border border-[rgba(190,150,255,0.15)] bg-[rgba(100,60,160,0.05)] px-6 py-3 backdrop-blur-[6px] transition-all duration-300 ease-out hover:shadow-[0_0_20px_rgba(190,150,255,0.2)] hover:-translate-y-0.5 group"
      >
        <div className="flex flex-col items-center gap-1.5">
          {/* Label with animated icon */}
          <div className="flex items-center gap-2">
            <span className="text-[#b094ff] animate-pulse group-hover:animate-spin-slow transition-all duration-1000" style={{ animationDuration: '3s' }}>
              ✦
            </span>
            <span className="text-xs font-light uppercase" style={{ letterSpacing: '0.1em', color: '#b094ff' }}>
              ETH/USD — Pyth Oracle
            </span>
          </div>
          
          {/* Price Display with gradient and glow */}
          <div className="relative">
            {priceChanged && (
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#c2a7ff] to-[#8f6fff] opacity-30 blur-xl animate-pulse" />
            )}
            <span 
              className="relative text-[clamp(2.8rem,4vw,4rem)] font-extralight bg-gradient-to-r from-[#c2a7ff] to-[#8f6fff] bg-clip-text text-transparent transition-all duration-300"
              style={{ 
                textShadow: '0 0 12px rgba(190,150,255,0.4)',
                transform: priceChanged ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              ${ethPrice}
            </span>
          </div>
          
          {/* Update Status */}
          <div className="flex items-center gap-1.5 opacity-60">
            <div className="w-1 h-1 rounded-full bg-[#b094ff] animate-pulse" />
            <span className="text-[10px] italic font-light" style={{ color: '#9d9d9d' }}>
              updated in real time
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
