import { useState } from 'react';
import { Button } from './ui/button';
import { executeBaseBet, BetStatus } from '@/lib/baseBetHelper';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import { Copy } from 'lucide-react';

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
  const [autoSpendEnabled, setAutoSpendEnabled] = useState(false);
  const { toast } = useToast();

  const handleBet = async () => {
    const result = await executeBaseBet((newStatus) => {
      setStatus(newStatus);
    });

    if (result.success) {
      setAutoSpendEnabled(true);
      toast({
        title: '✅ Bet Placed!',
        description: 'Auto-Spend is now enabled. Next bets will be instant!',
      });
    } else if (result.needsPermission) {
      toast({
        title: '⚠️ Permission Required',
        description: (
          <div className="flex items-center gap-2">
            <span className="flex-1 select-text">{result.error || 'Please approve USDC spending'}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => {
                navigator.clipboard.writeText(result.error || '');
                toast({ title: 'Error copied to clipboard' });
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        ),
        variant: 'destructive',
      });
    } else {
      toast({
        title: '❌ Bet Failed',
        description: (
          <div className="flex items-center gap-2">
            <span className="flex-1 select-text">{result.error || 'Transaction failed'}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => {
                navigator.clipboard.writeText(result.error || '');
                toast({ title: 'Error copied to clipboard' });
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        ),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleBet}
        disabled={status.isLoading}
        size={size}
        variant={variant}
        className={className}
      >
        {status.isLoading ? 'Processing...' : 'Place Bet (1 USDC)'}
      </Button>
      
      {autoSpendEnabled && (
        <Badge variant="outline" className="text-xs justify-center border-primary/50 text-primary">
          Sub Account • Auto-Spend ✓
        </Badge>
      )}

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
