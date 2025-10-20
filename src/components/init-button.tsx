'use client';
 
import { useAccount } from 'wagmi';
import { initializeWithProvider, isInitialized } from '../lib/nexus';
 
export default function InitButton({
  className,
  onReady,
}: { className?: string; onReady?: () => void }) {
  const { connector } = useAccount();
  
  const onClick = async () => {
    try {
      // Get the provider from the connected wallet
      const provider = await connector?.getProvider();
      if (!provider) throw new Error('No provider found');
      
      // We're calling our wrapper function from the lib/nexus.ts file here.
      await initializeWithProvider(provider);
      onReady?.();
      alert('Nexus initialized');
    } catch (e: any) {
      alert(e?.message ?? 'Init failed');
    }
  };
  return <button className={className} onClick={onClick} disabled={isInitialized()}>Initialize Nexus</button>;
}