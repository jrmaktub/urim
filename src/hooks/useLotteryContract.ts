import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent, useSwitchChain } from "wagmi";
import { toast } from "@/hooks/use-toast";
import { formatUnits, type Abi } from "viem";
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
    abi: (ERC20ABI as { abi: Abi }).abi,
    functionName: "allowance",
    args: address ? [address, FIFTY_FIFTY_RAFFLE_ADDRESS] : undefined,
    chainId: BASE_MAINNET_CHAIN_ID,
    query: {
      enabled: isConnected && chain?.id === BASE_MAINNET_CHAIN_ID,
      refetchInterval: 10000,
    },
  });

  // Approve and buy with writeContractAsync for better flow control
  const { writeContractAsync: approveUSDC } = useWriteContract();
  const { writeContractAsync: buyTicket } = useWriteContract();
  const [isProcessing, setIsProcessing] = useState(false);

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
    console.log("🎫 Buy Ticket clicked");
    
    if (!isConnected) {
      console.log("❌ Not connected, opening wallet modal");
      openConnectModal?.();
      return;
    }

    if (!address) {
      console.log("❌ No address yet, prompting connect modal again");
      openConnectModal?.();
      return;
    }

    // Force Base Mainnet
    if (chain?.id !== BASE_MAINNET_CHAIN_ID) {
      console.log(`⚠️ Wrong network: ${chain?.id}, switching to Base (${BASE_MAINNET_CHAIN_ID})`);
      toast({ 
        title: "Switch to Base to buy tickets",
        description: "Switching network...",
        className: "bg-primary/20 border-primary"
      });
      try {
        await switchChain({ chainId: BASE_MAINNET_CHAIN_ID });
        console.log("✅ Network switched to Base");
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log("✅ Waited for chain state update");
      } catch (error) {
        console.log("❌ Network switch failed", error);
        toast({
          title: "Network switch failed",
          description: "Please manually switch to Base Mainnet",
          variant: "destructive"
        });
        return;
      }
    }

    setIsProcessing(true);

    try {
      // Check current allowance
      const { data: currentAllowance } = await refetchAllowance();
      const hasCurrentAllowance = currentAllowance && (currentAllowance as bigint) >= TICKET_PRICE;
      console.log("💰 Current allowance:", currentAllowance?.toString(), "| Required:", TICKET_PRICE.toString(), "| Has allowance:", hasCurrentAllowance);

      // If allowance < 1 USDC, approve exactly 1 USDC
      if (!hasCurrentAllowance) {
        console.log("📝 Approving exactly 1 USDC...");
        toast({ title: "Approve USDC", description: "Please confirm the approval in your wallet" });

        const approveHash = await approveUSDC({
          address: USDC_ADDRESS,
          abi: (ERC20ABI as { abi: Abi }).abi,
          functionName: "approve",
          args: [FIFTY_FIFTY_RAFFLE_ADDRESS, TICKET_PRICE],
          account: address,
          chain: base,
          chainId: BASE_MAINNET_CHAIN_ID,
        });

        console.log("✅ Approval confirmed:", approveHash);
        toast({ title: "USDC approved!", description: "Now buying ticket..." });
        
        // Wait a bit for allowance to update
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Buy ticket (either already had allowance, or just approved)
      console.log("🎟️ Buying ticket...");
      toast({ title: "Buying ticket", description: "Please confirm the transaction in your wallet" });
      
      const buyHash = await buyTicket({
        address: FIFTY_FIFTY_RAFFLE_ADDRESS as `0x${string}`,
        abi: FiftyFiftyRaffleABI as unknown as Abi,
        functionName: "buyTicket",
        account: address,
        chain: base,
        chainId: BASE_MAINNET_CHAIN_ID,
      });

      console.log("✅ Ticket purchased:", buyHash);
      toast({ 
        title: "🎟️ Ticket purchased!",
        description: "Good luck in the draw!"
      });

      // Refetch data
      refetchRoundInfo();
      refetchAllowance();

    } catch (error: any) {
      console.log("❌ Transaction failed:", error);
      toast({
        title: "Transaction failed",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };


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
    isLoading: isProcessing,
  };
};
