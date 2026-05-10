import { Skeleton } from "@/components/ui/skeleton";
import { Award, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { IncentiveCalculationStatus, TargetPeriod } from "../types";
import type { IncentiveCalculation } from "../types";
import { TARGET_PERIOD_LABELS } from "../types";

const STATUS_LABELS: Record<IncentiveCalculationStatus, string> = {
  [IncentiveCalculationStatus.Calculated]: "Projected",
  [IncentiveCalculationStatus.HRApproved]: "Approved",
  [IncentiveCalculationStatus.PaidOnSlip]: "Paid",
};

export function MyIncentiveWidget() {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [incentive, setIncentive] = useState<IncentiveCalculation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .getMyProjectedIncentive(
        token,
        TargetPeriod.Monthly,
        BigInt(currentYear),
        BigInt(currentMonth),
      )
      .then(setIncentive)
      .finally(() => setLoading(false));
  }, [token, currentYear, currentMonth]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-muted-foreground" />
          <span className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            My Incentive
          </span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-card border border-border rounded-lg p-5"
      data-ocid="incentive-widget"
    >
      <div className="flex items-center gap-2 mb-3">
        <Award className="w-4 h-4 text-accent" />
        <span className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          My Incentive
        </span>
      </div>

      {!incentive ? (
        <p className="text-sm text-muted-foreground">
          No incentive data for this month. Targets must be set and achievement
          recorded.
        </p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Period</span>
            <span className="text-xs font-medium text-foreground">
              {TARGET_PERIOD_LABELS[incentive.period]} {String(incentive.year)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Target</span>
            <span className="text-xs font-mono font-medium text-foreground">
              ₹{incentive.targetAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Actual</span>
            <span className="text-xs font-mono font-medium text-foreground">
              ₹{incentive.actualAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Achievement</span>
            <span className="text-xs font-mono font-semibold text-primary">
              {incentive.achievementPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Slab Applied</span>
            <span className="text-xs font-medium text-foreground">
              {incentive.slabApplied || "—"}
            </span>
          </div>
          <div className="border-t border-border pt-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Incentive Earned
            </span>
            <span className="text-base font-display font-bold text-primary">
              ₹{incentive.incentiveAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground text-right">
            Status:{" "}
            <span className="font-medium text-foreground">
              {STATUS_LABELS[incentive.status] ?? incentive.status}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
