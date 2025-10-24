// Blockscout Explorer Configuration
export const BLOCKSCOUT_EXPLORER_URL = "https://base-sepolia.blockscout.com"; // We'll update this with your custom URL later
export const BLOCKSCOUT_CUSTOM_EXPLORER_URL = ""; // Your custom Autoscout URL will go here

// Helper functions

export const getExplorerTxUrl = (txHash: string) => 
  `${BLOCKSCOUT_CUSTOM_EXPLORER_URL || BLOCKSCOUT_EXPLORER_URL}/tx/${txHash}`;

export const getExplorerAddressUrl = (address: string) => 
  `${BLOCKSCOUT_CUSTOM_EXPLORER_URL || BLOCKSCOUT_EXPLORER_URL}/address/${address}`;

export const getExplorerTokenUrl = (tokenAddress: string) => 
  `${BLOCKSCOUT_CUSTOM_EXPLORER_URL || BLOCKSCOUT_EXPLORER_URL}/token/${tokenAddress}`;

export const getExplorerContractUrl = (contractAddress: string) => 
  `${BLOCKSCOUT_CUSTOM_EXPLORER_URL || BLOCKSCOUT_EXPLORER_URL}/address/${contractAddress}`;
