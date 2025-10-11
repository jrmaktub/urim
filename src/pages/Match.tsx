import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount, useChainId } from "wagmi";
import { BrowserProvider, Contract, parseUnits } from "ethers";
import { Trophy, Loader2, Clock, Users, DollarSign } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import UrimMatchBetABI from "@/contracts/UrimMatchBet.json";
import ERC20ABI from "@/contracts/ERC20.json";

const CONTRACT_ADDRESS = "0xe0d1BaC845c45869F14C70b5F06e6EE92d6d4C57";
const PYUSD_ADDRESS = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";

enum BetStatus {
  AWAITING_JOIN = 0,
  READY_TO_RESOLVE = 1,
  RESOLVED = 2
}

const Match = () => {
  const { matchId } = useParams();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [contractStatus, setContractStatus] = useState<BetStatus | null>(null);
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [contractStake, setContractStake] = useState("");
  const [stakeRequired, setStakeRequired] = useState<bigint>(0n);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  
  // Resolution state
  const [player1Sig, setPlayer1Sig] = useState<string | null>(null);
  const [player2Sig, setPlayer2Sig] = useState<string | null>(null);
  const [declaredWinner, setDeclaredWinner] = useState<string | null>(null);
  
  const isCorrectNetwork = chainId === 11155111;
  const matchTime = new Date();
  matchTime.setDate(matchTime.getDate() + 1);
  matchTime.setHours(20, 0, 0, 0);
  const isMatchEnded = new Date() > matchTime;

  const loadContractData = async () => {
    if (!window.ethereum || !isCorrectNetwork) return;

    try {
      const provider = new BrowserProvider(window.ethereum);
      const contract = new Contract(CONTRACT_ADDRESS, UrimMatchBetABI.abi, provider);

      const [status, p1, p2, stake] = await Promise.all([
        contract.status(),
        contract.player1(),
        contract.player2(),
        contract.stake()
      ]);

      setContractStatus(Number(status));
      setPlayer1(p1);
      setPlayer2(p2);
      setStakeRequired(stake);
      setContractStake((Number(stake) / 1e6).toString());
    } catch (error: any) {
      console.error('Error loading contract data:', error);
      if (error.code === 'CALL_EXCEPTION') {
        setContractStatus(BetStatus.AWAITING_JOIN);
      }
    }
  };

  useEffect(() => {
    if (address && isCorrectNetwork) {
      loadContractData();
    }
  }, [address, isCorrectNetwork]);

  const handleConfirmBet = async () => {
    if (!isConnected || !address || !isCorrectNetwork) {
      toast({
        title: "Wallet Error",
        description: "Please connect to Ethereum Sepolia",
        variant: "destructive",
      });
      return;
    }

    if (player2 && address.toLowerCase() !== player2.toLowerCase()) {
      toast({
        title: "Only opponent can join",
        description: `Opponent wallet: ${player2.slice(0, 6)}...${player2.slice(-4)}`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const pyusdContract = new Contract(PYUSD_ADDRESS, ERC20ABI.abi, signer);
      const matchBetContract = new Contract(CONTRACT_ADDRESS, UrimMatchBetABI.abi, signer);

      const amount = stakeRequired;
      const currentAllowance: bigint = await pyusdContract.allowance(address, CONTRACT_ADDRESS);

      if (currentAllowance < amount) {
        toast({
          title: "Processing...",
          description: "Approving PYUSD...",
        });

        const approveTx = await pyusdContract.approve(CONTRACT_ADDRESS, amount);
        await approveTx.wait();
      }

      toast({
        title: "Processing...",
        description: "Confirming bet...",
      });

      const joinTx = await matchBetContract.join();
      await joinTx.wait();
      await loadContractData();

      toast({
        title: "Bet Confirmed!",
        description: "Successfully joined the match bet",
      });
    } catch (error: any) {
      console.error('Confirm bet error:', error);
      toast({
        title: "Failed",
        description: error.message || "Failed to confirm bet",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeclareWinner = async (isPlayerWinner: boolean) => {
    if (!isConnected || !address) return;

    setIsResolving(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const winner = isPlayerWinner ? address : (address === player1 ? player2 : player1);
      const message = `I declare ${winner} as the winner`;
      const signature = await signer.signMessage(message);

      if (address === player1) {
        setPlayer1Sig(signature);
      } else {
        setPlayer2Sig(signature);
      }

      setDeclaredWinner(winner);

      toast({
        title: "Signature Received",
        description: "Waiting for opponent's signature",
      });

      // If both signatures exist, resolve
      if ((player1Sig && address === player2) || (player2Sig && address === player1)) {
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new Contract(CONTRACT_ADDRESS, UrimMatchBetABI.abi, signer);

        const sig1 = address === player1 ? signature : player1Sig!;
        const sig2 = address === player2 ? signature : player2Sig!;

        toast({
          title: "Processing...",
          description: "Settling bet on-chain...",
        });

        const tx = await contract.resolve(sig1, sig2, winner);
        await tx.wait();
        await loadContractData();

        toast({
          title: "Bet Settled!",
          description: `Winner: ${winner.slice(0, 6)}...${winner.slice(-4)}`,
        });
      }
    } catch (error: any) {
      console.error('Declare winner error:', error);
      toast({
        title: "Failed",
        description: error.message || "Failed to sign result",
        variant: "destructive",
      });
    } finally {
      setIsResolving(false);
    }
  };

  const totalPool = contractStake ? (parseFloat(contractStake) * 2).toFixed(2) : "0";
  const isOpponent = address && player2 && address.toLowerCase() === player2.toLowerCase();
  const bothStaked = contractStatus === BetStatus.READY_TO_RESOLVE;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Match Header */}
          <Card className="glass-card border-primary/30 animate-fade-in">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-2xl mb-2">Match #{matchId}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Clock className="w-4 h-4" />
                    <span>{matchTime.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="text-lg font-semibold">{totalPool} PYUSD</span>
                    <span className="text-sm text-muted-foreground">total pool</span>
                  </div>
                </div>
                {bothStaked && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                    Awaiting Result
                  </Badge>
                )}
              </div>
            </CardHeader>
            
            <CardContent>
              {/* Players Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">Player A</p>
                  <p className="font-mono text-sm mb-2">
                    {player1 ? `${player1.slice(0, 6)}...${player1.slice(-4)}` : "Loading..."}
                  </p>
                  {bothStaked ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-xs">
                      Staked
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs">
                      Waiting
                    </Badge>
                  )}
                </div>
                
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">Player B</p>
                  <p className="font-mono text-sm mb-2">
                    {player2 ? `${player2.slice(0, 6)}...${player2.slice(-4)}` : "Loading..."}
                  </p>
                  {bothStaked ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-xs">
                      Staked
                    </Badge>
                  ) : isOpponent ? (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs">
                      Your Turn
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs">
                      Waiting
                    </Badge>
                  )}
                </div>
              </div>

              {/* Join Button for Opponent */}
              {isOpponent && contractStatus === BetStatus.AWAITING_JOIN && (
                <Button
                  onClick={handleConfirmBet}
                  disabled={!isConnected || !isCorrectNetwork || isProcessing}
                  className="w-full mt-6"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Trophy className="w-4 h-4 mr-2" />
                      Confirm Bet
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Post-Match Resolution */}
          {isMatchEnded && bothStaked && contractStatus === BetStatus.READY_TO_RESOLVE && (
            <Card className="glass-card border-primary/30 animate-fade-in">
              <CardHeader>
                <CardTitle className="text-xl">Declare Winner</CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {player1Sig || player2Sig ? (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-sm mb-2">
                      {player1Sig && "Player A signed"}
                      {player1Sig && player2Sig && " • "}
                      {player2Sig && "Player B signed"}
                    </p>
                    {player1Sig && player2Sig ? (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                        Settling...
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                        Waiting for both signatures
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => handleDeclareWinner(true)}
                      disabled={!isConnected || isResolving}
                      variant="outline"
                      className="h-auto py-4 flex-col gap-2"
                    >
                      {isResolving ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Trophy className="w-5 h-5 text-primary" />
                          <span>I won</span>
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={() => handleDeclareWinner(false)}
                      disabled={!isConnected || isResolving}
                      variant="outline"
                      className="h-auto py-4 flex-col gap-2"
                    >
                      {isResolving ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Trophy className="w-5 h-5 text-muted-foreground" />
                          <span>Opponent won</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Settled State */}
          {contractStatus === BetStatus.RESOLVED && (
            <Card className="glass-card border-green-500/30 animate-scale-in">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Bet Settled ✓</h3>
                  <p className="text-muted-foreground">
                    Winner received {totalPool} PYUSD
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
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

export default Match;
