import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";

const CreateBet = () => {
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [duration, setDuration] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleLaunchBet = async () => {
    if (!question || !optionA || !optionB || !duration) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields before launching your bet.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate blockchain interaction
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setIsSuccess(true);
      toast({
        title: "Bet Created Successfully! ⚡",
        description: "Your quantum bet is now live on the blockchain.",
      });
    } catch (error) {
      toast({
        title: "Error Creating Bet",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen w-full bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-6">
          <div className="max-w-md w-full gold-card p-8 text-center animate-fade-up">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4 text-primary">
              Bet Created Successfully
            </h2>
            <p className="text-muted-foreground mb-8">
              Your bet is now live on the blockchain. Share it with others or create another.
            </p>
            <Button
              onClick={() => {
                setIsSuccess(false);
                setQuestion("");
                setOptionA("");
                setOptionB("");
                setDuration("");
              }}
              className="w-full"
            >
              Create Another Bet
            </Button>
          </div>
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
          {/* Title */}
          <div className="text-center mb-12 animate-fade-up">
            <h1 className="text-5xl font-bold mb-4 text-primary">
              CREATE YOUR BET
            </h1>
            <p className="text-lg text-muted-foreground">
              Define an event. Set your sides. Let the blockchain decide.
            </p>
          </div>

          {/* Form */}
          <div className="gold-card p-8 animate-fade-up" style={{ animationDelay: "0.2s" }}>
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

              {/* Option A */}
              <div>
                <Label htmlFor="optionA" className="text-foreground font-bold mb-2 block">
                  OPTION A
                </Label>
                <Input
                  id="optionA"
                  placeholder="First outcome (e.g., Yes)"
                  value={optionA}
                  onChange={(e) => setOptionA(e.target.value)}
                />
              </div>

              {/* Option B */}
              <div>
                <Label htmlFor="optionB" className="text-foreground font-bold mb-2 block">
                  OPTION B
                </Label>
                <Input
                  id="optionB"
                  placeholder="Second outcome (e.g., No)"
                  value={optionB}
                  onChange={(e) => setOptionB(e.target.value)}
                />
              </div>

              {/* Duration */}
              <div>
                <Label htmlFor="duration" className="text-foreground font-bold mb-2 block">
                  DURATION
                </Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="h-12 border-2 border-primary/50 bg-transparent text-foreground focus:border-primary focus:shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
                    <SelectValue placeholder="Select bet duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1d">1 Day</SelectItem>
                    <SelectItem value="3d">3 Days</SelectItem>
                    <SelectItem value="1w">1 Week</SelectItem>
                    <SelectItem value="2w">2 Weeks</SelectItem>
                    <SelectItem value="1m">1 Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Launch Button */}
              <Button
                onClick={handleLaunchBet}
                disabled={isProcessing}
                className="w-full h-14 text-base mt-8"
              >
                {isProcessing ? "PROCESSING..." : "LAUNCH BET"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default CreateBet;
