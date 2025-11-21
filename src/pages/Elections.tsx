import { useState } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, TrendingUp, Users, Clock } from "lucide-react";

// Placeholder candidate data
const candidates = [
  {
    id: 1,
    name: "Salvador Nasralla",
    image: "/placeholder.svg",
    percentage: 44,
    volume: "$125,430",
    color: "hsl(270 85% 68%)",
  },
  {
    id: 2,
    name: "Rixi Moncada",
    image: "/placeholder.svg",
    percentage: 32,
    volume: "$89,210",
    color: "hsl(0 100% 50%)",
  },
  {
    id: 3,
    name: "Nasry Asfura",
    image: "/placeholder.svg",
    percentage: 24,
    volume: "$62,890",
    color: "#0073CF",
  },
];

// Placeholder order book data
const yesOrders = [
  { price: "$0.44", shares: "1,234", total: "$543.00" },
  { price: "$0.43", shares: "2,456", total: "$1,056.00" },
  { price: "$0.42", shares: "890", total: "$374.00" },
];

const noOrders = [
  { price: "$0.56", shares: "987", total: "$552.00" },
  { price: "$0.57", shares: "1,543", total: "$880.00" },
  { price: "$0.58", shares: "654", total: "$379.00" },
];

const Elections = () => {
  const [timeRange, setTimeRange] = useState("1D");
  const [selectedCandidate, setSelectedCandidate] = useState(candidates[0]);
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradeType, setTradeType] = useState<"YES" | "NO">("YES");

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-foreground">
            Honduras Presidential 2025
            <span className="text-primary ml-3">– Prediction Market</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Trade the future. Quantum-powered political markets.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Graph Section */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Price Chart</h2>
                <Tabs value={timeRange} onValueChange={setTimeRange}>
                  <TabsList className="bg-secondary/40">
                    {["1H", "6H", "1D", "1W", "1M", "ALL"].map((range) => (
                      <TabsTrigger
                        key={range}
                        value={range}
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      >
                        {range}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              
              {/* Placeholder Graph */}
              <div className="relative h-64 sm:h-80 bg-card/50 rounded-xl border border-border/50 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 800 300">
                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map((i) => (
                      <line
                        key={i}
                        x1="0"
                        y1={i * 60 + 30}
                        x2="800"
                        y2={i * 60 + 30}
                        stroke="hsl(var(--border))"
                        strokeWidth="1"
                        opacity="0.3"
                      />
                    ))}
                    
                    {/* All candidate lines */}
                    {candidates.map((candidate, idx) => {
                      const points = Array.from({ length: 20 }, (_, i) => {
                        const x = (i * 800) / 19;
                        const baseY = 150 - (candidate.percentage - 32) * 3;
                        const variance = Math.sin(i * 0.5 + idx) * 20;
                        return `${x},${baseY + variance}`;
                      }).join(" ");
                      
                      return (
                        <polyline
                          key={candidate.id}
                          points={points}
                          fill="none"
                          stroke={candidate.color}
                          strokeWidth="3"
                          className="animate-fade-in"
                          style={{ animationDelay: `${idx * 200}ms` }}
                        />
                      );
                    })}
                  </svg>
                </div>
                
                {/* Legend */}
                <div className="absolute bottom-4 left-4 flex flex-wrap gap-3">
                  {candidates.map((candidate) => (
                    <div key={candidate.id} className="flex items-center gap-2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border/50">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: candidate.color }}
                      />
                      <span className="text-xs font-medium text-foreground">{candidate.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Candidate Cards */}
            <div className="space-y-4 animate-fade-up">
              {candidates.map((candidate, index) => (
                <div key={candidate.id} style={{ animationDelay: `${index * 100}ms` }}>
                  <div
                    onClick={() => setSelectedCandidate(candidate)}
                    className={`glass-card p-6 hover:border-primary/50 transition-all cursor-pointer ${
                      selectedCandidate.id === candidate.id ? "border-primary" : ""
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary overflow-hidden border-2 border-primary/30">
                          <img
                            src={candidate.image}
                            alt={candidate.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-foreground mb-1">
                            {candidate.name}
                          </h3>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <TrendingUp className="w-4 h-4" />
                              <span className="text-primary font-bold text-lg">{candidate.percentage}%</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Users className="w-4 h-4" />
                              <span>{candidate.volume}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                          onClick={() => {
                            setSelectedCandidate(candidate);
                            setTradeType("YES");
                          }}
                          className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white border-0"
                        >
                          Buy YES
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedCandidate(candidate);
                            setTradeType("NO");
                          }}
                          className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white border-0"
                        >
                          Buy NO
                        </Button>
                      </div>
                    </div>
                    {/* Percentage bar */}
                    <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${candidate.percentage}%`,
                          backgroundColor: candidate.color,
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Order Book - Shows under selected candidate */}
                  {selectedCandidate.id === candidate.id && (
                    <div className="glass-card p-6 mt-4">
                      <h2 className="text-2xl font-bold text-foreground mb-6">
                        Order Book - {selectedCandidate.name}
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* YES Orders */}
                        <div>
                          <h3 className="text-lg font-semibold text-green-500 mb-4">YES Orders</h3>
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground mb-2">
                              <div>Price</div>
                              <div className="text-right">Shares</div>
                              <div className="text-right">Total</div>
                            </div>
                            {yesOrders.map((order, idx) => (
                              <div
                                key={idx}
                                className="grid grid-cols-3 gap-2 text-sm bg-green-500/5 hover:bg-green-500/10 p-2 rounded-lg transition-colors"
                              >
                                <div className="text-green-500 font-medium">{order.price}</div>
                                <div className="text-right text-foreground">{order.shares}</div>
                                <div className="text-right text-muted-foreground">{order.total}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* NO Orders */}
                        <div>
                          <h3 className="text-lg font-semibold text-red-500 mb-4">NO Orders</h3>
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground mb-2">
                              <div>Price</div>
                              <div className="text-right">Shares</div>
                              <div className="text-right">Total</div>
                            </div>
                            {noOrders.map((order, idx) => (
                              <div
                                key={idx}
                                className="grid grid-cols-3 gap-2 text-sm bg-red-500/5 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                              >
                                <div className="text-red-500 font-medium">{order.price}</div>
                                <div className="text-right text-foreground">{order.shares}</div>
                                <div className="text-right text-muted-foreground">{order.total}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Rules Summary */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Rules Summary</h2>
              <div className="space-y-4">
                <p className="text-foreground leading-relaxed">
                  Presidential elections in Honduras are scheduled for November 30, 2025.
                </p>
                <p className="text-foreground leading-relaxed">
                  This market resolves according to the candidate who is publicly confirmed as the winner.
                </p>
                <p className="text-foreground leading-relaxed">
                  If no winner is known by December 31, 2026 at 11:59 PM ET, the market resolves to 'Other'.
                </p>
                <p className="text-foreground leading-relaxed">
                  Winner determination is based on a consensus of credible reporting and the official announcement from the Honduran National Electoral Council (CNE). If major sources disagree temporarily, resolution will wait until a clear public consensus emerges.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    View full rules
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    Help center
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="glass-card p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Timeline & Payout</h2>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-border" />
                
                {/* Timeline items */}
                <div className="space-y-8">
                  <div className="relative pl-16">
                    <div className="absolute left-0 w-12 h-12 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Market Opens</p>
                      <p className="font-semibold text-foreground">November 24, 2025</p>
                    </div>
                  </div>
                  
                  <div className="relative pl-16">
                    <div className="absolute left-0 w-12 h-12 rounded-full bg-secondary/50 border-2 border-border flex items-center justify-center">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Market Closes</p>
                      <p className="font-semibold text-foreground">November 30, 2025 at 10:00 PM Honduras time</p>
                      <p className="text-xs text-muted-foreground mt-1">Winner may not be immediately declared. Payout happens once a winner is publicly confirmed.</p>
                    </div>
                  </div>
                  
                  <div className="relative pl-16">
                    <div className="absolute left-0 w-12 h-12 rounded-full bg-secondary/50 border-2 border-border flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Payout</p>
                      <p className="font-semibold text-foreground">Once winner is publicly confirmed</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Resolver / Verification Link */}
            <div className="glass-card p-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">Resolver / Verification</h2>
              <p className="text-muted-foreground mb-4">
                Market resolution is verified through decentralized oracle consensus.
              </p>
              <Button variant="outline" className="gap-2 border-primary/30 hover:border-primary/50">
                View Oracle Resolver
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Right Sidebar - Purchase Widget */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 glass-card p-6 space-y-6">
              {/* Candidate Info */}
              <div className="flex items-center gap-4 pb-4 border-b border-border/50">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary overflow-hidden border-2 border-primary/30">
                  <img
                    src={selectedCandidate.image}
                    alt={selectedCandidate.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{selectedCandidate.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedCandidate.percentage}% probability</p>
                </div>
              </div>

              {/* Buy/Sell Toggle */}
              <div className="flex gap-2">
                <Button
                  onClick={() => setTradeType("YES")}
                  className={`flex-1 ${
                    tradeType === "YES"
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  Buy
                </Button>
                <Button
                  onClick={() => setTradeType("NO")}
                  className={`flex-1 ${
                    tradeType === "NO"
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  Sell
                </Button>
              </div>

              {/* Price Display */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">YES Price</span>
                  <span className="font-semibold text-green-500">$0.44</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">NO Price</span>
                  <span className="font-semibold text-red-500">$0.56</span>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Amount (USD)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  className="text-lg"
                />
                <div className="flex gap-2">
                  {[1, 5, 20, 100].map((amount) => (
                    <Button
                      key={amount}
                      size="sm"
                      variant="outline"
                      onClick={() => setTradeAmount(amount.toString())}
                      className="flex-1 text-xs"
                    >
                      +${amount}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTradeAmount("1000")}
                    className="flex-1 text-xs"
                  >
                    Max
                  </Button>
                </div>
              </div>

              {/* To Win Section */}
              <div className="bg-card/50 rounded-xl p-4 space-y-2 border border-border/30">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">You pay</span>
                  <span className="font-semibold text-foreground">
                    ${tradeAmount || "0.00"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">To win</span>
                  <span className="font-semibold text-primary">
                    ${tradeAmount ? (parseFloat(tradeAmount) * (tradeType === "YES" ? 2.27 : 1.79)).toFixed(2) : "0.00"}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-border/30">
                  <span className="text-muted-foreground">Avg. Price</span>
                  <span className="font-medium text-foreground">44¢</span>
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                className="w-full bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-white shadow-lg shadow-primary/25"
                size="lg"
              >
                Place Order
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Elections;
