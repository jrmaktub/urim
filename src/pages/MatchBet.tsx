import { useState } from "react";
import { Swords, Upload, Trophy, AlertCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useArbitrumWallet } from "@/hooks/useArbitrumWallet";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const MatchBet = () => {
  const { address, balance, isConnecting, isCorrectNetwork, connect, switchToArbitrumSepolia } = useArbitrumWallet();
  const { toast } = useToast();
  
  const [opponentAddress, setOpponentAddress] = useState("");
  const [stakeAmount, setStakeAmount] = useState("");
  const [betStatus, setBetStatus] = useState<"none" | "awaiting" | "ready" | "resolved">("none");
  const [sig1, setSig1] = useState("");
  const [sig2, setSig2] = useState("");
  const [winnerAddress, setWinnerAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [resolvedWinner, setResolvedWinner] = useState("");

  const handleCreateBet = async () => {
    if (!address || !isCorrectNetwork) {
      toast({
        title: "Wallet Error",
        description: "Please connect to Arbitrum Sepolia",
        variant: "destructive",
      });
      return;
    }

    if (!opponentAddress || !stakeAmount) {
      toast({
        title: "Missing Information",
        description: "Please provide opponent address and stake amount",
        variant: "destructive",
      });
      return;
    }

    // Mock contract deployment
    toast({
      title: "Creating Bet",
      description: "Deploying MatchBet contract...",
    });

    setTimeout(() => {
      setBetStatus("awaiting");
      setTxHash("0x" + Math.random().toString(16).slice(2, 66));
      toast({
        title: "Bet Created",
        description: `Contract deployed. Waiting for ${opponentAddress.slice(0, 6)}... to join.`,
      });
    }, 2000);
  };

  const handleJoinBet = async () => {
    toast({
      title: "Joining Bet",
      description: "Sending matching stake...",
    });

    setTimeout(() => {
      setBetStatus("ready");
      toast({
        title: "Bet Joined",
        description: "Both players staked. Ready to resolve.",
      });
    }, 2000);
  };

  const handleResolve = async () => {
    if (!sig1 || !sig2 || !winnerAddress) {
      toast({
        title: "Missing Data",
        description: "Please provide both signatures and winner address",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Resolving Bet",
      description: "Verifying signatures and transferring funds...",
    });

    setTimeout(() => {
      setBetStatus("resolved");
      setResolvedWinner(winnerAddress);
      setTxHash("0x" + Math.random().toString(16).slice(2, 66));
      toast({
        title: "Bet Resolved",
        description: `Winner: ${winnerAddress.slice(0, 6)}...${winnerAddress.slice(-4)}`,
      });
    }, 2000);
  };

  const getStatusBadge = () => {
    switch (betStatus) {
      case "awaiting":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Awaiting Join</Badge>;
      case "ready":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">Ready to Resolve</Badge>;
      case "resolved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">Resolved</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Settle Real Matches, On-Chain.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Two players stake, both sign, the chain decides.
            </p>
            
            {/* Wallet Connection */}
            <div className="flex justify-center mt-6">
              {!address ? (
                <Button 
                  onClick={connect}
                  disabled={isConnecting}
                  size="lg"
                  className="rounded-full"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </Button>
              ) : !isCorrectNetwork ? (
                <Button 
                  onClick={switchToArbitrumSepolia}
                  variant="outline"
                  size="lg"
                  className="rounded-full border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Switch to Arbitrum Sepolia
                </Button>
              ) : (
                <div className="glass-card px-6 py-3 rounded-full border border-primary/30">
                  <div className="text-sm">
                    <div className="font-medium">{balance} ETH</div>
                    <div className="text-xs text-muted-foreground">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Bet Interface */}
          <Card className="glass-card border-primary/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Swords className="w-6 h-6 text-primary" />
                  <CardTitle>1v1 Match Bet</CardTitle>
                </div>
                {getStatusBadge()}
              </div>
              <CardDescription>
                Create a match bet with wallet signature oracle resolution
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {betStatus === "none" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Opponent Address</label>
                    <Input
                      placeholder="0x..."
                      value={opponentAddress}
                      onChange={(e) => setOpponentAddress(e.target.value)}
                      className="glass-card"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Stake Amount (ETH)</label>
                    <Input
                      type="number"
                      placeholder="0.01"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      className="glass-card"
                    />
                  </div>
                  
                  <Button 
                    onClick={handleCreateBet}
                    disabled={!address || !isCorrectNetwork}
                    className="w-full"
                    size="lg"
                  >
                    <Swords className="w-4 h-4 mr-2" />
                    Create Bet
                  </Button>
                </div>
              )}

              {betStatus === "awaiting" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm text-muted-foreground mb-2">Opponent:</p>
                    <p className="font-mono text-sm">{opponentAddress}</p>
                    <p className="text-sm text-muted-foreground mt-3 mb-2">Stake:</p>
                    <p className="font-semibold">{stakeAmount} ETH</p>
                  </div>
                  
                  <Button 
                    onClick={handleJoinBet}
                    className="w-full"
                    size="lg"
                  >
                    Join Bet
                  </Button>
                </div>
              )}

              {betStatus === "ready" && (
                <div className="space-y-4">
                  <div className="grid gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Player 1 Signature
                      </label>
                      <Input
                        placeholder="0x..."
                        value={sig1}
                        onChange={(e) => setSig1(e.target.value)}
                        className="glass-card font-mono text-xs"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Player 2 Signature
                      </label>
                      <Input
                        placeholder="0x..."
                        value={sig2}
                        onChange={(e) => setSig2(e.target.value)}
                        className="glass-card font-mono text-xs"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                        <Trophy className="w-4 h-4" />
                        Winner Address
                      </label>
                      <Input
                        placeholder="0x..."
                        value={winnerAddress}
                        onChange={(e) => setWinnerAddress(e.target.value)}
                        className="glass-card"
                      />
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleResolve}
                    className="w-full"
                    size="lg"
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Resolve
                  </Button>
                </div>
              )}

              {betStatus === "resolved" && (
                <div className="space-y-4">
                  <div className="p-6 rounded-lg bg-gradient-to-br from-green-500/10 to-primary/10 border border-green-500/30 text-center">
                    <Trophy className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Bet Resolved!</h3>
                    <p className="text-muted-foreground mb-4">Winner</p>
                    <p className="font-mono text-sm bg-background/50 p-3 rounded">
                      {resolvedWinner}
                    </p>
                    <p className="text-sm text-muted-foreground mt-4">Transaction Hash</p>
                    <a 
                      href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-primary hover:underline block mt-2"
                    >
                      {txHash}
                    </a>
                  </div>
                  
                  <Button 
                    onClick={() => {
                      setBetStatus("none");
                      setOpponentAddress("");
                      setStakeAmount("");
                      setSig1("");
                      setSig2("");
                      setWinnerAddress("");
                      setResolvedWinner("");
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Create New Bet
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MatchBet;
