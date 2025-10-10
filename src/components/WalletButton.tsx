import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './ui/button';

const WalletButton = () => {
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
                <Button onClick={openAccountModal} variant="outline" size="sm" className="rounded-full">
                  {account.displayName}
                </Button>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};

export default WalletButton;
