import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'URIM Match Bet',
  projectId: 'YOUR_PROJECT_ID', // Get from walletconnect.com
  chains: [sepolia],
  ssr: false,
});
