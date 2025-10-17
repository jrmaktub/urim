import { TrendingUp, Users } from "lucide-react";
import BaseBetButton from "./BaseBetButton";

interface OutcomeCardProps {
  title: string;
  odds: number;
  poolSize: string;
}

const OutcomeCard = ({ title, odds, poolSize }: OutcomeCardProps) => {
  return (
    <div className="glass-card p-6 rounded-2xl border border-border hover:border-primary/50 transition-all duration-300 group">
      <div className="space-y-4">
        {/* Title */}
        <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
          {title}
        </h3>

        {/* Stats */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span>Odds</span>
            </div>
            <div className="text-2xl font-bold text-primary">{odds}%</div>
          </div>

          <div className="space-y-1 text-right">
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-end">
              <Users className="w-4 h-4" />
              <span>Pool</span>
            </div>
            <div className="text-lg font-semibold">{poolSize}</div>
          </div>
        </div>

        {/* Odds Bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-1000"
            style={{ width: `${odds}%` }}
          />
        </div>

        {/* Bet Button - Now uses Base Account SDK */}
        <BaseBetButton className="w-full rounded-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 glow-primary" />
      </div>
    </div>
  );
};

export default OutcomeCard;
