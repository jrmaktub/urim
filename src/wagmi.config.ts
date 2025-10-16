import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { injected, coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
  chains: [baseSepolia],
  transports: { 
    [baseSepolia.id]: http() 
  },
  connectors: [
    coinbaseWallet({
      appName: 'Urim',
      preference: 'smartWalletOnly',
    }),
    injected(),
  ],
});
