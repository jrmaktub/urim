import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider } from 'wagmi';
import { config } from './wagmi.config';
import Index from "./pages/Index";
import EverythingBets from "./pages/EverythingBets";
import CreateBet from "./pages/CreateBet";
import MarketDetail from "./pages/MarketDetail";
import NotFound from "./pages/NotFound";
import { PythPriceTestnet }  from "./pages/PythPrice";

const queryClient = new QueryClient();

const App = () => (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/everything-bets" element={<EverythingBets />} />
            <Route path="/create-bet" element={<CreateBet />} />
            <Route path="/market/:address" element={<MarketDetail />} />
            <Route path="/PythPrice" element={<PythPriceTestnet/>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
