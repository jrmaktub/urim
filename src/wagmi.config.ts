import { createConfig, http } from 'wagmi';
import { mainnet, base, baseSepolia } from 'wagmi/chains';
import { baseAccount } from 'wagmi/connectors';

export const config = createConfig({
  chains: [mainnet, base, baseSepolia],
  transports: { 
    [mainnet.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http() 
  },
  ssr: false,
});
