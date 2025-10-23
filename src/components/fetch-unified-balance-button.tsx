'use client';

import { getUnifiedBalances, isInitialized } from '../lib/nexus';

// Define a type for the cleaned-up data for better code completion and type safety.
type ProcessedBalance = {
  symbol: string;
  icon: string;
  totalBalance: string;
  chains: {
    chainName: string;
    balance: string;
    icon: string;
  }[];
};

export default function FetchUnifiedBalanceButton({
  className,
  onResult,
}: {
  className?: string;
  // Update the onResult prop to expect our new, cleaned-up data structure.
  onResult?: (result: ProcessedBalance[]) => void;
}) {
  const onClick = async () => {
    if (!isInitialized()) {
      alert('Nexus SDK is not initialized. Please connect your wallet first.');
      return;
    }

    // 1. Fetch the raw, detailed balance information.
    const rawBalances = await getUnifiedBalances();
    console.log('Raw Data from Nexus:', rawBalances); // Keep this for debugging

    // 2. Process the raw data into a clean, UI-friendly format.
    const processedBalances: ProcessedBalance[] = rawBalances
      // Filter out any tokens where the total balance is "0" or less.
      .filter((token) => parseFloat(token.balance) > 0)
      // Map over the remaining tokens to transform them into our desired shape.
      .map((token) => {
        // For each token, find which specific chains have a balance > 0.
        const chainsWithBalance = token.breakdown
          .filter((chain) => parseFloat(chain.balance) > 0)
          .map((chain) => ({
            // NOTE: The property for the chain's name might be different.
            // Based on the SDK's likely structure, it's probably `name`.
            // If it's different, you can easily change `chain.name` to the correct property.
            chainName: chain.chain.name || 'Unknown Chain',
            balance: chain.balance,
            icon: chain.chain.logo, // Assuming the chain icon is here.
          }));

        // Return the clean object for this token.
        return {
          symbol: token.symbol,
          icon: token.icon,
          totalBalance: token.balance,
          chains: chainsWithBalance,
        };
      });

    // 3. Pass the clean data to the parent component.
    onResult?.(processedBalances);
    console.log('Processed Data for UI:', processedBalances);
  };

  return (
    <button className={className} onClick={onClick}>
      Fetch Unified Balances
    </button>
  );
}

