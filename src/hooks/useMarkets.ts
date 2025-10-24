import { useReadContract } from 'wagmi';
import { URIM_MARKET_ADDRESS, URIM_QUANTUM_MARKET_ADDRESS } from '@/constants/contracts';
import UrimMarketABI from '@/contracts/UrimMarket.json';
import UrimQuantumMarketABI from '@/contracts/UrimQuantumMarket.json';

export interface MarketBasicInfo {
  id: number;
  question: string;
  endTimestamp: number;
  resolved: boolean;
  winningIndex: number;
  isQuantum: boolean;
}

export function useAllMarkets() {
  // Fetch Everything Bet market IDs
  const { data: everythingMarketIds, error: everythingError } = useReadContract({
    address: URIM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimMarketABI.abi,
    functionName: 'getAllMarketIds',
  });

  // Fetch Quantum Bet market IDs
  const { data: quantumMarketIds, error: quantumError } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi,
    functionName: 'getAllMarketIds',
  });

  // Log errors for debugging but don't throw
  if (everythingError) {
    console.warn('Error fetching everything markets:', everythingError);
  }
  if (quantumError) {
    console.warn('Error fetching quantum markets:', quantumError);
  }

  return {
    everythingMarketIds: (everythingMarketIds as bigint[]) || [],
    quantumMarketIds: (quantumMarketIds as bigint[]) || [],
  };
}

export function useMarketInfo(marketId: number, isQuantum: boolean) {
  const contractAddress = isQuantum ? URIM_QUANTUM_MARKET_ADDRESS : URIM_MARKET_ADDRESS;
  const abi = isQuantum ? UrimQuantumMarketABI.abi : UrimMarketABI.abi;

  const { data: basicInfo } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi,
    functionName: 'getMarketBasicInfo',
    args: [BigInt(marketId)],
  });

  const { data: outcomes } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi,
    functionName: isQuantum ? 'getScenarios' : 'getOutcomes',
    args: [BigInt(marketId)],
  });

  if (!basicInfo || !outcomes) return null;

  // Quantum markets return: [question, endTime, resolved, winningScenario, scenarioCount]
  // Everything markets return: [question, endTimestamp, resolved, winningIndex]
  const [question, endTimestamp, resolved, winningIndex] = basicInfo as [string, bigint, boolean, number | bigint];

  return {
    id: marketId,
    question,
    endTimestamp: Number(endTimestamp),
    resolved,
    winningIndex: typeof winningIndex === 'bigint' ? Number(winningIndex) : winningIndex,
    outcomes: outcomes as string[],
    isQuantum,
  };
}

export function useOutcomePool(marketId: number, outcomeIndex: number, isQuantum: boolean) {
  const contractAddress = isQuantum ? URIM_QUANTUM_MARKET_ADDRESS : URIM_MARKET_ADDRESS;
  const abi = isQuantum ? UrimQuantumMarketABI.abi : UrimMarketABI.abi;

  // Quantum markets use getTotalSharesPerScenario which returns all shares at once
  const { data: allShares } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi,
    functionName: isQuantum ? 'getTotalSharesPerScenario' : 'getOutcomePool',
    args: isQuantum ? [BigInt(marketId)] : [BigInt(marketId), BigInt(outcomeIndex)],
  });

  if (isQuantum && allShares && Array.isArray(allShares)) {
    return (allShares[outcomeIndex] as bigint) || 0n;
  }

  return (allShares as bigint) || 0n;
}
