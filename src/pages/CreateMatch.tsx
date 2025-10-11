import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useChainId } from "wagmi";
import { BrowserProvider, Contract, parseUnits } from "ethers";
import { Swords, Calendar, Users, DollarSign, Loader2, Copy, QrCode, Check } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import UrimMatchBetABI from "@/contracts/UrimMatchBet.json";
import ERC20ABI from "@/contracts/ERC20.json";

const CONTRACT_ADDRESS = "0xe0d1BaC845c45869F14C70b5F06e6EE92d6d4C57";
const PYUSD_ADDRESS = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";

const CreateMatch = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Form state
  const [eventTitle, setEventTitle] = useState("");
  const [matchTime, setMatchTime] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(20, 0, 0, 0);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState("");
  const [player2Address, setPlayer2Address] = useState("");
  const [stakeAmount, setStakeAmount] = useState("");
  const [stakeNow, setStakeNow] = useState(true);
  
  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [matchId, setMatchId] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  
  const isCorrectNetwork = chainId === 11155111;
  
  const validateForm = () => {
    if (!eventTitle.trim()) return "Event title is required";
    if (!player2Address.trim()) return "Player B address is required";
    if (!player2Address.match(/^0x[a-fA-F0-9]{40}$/)) return "Invalid Player B address";
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return "Valid stake amount is required";
    return "";
  };

  const handleCreateMatch = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    if (!isConnected || !address) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to continue",
        variant: "destructive",
      });
      return;
    }

    if (!isCorrectNetwork) {
      toast({
        title: "Wrong Network",
        description: "Please switch to Sepolia network",
        variant: "destructive",
      });
      return;
    }

    setError("");
    setIsProcessing(true);

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const amount = parseUnits(stakeAmount, 6);
      
      // If staking now, approve + join in one flow
      if (stakeNow) {
        const pyusdContract = new Contract(PYUSD_ADDRESS, ERC20ABI.abi, signer);
        const matchBetContract = new Contract(CONTRACT_ADDRESS, UrimMatchBetABI.abi, signer);
        
        // Check allowance
        const currentAllowance = await pyusdContract.allowance(address, CONTRACT_ADDRESS);
        
        // Auto-approve if needed
        if (currentAllowance < amount) {
          toast({
            title: "Processing...",
            description: "Approving PYUSD...",
          });
          
          const approveTx = await pyusdContract.approve(CONTRACT_ADDRESS, amount);
          await approveTx.wait();
        }
        
        // Join the bet
        toast({
          title: "Processing...",
          description: "Creating match and staking...",
        });
        
        const joinTx = await matchBetContract.join();
        await joinTx.wait();
      }
      
      // Generate match ID (simplified - in production use contract event or actual ID)
      const generatedMatchId = `${Date.now()}-${address?.slice(2, 8)}`;
      setMatchId(generatedMatchId);
      setIsSuccess(true);
      
      toast({
        title: "Match Created!",
        description: stakeNow ? "You've staked successfully" : "Share the link with your opponent",
      });
    } catch (error: any) {
      console.error('Create match error:', error);
      toast({
        title: "Failed",
        description: error.message || "Failed to create match",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const inviteLink = `${window.location.origin}/match/${matchId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied!",
      description: "Invite link copied to clipboard",
    });
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        
        <main className="pt-24 pb-16 px-6">
          <div className="max-w-2xl mx-auto">
            <Card className="glass-card border-primary/30 animate-scale-in">
              <CardHeader className="text-center pb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Match Created</CardTitle>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                    Awaiting Opponent Stake
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Invite Link */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Invite Link</label>
                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <p className="font-mono text-xs text-muted-foreground break-all mb-3">
                      {inviteLink}
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleCopyLink}
                        variant="outline"
                        className="flex-1"
                      >
                        {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                        {copied ? "Copied!" : "Copy Link"}
                      </Button>
                      <Button variant="outline" size="icon">
                        <QrCode className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Status Checklist */}
                <div className="space-y-2 p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm">You staked {stakeAmount} PYUSD</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Invite your opponent to join</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Both sign results after the match</p>
                  </div>
                </div>

                <Button 
                  onClick={() => navigate(`/match/${matchId}`)}
                  className="w-full"
                >
                  View Match
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>

        <footer className="relative border-t border-border/50 py-8 px-6">
          <div className="relative max-w-7xl mx-auto text-center">
            <div className="glass-card inline-block px-6 py-2 rounded-full border border-primary/30">
              <span className="text-xs font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Built on Ethereum Sepolia • Powered by Urim
              </span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <Card className="glass-card border-primary/30 animate-fade-in">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Swords className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-2xl">Create 1v1 Match Bet</CardTitle>
              </div>
              <CardDescription>
                Two players stake PYUSD. Winner gets the pool.
              </CardDescription>
              <div className="flex items-center gap-2 mt-4">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                  PYUSD
                </Badge>
                <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30 text-xs">
                  Sepolia
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-8">
              {/* Step A - Event */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">Event Details</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Event Title</label>
                    <Input
                      placeholder="e.g., Ping Pong Championship"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      className="glass-card"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Match Time</label>
                    <Input
                      type="datetime-local"
                      value={matchTime}
                      onChange={(e) => setMatchTime(e.target.value)}
                      className="glass-card"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Notes (optional)</label>
                    <Input
                      placeholder="Any additional details..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="glass-card"
                    />
                  </div>
                </div>
              </div>

              {/* Step B - Players */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">Players</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Player A (You)</p>
                    <p className="font-mono text-sm">
                      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Player B Address</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="0x..."
                        value={player2Address}
                        onChange={(e) => setPlayer2Address(e.target.value)}
                        className="glass-card font-mono text-sm flex-1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={async () => {
                          const text = await navigator.clipboard.readText();
                          setPlayer2Address(text);
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step C - Stake */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">Stake Amount</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Amount (PYUSD)
                      <span className="text-xs text-muted-foreground ml-2">= both stake this amount</span>
                    </label>
                    <Input
                      type="number"
                      placeholder="10"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      className="glass-card"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  
                  {stakeAmount && parseFloat(stakeAmount) > 0 && (
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm text-muted-foreground">Total Pool</p>
                      <p className="text-3xl font-bold text-primary">
                        {(parseFloat(stakeAmount) * 2).toFixed(2)} PYUSD
                      </p>
                    </div>
                  )}
                  
                  <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={stakeNow}
                      onChange={(e) => setStakeNow(e.target.checked)}
                      className="w-4 h-4 rounded border-border bg-background checked:bg-primary"
                    />
                    <span className="text-sm font-medium">Stake now as Player A</span>
                  </label>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* CTA */}
              <Button
                onClick={handleCreateMatch}
                disabled={!isConnected || !isCorrectNetwork || isProcessing}
                className="w-full h-12 text-base"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {stakeNow ? "Create & Stake" : "Create Match"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="relative border-t border-border/50 py-8 px-6">
        <div className="relative max-w-7xl mx-auto text-center">
          <div className="glass-card inline-block px-6 py-2 rounded-full border border-primary/30">
            <span className="text-xs font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Built on Ethereum Sepolia • Powered by Urim
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CreateMatch;
