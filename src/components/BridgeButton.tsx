import { BridgeButton } from '@avail-project/nexus-widgets';
import { useAccount, useSwitchChain } from 'wagmi';
import { optimismSepolia } from 'wagmi/chains';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';

function Bridge() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const [bridgeAmount, setBridgeAmount] = useState("1");
  
  const isOnCorrectChain = chain?.id === optimismSepolia.id;

  if (!isConnected) {
    return (
      <div className="glass-card p-6 border-2 border-red-500/30 bg-gradient-to-r from-red-500/10 to-red-600/10">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400 font-medium">
            Please connect your wallet first
          </p>
        </div>
      </div>
    );
  }

  if (!isOnCorrectChain) {
    return (
      <div className="glass-card p-6 space-y-4">
        <div className="p-4 rounded-lg bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-medium mb-1">
                You need to be on Optimism Sepolia to bridge to Base Sepolia
              </p>
              <p className="text-sm text-yellow-400/80">
                Current network: {chain?.name}
              </p>
            </div>
          </div>
        </div>
        
        <Button
          onClick={() => switchChain({ chainId: optimismSepolia.id })}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          size="lg"
        >
          Switch to Optimism Sepolia
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Amount to Bridge
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={bridgeAmount}
            onChange={(e) => setBridgeAmount(e.target.value)}
            placeholder="1.0"
            className="flex-1 h-12 text-lg bg-background/50"
            min="0"
            step="0.1"
          />
          <span className="text-sm font-bold text-muted-foreground px-3">USDC</span>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-purple-400">From:</span> Optimism Sepolia → <span className="font-medium text-purple-400">To:</span> Base Sepolia
        </p>
      </div>

      <BridgeButton
        prefill={{
          chainId: 84532,
          token: 'USDC',
          amount: bridgeAmount || '1',
        }}
      >
        {({ onClick, isLoading }) => (
          <Button
            onClick={onClick}
            disabled={isLoading || !bridgeAmount || parseFloat(bridgeAmount) <= 0}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
            size="lg"
          >
            {isLoading ? '⏳ Bridging…' : `🌉 Bridge ${bridgeAmount || '0'} USDC to Base Sepolia`}
          </Button>
        )}
      </BridgeButton>
    </div>
  );
}

export default Bridge;