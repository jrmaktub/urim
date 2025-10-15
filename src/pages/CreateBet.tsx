import { useState } from "react";
import { Sparkles, Check } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const CreateBet = () => {
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [duration, setDuration] = useState("24h");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleLaunchBet = async () => {
    if (!question || !optionA || !optionB) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    // Simulate transaction
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsProcessing(false);
    setIsSuccess(true);

    toast({
      title: "Success",
      description: "Your bet is live ⚡",
    });
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        
        <main className="pt-32 pb-20 px-6">
          <div className="max-w-xl mx-auto">
            <div className="glass-card border-primary/20 p-8 animate-fade-up text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 glow-subtle">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                Your bet is live ⚡
              </h2>
              <p className="text-muted-foreground mb-8">
                The blockchain has recorded your bet
              </p>
              <Button 
                onClick={() => setIsSuccess(false)}
                variant="outline"
                className="w-full"
              >
                Create Another Bet
              </Button>
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
              <Sparkles className="w-7 h-7 text-background" />
            </div>
            <h1 className="text-5xl font-bold mb-4 tracking-tight">
              Create Your Bet
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Define an event. Set your sides. Let the blockchain decide.
            </p>
          </div>

          {/* Form Card */}
          <div className="glass-card border-border/30 p-8 space-y-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            {/* Question */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground/90">
                Question
              </label>
              <Input
                placeholder="Will Bitcoin hit $100k by end of 2025?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="h-12 bg-input/50 border-border/50 focus:border-primary/50 transition-all"
              />
            </div>

            {/* Option A */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground/90">
                Option A
              </label>
              <Input
                placeholder="Yes"
                value={optionA}
                onChange={(e) => setOptionA(e.target.value)}
                className="h-12 bg-input/50 border-border/50 focus:border-primary/50 transition-all"
              />
            </div>

            {/* Option B */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground/90">
                Option B
              </label>
              <Input
                placeholder="No"
                value={optionB}
                onChange={(e) => setOptionB(e.target.value)}
                className="h-12 bg-input/50 border-border/50 focus:border-primary/50 transition-all"
              />
            </div>

            {/* Duration */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground/90">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full h-12 bg-input/50 border border-border/50 rounded-lg px-4 text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Launch Button */}
            <Button
              onClick={handleLaunchBet}
              disabled={isProcessing}
              className="w-full h-14 text-base mt-8"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                "Launch Bet"
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

export default CreateBet;
