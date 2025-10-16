import { formatUnits, parseUnits } from "viem";

// USDC has 6 decimals
export const USDC_DECIMALS = 6;

export function formatUsdc(amount: bigint): string {
  return formatUnits(amount, USDC_DECIMALS);
}

export function parseUsdc(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}
