import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Info } from "lucide-react";
import { QUANTUM_BET_ADDRESS, USDC_ADDRESS } from "@/constants/contracts";
import QuantumBetABI from "@/contracts/QuantumBet.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { parseUnits } from "viem";
import { useNotification } from "@blockscout/app-sdk";

const URIM_TREASURY = "0x70f8c04a5768CC8AA87bA2030f90d02522F47436"; // Urim treasury address
const PLATFORM_FEE = "1"; // 1 USDC platform fee

type AIOutcome = {
  title: string;
  desc: string;
  prob: number;
};

type AIOutcomes = {
  outcomeA: AIOutcome;
  outcomeB: AIOutcome;
  outcomeC: AIOutcome;
};

export default function QuantumBets() {
  const { address } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const { openTxToast } = useNotification();

  const [question, setQuestion] = useState("");
  const [durationDays, setDurationDays] = useState("7");
  const [customDays, setCustomDays] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiOutcomes, setAiOutcomes] = useState<AIOutcomes | null>(null);
  const [creatingMarket, setCreatingMarket] = useState(false);

  const getDurationInSeconds = () => {
    const days = durationDays === "custom" ? parseInt(customDays) || 7 : parseInt(durationDays);
    return BigInt(days * 86400);
  };

  const generateAIOutcomes = async () => {
    if (!question.trim()) {
      toast({ title: "Enter a question", variant: "destructive" });
      return;
    }

    setGenerating(true);

    try {
      // Call OpenAI through edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-scenarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate scenarios');
      }

      const data = await response.json();
      
      if (data.outcomeA && data.outcomeB && data.outcomeC) {
        setAiOutcomes(data as AIOutcomes);
        toast({ title: "✨ Scenarios generated", description: "AI outcomes are ready" });
      } else {
        // Fallback outcomes
        setAiOutcomes({
          outcomeA: { title: "Yes", desc: "Outcome occurs.", prob: 50 },
          outcomeB: { title: "No", desc: "Outcome does not occur.", prob: 30 },
          outcomeC: { title: "Uncertain", desc: "Outcome is unclear.", prob: 20 },
        });
        toast({ title: "Using fallback outcomes", description: "AI service unavailable" });
      }
    } catch (error: any) {
      console.error("AI generation error:", error);
      // Fallback outcomes
      setAiOutcomes({
        outcomeA: { title: "Yes", desc: "Outcome occurs.", prob: 50 },
        outcomeB: { title: "No", desc: "Outcome does not occur.", prob: 30 },
        outcomeC: { title: "Uncertain", desc: "Outcome is unclear.", prob: 20 },
      });
      toast({ title: "Using fallback outcomes", description: "AI service unavailable", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const createMarket = async () => {
    if (!address) {
      toast({ title: "Connect Wallet", description: "Please connect your wallet first.", variant: "destructive" });
      return;
    }

    if (!question.trim() || !aiOutcomes) {
      toast({ title: "Generate outcomes first", variant: "destructive" });
      return;
    }

    setCreatingMarket(true);

    try {
      const durationSeconds = getDurationInSeconds();
      const feeAmount = parseUnits(PLATFORM_FEE, 6);

      // Step 1: Approve USDC for fee
      toast({ title: "Step 1: Approving platform fee...", description: `${PLATFORM_FEE} USDC` });

      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_TREASURY, feeAmount],
      } as any);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 2: Transfer fee to treasury
      toast({ title: "Step 2: Paying platform fee...", description: "Supporting Urim infrastructure" });

      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "transfer",
        args: [URIM_TREASURY, feeAmount],
      } as any);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Create market
      toast({ title: "Step 3: Creating market...", description: "Deploying on Base Sepolia" });

      const hash = await writeContractAsync({
        address: QUANTUM_BET_ADDRESS as `0x${string}`,
        abi: QuantumBetABI.abi as any,
        functionName: "createMarket",
        args: [question.trim(), durationSeconds],
      } as any);

      openTxToast("84532", hash);

      toast({
        title: "✅ Market created!",
        description: "Your AI-powered market is now live",
      });

      // Reset form
      setQuestion("");
      setDurationDays("7");
      setCustomDays("");
      setAiOutcomes(null);

    } catch (error: any) {
      console.error("Market creation error:", error);
      toast({
        title: "❌ Transaction failed",
        description: error?.shortMessage || error?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setCreatingMarket(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider">AI-Powered</span>
        </div>
        <h2 className="text-4xl font-bold mb-3">🧠 Quantum Bets</h2>
        <p className="text-muted-foreground text-lg">AI generates three possible futures. You bet on outcomes.</p>
      </div>

      <Card className="p-8 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="space-y-6">
          {/* Question Input */}
          <div className="space-y-3">
            <Label className="text-sm font-bold uppercase tracking-wider">
              Describe your scenario:
            </Label>
            <Input
              placeholder="Will Rixi Moncada win the Honduras 2025 election?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="h-12"
            />
          </div>

          {/* Duration Selector */}
          <div className="space-y-3">
            <Label className="text-sm font-bold uppercase tracking-wider">
              Market duration:
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={durationDays} onValueChange={setDurationDays}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Day</SelectItem>
                  <SelectItem value="2">2 Days</SelectItem>
                  <SelectItem value="3">3 Days</SelectItem>
                  <SelectItem value="7">7 Days</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              
              {durationDays === "custom" && (
                <Input
                  type="number"
                  placeholder="Days"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="h-12"
                  min="1"
                />
              )}
            </div>
          </div>

          {/* Platform Fee Notice */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-primary">Platform Fee: {PLATFORM_FEE} USDC</p>
              <p className="text-muted-foreground text-xs mt-1">
                A small fee helps sustain AI infrastructure and liquidity pools.
              </p>
            </div>
          </div>

          {/* Generate Button */}
          {!aiOutcomes && (
            <Button
              onClick={generateAIOutcomes}
              disabled={generating}
              className="w-full h-14 text-base"
              size="lg"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin mr-2" />
                  Generating scenarios...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate AI Scenarios
                </>
              )}
            </Button>
          )}

          {/* AI Generated Outcomes */}
          {aiOutcomes && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center py-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground">✨ Generated by Urim AI</p>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {(['outcomeA', 'outcomeB', 'outcomeC'] as const).map((key, idx) => {
                  const outcome = aiOutcomes[key];
                  return (
                    <Card key={idx} className="p-5 border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-base">{outcome.title}</h3>
                          <span className="text-xs font-mono bg-primary/20 px-2 py-1 rounded">
                            {outcome.prob}%
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {outcome.desc}
                        </p>
                        {/* Probability Bar */}
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-500"
                            style={{ width: `${outcome.prob}%` }}
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Create Market Button */}
              <Button
                onClick={createMarket}
                disabled={creatingMarket}
                className="w-full h-14 text-base"
                size="lg"
              >
                {creatingMarket ? (
                  <>
                    <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin mr-2" />
                    Creating market...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Create Quantum Market
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
