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
import { URIM_QUANTUM_MARKET_ADDRESS, BASE_SEPOLIA_CHAIN_ID } from "@/constants/contracts";
import UrimQuantumMarketABI from "@/contracts/UrimQuantumMarket.json";
import { Card } from "@/components/ui/card";
import { useNotification } from "@blockscout/app-sdk";

const CreateBet = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { chainId, address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  
  const [question, setQuestion] = useState("");
  const [scenarios, setScenarios] = useState(["", "", ""]);
  const [probabilities, setProbabilities] = useState(["33", "33", "34"]);
  const [duration, setDuration] = useState("7");
  const [isCreating, setIsCreating] = useState(false);
  const { openTxToast } = useNotification();


  const handleScenarioChange = (index: number, value: string) => {
    const newScenarios = [...scenarios];
    newScenarios[index] = value;
    setScenarios(newScenarios);
  };

  const handleProbabilityChange = (index: number, value: string) => {
    const newProbs = [...probabilities];
    newProbs[index] = value;
    setProbabilities(newProbs);
  };

  const handleCreateMarket = async (txHash) => {
    if (!address) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    if (!question || scenarios.some(s => !s.trim())) {
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

    const totalProb = probabilities.reduce((sum, p) => sum + Number(p), 0);
    if (totalProb !== 100) {
      toast({
        title: "Invalid Probabilities",
        description: "Probabilities must sum to 100%.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    
    try {
      // Log contract connection
      console.log(`✅ Connected to UrimQuantumMarket on Base Sepolia: ${URIM_QUANTUM_MARKET_ADDRESS}`);
      
      toast({
        title: "✅ Contract Connected",
        description: `UrimQuantumMarket on Base Sepolia`,
      });

      const durationSeconds = BigInt(Number(duration) * 24 * 60 * 60);
      const probabilitiesArray = probabilities.map(p => BigInt(p));
      
      // Using empty price feed for now (0x0...0) and empty boundaries
      const priceFeedId = "0x0000000000000000000000000000000000000000000000000000000000000000";
      const priceBoundaries: bigint[] = [];

      await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "createQuantumMarket",
        args: [question, scenarios, probabilitiesArray, durationSeconds, priceFeedId, priceBoundaries],
      } as any);

      openTxToast("84532", txHash)
      
      toast({
        title: "Quantum Market Created ⚡",
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

  return (
    <div className="min-h-screen w-full bg-background">
      <Navigation />
      
      <div className="pt-32 pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12 animate-fade-up">
            <h1 className="text-5xl font-bold mb-4 text-primary flex items-center justify-center gap-3">
              <Sparkles className="w-12 h-12" />
              CREATE QUANTUM MARKET
            </h1>
            <p className="text-lg text-muted-foreground">
              Create a quantum prediction market with AI-weighted scenarios
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

              {/* Scenarios */}
              <div>
                <Label className="text-foreground font-bold mb-2 block">
                  SCENARIOS (3 required)
                </Label>
                
                <div className="space-y-4">
                  {scenarios.map((scenario, index) => (
                    <div key={index} className="space-y-2">
                      <Input
                        placeholder={`Scenario ${index + 1}`}
                        value={scenario}
                        onChange={(e) => handleScenarioChange(index, e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground">Probability %:</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          className="w-24"
                          value={probabilities[index]}
                          onChange={(e) => handleProbabilityChange(index, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
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

              {/* Info */}
              <div className="bg-muted/30 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <span className="font-bold text-foreground">Settlement:</span> Manual resolution by contract owner
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  All bets placed in USDC on Base Sepolia
                </p>
              </div>

              {/* Create Button */}
              <Button
                onClick={handleCreateMarket}
                disabled={isCreating}
                className="w-full h-14 text-base mt-8"
              >
                {isCreating ? "CREATING MARKET..." : "CREATE QUANTUM MARKET"}
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
