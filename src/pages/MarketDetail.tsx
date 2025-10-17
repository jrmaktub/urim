import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount, useReadContract } from "wagmi";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trophy, Clock } from "lucide-react";
import { formatUsdc } from "@/lib/erc20";
import { USDC_ADDRESS, BASE_SEPOLIA_CHAIN_ID } from "@/constants/contracts";
import MarketABI from "@/contracts/Market.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { sendTransaction } from "@/lib/baseAccount";
import { encodeFunctionData } from "viem";
import BaseBetButton from "@/components/BaseBetButton";

const MarketDetail = () => {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { address: userAddress, chainId } = useAccount();
  
  const [timeLeft, setTimeLeft] = useState("");

  // Read market info
  const { data: marketInfo } = useReadContract({
    address: address as `0x${string}`,
    abi: MarketABI.abi,
    functionName: "info",
  });

  const { data: outcomeCount } = useReadContract({
    address: address as `0x${string}`,
    abi: MarketABI.abi,
    functionName: "outcomeCount",
  });

  const [isClaiming, setIsClaiming] = useState(false);

  const info = marketInfo as [string, string, bigint, boolean, number] | undefined;
  const question = info?.[0] || "";
  const endTime = info?.[2] || 0n;
  const resolved = info?.[3] || false;
  const winningIndex = info?.[4] || 0;

  // Update countdown
  useEffect(() => {
    if (!endTime) return;
    
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = Number(endTime) - now;
      
      if (diff <= 0) {
        setTimeLeft("Ended");
        return;
      }
      
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      
      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}m`);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [endTime]);

  const handleClaim = async () => {
    if (!address) return;
    
    setIsClaiming(true);
    
    try {
      const data = encodeFunctionData({
        abi: MarketABI.abi,
        functionName: "claim",
      });

      await sendTransaction({
        to: address!,
        data: data as `0x${string}`,
      });
      
      toast({
        title: "Winnings Claimed! 🏆",
        description: "Your USDC has been transferred (no wallet pop-up!)",
      });
    } catch (error) {
      console.error("Claim failed:", error);
      toast({
        title: "Claim Failed",
        description: "Could not claim winnings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
    return (
      <div className="min-h-screen w-full bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-6">
          <Card className="max-w-md w-full p-8 text-center">
            <h2 className="text-2xl font-bold mb-4 text-destructive">Wrong Network</h2>
            <p className="text-muted-foreground">
              Please switch to Base Sepolia testnet to view this market.
            </p>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const outcomes = outcomeCount ? Array.from({ length: Number(outcomeCount) }, (_, i) => i) : [];

  return (
    <div className="min-h-screen w-full bg-background">
      <Navigation />
      
      <div className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-8"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Markets
          </Button>

          <div className="mb-8 animate-fade-up">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-4xl font-bold text-primary">{question}</h1>
              {resolved && (
                <Trophy className="w-8 h-8 text-primary" />
              )}
            </div>
            
            <div className="flex items-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{timeLeft}</span>
              </div>
              {resolved && (
                <span className="text-primary font-bold">
                  RESOLVED
                </span>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {outcomes.map((i) => (
              <OutcomeCard
                key={i}
                index={i}
                marketAddress={address!}
                userAddress={userAddress}
                resolved={resolved}
                winningIndex={winningIndex}
              />
            ))}
          </div>

          {resolved && userAddress && (
            <Button
              onClick={handleClaim}
              disabled={isClaiming}
              className="w-full h-14 text-base"
            >
              {isClaiming ? "CLAIMING..." : "CLAIM WINNINGS"}
            </Button>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

interface OutcomeCardProps {
  index: number;
  marketAddress: string;
  userAddress?: `0x${string}`;
  resolved: boolean;
  winningIndex: number;
}

const OutcomeCard = ({ index, marketAddress, userAddress, resolved, winningIndex }: OutcomeCardProps) => {
  const { data: outcomeName } = useReadContract({
    address: marketAddress as `0x${string}`,
    abi: MarketABI.abi,
    functionName: "outcomes",
    args: [BigInt(index)],
  });

  const { data: pool } = useReadContract({
    address: marketAddress as `0x${string}`,
    abi: MarketABI.abi,
    functionName: "pools",
    args: [BigInt(index)],
  });

  const { data: userStake } = useReadContract({
    address: marketAddress as `0x${string}`,
    abi: MarketABI.abi,
    functionName: "userStakes",
    args: [userAddress, BigInt(index)],
    query: { enabled: !!userAddress },
  });

  const isWinner = resolved && winningIndex === index;
  const hasStake = userStake && (userStake as bigint) > 0n;

  return (
    <Card className={`p-6 ${isWinner ? "border-primary border-2" : ""}`}>
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-bold text-foreground">{outcomeName as string}</h3>
        {isWinner && <Trophy className="w-6 h-6 text-primary" />}
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Pool:</span>
          <span className="font-bold">{pool ? formatUsdc(pool as bigint) : "0"} USDC</span>
        </div>
        {hasStake && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Your Stake:</span>
            <span className="font-bold text-primary">{formatUsdc(userStake as bigint)} USDC</span>
          </div>
        )}
      </div>
      
      {!resolved && (
        <BaseBetButton className="w-full" />
      )}
    </Card>
  );
};

export default MarketDetail;
