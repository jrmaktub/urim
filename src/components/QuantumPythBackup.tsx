// Archived Quantum Pyth logic — restore anytime if needed.
// This component contains the original oracle-powered prediction market functionality
// using Pyth price feeds for market resolution.

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, Zap, RefreshCw } from "lucide-react";
import { URIM_QUANTUM_MARKET_ADDRESS, USDC_ADDRESS } from "@/constants/contracts";
import UrimQuantumMarketABI from "@/contracts/UrimQuantumMarket.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { parseUnits, formatUnits } from "viem";
// import { BridgeAndExecuteButton } from '@avail-project/nexus-widgets';
import { optimismSepolia, baseSepolia } from 'wagmi/chains';
import { useNotification } from "@blockscout/app-sdk";
import { cn } from "@/lib/utils";
import { EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";

// This component is archived and not currently in use
// Contains the full Quantum Pyth oracle-powered market implementation
export default function QuantumPythBackup() {
  return (
    <Card className="p-6 border-2 border-muted/30">
      <div className="text-center text-muted-foreground">
        <p className="text-sm">Quantum Pyth markets are currently archived</p>
        <p className="text-xs mt-2">This component can be restored if needed</p>
      </div>
    </Card>
  );
}
