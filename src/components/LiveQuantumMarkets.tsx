import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract, useSwitchChain } from "wagmi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock } from "lucide-react";
import { URIM_QUANTUM_MARKET_ADDRESS, USDC_ADDRESS } from "@/constants/contracts";
import UrimQuantumMarketABI from "@/contracts/UrimQuantumMarket.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { parseUnits, formatUnits } from "viem";
import { BridgeAndExecuteButton } from '@avail-project/nexus-widgets';
import { optimismSepolia, baseSepolia } from 'wagmi/chains';
import { useNotification } from "@blockscout/app-sdk";

type MarketData = {
  marketId: bigint;
  question: string;
  optionA: string;
  optionB: string;
  endTime: bigint;
  outcome: number;
  totalOptionAShares: bigint;
  totalOptionBShares: bigint;
  resolved: boolean;
  cancelled: boolean;
};

export default function LiveQuantumMarkets() {
  const { address, chain } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const { openTxToast } = useNotification();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [betAmounts, setBetAmounts] = useState<Record<string, string>>({});
  const [bettingMarkets, setBettingMarkets] = useState<Record<string, 'yes' | 'no' | null>>({});
  const [bridgeMode, setBridgeMode] = useState<Record<string, boolean>>({});

  // Fetch all market IDs - always from Base Sepolia
  const { data: marketIdsData, refetch: refetchMarketIds } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getAllMarketIds",
    chainId: baseSepolia.id,
  });

  const marketIds = (marketIdsData as bigint[]) || [];

  // Fetch market info for each ID
  useEffect(() => {
    const fetchMarkets = async () => {
      if (!marketIds.length) return;

      const marketPromises = marketIds.map(async (id) => {
        try {
          const response = await fetch(
            `https://base-sepolia.blockscout.com/api/v2/smart-contracts/${URIM_QUANTUM_MARKET_ADDRESS}/methods-read-proxy?method_id=getMarketInfo&args[]=${id}`
          );
          
          // Fallback: use a hook-based approach instead
          return { marketId: id };
        } catch (error) {
          console.error(`Failed to fetch market ${id}:`, error);
          return null;
        }
      });

      const marketData = await Promise.all(marketPromises);
      setMarkets(marketData.filter(Boolean) as any[]);
    };

    fetchMarkets();
  }, [marketIds]);

  const placeBet = async (marketId: bigint, isYes: boolean) => {
    if (!address) {
      toast({ title: "Connect Wallet", description: "Please connect your wallet first.", variant: "destructive" });
      return;
    }

    // Check if on Base Sepolia for direct betting
    if (chain?.id !== baseSepolia.id) {
      toast({ 
        title: "Wrong Network", 
        description: "Please switch to Base Sepolia to place bets directly.", 
        variant: "destructive" 
      });
      return;
    }

    const betAmount = betAmounts[marketId.toString()];
    if (!betAmount || parseFloat(betAmount) <= 0) {
      toast({ title: "Enter amount", description: "Please enter a valid bet amount.", variant: "destructive" });
      return;
    }

    setBettingMarkets(prev => ({ ...prev, [marketId.toString()]: isYes ? 'yes' : 'no' }));

    try {
      const amountWei = parseUnits(betAmount, 6);

      toast({ 
        title: "Step 1: Approving USDC...", 
        description: "Please confirm the approval transaction in your wallet" 
      });

      // Approve USDC
      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_QUANTUM_MARKET_ADDRESS, amountWei],
      } as any);

      toast({ 
        title: "Step 2: Placing bet...", 
        description: `Betting ${betAmount} USDC on ${isYes ? 'YES' : 'NO'}. Confirm the transaction.` 
      });

      // Buy shares - isYes is passed as _isOptionA parameter
      // true = OptionA (Yes), false = OptionB (No)
      const hash = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyShares",
        args: [marketId, isYes, amountWei], // marketId, _isOptionA (boolean), _amount
        gas: BigInt(500_000),
      } as any);

      // Show Blockscout toast
      openTxToast("84532", hash);

      // Clear input and refetch
      setBetAmounts(prev => ({ ...prev, [marketId.toString()]: '' }));
      await refetchMarketIds();
    } catch (error: any) {
      console.error("Bet error:", error);
      
      // Better error parsing
      let errorMsg = "Transaction failed";
      if (error?.shortMessage) {
        errorMsg = error.shortMessage;
      } else if (error?.message) {
        // Extract readable error from message
        if (error.message.includes("user rejected")) {
          errorMsg = "Transaction rejected by user";
        } else if (error.message.includes("insufficient funds")) {
          errorMsg = "Insufficient funds for transaction";
        } else if (error.message.includes("Market trading period has ended")) {
          errorMsg = "Market trading period has ended";
        } else if (error.message.includes("Amount too small")) {
          errorMsg = "Bet amount is too small";
        } else {
          errorMsg = error.message;
        }
      }
      
      const fullError = JSON.stringify(error, null, 2);

      toast({
        title: "❌ Transaction failed",
        description: errorMsg,
        variant: "destructive",
        action: (
          <button
            onClick={() => {
              navigator.clipboard.writeText(fullError);
              toast({ title: "Error copied to clipboard" });
            }}
            className="ml-2 px-3 py-1 text-xs bg-destructive/20 hover:bg-destructive/30 rounded"
          >
            📋 Copy
          </button>
        ),
      });
    } finally {
      setBettingMarkets(prev => ({ ...prev, [marketId.toString()]: null }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">✨ Live Quantum Markets</h2>
      </div>

      <div className="grid gap-4">
        {marketIds.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No live markets yet. Create one in the Quantum Pyth section above!
          </Card>
        ) : (
          marketIds.map((marketId) => (
            <LiveMarketCard
              key={marketId.toString()}
              marketId={marketId}
              betAmount={betAmounts[marketId.toString()] || ''}
              onBetAmountChange={(value) => 
                setBetAmounts(prev => ({ ...prev, [marketId.toString()]: value }))
              }
              onPlaceBet={placeBet}
              bettingStatus={bettingMarkets[marketId.toString()]}
              bridgeMode={bridgeMode[marketId.toString()] || false}
              onBridgeModeToggle={(value) =>
                setBridgeMode(prev => ({ ...prev, [marketId.toString()]: value }))
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function LiveMarketCard({ 
  marketId, 
  betAmount, 
  onBetAmountChange, 
  onPlaceBet,
  bettingStatus,
  bridgeMode,
  onBridgeModeToggle
}: { 
  marketId: bigint;
  betAmount: string;
  onBetAmountChange: (value: string) => void;
  onPlaceBet: (marketId: bigint, isYes: boolean) => void;
  bettingStatus: 'yes' | 'no' | null;
  bridgeMode: boolean;
  onBridgeModeToggle: (value: boolean) => void;
}) {
  const { address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const [bridgeChoice, setBridgeChoice] = useState<'yes' | 'no' | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const isOnOptimismSepolia = chain?.id === optimismSepolia.id;
  const isOnBaseSepolia = chain?.id === baseSepolia.id;
  
  const { data: marketInfo, refetch } = useReadContract({
    address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
    abi: UrimQuantumMarketABI.abi as any,
    functionName: "getMarketInfo",
    args: [marketId],
    chainId: baseSepolia.id,
  });

  // Check USDC allowance on Optimism Sepolia for bridge mode
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: ERC20ABI.abi as any,
    functionName: "allowance",
    args: [address, URIM_QUANTUM_MARKET_ADDRESS],
    chainId: optimismSepolia.id,
    query: {
      enabled: bridgeMode && !!address && isOnOptimismSepolia,
    },
  });

  const currentAllowance = (allowanceData as bigint) || BigInt(0);
  const requiredAllowance = parseUnits("1000", 6); // 1000 USDC
  const isApproved = currentAllowance >= requiredAllowance;

  const handleApprove = async () => {
    if (!address || !isOnOptimismSepolia) return;
    
    setIsApproving(true);
    try {
      toast({ 
        title: "Approving USDC...", 
        description: "Approve 1000 USDC for the contract on Optimism Sepolia" 
      });

      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20ABI.abi as any,
        functionName: "approve",
        args: [URIM_QUANTUM_MARKET_ADDRESS, requiredAllowance],
      } as any);

      toast({ 
        title: "✅ Approved!", 
        description: "You can now use Bridge & Execute" 
      });

      await refetchAllowance();
    } catch (error: any) {
      console.error("Approval error:", error);
      toast({
        title: "❌ Approval failed",
        description: error?.shortMessage || error?.message || "Failed to approve",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (!marketInfo) {
    return (
      <Card className="p-6 border-2 border-primary/20 animate-pulse">
        <div className="h-20 bg-primary/5 rounded" />
      </Card>
    );
  }

  const [question, optionA, optionB, endTime, outcome, totalOptionAShares, totalOptionBShares, resolved, cancelled] = marketInfo as [
    string, string, string, bigint, number, bigint, bigint, boolean, boolean
  ];

  if (cancelled) return null;

  const now = Math.floor(Date.now() / 1000);
  const isActive = !resolved && now < Number(endTime);
  const isResolved = resolved;
  const winningOutcome = outcome; // 0 = OptionA, 1 = OptionB, 2 = Tie

  return (
    <Card className={`p-6 border-2 transition-all ${
      isResolved 
        ? 'border-border/50 bg-muted/50 opacity-75' 
        : 'border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-lg'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xs font-mono text-muted-foreground">
              Market #{marketId.toString()}
            </div>
            {isResolved && <Badge variant="secondary">Resolved</Badge>}
            {!isResolved && isActive && <Badge className="bg-green-500">Active</Badge>}
            {!isResolved && !isActive && <Badge variant="outline">Ended</Badge>}
          </div>
          <div className="text-lg font-semibold mb-2">🧠 {question}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Ends {new Date(Number(endTime) * 1000).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {isResolved && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <div className="text-sm font-semibold text-green-500">
            Market resolved: {winningOutcome === 0 ? optionA : winningOutcome === 1 ? optionB : 'Tie'}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <div className="p-4 rounded-lg border-2 border-primary/20 bg-background/50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <span className="text-lg">🔮</span>
              <span>{optionA || 'YES'}</span>
            </div>
            {isResolved && winningOutcome === 0 && (
              <Badge className="bg-green-500">Winner</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            💰 Total: {formatUnits(totalOptionAShares, 6)} USDC
          </div>
        </div>

        <div className="p-4 rounded-lg border-2 border-primary/20 bg-background/50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <span className="text-lg">🪶</span>
              <span>{optionB || 'NO'}</span>
            </div>
            {isResolved && winningOutcome === 1 && (
              <Badge className="bg-green-500">Winner</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            💰 Total: {formatUnits(totalOptionBShares, 6)} USDC
          </div>
        </div>
      </div>

      {isActive && !isResolved && (
        <>
          {!bridgeMode ? (
            // Mode 1: Normal Betting
            <>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount (USDC)"
                  value={betAmount}
                  onChange={(e) => onBetAmountChange(e.target.value)}
                  className="flex-1 bg-background/50"
                />
                {!isOnBaseSepolia ? (
                  <Button
                    onClick={() => switchChain({ chainId: baseSepolia.id })}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90 whitespace-nowrap"
                  >
                    Switch to Base
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => onPlaceBet(marketId, true)}
                      disabled={bettingStatus === 'yes' || bettingStatus === 'no'}
                      className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90"
                    >
                      {bettingStatus === 'yes' ? "Betting..." : "Bet Yes"}
                    </Button>
                    <Button
                      onClick={() => onPlaceBet(marketId, false)}
                      disabled={bettingStatus === 'yes' || bettingStatus === 'no'}
                      className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90"
                    >
                      {bettingStatus === 'no' ? "Betting..." : "Bet No"}
                    </Button>
                  </>
                )}
              </div>
              
              {/* Compact Bridge Mode Toggle */}
              <div className="mt-3 flex justify-center">
                <Button
                  onClick={() => onBridgeModeToggle(true)}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  🌉 or use Bridge & Execute
                </Button>
              </div>
            </>
          ) : (
            // Mode 2: Bridge Mode - Compact Layout
            <>
              <div className="space-y-2">
                <Input
                  type="number"
                  placeholder="Amount (USDC)"
                  value={betAmount}
                  onChange={(e) => onBetAmountChange(e.target.value)}
                  className="bg-background/50"
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => setBridgeChoice('yes')}
                    variant={bridgeChoice === 'yes' ? 'default' : 'outline'}
                    size="sm"
                  >
                    🔮 Yes
                  </Button>
                  <Button
                    onClick={() => setBridgeChoice('no')}
                    variant={bridgeChoice === 'no' ? 'default' : 'outline'}
                    size="sm"
                  >
                    🪶 No
                  </Button>
                </div>
              </div>

              {/* Avail Widget - Only when choice is made */}
              {bridgeChoice && (
                <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                    <span>🔗 Avail Cross-Chain</span>
                  </div>
                  
                  {!address ? (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      Connect wallet
                    </div>
                  ) : !isOnOptimismSepolia ? (
                    <Button
                      onClick={() => switchChain({ chainId: optimismSepolia.id })}
                      size="sm"
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90"
                    >
                      Switch to OP Sepolia
                    </Button>
                  ) : !isApproved ? (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        Approve 1000 USDC for bridge transactions
                      </div>
                      <Button
                        onClick={handleApprove}
                        disabled={isApproving}
                        size="sm"
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:opacity-90"
                      >
                        {isApproving ? "⏳ Approving..." : "✅ Approve USDC"}
                      </Button>
                    </div>
                  ) : (
                    <BridgeAndExecuteButton
                      contractAddress={URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`}
                      contractAbi={[{
                        name: 'buyShares',
                        type: 'function',
                        stateMutability: 'nonpayable',
                        inputs: [
                          { name: '_marketId', type: 'uint256' },
                          { name: '_isOptionA', type: 'bool' },
                          { name: '_amount', type: 'uint256' }
                        ],
                        outputs: []
                      }] as const}
                      functionName="buyShares"
                      buildFunctionParams={() => ({
                        functionParams: [
                          marketId,
                          bridgeChoice === 'yes',
                          parseUnits(betAmount || '1', 6)
                        ]
                      })}
                      prefill={{
                        toChainId: baseSepolia.id,
                        token: 'USDC',
                        amount: betAmount || '1'
                      }}
                    >
                      {({ onClick, isLoading, disabled }) => (
                        <Button
                          onClick={() => {
                            onClick();
                            toast({ 
                              title: "🌉 Bridging to Base...", 
                              description: `${betAmount || '1'} USDC on ${bridgeChoice === 'yes' ? 'YES' : 'NO'}` 
                            });
                          }}
                          disabled={isLoading || disabled || !betAmount}
                          size="sm"
                          className="w-full bg-gradient-to-r from-primary to-primary-glow hover:opacity-90"
                        >
                          {isLoading ? '⏳ Processing...' : '🔄 Execute'}
                        </Button>
                      )}
                    </BridgeAndExecuteButton>
                  )}
                </div>
              )}
              
              {/* Back button */}
              <div className="mt-2 flex justify-center">
                <Button
                  onClick={() => {
                    onBridgeModeToggle(false);
                    setBridgeChoice(null);
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  ← Back to Normal Betting
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </Card>
  );
}