import { useState } from "react";
import { Zap, Plus, X } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const CreateQuantumBet = () => {
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [outcomes, setOutcomes] = useState(["", ""]);
  const [aiGenerate, setAiGenerate] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

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
    if (!question || outcomes.filter(o => o.trim()).length < 2) {
      toast({
        title: "Missing fields",
        description: "Please provide a question and at least 2 outcomes",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    // Simulate AI generation or blockchain transaction
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const generatedData = {
      question,
      outcomes: outcomes.filter(o => o.trim()),
      probabilities: outcomes.filter(o => o.trim()).map(() => 
        (Math.random() * 40 + 20).toFixed(1)
      ),
      totalPool: "1,234 USDC",
    };

    setPreviewData(generatedData);
    setIsProcessing(false);
    setIsSuccess(true);

    toast({
      title: "Success",
      description: "Quantum bet generated ✨",
    });
  };

  if (isSuccess && previewData) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        
        <main className="pt-32 pb-20 px-6">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8 animate-fade-up">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow mb-4 animate-shimmer">
                <Zap className="w-7 h-7 text-background" />
              </div>
              <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                Quantum Bet Created
              </h2>
              <p className="text-muted-foreground">
                Your multi-outcome bet is now live
              </p>
            </div>

            {/* Preview Card */}
            <div className="glass-card border-primary/20 p-8 space-y-6 animate-fade-up">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">{previewData.question}</h3>
                
                <div className="space-y-3">
                  {previewData.outcomes.map((outcome: string, index: number) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-all"
                    >
                      <span className="font-medium">{outcome}</span>
                      <span className="text-primary font-semibold">
                        {previewData.probabilities[index]}%
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Total Pool</p>
                  <p className="text-2xl font-bold text-primary">
                    {previewData.totalPool}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => {
                    setIsSuccess(false);
                    setPreviewData(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Create Another
                </Button>
                <Button className="flex-1">
                  Share Bet
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
