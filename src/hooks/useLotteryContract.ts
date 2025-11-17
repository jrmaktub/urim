import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent, useSwitchChain } from "wagmi";
import { toast } from "@/hooks/use-toast";
import { formatUnits, type Abi, maxUint256 } from "viem";
import { base } from "wagmi/chains";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import FiftyFiftyRaffleABI from "@/contracts/FiftyFiftyRaffle.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { FIFTY_FIFTY_RAFFLE_ADDRESS } from "@/constants/lottery";

const BASE_MAINNET_CHAIN_ID = 8453;
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
const TICKET_PRICE = BigInt(1_000_000); // 1 USDC (6 decimals)

export const useLotteryContract = () => {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const [isApproving, setIsApproving] = useState(false);

  // Read current round info
  const { data: roundInfo, refetch: refetchRoundInfo } = useReadContract({
    address: FIFTY_FIFTY_RAFFLE_ADDRESS as `0x${string}`,
    abi: FiftyFiftyRaffleABI as unknown as Abi,
    functionName: "getCurrentRoundInfo",
    chainId: BASE_MAINNET_CHAIN_ID,
    query: {
      refetchInterval: 10000, // Auto-refresh every 10 seconds
    },
  });

  // Watch for TicketPurchased events to instantly update UI
  useWatchContractEvent({
    address: FIFTY_FIFTY_RAFFLE_ADDRESS as `0x${string}`,
    abi: FiftyFiftyRaffleABI as unknown as Abi,
    eventName: "TicketPurchased",
    chainId: BASE_MAINNET_CHAIN_ID,
    onLogs: () => {
      // Instantly refetch round info when a ticket is purchased
      refetchRoundInfo();
      refetchAllowance();
    },
  });

  // Read USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20ABI as unknown as Abi,
    functionName: "allowance",
    args: address ? [address, FIFTY_FIFTY_RAFFLE_ADDRESS] : undefined,
    chainId: BASE_MAINNET_CHAIN_ID,
    query: {
      enabled: isConnected && chain?.id === BASE_MAINNET_CHAIN_ID,
      refetchInterval: 10000,
    },
  });

  // Approve USDC
  const { writeContract: approveUSDC, data: approveHash } = useWriteContract();
  const { isLoading: isApprovalLoading, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Buy ticket
  const { writeContract: buyTicket, data: buyHash } = useWriteContract();
  const { isLoading: isBuyLoading, isSuccess: isBuySuccess } = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  // Parse round info
  // getCurrentRoundInfo returns: roundId, endTime, totalPlayers, totalUSDC, timeLeft, state
  const roundId = roundInfo ? Number(roundInfo[0]) : 0;
  const totalPlayers = roundInfo ? Number(roundInfo[2]) : 0;
  const totalUSDC = roundInfo ? formatUnits(roundInfo[3] as bigint, 6) : "0";
  const roundTimeLeft = roundInfo ? Number(roundInfo[4]) : 0;
  const roundState = roundInfo ? Number(roundInfo[5]) : 0; // 0=OPEN, 1=DRAWING, 2=FINISHED
  const isOpen = roundState === 0;

  const isCorrectNetwork = chain?.id === BASE_MAINNET_CHAIN_ID;
  const hasAllowance = allowance && (allowance as bigint) >= TICKET_PRICE;

  const handleBuyTicket = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }

    // Force Base Mainnet
    if (chain?.id !== BASE_MAINNET_CHAIN_ID) {
      toast({ 
        title: "Switch to Base to buy tickets",
        description: "Switching network...",
        className: "bg-primary/20 border-primary"
      });
      try {
        await switchChain({ chainId: BASE_MAINNET_CHAIN_ID });
      } catch (error) {
        toast({
          title: "Network switch failed",
          description: "Please manually switch to Base Mainnet",
          variant: "destructive"
        });
        return;
      }
      // continue after successful switch
    }

    if (!isOpen) {
      const stateText = roundState === 1 ? "drawing" : roundState === 2 ? "finished" : "not open";
      toast({ 
        title: `Round is ${stateText}`, 
        description: "Please wait for the next round to start",
        variant: "destructive"
      });
      return;
    }

    try {
      // Check if approval is needed
      if (!hasAllowance) {
        setIsApproving(true);
        toast({ title: "Approving USDC...", description: "Please confirm the transaction in your wallet" });
        
        approveUSDC({
          address: USDC_ADDRESS,
          abi: ERC20ABI as unknown as Abi,
          functionName: "approve",
          args: [FIFTY_FIFTY_RAFFLE_ADDRESS, maxUint256],
          account: address,
          chain: base,
          chainId: BASE_MAINNET_CHAIN_ID,
        });
        
        return;
      }

      // Buy ticket
      toast({ title: "Buying ticket...", description: "Please confirm the transaction in your wallet" });
      buyTicket({
        address: FIFTY_FIFTY_RAFFLE_ADDRESS as `0x${string}`,
        abi: FiftyFiftyRaffleABI as unknown as Abi,
        functionName: "buyTicket",
        account: address,
        chain: base,
        chainId: BASE_MAINNET_CHAIN_ID,
      });
      
    } catch (error: any) {
      toast({ 
        title: "Transaction failed", 
        description: error.message, 
        variant: "destructive" 
      });
      setIsApproving(false);
    }
  };

  // Handle approval success - automatically buy ticket
  useEffect(() => {
    if (isApprovalSuccess && isApproving) {
      setIsApproving(false);
      refetchAllowance();
      toast({ 
        title: "USDC approved!", 
        description: "Buying ticket now..." 
      });
      
      // Automatically proceed to buy ticket
      buyTicket({
        address: FIFTY_FIFTY_RAFFLE_ADDRESS as `0x${string}`,
        abi: FiftyFiftyRaffleABI as unknown as Abi,
        functionName: "buyTicket",
        account: address,
        chain: base,
        chainId: BASE_MAINNET_CHAIN_ID,
      });
    }
  }, [isApprovalSuccess, isApproving, refetchAllowance, address]);

  // Handle buy success
  useEffect(() => {
    if (isBuySuccess && !isApproving) {
      toast({ 
        title: "🎟️ Ticket purchased successfully!",
        description: "Good luck in the draw!"
      });
      // Immediately refetch round info
      refetchRoundInfo();
      refetchAllowance();
    }
  }, [isBuySuccess, isApproving, refetchRoundInfo, refetchAllowance]);

  return {
    roundId,
    totalUSDC,
    totalPlayers,
    roundTimeLeft,
    isOpen,
    roundState,
    isCorrectNetwork,
    hasAllowance,
    handleBuyTicket,
    refetchRoundInfo,
    refetchAllowance,
    isLoading: isApprovalLoading || isBuyLoading || isApproving,
  };
};
