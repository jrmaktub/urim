import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, Zap, RefreshCw } from "lucide-react";
import { URIM_QUANTUM_MARKET_ADDRESS, USDC_ADDRESS } from "@/constants/contracts";
import UrimQuantumMarketABI from "@/contracts/UrimQuantumMarket.json";
import ERC20ABI from "@/contracts/ERC20.json";
import { parseUnits, formatUnits } from "viem";
// import { BridgeAndExecuteButton } from '@avail-project/nexus-widgets';
import { optimismSepolia, baseSepolia } from 'wagmi/chains';
import { useNotification } from "@blockscout/app-sdk";
import { cn } from "@/lib/utils";
import { EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";

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

type MarketUIState = {
  selected?: 'A' | 'B';
  amount?: string;
  pending?: boolean;
};

export default function LiveQuantumMarkets() {
  const { address, chain } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const { openTxToast } = useNotification();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [ui, setUi] = useState<Record<number, MarketUIState>>({});
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

  const setSelected = (id: number, val: 'A' | 'B') => 
    setUi(prev => ({ ...prev, [id]: { ...prev[id], selected: val }}));
  
  const setAmount = (id: number, val: string) => 
    setUi(prev => ({ ...prev, [id]: { ...prev[id], amount: val }}));
  
  const setPending = (id: number, val: boolean) => 
    setUi(prev => ({ ...prev, [id]: { ...prev[id], pending: val }}));

  const showErrorWithCopy = (title: string, body: string) => {
    toast({
      title: `❌ ${title}`,
      description: (
        <div className="space-y-2">
          <div className="text-sm">{body}</div>
          <button
            className="text-xs underline opacity-80 hover:opacity-100"
            onClick={() => {
              navigator.clipboard.writeText(body);
              toast({ title: "Error copied to clipboard" });
            }}
          >
            📋 Copy error
          </button>
        </div>
      ),
      variant: "destructive",
      duration: 9000,
    });
  };

  const handleBet = async (marketId: number, isOptionA: boolean) => {
    if (!address) {
      toast({ title: "Connect Wallet", description: "Please connect your wallet first.", variant: "destructive" });
      return;
    }

    if (chain?.id !== baseSepolia.id) {
      toast({ 
        title: "Wrong Network", 
        description: "Please switch to Base Sepolia to place bets.", 
        variant: "destructive" 
      });
      return;
    }

    const amountStr = ui[marketId]?.amount ?? "";
    if (!amountStr || parseFloat(amountStr) <= 0) {
      toast({ title: "Enter amount", description: "Please enter a valid bet amount.", variant: "destructive" });
      return;
    }

    setPending(marketId, true);

    try {
      const amount = parseUnits(amountStr, 6);

      // Check allowance
      const allowanceResult = await fetch(
        `https://base-sepolia.blockscout.com/api/v2/smart-contracts/${USDC_ADDRESS}/methods-read?is_custom_abi=false&method_id=allowance&args[]=${address}&args[]=${URIM_QUANTUM_MARKET_ADDRESS}`
      ).then(r => r.json());
      
      const currentAllowance = BigInt(allowanceResult?.result?.output?.[0]?.value || 0);

      // Approve if needed
      if (currentAllowance < amount) {
        toast({ 
          title: "Step 1: Approving USDC...", 
          description: "Please confirm the approval transaction" 
        });

        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS as `0x${string}`,
          abi: ERC20ABI.abi as any,
          functionName: "approve",
          args: [URIM_QUANTUM_MARKET_ADDRESS, amount],
        } as any);

        // Wait for approval
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      toast({ 
        title: "Step 2: Placing bet...", 
        description: `Betting ${amountStr} USDC on ${isOptionA ? 'YES' : 'NO'}` 
      });

      // Place bet
      const hash = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "buyShares",
        args: [BigInt(marketId), isOptionA, amount],
        gas: BigInt(500_000),
      } as any);

      openTxToast("84532", hash);

      toast({ title: "✅ Bet placed!", description: "Transaction submitted successfully" });
      
      setAmount(marketId, "");
      await refetchMarketIds();
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || "Transaction failed";
      showErrorWithCopy("Bet failed", msg);
    } finally {
      setPending(marketId, false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">✨ Live Quantum Pyth Markets</h2>
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
              uiState={ui[Number(marketId)] || {}}
              onSetSelected={(val) => setSelected(Number(marketId), val)}
              onSetAmount={(val) => setAmount(Number(marketId), val)}
              onHandleBet={handleBet}
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
  uiState,
  onSetSelected,
  onSetAmount,
  onHandleBet,
  bridgeMode,
  onBridgeModeToggle
}: { 
  marketId: bigint;
  uiState: MarketUIState;
  onSetSelected: (val: 'A' | 'B') => void;
  onSetAmount: (val: string) => void;
  onHandleBet: (marketId: number, isOptionA: boolean) => void;
  bridgeMode: boolean;
  onBridgeModeToggle: (value: boolean) => void;
}) {
  const { address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const { openTxToast } = useNotification();
  const [bridgeChoice, setBridgeChoice] = useState<'yes' | 'no' | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

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

  const handleResolveMarket = async (priceFeedId: string) => {
    if (!address) {
      toast({ title: "Connect Wallet", description: "Please connect your wallet first.", variant: "destructive" });
      return;
    }

    if (chain?.id !== baseSepolia.id) {
      toast({ 
        title: "Wrong Network", 
        description: "Please switch to Base Sepolia to resolve markets.", 
        variant: "destructive" 
      });
      return;
    }

    setIsResolving(true);

    try {
      toast({ title: "🔮 Fetching Pyth price data...", description: "Getting latest price feed" });

      // Initialize Pyth connection
      const connection = new EvmPriceServiceConnection("https://hermes.pyth.network");
      
      // Get price update data from Pyth
      const priceIds = [priceFeedId as `0x${string}`];
      const priceUpdateData = await connection.getPriceFeedsUpdateData(priceIds);
      
      console.log("Price update data:", priceUpdateData);

      // Estimate the fee (usually around 0.0001 ETH on testnets)
      const fee = BigInt("100000000000000"); // 0.0001 ETH

      toast({ title: "⚡ Resolving market...", description: "Submitting resolution transaction" });

      // Call resolveMarket with price update data and ETH for fee
      const hash = await writeContractAsync({
        address: URIM_QUANTUM_MARKET_ADDRESS as `0x${string}`,
        abi: UrimQuantumMarketABI.abi as any,
        functionName: "resolveMarket",
        args: [marketId, priceUpdateData],
        value: fee,
        gas: BigInt(1_000_000),
      } as any);

      openTxToast("84532", hash);
      console.log("Resolve transaction sent:", hash);

      toast({ 
        title: "✅ Market resolved!", 
        description: "The outcome has been determined using Pyth oracle data" 
      });
      
      // Wait and refetch market info
      setTimeout(() => {
        refetch();
      }, 3000);

    } catch (error: any) {
      console.error("Resolve error:", error);
      const errorMsg = error?.shortMessage || error?.message || "Failed to resolve market";
      
      toast({
        title: "❌ Resolution failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsResolving(false);
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

  const [question, optionA, optionB, endTime, outcome, totalOptionAShares, totalOptionBShares, resolved, cancelled, priceFeedId, targetPrice] = marketInfo as [
    string, string, string, bigint, number, bigint, bigint, boolean, boolean, string, bigint
  ];

  if (cancelled) return null;

  const now = Math.floor(Date.now() / 1000);
  const isActive = !resolved && now < Number(endTime);
  const isResolved = resolved;
  const isEnded = !resolved && now >= Number(endTime);
  const winningOutcome = outcome; // 0 = UNRESOLVED, 1 = OPTION_A, 2 = OPTION_B
  
  // Check if market can be resolved
  const canResolve = isEnded && !resolved && !cancelled && priceFeedId && priceFeedId !== "0x0000000000000000000000000000000000000000000000000000000000000000";

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
            ✅ Market resolved: {winningOutcome === 1 ? optionA : winningOutcome === 2 ? optionB : 'Unresolved'}
          </div>
        </div>
      )}

      <div role="radiogroup" className="grid md:grid-cols-2 gap-3 mb-4">
        {/* Option A - Yes */}
        <div
          role="radio"
          aria-checked={uiState.selected === 'A'}
          tabIndex={0}
          onClick={() => !isResolved && onSetSelected('A')}
          onKeyDown={(e) => {
            if (!isResolved && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onSetSelected('A');
            }
          }}
          className={cn(
            "min-h-[56px] p-4 rounded-xl border-2 transition-all pointer-events-auto cursor-pointer",
            isResolved 
              ? "border-primary/20 bg-background/50"
              : uiState.selected === 'A' 
                ? "ring-2 ring-primary/70 bg-white/5 border-primary/40" 
                : "border-primary/20 bg-background/50 hover:bg-white/3 hover:border-primary/30"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <span className="text-lg">🔮</span>
              <span>{optionA || 'YES'}</span>
            </div>
            {isResolved && winningOutcome === 1 && (
              <Badge className="bg-green-500">Winner</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            💰 Total: {formatUnits(totalOptionAShares, 6)} USDC
          </div>
        </div>

        {/* Option B - No */}
        <div
          role="radio"
          aria-checked={uiState.selected === 'B'}
          tabIndex={0}
          onClick={() => !isResolved && onSetSelected('B')}
          onKeyDown={(e) => {
            if (!isResolved && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onSetSelected('B');
            }
          }}
          className={cn(
            "min-h-[56px] p-4 rounded-xl border-2 transition-all pointer-events-auto cursor-pointer",
            isResolved 
              ? "border-primary/20 bg-background/50"
              : uiState.selected === 'B' 
                ? "ring-2 ring-primary/70 bg-white/5 border-primary/40" 
                : "border-primary/20 bg-background/50 hover:bg-white/3 hover:border-primary/30"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <span className="text-lg">🪶</span>
              <span>{optionB || 'NO'}</span>
            </div>
            {isResolved && winningOutcome === 2 && (
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
              <div className="space-y-3">
                <Input
                  inputMode="decimal"
                  placeholder="Amount (USDC)"
                  value={uiState.amount ?? ""}
                  onChange={(e) => onSetAmount(e.target.value)}
                  className={cn(
                    "w-full py-3 bg-background/50",
                    uiState.selected ? "opacity-100" : "opacity-60"
                  )}
                />
                
                {!isOnBaseSepolia ? (
                  <Button
                    onClick={() => switchChain({ chainId: baseSepolia.id })}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90"
                  >
                    Switch to Base Sepolia
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      disabled={uiState.pending}
                      onClick={() => onHandleBet(Number(marketId), true)}
                      className="min-h-[48px] bg-gradient-to-r from-primary to-primary-glow hover:opacity-90"
                    >
                      {uiState.pending ? "⏳ Processing..." : "Bet Yes"}
                    </Button>
                    <Button
                      disabled={uiState.pending}
                      onClick={() => onHandleBet(Number(marketId), false)}
                      className="min-h-[48px] bg-gradient-to-r from-primary to-primary-glow hover:opacity-90"
                    >
                      {uiState.pending ? "⏳ Processing..." : "Bet No"}
                    </Button>
                  </div>
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
                  inputMode="decimal"
                  placeholder="Amount (USDC)"
                  value={uiState.amount ?? ""}
                  onChange={(e) => onSetAmount(e.target.value)}
                  className="bg-background/50"
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => setBridgeChoice('yes')}
                    variant={bridgeChoice === 'yes' ? 'default' : 'outline'}
                    size="sm"
                    className="min-h-[48px]"
                  >
                    🔮 Yes
                  </Button>
                  <Button
                    onClick={() => setBridgeChoice('no')}
                    variant={bridgeChoice === 'no' ? 'default' : 'outline'}
                    size="sm"
                    className="min-h-[48px]"
                  >
                    🪶 No
                  </Button>
                </div>
              </div>

              {/* Cross-Chain Widget - Temporarily disabled */}
              {bridgeChoice && (
                <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/30">
                  <div className="text-xs text-muted-foreground mb-2 text-center">
                    <span>Cross-chain bridging temporarily unavailable</span>
                  </div>
                  <Button
                    onClick={() => {
                      onBridgeModeToggle(false);
                      setBridgeChoice(null);
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    Use Regular Betting Instead
                  </Button>
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

      {/* Resolve Market Button - Show when market has ended but not resolved */}
      {canResolve && (
        <div className="mt-6 pt-4 border-t border-border/50">
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 mb-3">
            <div className="text-sm font-semibold text-blue-400 mb-1">
              ⏰ Market has ended
            </div>
            <div className="text-xs text-muted-foreground">
              This market can now be resolved using Pyth oracle. Anyone can trigger resolution.
            </div>
          </div>

          {!isOnBaseSepolia ? (
            <Button
              onClick={() => switchChain({ chainId: baseSepolia.id })}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90"
            >
              Switch to Base Sepolia to Resolve
            </Button>
          ) : (
            <Button
              onClick={() => handleResolveMarket(priceFeedId)}
              disabled={isResolving}
              className="w-full min-h-[52px] bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90 font-semibold"
            >
              {isResolving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Resolving Market...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Resolve Market with Pyth Oracle
                </>
              )}
            </Button>
          )}
          
          {priceFeedId && targetPrice && (
            <div className="mt-3 p-2 rounded bg-muted/30 text-xs text-muted-foreground">
              <div className="font-mono">Target: ${(Number(targetPrice) / 1e8).toFixed(2)}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}