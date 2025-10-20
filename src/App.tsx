import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider } from 'wagmi';
// import { config } from './wagmi.config';
import Index from "./pages/Index";
import EverythingBets from "./pages/EverythingBets";
import CreateBet from "./pages/CreateBet";
import MarketDetail from "./pages/MarketDetail";
import NotFound from "./pages/NotFound";
import { PythPriceTestnet }  from "./pages/PythPrice";
import { NexusProvider } from '@avail-project/nexus-widgets';
import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import {
  base,
  baseSepolia,
  mainnet
} from 'wagmi/chains';

const config = getDefaultConfig({
  appName: 'Nexus SDK with RainbowKit',
  projectId: 'f5d6f1be5b3a2781cb85a4547cc81384',
  chains: [mainnet, base, baseSepolia, ],
  ssr: true, // If your dApp uses server side rendering (SSR)
});

const queryClient = new QueryClient();

const App = () => (
    <NexusProvider
      config={{
        debug: false, // true to view debug logs
        network: 'testnet', // "mainnet" (default) or "testnet"
      }}
    >
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/everything-bets" element={<EverythingBets />} />
            <Route path="/create" element={<CreateBet />} />
            <Route path="/market/:address" element={<MarketDetail />} />
            <Route path="/PythPrice" element={<PythPriceTestnet/>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
        </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
    </NexusProvider>
);

export default App;
