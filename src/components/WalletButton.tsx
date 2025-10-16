import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from './ui/button';
import { Shield, LogOut } from 'lucide-react';

const WalletButton = () => {
  const { address, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const baseAccountConnector = connectors.find(c => c.name === 'Base Account');
  const isBaseAccount = connector?.name === 'Base Account';

  const handleDisconnect = async () => {
    try {
      await disconnect();
      // Clear all cached wallet data
      localStorage.clear();
      sessionStorage.clear();
      // Reload page to reset state
      window.location.reload();
    } catch (error) {
      console.error('Disconnect error:', error);
      // Force clear and reload even if disconnect fails
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

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
    <div className="flex items-center gap-3">
      {isBaseAccount && (
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-primary">Sub Account ✓</span>
        </div>
      )}
      <div className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-primary/30 bg-background/80">
        <span className="text-sm font-mono font-semibold text-primary">{address.slice(0, 6)}...{address.slice(-4)}</span>
        <Button 
          onClick={handleDisconnect}
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
          title="Disconnect & Clear Cache"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default WalletButton;
