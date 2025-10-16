import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { baseSepolia } from 'wagmi/chains';
import { config } from './wagmi.config';
import Index from "./pages/Index";
import EverythingBets from "./pages/EverythingBets";
import CreateBet from "./pages/CreateBet";
import MarketDetail from "./pages/MarketDetail";
import NotFound from "./pages/NotFound";
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

const App = () => (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider 
        initialChain={baseSepolia}
        theme={darkTheme({
          accentColor: '#7C3AED',
          accentColorForeground: 'white',
          borderRadius: 'large',
        })}
        modalSize="compact"
      >
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/everything-bets" element={<EverythingBets />} />
              <Route path="/create" element={<CreateBet />} />
              <Route path="/market/:address" element={<MarketDetail />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
