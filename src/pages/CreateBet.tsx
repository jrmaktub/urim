import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract } from "wagmi";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Plus, X } from "lucide-react";
import { URIM_MARKET_ADDRESS } from "@/constants/contracts";
import UrimMarketABI from "@/contracts/UrimMarket.json";
import { Card } from "@/components/ui/card";
import { useNotification } from "@blockscout/app-sdk";

const CreateBet = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { openTxToast } = useNotification();
  
  const [question, setQuestion] = useState("");
  const [outcomes, setOutcomes] = useState(["YES", "NO"]);
  const [duration, setDuration] = useState("24");
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
        variant: "destructive",
      });
      return;
    }

    const validOutcomes = outcomes.filter(o => o.trim());
    if (!question.trim() || validOutcomes.length < 2) {
      toast({
        title: "Missing Information",
        description: "Please fill in question and at least 2 outcomes.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    
    try {
      const durationInSeconds = parseInt(duration) * 3600;
      const endTimestamp = Math.floor(Date.now() / 1000) + durationInSeconds;
      
      const hash = await writeContractAsync({
        address: URIM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimMarketABI.abi as any,
        functionName: "createMarket",
        args: [question, validOutcomes, BigInt(endTimestamp)],
      } as any);

      openTxToast("84532", hash);
      
      setTimeout(() => navigate("/"), 2000);
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Transaction failed",
        description: error?.shortMessage || "Try again",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      <Navigation />
      
      <section className="relative max-w-4xl mx-auto px-6 pt-32 pb-16">
        <Card className="p-8 border-primary/20 bg-background/95 space-y-8 hover:border-primary/30 transition-all animate-fade-in">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                <TrendingUp className="w-6 h-6 text-background" />
              </div>
              <h1 className="text-3xl font-bold">Create Everything Bet</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Create a custom prediction market for any question.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="question" className="text-sm font-semibold">
                Question
              </Label>
              <Input
                id="question"
                placeholder="e.g., Will BTC reach $100k by end of 2024?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="bg-background/50 border-primary/20 focus:border-primary/40"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Outcomes</Label>
              <div className="space-y-2">
                {outcomes.map((outcome, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`Outcome ${index + 1}`}
                      value={outcome}
                      onChange={(e) => handleOutcomeChange(index, e.target.value)}
                      className="flex-1 bg-background/50 border-primary/20 focus:border-primary/40"
                    />
                    {outcomes.length > 2 && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeOutcome(index)}
                        className="border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {outcomes.length < 3 && (
                  <Button
                    variant="outline"
                    onClick={addOutcome}
                    className="w-full border-primary/30 hover:bg-primary/5 hover:border-primary/50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Outcome
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="duration" className="text-sm font-semibold">
                Duration (hours)
              </Label>
              <Input
                id="duration"
                type="number"
                placeholder="24"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="bg-background/50 border-primary/20 focus:border-primary/40"
              />
            </div>

            <Button
              onClick={handleCreateMarket}
              disabled={isCreating}
              className="w-full bg-gradient-to-r from-primary to-primary/70 hover:shadow-lg hover:shadow-primary/20 transition-all"
              size="lg"
            >
              {isCreating ? "Creating..." : "Create Market"}
            </Button>

            <div className="pt-4 border-t border-border/30">
              <Button
                variant="outline"
                className="w-full border-primary/30 hover:bg-primary/5 hover:border-primary/50 transition-all group"
                onClick={() => {
                  toast({ 
                    title: "🪐 Bridge & Execute", 
                    description: "Cross-chain bridging with Avail coming soon!" 
                  });
                }}
              >
                <span className="mr-2">🪐</span>
                Bridge & Execute with Avail
                <span className="ml-2 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  (Cross-chain in one click)
                </span>
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <Footer />
    </div>
  );
};

export default CreateBet;