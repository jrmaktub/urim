import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch URIM price from CoinGecko
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=urim&vs_currencies=usd"
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.urim?.usd) {
      throw new Error("URIM price not found in response");
    }
    
    console.log("URIM price fetched:", data.urim.usd);
    
    return new Response(
      JSON.stringify({ price: data.urim.usd }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching URIM price:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage, price: 0.000008 }), // Fallback price
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // Return 200 with fallback to not break the app
      }
    );
  }
});
