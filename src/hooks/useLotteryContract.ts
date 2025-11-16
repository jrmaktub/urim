import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent, useSwitchChain } from "wagmi";
import { toast } from "@/hooks/use-toast";
import { formatUnits, type Abi } from "viem";
import { base } from "wagmi/chains";
import FiftyFiftyRaffleABI from "@/contracts/FiftyFiftyRaffle.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { FIFTY_FIFTY_RAFFLE_ADDRESS } from "@/constants/lottery";

const BASE_MAINNET_CHAIN_ID = 8453;
const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c37a0643ab80e1d3f56" as `0x${string}`;
const TICKET_PRICE = BigInt(1_000_000); // 1 USDC (6 decimals)

export const useLotteryContract = () => {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
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
    args: [address, FIFTY_FIFTY_RAFFLE_ADDRESS],
    chainId: BASE_MAINNET_CHAIN_ID,
    query: {
      refetchInterval: 10000, // Auto-refresh every 10 seconds
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
  const roundId = roundInfo ? Number(roundInfo[0]) : 0;
  const totalUSDC = roundInfo ? formatUnits(roundInfo[1] as bigint, 6) : "0";
  const totalURIM = roundInfo ? formatUnits(roundInfo[2] as bigint, 6) : "0";
  const roundTimeLeft = roundInfo ? Number(roundInfo[3]) : 0;
  const isOpen = roundInfo ? roundInfo[4] : false;

  const isCorrectNetwork = chain?.id === BASE_MAINNET_CHAIN_ID;
  const hasAllowance = allowance && (allowance as bigint) >= TICKET_PRICE;

  const handleBuyTicket = async () => {
    if (!isConnected) {
      toast({ 
        title: "Please connect your wallet",
        description: "Connect your wallet to purchase tickets",
        variant: "destructive" 
      });
      return;
    }

    if (!isCorrectNetwork) {
      toast({ 
        title: "Switching to Base Mainnet...",
        className: "bg-primary/20 border-primary"
      });
      switchChain({ chainId: base.id });
      return;
    }

    if (!isOpen) {
      toast({ 
        title: "Round is not open", 
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
          args: [FIFTY_FIFTY_RAFFLE_ADDRESS, TICKET_PRICE],
          account: address,
          chain: base,
        });
        
        return;
      }

      // Buy ticket
      toast({ title: "Buying ticket...", description: "Please confirm the transaction in your wallet" });
      buyTicket({
        address: FIFTY_FIFTY_RAFFLE_ADDRESS as `0x${string}`,
        abi: FiftyFiftyRaffleABI as unknown as Abi,
        functionName: "buyTicketWithUSDC",
        account: address,
        chain: base,
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

  // Handle approval success
  useEffect(() => {
    if (isApprovalSuccess && isApproving) {
      setIsApproving(false);
      refetchAllowance();
      toast({ 
        title: "USDC approved!", 
        description: "Click 'Buy Ticket' again to complete your purchase" 
      });
    }
  }, [isApprovalSuccess, isApproving, refetchAllowance]);

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
    totalURIM,
    roundTimeLeft,
    isOpen,
    isCorrectNetwork,
    hasAllowance,
    handleBuyTicket,
    refetchRoundInfo,
    isLoading: isApprovalLoading || isBuyLoading || isApproving,
  };
};
