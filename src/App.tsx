import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider } from 'wagmi';
import Index from "./pages/Index";
import EverythingBets from "./pages/EverythingBets";
import CreateBet from "./pages/CreateBet";
import MarketDetail from "./pages/MarketDetail";
import NotFound from "./pages/NotFound";
import { PythPriceTestnet } from "./pages/PythPrice";
import { NexusProvider } from '@avail-project/nexus-widgets';
import type { NexusNetwork } from '@avail-project/nexus-widgets';
import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import {
  base,
  baseSepolia,
  mainnet,
  optimismSepolia
} from 'wagmi/chains';
import { createContext, useContext, useMemo, useState } from 'react';
import WalletBridge from './components/WalletBridge'  // CRITICAL IMPORT

const config = getDefaultConfig({
  appName: 'Nexus SDK with RainbowKit',
  projectId: 'f5d6f1be5b3a2781cb85a4547cc81384',
  chains: [mainnet, base, baseSepolia, optimismSepolia],
  ssr: false,
});

const queryClient = new QueryClient();

interface Web3ContextValue {
  network: NexusNetwork;
  setNetwork: React.Dispatch<React.SetStateAction<NexusNetwork>>;
}

const Web3Context = createContext<Web3ContextValue | null>(null);

export function useWeb3Context() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3Context must be used within App');
  }
  return context;
}

const App = () => {
  const [network, setNetwork] = useState<NexusNetwork>('testnet');
  const value = useMemo(() => ({ network, setNetwork }), [network]);

  return (
    <Web3Context.Provider value={value}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider modalSize="compact">
            <NexusProvider
              config={{
                debug: true,
                network: network,
              }}
            >
              {/* CRITICAL: This component sets the provider for Nexus */}
              <WalletBridge />
              
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/everything-bets" element={<EverythingBets />} />
                    <Route path="/create" element={<CreateBet />} />
                    <Route path="/market/:address" element={<MarketDetail />} />
                    <Route path="/PythPrice" element={<PythPriceTestnet />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </NexusProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </Web3Context.Provider>
  );
};

export default App;