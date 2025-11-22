import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits, type Abi } from "viem";
import { base } from "wagmi/chains";
import { HONDURAS_ELECTION_ADDRESS, BASE_USDC_ADDRESS } from "@/constants/hondurasElection";
import HondurasElectionABI from "@/contracts/HondurasElection.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function useHondurasElectionPrices() {
  const { data, refetch } = useReadContract({
    address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
    abi: HondurasElectionABI as Abi,
    functionName: "getAllPrices",
    chainId: base.id,
  });

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (!data || !Array.isArray(data)) {
    return {
      nasralla: 0,
      moncada: 0,
      asfura: 0,
    };
  }

  // Convert from 18 decimals to percentage
  return {
    nasralla: Number(formatUnits(data[0] as bigint, 16)), // 18 decimals -> percentage
    moncada: Number(formatUnits(data[1] as bigint, 16)),
    asfura: Number(formatUnits(data[2] as bigint, 16)),
  };
}

export function useUserPosition(candidateId: number) {
  const { address } = useAccount();
  
  const { data } = useReadContract({
    address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
    abi: HondurasElectionABI as Abi,
    functionName: "getUserSharesInUSDC",
    args: [address, candidateId],
    chainId: base.id,
    query: {
      enabled: !!address,
    },
  });

  if (!data) return "0.00";
  
  // Convert from 6 decimals (USDC) to USD
  return formatUnits(data as bigint, 6);
}

export function useMarketTimeRemaining() {
  const { data, refetch } = useReadContract({
    address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
    abi: HondurasElectionABI as Abi,
    functionName: "getMarketTimeRemaining",
    chainId: base.id,
  });

  // Refresh every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 1000);
    return () => clearInterval(interval);
  }, [refetch]);

  return data ? Number(data) : 0;
}

export function useMarketState() {
  const { data, refetch } = useReadContract({
    address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
    abi: HondurasElectionABI as Abi,
    functionName: "state",
    chainId: base.id,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  return data !== undefined ? Number(data) : 0;
}

export function useUSDCAllowance() {
  const { address } = useAccount();
  
  const { data, refetch } = useReadContract({
    address: BASE_USDC_ADDRESS as `0x${string}`,
    abi: (ERC20ABI as { abi: Abi }).abi,
    functionName: "allowance",
    args: address ? [address, HONDURAS_ELECTION_ADDRESS] : undefined,
    chainId: base.id,
    query: {
      enabled: !!address,
    },
  });

  return { 
    allowance: data ? data as bigint : BigInt(0),
    refetch 
  };
}

export function useApproveUSDC() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = async (amount: string) => {
    const amountInWei = parseUnits(amount, 6); // USDC has 6 decimals
    
    return await writeContractAsync({
      address: BASE_USDC_ADDRESS as `0x${string}`,
      abi: (ERC20ABI as { abi: Abi }).abi,
      functionName: "approve",
      args: [HONDURAS_ELECTION_ADDRESS, amountInWei],
      account: address,
      chain: base,
      chainId: base.id,
    });
  };

  return { approve, isPending, isConfirming, isSuccess, hash };
}

export function useBuyShares() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries();
    }
  }, [isSuccess, queryClient]);

  const buyShares = async (candidateId: number, usdcAmount: string) => {
    const amountInWei = parseUnits(usdcAmount, 6); // USDC has 6 decimals
    
    return await writeContractAsync({
      address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
      abi: HondurasElectionABI as Abi,
      functionName: "buySharesUSD",
      args: [candidateId, amountInWei],
      account: address,
      chain: base,
      chainId: base.id,
    });
  };

  return { buyShares, isConfirming, isSuccess, hash, isPending };
}

export function useSellShares() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries();
    }
  }, [isSuccess, queryClient]);

  const sellShares = async (candidateId: number, usdcAmount: string) => {
    const amountInWei = parseUnits(usdcAmount, 6); // USDC has 6 decimals
    
    return await writeContractAsync({
      address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
      abi: HondurasElectionABI as Abi,
      functionName: "sellSharesUSD",
      args: [candidateId, amountInWei],
      account: address,
      chain: base,
      chainId: base.id,
    });
  };

  return { sellShares, isConfirming, isSuccess, hash, isPending };
}

export function useClaimWinnings() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimWinnings = async () => {
    return await writeContractAsync({
      address: HONDURAS_ELECTION_ADDRESS as `0x${string}`,
      abi: HondurasElectionABI as Abi,
      functionName: "claimWinnings",
      account: address,
      chain: base,
      chainId: base.id,
    });
  };

  return { claimWinnings, isConfirming, isSuccess, hash, isPending };
}
