import { useState } from "react";
import { parseSolanaError } from "@/components/CopyableErrorToast";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSolanaWallet } from "@/hooks/useSolanaWallet";
import { useMineralFutures, type MarketData, type PositionData } from "@/hooks/useMineralFutures";
import {
  COMMODITIES,
  COMMODITY_ICONS,
  MARKET_PDAS,
  type CommodityName,
} from "@/constants/mineralFutures";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Wallet, RefreshCw, Shield, Loader2 } from "lucide-react";
import { toast, Toaster } from "sonner";
import MineralPriceChart from "@/components/MineralPriceChart";

const LAMPORTS_PER_SOL = 1_000_000_000;

function formatPrice(price: number): string {
  return `$${price.toLocaleString()}`;
}

function formatSol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function getCommodityForMarket(marketPubkey: string): CommodityName | null {
  for (const [name, pda] of Object.entries(MARKET_PDAS)) {
    if (pda === marketPubkey) return name as CommodityName;
  }
  return null;
}

export default function MineralFutures() {
  const { connected, publicKey, provider, connect, disconnect, isPhantomInstalled } = useSolanaWallet();
  const {
    markets,
    positions,
    solBalance,
    urimBalance,
    hasUrimDiscount,
    loading,
    refresh,
    openPosition,
    closePosition,
  } = useMineralFutures(publicKey);

  const [selectedMarket, setSelectedMarket] = useState<CommodityName>("ANTIMONY");
  const [direction, setDirection] = useState<0 | 1>(0); // 0=Long, 1=Short
  const [solAmount, setSolAmount] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [closingPosition, setClosingPosition] = useState<string | null>(null);

  const currentMarket = markets[selectedMarket] || null;
  const feeRate = hasUrimDiscount ? 0.00045 : 0.0005;
  const feeLabel = hasUrimDiscount ? "0.045% ✓ URIM" : "0.05%";

  const handlePlaceOrder = async () => {
    if (!provider || !publicKey) {
      toast.error("Connect your Phantom wallet first");
      return;
    }
    const amount = parseFloat(solAmount);
    if (isNaN(amount) || amount < 0.01) {
      toast.error("Minimum order is 0.01 SOL");
      return;
    }
    if (amount > solBalance) {
      toast.error("Insufficient SOL balance");
      return;
    }

    setPlacingOrder(true);
    try {
      const lamports = Math.round(amount * LAMPORTS_PER_SOL);
      const tx = await openPosition(provider, selectedMarket, direction, lamports);
      toast.success(`Position opened! TX: ${tx.slice(0, 8)}...`);
      setSolAmount("");
    } catch (e: any) {
      const { userMessage, fullError } = parseSolanaError(e);
      toast.error(userMessage, {
        description: fullError.length > 100 ? fullError.slice(0, 100) + "..." : undefined,
        action: {
          label: "Copy",
          onClick: () => navigator.clipboard.writeText(fullError),
        },
      });
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleClosePosition = async (pos: PositionData) => {
    if (!provider) return;
    setClosingPosition(pos.publicKey);
    try {
      const tx = await closePosition(provider, pos);
      toast.success(`Position closed! TX: ${tx.slice(0, 8)}...`);
    } catch (e: any) {
      const { userMessage, fullError } = parseSolanaError(e);
      toast.error(userMessage, {
        description: fullError.length > 100 ? fullError.slice(0, 100) + "..." : undefined,
        action: {
          label: "Copy",
          onClick: () => navigator.clipboard.writeText(fullError),
        },
      });
    } finally {
      setClosingPosition(null);
    }
  };

  const computePnl = (pos: PositionData): { pnl: number; pnlPercent: number } => {
    const commodity = getCommodityForMarket(pos.market);
    const mkt = commodity ? markets[commodity] : null;
    if (!mkt || pos.entryPrice === 0) return { pnl: 0, pnlPercent: 0 };
    const pnlPercent =
      pos.direction === 0
        ? (mkt.markPrice - pos.entryPrice) / pos.entryPrice
        : (pos.entryPrice - mkt.markPrice) / pos.entryPrice;
    const pnl = pnlPercent * pos.collateral;
    return { pnl, pnlPercent };
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-20 pb-12 px-3 sm:px-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Mineral Futures
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Perpetual futures on strategic minerals — Solana Devnet
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {connected ? (
              <Button variant="outline" onClick={disconnect} className="text-xs">
                <Wallet className="w-3 h-3 mr-1" /> {truncateAddress(publicKey!)}
              </Button>
            ) : (
              <Button onClick={connect}>
                <Wallet className="w-4 h-4 mr-2" />
                {isPhantomInstalled ? "Connect Phantom" : "Install Phantom"}
              </Button>
            )}
          </div>
        </div>

        {/* Price Chart */}
        {currentMarket && (
          <Card className="border-border/50 bg-[hsl(240,10%,8%)] mb-4">
            <CardContent className="p-4">
              <MineralPriceChart commodity={selectedMarket} currentPrice={currentMarket.markPrice} />
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* ── LEFT: Markets ── */}
          <div className="lg:col-span-3 space-y-3">
            <Card className="border-border/50 bg-[hsl(240,10%,8%)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Markets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-3 pt-0">
                {COMMODITIES.map((name) => {
                  const mkt = markets[name];
                  const isActive = selectedMarket === name;
                  return (
                    <button
                      key={name}
                      onClick={() => setSelectedMarket(name)}
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-left transition-all ${
                        isActive
                          ? "bg-primary/15 border border-primary/40"
                          : "hover:bg-muted/40 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{COMMODITY_ICONS[name]}</span>
                        <span className={`font-semibold text-sm ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                          {name}
                        </span>
                      </div>
                      <span className="font-mono text-sm text-foreground">
                        {mkt ? formatPrice(mkt.markPrice) : "—"}
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Market Details */}
            {currentMarket && (
              <Card className="border-border/50 bg-[hsl(240,10%,8%)]">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Mark Price</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatPrice(currentMarket.markPrice)}/ton
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Oracle Update</span>
                    <Badge variant="outline" className="text-xs font-mono">Live Oracle</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">OI Long</span>
                    <span className="font-mono text-sm text-[hsl(145,80%,50%)]">
                      {formatSol(currentMarket.openInterestLong)} SOL
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">OI Short</span>
                    <span className="font-mono text-sm text-[hsl(0,80%,60%)]">
                      {formatSol(currentMarket.openInterestShort)} SOL
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Last Updated</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(currentMarket.lastPriceUpdate * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── CENTER: Order Panel ── */}
          <div className="lg:col-span-4">
            <Card className="border-border/50 bg-[hsl(240,10%,8%)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  {COMMODITY_ICONS[selectedMarket]} {selectedMarket} Perpetual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Direction Toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDirection(0)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                      direction === 0
                        ? "bg-[hsl(145,80%,40%)] text-white shadow-[0_0_20px_hsl(145,80%,40%/0.3)]"
                        : "bg-[hsl(145,80%,40%/0.1)] text-[hsl(145,80%,50%)] border border-[hsl(145,80%,40%/0.3)] hover:bg-[hsl(145,80%,40%/0.2)]"
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" /> LONG
                  </button>
                  <button
                    onClick={() => setDirection(1)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                      direction === 1
                        ? "bg-[hsl(0,80%,50%)] text-white shadow-[0_0_20px_hsl(0,80%,50%/0.3)]"
                        : "bg-[hsl(0,80%,50%/0.1)] text-[hsl(0,80%,60%)] border border-[hsl(0,80%,50%/0.3)] hover:bg-[hsl(0,80%,50%/0.2)]"
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" /> SHORT
                  </button>
                </div>

                {/* SOL Input */}
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Collateral (SOL)</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    value={solAmount}
                    onChange={(e) => setSolAmount(e.target.value)}
                    className="font-mono text-lg"
                  />
                  {connected && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Balance: {solBalance.toFixed(4)} SOL
                      </span>
                      <button
                        onClick={() => setSolAmount(Math.max(0, solBalance - 0.01).toFixed(4))}
                        className="text-xs text-primary hover:underline"
                      >
                        MAX
                      </button>
                    </div>
                  )}
                </div>

                {/* Entry price info */}
                {currentMarket && solAmount && (
                  <div className="bg-muted/30 rounded-lg p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entry Price</span>
                      <span className="font-mono text-foreground">
                        {formatPrice(currentMarket.markPrice)}/ton
                      </span>
                    </div>
                  </div>
                )}

                {/* Place Order button */}
                {connected ? (
                  <Button
                    onClick={handlePlaceOrder}
                    disabled={placingOrder || !solAmount}
                    className={`w-full h-12 font-bold text-base ${
                      direction === 0
                        ? "bg-[hsl(145,80%,40%)] hover:bg-[hsl(145,80%,35%)] text-white shadow-[0_4px_16px_hsl(145,80%,40%/0.3)]"
                        : "bg-[hsl(0,80%,50%)] hover:bg-[hsl(0,80%,45%)] text-white shadow-[0_4px_16px_hsl(0,80%,50%/0.3)]"
                    }`}
                  >
                    {placingOrder ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {placingOrder
                      ? "Placing Order..."
                      : `${direction === 0 ? "Long" : "Short"} ${selectedMarket}`}
                  </Button>
                ) : (
                  <Button onClick={connect} className="w-full h-12">
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Phantom to Trade
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT: Positions ── */}
          <div className="lg:col-span-5">
            <Card className="border-border/50 bg-[hsl(240,10%,8%)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  My Positions {positions.length > 0 && `(${positions.length})`}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {!connected ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Connect wallet to view positions
                  </div>
                ) : positions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No open positions
                  </div>
                ) : (
                  <div className="space-y-2">
                    {positions.map((pos) => {
                      const commodity = getCommodityForMarket(pos.market);
                      const { pnl, pnlPercent } = computePnl(pos);
                      const isProfit = pnl >= 0;
                      return (
                        <div
                          key={pos.publicKey}
                          className="rounded-lg border border-border/40 p-3 space-y-2 bg-muted/20"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{commodity ? COMMODITY_ICONS[commodity] : "?"}</span>
                              <span className="font-semibold text-sm">{commodity || "Unknown"}</span>
                              <Badge
                                className={`text-xs ${
                                  pos.direction === 0
                                    ? "bg-[hsl(145,80%,40%/0.2)] text-[hsl(145,80%,50%)] border-[hsl(145,80%,40%/0.3)]"
                                    : "bg-[hsl(0,80%,50%/0.2)] text-[hsl(0,80%,60%)] border-[hsl(0,80%,50%/0.3)]"
                                }`}
                                variant="outline"
                              >
                                {pos.direction === 0 ? "LONG" : "SHORT"}
                              </Badge>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleClosePosition(pos)}
                              disabled={closingPosition === pos.publicKey}
                              className="text-xs h-7 border-destructive/50 text-destructive hover:bg-destructive/10"
                            >
                              {closingPosition === pos.publicKey ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "Close"
                              )}
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground block">Collateral</span>
                              <span className="font-mono">{formatSol(pos.collateral)} SOL</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Entry Price</span>
                              <span className="font-mono">{formatPrice(pos.entryPrice)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">PnL</span>
                              <span
                                className={`font-mono font-bold ${
                                  isProfit ? "text-[hsl(145,80%,50%)]" : "text-[hsl(0,80%,60%)]"
                                }`}
                              >
                                {isProfit ? "+" : ""}
                                {formatSol(pnl)} SOL
                                <span className="text-[10px] ml-1">
                                  ({(pnlPercent * 100).toFixed(2)}%)
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── BOTTOM BAR ── */}
        {connected && (
          <div className="mt-4 flex flex-wrap items-center gap-4 bg-[hsl(240,10%,8%)] border border-border/40 rounded-xl px-4 py-3 text-xs">
            <div className="flex items-center gap-2">
              <Wallet className="w-3 h-3 text-muted-foreground" />
              <span className="font-mono text-muted-foreground">{truncateAddress(publicKey!)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">SOL:</span>
              <span className="font-mono text-foreground">{solBalance.toFixed(4)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">URIM:</span>
              <span className="font-mono text-[hsl(45,95%,55%)]">{urimBalance.toLocaleString()}</span>
            </div>
            {hasUrimDiscount && (
              <Badge className="bg-[hsl(45,95%,55%/0.15)] text-[hsl(45,95%,55%)] border-[hsl(45,95%,55%/0.3)] text-[10px]" variant="outline">
                ✓ Discount Active
              </Badge>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
