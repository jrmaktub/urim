import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from './ui/button';
import { Shield, LogOut } from 'lucide-react';

const WalletButton = () => {
  const { address, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const baseAccountConnector = connectors.find(c => c.name === 'Base Account');
  const isBaseAccount = connector?.name === 'Base Account';

  if (!address) {
    return (
      <Button 
        onClick={() => baseAccountConnector && connect({ connector: baseAccountConnector })}
        variant="default" 
        size="sm" 
        className="rounded-full"
      >
        <Shield className="w-4 h-4 mr-2" />
        Connect Base Account
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isBaseAccount && (
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-primary">Sub Account ✓</span>
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-background/50">
        <span className="text-xs font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
        <Button 
          onClick={() => disconnect()} 
          variant="ghost" 
          size="sm" 
          className="h-6 w-6 p-0"
        >
          <LogOut className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};

export default WalletButton;
