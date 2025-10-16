import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './ui/button';
import { useState, useEffect } from 'react';
import { ensureSubAccount } from '@/lib/baseAccount';

const WalletButton = () => {
  const [subAccountActive, setSubAccountActive] = useState(false);

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        useEffect(() => {
          if (connected) {
            ensureSubAccount()
              .then(() => setSubAccountActive(true))
              .catch(() => setSubAccountActive(false));
          }
        }, [connected]);

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button onClick={openConnectModal} variant="default" size="sm" className="rounded-full">
                    Connect Wallet
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button onClick={openChainModal} variant="destructive" size="sm" className="rounded-full">
                    Wrong network
                  </Button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  {subAccountActive && (
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-xs font-medium text-primary">Auto-Spend ✓</span>
                    </div>
                  )}
                  <Button onClick={openAccountModal} variant="outline" size="sm" className="rounded-full">
                    {account.displayName}
                  </Button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};

export default WalletButton;
