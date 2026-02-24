import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { COMMODITY_ICONS, type CommodityName } from "@/constants/mineralFutures";

type TimeFrame = "1H" | "4H" | "1D" | "1W";

interface MineralPriceChartProps {
  commodity: CommodityName;
  currentPrice: number;
}

function generatePriceHistory(basePrice: number, timeframe: TimeFrame): { time: string; price: number }[] {
  const points: { time: string; price: number }[] = [];
  const configs: Record<TimeFrame, { count: number; volatility: number; labelFn: (i: number) => string }> = {
    "1H": {
      count: 60,
      volatility: 0.001,
      labelFn: (i) => `${60 - i}m`,
    },
    "4H": {
      count: 48,
      volatility: 0.003,
      labelFn: (i) => `${((48 - i) * 5)}m`,
    },
    "1D": {
      count: 24,
      volatility: 0.008,
      labelFn: (i) => `${String(i).padStart(2, "0")}:00`,
    },
    "1W": {
      count: 7,
      volatility: 0.025,
      labelFn: (i) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i % 7],
    },
  };

  const { count, volatility, labelFn } = configs[timeframe];
  let price = basePrice * (1 - volatility * count * 0.3);

  // Use a seeded-ish random walk so it doesn't re-randomize every render
  const seed = basePrice * 1000 + count;
  for (let i = 0; i < count; i++) {
    const pseudoRand = Math.sin(seed + i * 13.37) * 0.5 + 0.5;
    const drift = 0.0002;
    price = price * (1 + drift + (pseudoRand - 0.48) * volatility);
    points.push({ time: labelFn(i), price: Math.round(price * 100) / 100 });
  }
  // Ensure last point matches current price
  if (points.length > 0) points[points.length - 1].price = basePrice;
  return points;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[hsl(240,10%,12%)] border border-border/50 rounded-lg px-3 py-2 shadow-xl">
      <span className="font-mono text-sm text-foreground font-bold">
        ${payload[0].value.toLocaleString()}
      </span>
      <span className="text-xs text-muted-foreground ml-2">/ton</span>
    </div>
  );
};

export default function MineralPriceChart({ commodity, currentPrice }: MineralPriceChartProps) {
  const [timeframe, setTimeframe] = useState<TimeFrame>("1D");

  const data = useMemo(
    () => generatePriceHistory(currentPrice, timeframe),
    [currentPrice, timeframe]
  );

  const firstPrice = data[0]?.price ?? currentPrice;
  const change = currentPrice - firstPrice;
  const changePercent = firstPrice ? (change / firstPrice) * 100 : 0;
  const isPositive = change >= 0;
  const minPrice = Math.min(...data.map((d) => d.price));
  const maxPrice = Math.max(...data.map((d) => d.price));
  const padding = (maxPrice - minPrice) * 0.1 || 1;

  const gradientColor = isPositive ? "145, 80%, 45%" : "0, 80%, 55%";
  const strokeColor = isPositive ? "hsl(145,80%,50%)" : "hsl(0,80%,60%)";

  const timeframes: TimeFrame[] = ["1H", "4H", "1D", "1W"];

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{COMMODITY_ICONS[commodity]}</span>
          <span className="font-bold text-foreground">{commodity}</span>
          <span className="font-mono text-lg font-bold text-foreground">
            ${currentPrice.toLocaleString()}
          </span>
          <span
            className={`text-sm font-mono font-semibold ${
              isPositive ? "text-[hsl(145,80%,50%)]" : "text-[hsl(0,80%,60%)]"
            }`}
          >
            {isPositive ? "+" : ""}
            {change.toFixed(2)} ({changePercent.toFixed(2)}%)
          </span>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                timeframe === tf
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`hsl(${gradientColor})`} stopOpacity={0.25} />
                <stop offset="100%" stopColor={`hsl(${gradientColor})`} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(240,5%,45%)", fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[minPrice - padding, maxPrice + padding]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(240,5%,45%)", fontSize: 11 }}
              tickFormatter={(v: number) => `$${v.toLocaleString()}`}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(240,5%,30%)", strokeDasharray: "4 4" }} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={strokeColor}
              strokeWidth={2}
              fill="url(#priceGradient)"
              dot={false}
              activeDot={{ r: 4, fill: strokeColor, stroke: "hsl(240,10%,8%)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
