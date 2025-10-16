import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'URIM',
  projectId: 'YOUR_PROJECT_ID', // Get from walletconnect.com
  chains: [baseSepolia],
  ssr: false,
});
