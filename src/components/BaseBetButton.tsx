import { useState } from 'react';
import { Button } from './ui/button';
import { executeBaseBet, BetStatus } from '@/lib/baseBetHelper';
import { useToast } from '@/hooks/use-toast';
import { useAccount, useWalletClient } from 'wagmi';

interface BaseBetButtonProps {
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export default function BaseBetButton({ 
  className = '', 
  size = 'default',
  variant = 'default' 
}: BaseBetButtonProps) {
  const [status, setStatus] = useState<BetStatus>({
    message: '',
    isLoading: false,
    callsId: null,
  });
  const { toast } = useToast();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const handleBet = async () => {
    if (!address || !walletClient) {
      toast({
        title: '⚠️ Wallet Not Connected',
        description: 'Please connect your wallet first.',
        variant: 'destructive',
      });
      return;
    }

    const result = await executeBaseBet(walletClient, address, (newStatus) => {
      setStatus(newStatus);
    });

    if (result.success) {
      toast({
        title: '✅ Bet Placed!',
        description: 'Your bet has been successfully placed.',
      });
    } else {
      toast({
        title: '❌ Bet Failed',
        description: result.error || 'Transaction failed',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleBet}
        disabled={status.isLoading || !address}
        size={size}
        variant={variant}
        className={className}
      >
        {status.isLoading ? 'Processing...' : 'Place Bet (1 USDC)'}
      </Button>

      {status.message && (
        <p className="text-xs text-muted-foreground text-center">
          {status.message}
        </p>
      )}

      {status.callsId && (
        <a
          href={`https://base-sepolia.blockscout.com/tx/${status.callsId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline text-center font-mono break-all px-2"
        >
          View TX: {status.callsId.slice(0, 10)}...{status.callsId.slice(-8)}
        </a>
      )}
    </div>
  );
}
