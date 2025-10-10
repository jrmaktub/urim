import { useState, useEffect } from "react";
import { Swords, Upload, Trophy, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import { BrowserProvider, Contract, parseUnits } from "ethers";
import { useAccount, useChainId } from 'wagmi';
import UrimMatchBetABI from "@/contracts/UrimMatchBet.json";
import ERC20ABI from "@/contracts/ERC20.json";

const CONTRACT_ADDRESS = "0xe0d1BaC845c45869F14C70b5F06e6EE92d6d4C57";
const PYUSD_ADDRESS = "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8";

enum BetStatus {
  AWAITING_JOIN = 0,
  READY_TO_RESOLVE = 1,
  RESOLVED = 2
}

const MatchBet = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isCorrectNetwork = chainId === 11155111; // Sepolia chain ID
  const { toast } = useToast();
  
  const [stakeAmount, setStakeAmount] = useState("");
  const [contractStatus, setContractStatus] = useState<BetStatus | null>(null);
  const [sig1, setSig1] = useState("");
  const [sig2, setSig2] = useState("");
  const [winnerAddress, setWinnerAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [contractStake, setContractStake] = useState("");
  const [stakeRequired, setStakeRequired] = useState<bigint>(0n);
  const [allowanceEnough, setAllowanceEnough] = useState(false);

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
      setContractStake(parseFloat(formatUnits(stake, 6)).toString());
    } catch (error: any) {
      console.error('Error loading contract data:', error);
      // Set default state if contract isn't initialized yet
      if (error.code === 'CALL_EXCEPTION') {
        setContractStatus(BetStatus.AWAITING_JOIN);
      }
    }
  };

  const checkAllowance = async () => {
    if (!window.ethereum || !isCorrectNetwork || !address) return;
    try {
      const provider = new BrowserProvider(window.ethereum);
      const pyusd = new Contract(PYUSD_ADDRESS, ERC20ABI.abi, provider);
      const current: bigint = await pyusd.allowance(address, CONTRACT_ADDRESS);
      const required: bigint = (stakeAmount && parseFloat(stakeAmount) > 0)
        ? parseUnits(stakeAmount, 6)
        : stakeRequired;
      setAllowanceEnough(required > 0n && current >= required);
    } catch (e) {
      console.error('Allowance check error:', e);
    }
  };

  useEffect(() => {
    if (address && isCorrectNetwork) {
      loadContractData();
    } else if (address) {
      // Even if wrong network, show default state
      setContractStatus(BetStatus.AWAITING_JOIN);
    }
  }, [address, isCorrectNetwork]);

  useEffect(() => {
    if (address && isCorrectNetwork) {
      checkAllowance();
    } else {
      setAllowanceEnough(false);
    }
  }, [address, isCorrectNetwork, stakeAmount, stakeRequired]);

  const handleApprove = async () => {
    if (!isConnected || !address || !isCorrectNetwork) {
      toast({
        title: "Wallet Error",
        description: "Please connect to Ethereum Sepolia",
        variant: "destructive",
      });
      return;
    }


    setIsApproving(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const pyusdContract = new Contract(PYUSD_ADDRESS, ERC20ABI.abi, signer);

      const amount = (stakeAmount && parseFloat(stakeAmount) > 0)
        ? parseUnits(stakeAmount, 6)
        : stakeRequired;
      const tx = await pyusdContract.approve(CONTRACT_ADDRESS, amount);

      toast({
        title: "Approving PYUSD",
        description: "Transaction submitted...",
      });

      await tx.wait();
      setAllowanceEnough(true);

      // Automatically proceed to Join step if this wallet is the opponent
      if (address && player2 && address.toLowerCase() === player2.toLowerCase()) {
        await handleJoinBet();
      }
      
      toast({
        title: "Approved!",
        description: `Successfully approved ${stakeAmount || parseFloat(formatUnits(stakeRequired, 6)).toString()} PYUSD`,
      });
    } catch (error: any) {
      console.error('Approval error:', error);
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve PYUSD",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleJoinBet = async () => {
    if (!isConnected || !address || !isCorrectNetwork) {
      toast({
        title: "Wallet Error",
        description: "Please connect to Ethereum Sepolia",
        variant: "destructive",
      });
      return;
    }

    // Ensure only the designated opponent can join
    if (player2 && address.toLowerCase() !== player2.toLowerCase()) {
      toast({
        title: "Only opponent can join",
        description: `Opponent wallet: ${player2.slice(0, 6)}...${player2.slice(-4)}`,
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, UrimMatchBetABI.abi, signer);

      const tx = await contract.join();
      setTxHash(tx.hash);

      toast({
        title: "Joining Bet",
        description: "Transaction submitted...",
      });

      await tx.wait();
      await loadContractData();

      toast({
        title: "Joined!",
        description: "Successfully joined the bet",
      });
    } catch (error: any) {
      console.error('Join error:', error);
      toast({
        title: "Join Failed",
        description: error.message || "Failed to join bet",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
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

    setIsResolving(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, UrimMatchBetABI.abi, signer);

      const tx = await contract.resolve(sig1, sig2, winnerAddress);
      setTxHash(tx.hash);

      toast({
        title: "Resolving Bet",
        description: "Verifying signatures and transferring funds...",
      });

      await tx.wait();
      await loadContractData();

      toast({
        title: "Bet Resolved",
        description: `Winner: ${winnerAddress.slice(0, 6)}...${winnerAddress.slice(-4)}`,
      });
    } catch (error: any) {
      console.error('Resolve error:', error);
      toast({
        title: "Resolution Failed",
        description: error.message || "Failed to resolve bet",
        variant: "destructive",
      });
    } finally {
      setIsResolving(false);
    }
  };

  const getStatusBadge = () => {
    if (contractStatus === null) return null;
    
    switch (contractStatus) {
      case BetStatus.AWAITING_JOIN:
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Awaiting Join</Badge>;
      case BetStatus.READY_TO_RESOLVE:
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">Ready to Resolve</Badge>;
      case BetStatus.RESOLVED:
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">Resolved</Badge>;
      default:
        return null;
    }
  };

  const formatUnits = (value: bigint, decimals: number) => {
    const str = value.toString();
    const len = str.length;
    if (len <= decimals) {
      return '0.' + '0'.repeat(decimals - len) + str;
    }
    return str.slice(0, len - decimals) + '.' + str.slice(len - decimals);
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
              {/* Contract Info - Only show if we have loaded data */}
              {contractStatus !== null && player1 && player2 && (
                <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-2 animate-fade-in">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Player 1:</p>
                      <p className="font-mono text-xs">{player1.slice(0, 6)}...{player1.slice(-4)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Player 2:</p>
                      <p className="font-mono text-xs">{player2.slice(0, 6)}...{player2.slice(-4)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Stake:</p>
                    <p className="font-semibold">{contractStake} PYUSD</p>
                  </div>
                </div>
              )}

              {/* Always show UI based on status, default to AWAITING_JOIN */}
              {(contractStatus === BetStatus.AWAITING_JOIN || contractStatus === null) && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Stake Amount (PYUSD)</label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      className="glass-card"
                    />
                  </div>
                  
                  {!allowanceEnough && (
                    <Button 
                      onClick={handleApprove}
                      disabled={!address || !isCorrectNetwork || isApproving}
                      className="w-full"
                      size="lg"
                    >
                      {isApproving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <Wallet className="w-4 h-4 mr-2" />
                          Approve PYUSD
                        </>
                      )}
                    </Button>
                  )}

                  <Button 
                    onClick={handleJoinBet}
                    disabled={!address || !isCorrectNetwork || isJoining}
                    className="w-full"
                    size="lg"
                    variant="outline"
                  >
                    {isJoining ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        <Swords className="w-4 h-4 mr-2" />
                        Join Bet
                      </>
                    )}
                  </Button>
                </div>
              )}

              {contractStatus === BetStatus.READY_TO_RESOLVE && (
                <div className="space-y-4 animate-fade-in">
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
                    disabled={!address || !isCorrectNetwork || isResolving}
                    className="w-full"
                    size="lg"
                  >
                    {isResolving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Resolving...
                      </>
                    ) : (
                      <>
                        <Trophy className="w-4 h-4 mr-2" />
                        Resolve
                      </>
                    )}
                  </Button>
                </div>
              )}

              {contractStatus === BetStatus.RESOLVED && txHash && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-6 rounded-lg bg-gradient-to-br from-green-500/10 to-primary/10 border border-green-500/30 text-center animate-scale-in">
                    <Trophy className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Bet Resolved!</h3>
                    <p className="text-muted-foreground mb-4">Winner</p>
                    <p className="font-mono text-sm bg-background/50 p-3 rounded">
                      {winnerAddress || "View on explorer"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-4">Transaction Hash</p>
                    <a 
                      href={`https://sepolia.etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-primary hover:underline block mt-2"
                    >
                      {txHash}
                    </a>
                  </div>
                  
                  <Button 
                    onClick={() => {
                      setStakeAmount("");
                      setSig1("");
                      setSig2("");
                      setWinnerAddress("");
                      setTxHash("");
                      loadContractData();
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Refresh Status
                  </Button>
                </div>
              )}

              {/* No wallet connected state */}
              {!address && (
                <div className="p-6 rounded-lg bg-muted/30 border border-border text-center animate-fade-in">
                  <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect your wallet to start creating or joining match bets
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="relative border-t border-border/50 py-12 px-6">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
        <div className="relative max-w-7xl mx-auto text-center">
          <div className="glass-card inline-block px-6 py-3 rounded-full border border-primary/30 mb-6">
            <span className="text-sm font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Built on Ethereum Sepolia • Powered by Urim Quantum Markets
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Contract: <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">{CONTRACT_ADDRESS}</a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default MatchBet;
