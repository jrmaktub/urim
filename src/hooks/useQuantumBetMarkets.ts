import { useReadContract } from 'wagmi';
import { QUANTUM_BET_ADDRESS } from '@/constants/contracts';
import QuantumBetABI from '@/contracts/QuantumBet.json';

export interface QuantumBetMarket {
  id: number;
  question: string;
  creator: string;
  yesPool: bigint;
  noPool: bigint;
  resolved: boolean;
  outcome: boolean;
  closeTime: number;
}

export function useQuantumBetMarketCount() {
  const { data, isLoading, refetch } = useReadContract({
    address: QUANTUM_BET_ADDRESS as `0x${string}`,
    abi: QuantumBetABI.abi,
    functionName: 'marketCount',
  });

  return {
    count: data ? Number(data) : 0,
    isLoading,
    refetch,
  };
}

export function useQuantumBetMarket(marketId: number) {
  const { data, isLoading, refetch } = useReadContract({
    address: QUANTUM_BET_ADDRESS as `0x${string}`,
    abi: QuantumBetABI.abi,
    functionName: 'getMarket',
    args: [BigInt(marketId)],
  });

  if (!data || !Array.isArray(data)) return { market: null, isLoading, refetch };

  const [question, creator, yesPool, noPool, resolved, outcome, closeTime] = data;

  return {
    market: {
      id: marketId,
      question: question as string,
      creator: creator as string,
      yesPool: yesPool as bigint,
      noPool: noPool as bigint,
      resolved: resolved as boolean,
      outcome: outcome as boolean,
      closeTime: Number(closeTime),
    } as QuantumBetMarket,
    isLoading,
    refetch,
  };
}
