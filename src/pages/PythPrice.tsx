import React, { useState } from 'react';
import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";


// The Price Feed ID for ETH/USD on the BASE SEPOLIA testnet
const ETH_USD_BASE_SEPOLIA_ID = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

// The connection to the Pyth Hermes service.
const connection = new EvmPriceServiceConnection("https://hermes.pyth.network");

export function PythPriceTestnet() {
  // State to store the price we fetch. Initial value is null.
  const [ethPrice, setEthPrice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);


  // This function will be called when the button is clicked.
  const fetchEthPrice = async () => {
    setIsLoading(true);
    setEthPrice(null); // Reset previous price
    setError(null);

    try {
      // Fetch the latest price feeds for the given ID.
      const priceFeeds = await connection.getLatestPriceFeeds([ETH_USD_BASE_SEPOLIA_ID]);
      
      if (priceFeeds && priceFeeds.length > 0) {
        const price = priceFeeds[0].getPriceNoOlderThan(60); // Check that the price is not older than 60 seconds

        if (price) {
          // The price object contains the price and an exponent.
          // The human-readable price is price.price * 10^price.expo.
          const formattedPrice = (Number(price.price) * Math.pow(10, price.expo)).toFixed(2);
          setEthPrice(`$${formattedPrice}`);
        } else {
           setError("Price is too old to be displayed.");
        }
      } else {
        setError("Could not fetch price for ETH/USD.");
      }
    } catch (e) {
      console.error("Failed to fetch Pyth price:", e);
      setError("An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full">
      <Navigation />
      
      <section className="min-h-screen flex items-center justify-center px-6 pt-24 pb-12">
        <div className="max-w-3xl mx-auto w-full space-y-8 animate-fade-up">
           <div className="text-center space-y-4">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                  Fetch Pyth Price
                </span>
              </h1>
            
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Click the button to get the latest price for ETH/USD on the Base Sepolia testnet.
              </p>
            </div>
            
            <div className="glass-card p-8 md:p-12 rounded-2xl space-y-6 flex flex-col items-center">
                <button onClick={fetchEthPrice} disabled={isLoading} className="w-full h-14 text-lg rounded-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 glow-primary disabled:opacity-50">
                    {isLoading ? 'Fetching...' : 'Get ETH/USD Price'}
                </button>
                
                {ethPrice && (
                    <div className="text-center mt-6">
                    <h2 className="text-lg text-muted-foreground">Current Price:</h2>
                    <p className="text-4xl font-bold">{ethPrice}</p>
                    </div>
                )}

                {error && (
                    <div className="text-center mt-6">
                      <p className="text-lg text-red-500">{error}</p>
                    </div>
                )}
            </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}