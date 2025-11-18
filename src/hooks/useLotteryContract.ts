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
const TICKET_PRICE = BigInt(5_000_000); // 5 USDC (6 decimals)

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

  // Contract write hooks
  const { writeContractAsync: approveUSDC } = useWriteContract();
  const { writeContractAsync: buyTicket } = useWriteContract();
  const [isProcessing, setIsProcessing] = useState(false);
  const [approvalHash, setApprovalHash] = useState<`0x${string}` | undefined>();
  const [buyHash, setBuyHash] = useState<`0x${string}` | undefined>();

  // Wait for approval transaction
  const { isLoading: isApprovePending, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approvalHash,
  });

  // Wait for buy transaction
  const { isLoading: isBuyPending, isSuccess: isBuySuccess } = useWaitForTransactionReceipt({
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
        title: "Switch to Base",
        description: "Switching to Base Mainnet...",
        className: "bg-primary/20 border-primary"
      });
      try {
        await switchChain({ chainId: BASE_MAINNET_CHAIN_ID });
        console.log("✅ Network switched to Base");
        // Wait for chain state to update
        await new Promise(resolve => setTimeout(resolve, 1000));
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

    // Check if round is open
    if (!isOpen) {
      toast({
        title: "Round closed",
        description: "This round is currently being drawn or has ended. Please wait for the next round.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Check current allowance
      const { data: currentAllowance } = await refetchAllowance();
      const hasCurrentAllowance = currentAllowance && (currentAllowance as bigint) >= TICKET_PRICE;
      console.log("💰 Current allowance:", currentAllowance?.toString(), "| Required:", TICKET_PRICE.toString(), "| Has allowance:", hasCurrentAllowance);

      // Step 2: If insufficient allowance, approve USDC
      if (!hasCurrentAllowance) {
        console.log("📝 Approving 50 USDC (for multiple tickets)...");
        toast({ 
          title: "Step 1 of 2: Approve USDC", 
          description: "Please confirm the approval in your wallet",
          className: "bg-primary/20 border-primary"
        });

        try {
          const txHash = await approveUSDC({
            address: USDC_ADDRESS,
            abi: (ERC20ABI as { abi: Abi }).abi,
            functionName: "approve",
            args: [FIFTY_FIFTY_RAFFLE_ADDRESS, BigInt(50_000_000)], // Approve 50 USDC for multiple tickets
            account: address,
            chain: base,
            chainId: BASE_MAINNET_CHAIN_ID,
          });

          console.log("✅ Approval transaction sent:", txHash);
          setApprovalHash(txHash);
          
          toast({ 
            title: "Approval submitted", 
            description: "Waiting for confirmation...",
            className: "bg-primary/20 border-primary"
          });

          // Wait for approval to be mined
          let confirmed = false;
          let attempts = 0;
          const maxAttempts = 30; // 30 seconds max

          while (!confirmed && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const { data: updatedAllowance } = await refetchAllowance();
            confirmed = updatedAllowance && (updatedAllowance as bigint) >= TICKET_PRICE;
            attempts++;
            console.log(`⏳ Waiting for approval... Attempt ${attempts}/${maxAttempts}, Allowance: ${updatedAllowance?.toString()}`);
          }

          if (!confirmed) {
            throw new Error("Approval transaction did not confirm in time");
          }

          console.log("✅ Approval confirmed on-chain");
          toast({ 
            title: "USDC approved!", 
            description: "Now purchasing ticket...",
            className: "bg-primary/20 border-primary"
          });

        } catch (approvalError: any) {
          console.log("❌ Approval failed:", approvalError);
          
          if (approvalError.message?.includes("User rejected")) {
            toast({
              title: "Approval cancelled",
              description: "You cancelled the approval",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Approval failed",
              description: approvalError.shortMessage || approvalError.message || "Please try again",
              variant: "destructive"
            });
          }
          setIsProcessing(false);
          return;
        }
      }

      // Step 3: Buy ticket
      console.log("🎟️ Buying ticket...");
      toast({ 
        title: hasCurrentAllowance ? "Buying ticket" : "Step 2 of 2: Buy ticket", 
        description: "Please confirm the transaction in your wallet",
        className: "bg-primary/20 border-primary"
      });
      
      try {
        const txHash = await buyTicket({
          address: FIFTY_FIFTY_RAFFLE_ADDRESS as `0x${string}`,
          abi: FiftyFiftyRaffleABI as unknown as Abi,
          functionName: "buyTicket",
          account: address,
          chain: base,
          chainId: BASE_MAINNET_CHAIN_ID,
        });

        console.log("✅ Buy ticket transaction sent:", txHash);
        setBuyHash(txHash);

        toast({ 
          title: "Purchase submitted", 
          description: "Waiting for confirmation...",
          className: "bg-primary/20 border-primary"
        });

        // Wait for buy transaction to be confirmed
        let confirmed = false;
        let attempts = 0;
        const maxAttempts = 30;

        while (!confirmed && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
          
          // Check if transaction is mined by refetching round info
          const previousPlayers = totalPlayers;
          await refetchRoundInfo();
          
          // If player count increased, transaction was successful
          confirmed = totalPlayers > previousPlayers;
          console.log(`⏳ Waiting for ticket purchase... Attempt ${attempts}/${maxAttempts}`);
        }

        console.log("✅ Ticket purchase confirmed!");
        toast({ 
          title: "🎟️ Ticket purchased!",
          description: `Good luck! Round ends in ${formatTime(roundTimeLeft)}`,
          className: "bg-primary/20 border-primary"
        });

        // Final data refresh
        refetchRoundInfo();
        refetchAllowance();

      } catch (buyError: any) {
        console.log("❌ Buy ticket failed:", buyError);
        
        if (buyError.message?.includes("User rejected")) {
          toast({
            title: "Purchase cancelled",
            description: "You cancelled the ticket purchase",
            variant: "destructive"
          });
        } else if (buyError.message?.includes("insufficient")) {
          toast({
            title: "Insufficient USDC",
            description: "You need at least 5 USDC to buy a ticket",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Purchase failed",
            description: buyError.shortMessage || buyError.message || "Please try again",
            variant: "destructive"
          });
        }
      }

    } catch (error: any) {
      console.log("❌ Unexpected error:", error);
      toast({
        title: "Transaction failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setApprovalHash(undefined);
      setBuyHash(undefined);
    }
  };

  // Helper function to format time
  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return "0h 0m";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
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
    isLoading: isProcessing || isApprovePending || isBuyPending,
  };
};
