// Base Mainnet Configuration
export const BASE_MAINNET_CHAIN_ID = 8453;

// Honduras Election Market Contract
export const HONDURAS_ELECTION_ADDRESS = "0xb73D817C1c90606ecb6d131a10766919fcBD6Ec6";

// Base Mainnet USDC
export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Candidate IDs
export const CANDIDATE_IDS = {
  NASRALLA: 1,
  MONCADA: 2,
  ASFURA: 3,
} as const;

// Market states
export const MARKET_STATES = {
  OPEN: 0,
  CLOSED: 1,
  RESOLVED: 2,
} as const;
