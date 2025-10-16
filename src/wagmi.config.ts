import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { baseAccount } from 'wagmi/connectors';

export const config = createConfig({
  chains: [baseSepolia],
  transports: { 
    [baseSepolia.id]: http() 
  },
  connectors: [
    baseAccount({
      appName: 'Urim - Quantum Prediction Markets',
    }),
  ],
});
