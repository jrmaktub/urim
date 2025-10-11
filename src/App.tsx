import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from './wagmi.config';
import Index from "./pages/Index";
import CreateDecision from "./pages/CreateDecision";
import Markets from "./pages/Markets";
import DecisionDetail from "./pages/DecisionDetail";
import MatchBet from "./pages/MatchBet";
import CreateMatch from "./pages/CreateMatch";
import Match from "./pages/Match";
import NotFound from "./pages/NotFound";
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

const App = () => (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider theme={darkTheme({
        accentColor: 'hsl(var(--primary))',
        accentColorForeground: 'hsl(var(--primary-foreground))',
        borderRadius: 'medium',
      })}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/create" element={<CreateMatch />} />
              <Route path="/markets" element={<Markets />} />
              <Route path="/decision/:id" element={<DecisionDetail />} />
              <Route path="/match-bet" element={<MatchBet />} />
              <Route path="/match/:matchId" element={<Match />} />
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
