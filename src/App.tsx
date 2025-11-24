import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider } from 'wagmi';
import Index from "./pages/Index";
import QuantumBets from "./pages/QuantumBets";
import Elections from "./pages/Elections";
import EverythingBets from "./pages/EverythingBets";
import CreateBet from "./pages/CreateBet";
import MarketDetail from "./pages/MarketDetail";
import QuantumMarketDetail from "./pages/QuantumMarketDetail";
import EverythingMarketDetail from "./pages/EverythingMarketDetail";
import NotFound from "./pages/NotFound";
import { PythPriceTestnet } from "./pages/PythPrice";
import Tournaments from "./pages/Tournaments";
import Lottery from "./pages/Lottery";
import QuantumPythPrices from "./pages/QuantumPythPrices";
import LiquidityProvider from "./pages/LiquidityProvider";
// import { NexusProvider } from '@avail-project/nexus-widgets';
// import type { NexusNetwork } from '@avail-project/nexus-widgets';
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
// import { createContext, useContext, useMemo, useState } from 'react';
// import WalletBridge from './components/WalletBridge';
import { NotificationProvider, TransactionPopupProvider } from "@blockscout/app-sdk";


const config = getDefaultConfig({
  appName: 'URIM Quantum Markets',
  projectId: 'f5d6f1be5b3a2781cb85a4547cc81384',
  chains: [mainnet, base, baseSepolia, optimismSepolia],
  ssr: false,
});

const queryClient = new QueryClient();

// interface Web3ContextValue {
//   network: NexusNetwork;
//   setNetwork: React.Dispatch<React.SetStateAction<NexusNetwork>>;
// }

// const Web3Context = createContext<Web3ContextValue | null>(null);

// export function useWeb3Context() {
//   const context = useContext(Web3Context);
//   if (!context) {
//     throw new Error('useWeb3Context must be used within App');
//   }
//   return context;
// }

const App = () => {
  // const [network, setNetwork] = useState<NexusNetwork>('testnet');
  // const value = useMemo(() => ({ network, setNetwork }), [network]);

  return (
    <TransactionPopupProvider>
   <NotificationProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider modalSize="compact">
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/quantum-bets" element={<QuantumBets />} />
                    <Route path="/elections" element={<Elections />} />
                    <Route path="/everything-bets" element={<EverythingBets />} />
                    <Route path="/tournaments" element={<Tournaments />} />
                    <Route path="/lottery" element={<Lottery />} />
                    <Route path="/create-bet" element={<CreateBet />} />
                    <Route path="/market/:address" element={<MarketDetail />} />
                    <Route path="/quantum-market/:id" element={<QuantumMarketDetail />} />
                    <Route path="/everything-market/:id" element={<EverythingMarketDetail />} />
                    <Route path="/quantum-pyth-prices" element={<QuantumPythPrices />} />
                    <Route path="/liquidity-provider" element={<LiquidityProvider />} />
                    <Route path="/PythPrice" element={<PythPriceTestnet />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </NotificationProvider>
    </TransactionPopupProvider>
  );
};

export default App;