import { createConfig, http } from 'wagmi';
import { mainnet, base, baseSepolia } from 'wagmi/chains';
import { baseAccount } from 'wagmi/connectors';

export const config = createConfig({
  chains: [mainnet, base, baseSepolia],
  transports: { 
    [mainnet.id]: http(),
    [base.id]: http('https://base-mainnet.g.alchemy.com/v2/27SvVEbGAVC2VSJ8rPss0rPzh4IWLU_j'),
    [baseSepolia.id]: http() 
  },
  ssr: false,
});
