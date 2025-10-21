import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Users, DollarSign, TrendingUp, Clock, Sparkles } from 'lucide-react';
import { useMarketInfo, useOutcomePool } from '@/hooks/useMarkets';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export default function QuantumMarketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const marketId = id ? parseInt(id) : 0;
  
  const market = useMarketInfo(marketId, true);
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string>('');
  const [betAmount, setBetAmount] = useState('');

  if (!market) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Loading market...</h2>
        </div>
      </div>
    );
  }

  const handlePlaceBet = () => {
    if (!selectedOutcome || !betAmount) {
      toast({
        title: "Missing information",
        description: "Please select a scenario and enter an amount",
        variant: "destructive",
      });
      return;
    }
    
    // Contract interaction would go here
    toast({
      title: "Bet placed successfully!",
      description: `Placed ${betAmount} USDC on: ${selectedOutcome}`,
    });
    setShowBetModal(false);
    setBetAmount('');
    setSelectedOutcome('');
  };

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      <Navigation />
      
      <main className="container mx-auto px-4 py-24">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Markets
        </Button>

        {/* Market Header */}
        <div className="glass-card p-8 mb-8 hover-glow">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-4 shimmer-text bg-gradient-to-r from-primary to-purple-400 bg-clip-text">
                {market.question}
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>
                    {market.resolved
                      ? 'Resolved'
                      : `Ends ${new Date(market.endTimestamp * 1000).toLocaleDateString()}`}
                  </span>
                </div>
                {market.resolved && (
                  <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                    Resolved
                  </Badge>
                )}
              </div>
            </div>
            {!market.resolved && (
              <Button
                onClick={() => setShowBetModal(true)}
                className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 hover:scale-105 hover:shadow-primary/40 transition-all animate-float"
              >
                <Sparkles className="w-4 h-4" />
                Place Bet
              </Button>
            )}
          </div>
        </div>

        {/* Scenarios */}
        <div className="grid gap-4 mb-8">
          <h2 className="text-2xl font-bold">Quantum Scenarios</h2>
          {market.outcomes.map((outcome, idx) => {
            const pool = useOutcomePool(marketId, idx, true);
            const totalValue = pool ? Number(pool) / 1e18 : 0;
            
            return (
              <Card
                key={idx}
                className={`glass-card p-6 transition-all duration-300 hover-glow animate-slide-in ${
                  market.resolved && market.winningIndex === idx
                    ? 'border-green-500 bg-green-500/5 shadow-lg shadow-green-500/20'
                    : 'hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10'
                }`}
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{outcome}</h3>
                      {market.resolved && market.winningIndex === idx && (
                        <Badge className="bg-green-500 text-white">Winner</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        <span>{totalValue.toFixed(2)} USDC</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        <span>{totalValue > 0 ? ((totalValue / (totalValue + 1)) * 100).toFixed(1) : 0}% probability</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Activity Feed */}
        <div className="glass-card p-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Users className="w-6 h-6" />
            Recent Activity
          </h2>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground text-center py-8">
              Activity feed coming soon...
            </div>
          </div>
        </div>
      </main>

      {/* Bet Modal */}
      <Dialog open={showBetModal} onOpenChange={setShowBetModal}>
        <DialogContent className="glass-card border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              Place Your Bet
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Select Scenario</Label>
              <RadioGroup value={selectedOutcome} onValueChange={setSelectedOutcome}>
                {market.outcomes.map((outcome, idx) => (
                  <div key={idx} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-primary/5 transition-colors">
                    <RadioGroupItem value={outcome} id={`outcome-${idx}`} />
                    <Label htmlFor={`outcome-${idx}`} className="flex-1 cursor-pointer">
                      {outcome}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label htmlFor="amount" className="text-base font-semibold">Amount (USDC)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="bg-background/50 border-primary/20 focus:border-primary"
              />
            </div>

            <Button
              onClick={handlePlaceBet}
              className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
              disabled={!selectedOutcome || !betAmount}
            >
              Confirm Bet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
