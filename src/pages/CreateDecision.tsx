import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const CreateDecision = () => {
  const [decision, setDecision] = useState("");
  const [context, setContext] = useState("");

  const handleGenerate = () => {
    // TODO: Navigate to outcome branches
    console.log("Generating branches for:", decision);
  };

  return (
    <div className="min-h-screen w-full">
      <Navigation />
      
      <section className="min-h-screen flex items-center justify-center px-6 pt-24 pb-12">
        <div className="max-w-3xl mx-auto w-full space-y-8 animate-fade-up">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card glow-primary mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium tracking-wider">NEW DECISION</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Create Decision
              </span>
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Describe your decision and we'll generate quantum outcome branches for the market.
            </p>
          </div>

          {/* Form */}
          <div className="glass-card p-8 md:p-12 rounded-2xl space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Decision Question</label>
              <Input
                placeholder="Should I launch next week?"
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                className="h-14 text-lg glass-card border-primary/30 focus:border-primary/60"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Context (optional)</label>
              <Textarea
                placeholder="Add any relevant context about your decision, constraints, or goals..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="min-h-[120px] glass-card border-primary/30 focus:border-primary/60"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!decision.trim()}
              className="w-full h-14 text-lg rounded-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 glow-primary disabled:opacity-50"
            >
              Generate Branches
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Your decision will create a prediction market on Base testnet
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CreateDecision;
