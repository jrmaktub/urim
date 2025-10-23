import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useNexus } from '@avail-project/nexus-widgets';

/**
 * CRITICAL: This component bridges the gap between RainbowKit/Wagmi and Nexus SDK
 * It manually sets the wallet provider so Nexus can detect it
 */
export function WalletBridge() {
  const { connector, isConnected } = useAccount();
  const { setProvider } = useNexus();

  useEffect(() => {
    if (isConnected && connector?.getProvider) {
      console.log('🌉 Setting provider for Nexus SDK...');
      connector.getProvider().then((provider:any) => {
        console.log('✅ Provider set:', provider);
        setProvider(provider);
      });
    }
  }, [isConnected, connector, setProvider]);

  return null; // This component doesn't render anything
}

export default WalletBridge;