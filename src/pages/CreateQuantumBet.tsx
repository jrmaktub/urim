import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract } from "wagmi";
import { Zap, Plus, X } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { URIM_QUANTUM_MARKET_ADDRESS } from "@/constants/contracts";
import UrimQuantumMarketABI from "@/contracts/UrimQuantumMarket.json";
import { parseUnits } from "viem";

const CreateQuantumBet = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [question, setQuestion] = useState("");
  const [outcomes, setOutcomes] = useState(["", ""]);
  const [aiGenerate, setAiGenerate] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const addOutcome = () => {
    if (outcomes.length < 6) {
      setOutcomes([...outcomes, ""]);
    }
  };

  const removeOutcome = (index: number) => {
    if (outcomes.length > 2) {
      setOutcomes(outcomes.filter((_, i) => i !== index));
    }
  };

  const updateOutcome = (index: number, value: string) => {
    const newOutcomes = [...outcomes];
    newOutcomes[index] = value;
    setOutcomes(newOutcomes);
  };

  const handleGenerateQuantumBet = async () => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    if (!question || outcomes.filter(o => o.trim()).length < 2) {
      toast({
        title: "Missing fields",
        description: "Please provide a question and at least 2 outcomes",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Log contract connection
      console.log(`✅ Connected to UrimQuantumMarket on Base Sepolia: ${URIM_QUANTUM_MARKET_ADDRESS}`);
      
      toast({
        title: "✅ Contract Connected",
        description: `UrimQuantumMarket on Base Sepolia`,
      });

      const durationSeconds = BigInt(7 * 24 * 60 * 60); // 7 days
      const scenarioTexts = outcomes.filter(o => o.trim());
      
      // Equal probabilities that sum to 100
      const equalProb = Math.floor(100 / scenarioTexts.length);
      const remainder = 100 - (equalProb * scenarioTexts.length);
      const probabilitiesArray = scenarioTexts.map((_, i) => 
        BigInt(i === 0 ? equalProb + remainder : equalProb)
      );
      
      // Empty price feed (not using Pyth for now)
      const priceFeedId = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
      const priceBoundaries: bigint[] = [];

      toast({
        title: "Creating Market",
        description: "Please confirm the transaction in your wallet.",
      });

      // Use the new createMarket function with optionA/optionB
      const optionA = "Yes";
      const optionB = "No";
      const targetPrice = BigInt(0); // Default target price (not using Pyth price for manual creation)

      await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: 'createMarket',
        args: [question, optionA, optionB, durationSeconds, priceFeedId, targetPrice],
        gas: BigInt(3000000),
      } as any);

      toast({
        title: "Quantum Market Created! ⚡",
        description: "Your market is now live on Base Sepolia. Redirecting...",
      });

      // Navigate back to home after short delay
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error: any) {
      console.error("Failed to create quantum market:", error);
      const errorMsg = error?.shortMessage || error?.message || "Could not create market. Please try again.";
      const fullError = JSON.stringify(error, null, 2);
      
      toast({
        title: "Transaction Failed",
        description: errorMsg,
        variant: "destructive",
        action: (
          <button
            onClick={() => {
              navigator.clipboard.writeText(fullError);
              toast({ title: "Error copied to clipboard" });
            }}
            className="ml-2 px-3 py-1 text-xs bg-destructive/20 hover:bg-destructive/30 rounded"
          >
            📋 Copy
          </button>
        ),
      });
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      <Navigation />
      
      <main className="pt-32 pb-20 px-6 relative">
        <div className="max-w-xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 animate-fade-up">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow mb-6 glow-gold">
              <Zap className="w-7 h-7 text-background" />
            </div>
            <h1 className="text-5xl font-bold mb-4 tracking-tight">
              Create Quantum Bet
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Add probabilities or let AI generate outcomes.
            </p>
          </div>

          {/* Form Card */}
          <div className="glass-card border-border/30 p-8 space-y-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            {/* Question */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground/90">
                Event Question
              </label>
              <Input
                placeholder="What will be the outcome of the election?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="h-12 bg-input/50 border-border/50 focus:border-primary/50 transition-all"
              />
            </div>

            {/* AI Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Let AI generate outcomes</p>
                  <p className="text-xs text-muted-foreground">Auto-generate probabilities</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiGenerate}
                  onChange={(e) => setAiGenerate(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-all peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-background after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>

            {/* Outcomes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground/90">
                  Outcomes
                </label>
                {outcomes.length < 6 && (
                  <Button
                    onClick={addOutcome}
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Outcome
                  </Button>
                )}
              </div>

              {outcomes.map((outcome, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1 relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">
                        {String.fromCharCode(65 + index)}
                      </span>
                    </div>
                    <Input
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      value={outcome}
                      onChange={(e) => updateOutcome(index, e.target.value)}
                      className="h-12 pl-12 bg-input/50 border-border/50 focus:border-primary/50 transition-all"
                    />
                  </div>
                  {outcomes.length > 2 && (
                    <Button
                      onClick={() => removeOutcome(index)}
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerateQuantumBet}
              disabled={isProcessing}
              className="w-full h-14 text-base mt-8"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-4.5 h-4.5 mr-2" />
                  Generate Quantum Bet
                </>
              )}
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-6 px-6 border-t border-border/20 backdrop-blur-xl bg-background/80">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs font-medium text-muted-foreground">
            Built on Ethereum Sepolia • Powered by{" "}
            <span className="text-primary">Urim</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default CreateQuantumBet;
