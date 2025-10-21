import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract } from "wagmi";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Plus, X, Flag } from "lucide-react";
import { URIM_MARKET_ADDRESS, USDC_ADDRESS, MAX_OUTCOMES, BASE_SEPOLIA_CHAIN_ID } from "@/constants/contracts";
import UrimMarketABI from "@/contracts/UrimMarket.json";
import { Card } from "@/components/ui/card";

const CreateBet = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  
  const [question, setQuestion] = useState("");
  const [outcomes, setOutcomes] = useState(["", ""]);
  const [endDateTime, setEndDateTime] = useState("");
  const [createdMarketAddress, setCreatedMarketAddress] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleAddOutcome = () => {
    if (outcomes.length < MAX_OUTCOMES) {
      setOutcomes([...outcomes, ""]);
    }
  };

  const handleRemoveOutcome = (index: number) => {
    if (outcomes.length > 2) {
      setOutcomes(outcomes.filter((_, i) => i !== index));
    }
  };

  const handleOutcomeChange = (index: number, value: string) => {
    const newOutcomes = [...outcomes];
    newOutcomes[index] = value;
    setOutcomes(newOutcomes);
  };

  const fillHondurasPreset = () => {
    setQuestion("Who will be the next President of Honduras?");
    setOutcomes(["Rixi Moncada", "Salvador Nasralla", "Nasry Asfura"]);
    
    // Set end time to ~180 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 180);
    const dateStr = futureDate.toISOString().slice(0, 16);
    setEndDateTime(dateStr);
    
    toast({
      title: "Honduras Election Preset Loaded 🇭🇳",
      description: "Market configured for Honduras presidential race",
    });
  };

  const handleCreateMarket = async () => {
    if (!question || outcomes.some(o => !o.trim()) || !endDateTime) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields before creating your market.",
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


    const endTime = Math.floor(new Date(endDateTime).getTime() / 1000);
    
    setIsCreating(true);
    
    try {
      const hash = await writeContractAsync({
        address: URIM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimMarketABI.abi as any,
        functionName: "createMarket",
        args: [question, outcomes, BigInt(endTime)],
      } as any);
      
      toast({
        title: "Market Created! 🎉",
        description: "Your market is now live on Base Sepolia",
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

  if (createdMarketAddress) {
    return (
      <div className="min-h-screen w-full bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-6">
          <Card className="max-w-md w-full p-8 text-center animate-fade-up">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4 text-primary">
              Market Created Successfully
            </h2>
            <p className="text-muted-foreground mb-8">
              Your market is now live on Base Sepolia. Start accepting bets!
            </p>
            <div className="space-y-4">
              <Button
                onClick={() => navigate(`/market/${createdMarketAddress}`)}
                className="w-full"
              >
                View Market
              </Button>
              <Button
                onClick={() => {
                  setCreatedMarketAddress(null);
                  setQuestion("");
                  setOutcomes(["", ""]);
                  setEndDateTime("");
                }}
                variant="outline"
                className="w-full"
              >
                Create Another Market
              </Button>
            </div>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <Navigation />
      
      <div className="pt-32 pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12 animate-fade-up">
            <h1 className="text-5xl font-bold mb-4 text-primary">
              CREATE MARKET
            </h1>
            <p className="text-lg text-muted-foreground">
              Create a prediction market settled in USDC on Base Sepolia
            </p>
          </div>

          {/* Honduras Election Preset */}
          <div className="mb-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <Button
              onClick={fillHondurasPreset}
              variant="outline"
              className="w-full h-16 text-base border-2 border-primary/30 hover:border-primary"
            >
              <Flag className="w-5 h-5 mr-2" />
              Create Honduras Presidential Market 🇭🇳
            </Button>
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
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-foreground font-bold">
                    OUTCOMES ({outcomes.length}/{MAX_OUTCOMES})
                  </Label>
                  {outcomes.length < MAX_OUTCOMES && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddOutcome}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Outcome
                    </Button>
                  )}
                </div>
                
                <div className="space-y-3">
                  {outcomes.map((outcome, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Outcome ${index + 1}`}
                        value={outcome}
                        onChange={(e) => handleOutcomeChange(index, e.target.value)}
                      />
                      {outcomes.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveOutcome(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* End Time */}
              <div>
                <Label htmlFor="endTime" className="text-foreground font-bold mb-2 block">
                  END TIME
                </Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={endDateTime}
                  onChange={(e) => setEndDateTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              {/* Settlement Token Info */}
              <div className="bg-muted/30 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <span className="font-bold text-foreground">Settlement Token:</span> USDC (ERC-20)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  All bets will be placed and settled in USDC on Base Sepolia
                </p>
              </div>

              {/* Create Button */}
              <Button
                onClick={handleCreateMarket}
                disabled={isCreating}
                className="w-full h-14 text-base mt-8"
              >
                {isCreating ? "CREATING MARKET..." : "CREATE MARKET"}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default CreateBet;
