import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract } from "wagmi";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";
import { URIM_MARKET_ADDRESS, BASE_SEPOLIA_CHAIN_ID } from "@/constants/contracts";
import UrimMarketABI from "@/contracts/UrimMarket.json";
import { Card } from "@/components/ui/card";
import { getExplorerTxUrl } from "@/constants/blockscout";

const CreateBet = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { chainId, address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  
  const [question, setQuestion] = useState("");
  const [outcomes, setOutcomes] = useState(["", ""]);
  const [duration, setDuration] = useState("7");
  const [isCreating, setIsCreating] = useState(false);

  const handleOutcomeChange = (index: number, value: string) => {
    const newOutcomes = [...outcomes];
    newOutcomes[index] = value;
    setOutcomes(newOutcomes);
  };

  const addOutcome = () => {
    if (outcomes.length < 3) {
      setOutcomes([...outcomes, ""]);
    }
  };

  const removeOutcome = (index: number) => {
    if (outcomes.length > 2) {
      setOutcomes(outcomes.filter((_, i) => i !== index));
    }
  };

  const handleCreateMarket = async () => {
    if (!address) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    if (!question || outcomes.some(s => !s.trim())) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
      toast({
        title: "Wrong Network",
        description: "Please switch to Base Sepolia testnet.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    
    try {
      const durationSeconds = BigInt(Number(duration) * 24 * 60 * 60);
      const endTimestamp = BigInt(Math.floor(Date.now() / 1000)) + durationSeconds;
      
      const txHash = await writeContractAsync({
        address: URIM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimMarketABI.abi as any,
        functionName: "createMarket",
        args: [question, outcomes, endTimestamp],
      } as any);
      
      toast({
        title: "⚡ Market Created",
        description: (
          <div className="space-y-2">
            <p>Your market is now live on Base Sepolia</p>
            <button
              onClick={() => window.open(getExplorerTxUrl(txHash as string), '_blank')}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View on BlockScout →
            </button>
          </div>
        )
      });
      
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (error) {
      console.error("Failed to create market:", error);
      toast({
        title: "Transaction Failed",
        description: "Could not create market. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <Navigation />
      
      <div className="pt-32 pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12 animate-fade-up">
            <h1 className="text-5xl font-bold mb-4 text-primary flex items-center justify-center gap-3">
              <Sparkles className="w-12 h-12" />
              CREATE EVERYTHING BET
            </h1>
            <p className="text-lg text-muted-foreground">
              Create a prediction market for any question
            </p>
          </div>

          <Card className="p-8 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <div className="space-y-6">
              {/* Question */}
              <div>
                <Label htmlFor="question" className="text-foreground font-bold mb-2 block">
                  QUESTION
                </Label>
                <Input
                  id="question"
                  placeholder="What event do you want to predict?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </div>

              {/* Outcomes */}
              <div>
                <Label className="text-foreground font-bold mb-2 block">
                  OPTIONS (2-3 outcomes)
                </Label>
                
                <div className="space-y-3">
                  {outcomes.map((outcome, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Option ${index + 1}`}
                        value={outcome}
                        onChange={(e) => handleOutcomeChange(index, e.target.value)}
                      />
                      {outcomes.length > 2 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeOutcome(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  {outcomes.length < 3 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addOutcome}
                      className="w-full"
                    >
                      + Add Option
                    </Button>
                  )}
                </div>
              </div>

              {/* Duration */}
              <div>
                <Label htmlFor="duration" className="text-foreground font-bold mb-2 block">
                  DURATION (days)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="365"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>

              {/* Create Button */}
              <Button
                onClick={handleCreateMarket}
                disabled={isCreating}
                className="w-full h-14 text-base mt-8"
              >
                {isCreating ? "CREATING MARKET..." : "CREATE MARKET"}
              </Button>

              {/* Avail Bridge */}
              <div className="mt-6 pt-6 border-t border-border/30">
                <Button
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => {
                    toast({
                      title: "Avail Bridge",
                      description: "Bridge & Execute functionality coming soon."
                    });
                  }}
                >
                  Bridge & Execute with Avail
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default CreateBet;
