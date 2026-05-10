import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BanknoteIcon, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Role } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import type { EmployeeAdvance } from "../../types";
import { AdvanceStatus } from "../../types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface Props {
  portalRole: Role;
}

function statusBadge(status: AdvanceStatus, isPaused: boolean) {
  if (isPaused) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
        Paused
      </Badge>
    );
  }
  if (status === AdvanceStatus.Active) {
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
        Active
      </Badge>
    );
  }
  if (status === AdvanceStatus.FullyRecovered) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        Fully Recovered
      </Badge>
    );
  }
  return (
    <Badge className="bg-muted text-muted-foreground border-border">
      Cancelled
    </Badge>
  );
}

function statusIcon(status: AdvanceStatus, isPaused: boolean) {
  if (isPaused) return <Clock className="w-5 h-5 text-yellow-500" />;
  if (status === AdvanceStatus.FullyRecovered)
    return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  if (status === AdvanceStatus.Cancelled)
    return <XCircle className="w-5 h-5 text-muted-foreground" />;
  return <BanknoteIcon className="w-5 h-5 text-blue-500" />;
}

function getExpectedCompletionMonth(advance: EmployeeAdvance): string {
  if (advance.status === AdvanceStatus.FullyRecovered) return "Completed";
  if (advance.status === AdvanceStatus.Cancelled) return "Cancelled";
  const remaining =
    Number(advance.totalInstallments) - Number(advance.installmentsCompleted);
  if (remaining <= 0) return "Completion pending";
  const startMonth = Number(advance.firstDeductionMonth);
  const startYear = Number(advance.firstDeductionYear);
  const totalMonthsFromStart =
    Number(advance.installmentsCompleted) + remaining - 1;
  const endMonth = ((startMonth - 1 + totalMonthsFromStart) % 12) + 1;
  const endYear =
    startYear + Math.floor((startMonth - 1 + totalMonthsFromStart) / 12);
  return `${MONTH_NAMES[endMonth - 1]} ${endYear}`;
}

export default function MyAdvances({ portalRole }: Props) {
  const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getMyAdvances()
      .then((list) => setAdvances(list))
      .catch(() => {
        toast.error("Failed to load advances");
        setAdvances([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeCount = advances.filter(
    (a) => a.status === AdvanceStatus.Active && !a.isPaused,
  ).length;
  const totalBalance = advances
    .filter((a) => a.status === AdvanceStatus.Active)
    .reduce((sum, a) => sum + (a.advanceAmount - a.amountRecovered), 0);

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="My Advances"
        subtitle="Track advance payments and monthly installment deductions"
      />
      <PageContent>
        {loading && (
          <div className="space-y-3" data-ocid="advances-loading">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        )}

        {!loading && advances.length === 0 && (
          <div
            className="bg-card border border-border rounded-lg p-12 text-center"
            data-ocid="advances-empty"
          >
            <BanknoteIcon className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-display font-medium text-foreground mb-1">
              No advance records found
            </p>
            <p className="text-sm text-muted-foreground font-body">
              You have no advance payments on record. Contact HR if you need an
              advance.
            </p>
          </div>
        )}

        {!loading && advances.length > 0 && (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs uppercase tracking-wider font-display text-muted-foreground mb-1">
                  Total Advances
                </p>
                <p className="font-display font-bold text-2xl text-foreground">
                  {advances.length}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs uppercase tracking-wider font-display text-muted-foreground mb-1">
                  Active Advances
                </p>
                <p className="font-display font-bold text-2xl text-blue-600">
                  {activeCount}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs uppercase tracking-wider font-display text-muted-foreground mb-1">
                  Total Balance Remaining
                </p>
                <p className="font-display font-bold text-2xl text-destructive">
                  ₹
                  {totalBalance.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            {/* Advance cards */}
            <div className="space-y-4" data-ocid="advances-list">
              {advances.map((advance) => {
                const balance = advance.advanceAmount - advance.amountRecovered;
                const remaining =
                  Number(advance.totalInstallments) -
                  Number(advance.installmentsCompleted);
                const progressPct =
                  advance.totalInstallments > BigInt(0)
                    ? Math.round(
                        (Number(advance.installmentsCompleted) /
                          Number(advance.totalInstallments)) *
                          100,
                      )
                    : 0;
                const advanceDate = new Date(
                  Number(advance.advanceDate) / 1_000_000,
                ).toLocaleDateString("en-IN");
                const firstDeduction = `${MONTH_NAMES[Number(advance.firstDeductionMonth) - 1]} ${advance.firstDeductionYear}`;

                return (
                  <div
                    key={advance.id}
                    className="bg-card border border-border rounded-lg overflow-hidden"
                    data-ocid={`advance-${advance.id}`}
                  >
                    {/* Card header */}
                    <div className="px-5 py-4 border-b border-border flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {statusIcon(advance.status, advance.isPaused)}
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-foreground truncate">
                            {advance.reason}
                          </p>
                          <p className="text-xs text-muted-foreground font-body mt-0.5">
                            Advance Date: {advanceDate}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {statusBadge(advance.status, advance.isPaused)}
                        <span className="font-display font-bold text-lg text-foreground">
                          ₹{advance.advanceAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="px-5 py-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
                        <AdvField
                          label="Monthly Installment"
                          value={`₹${advance.installmentAmount.toLocaleString("en-IN")}`}
                        />
                        <AdvField
                          label="Amount Recovered"
                          value={`₹${advance.amountRecovered.toLocaleString("en-IN")}`}
                          highlight="green"
                        />
                        <AdvField
                          label="Balance Remaining"
                          value={`₹${balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                          highlight={
                            advance.status === AdvanceStatus.Active
                              ? "red"
                              : undefined
                          }
                        />
                        <AdvField
                          label="Installments"
                          value={`${advance.installmentsCompleted} of ${advance.totalInstallments}`}
                        />
                        <AdvField
                          label="Expected Completion"
                          value={getExpectedCompletionMonth(advance)}
                        />
                      </div>

                      {/* Progress bar */}
                      {advance.status === AdvanceStatus.Active && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground font-body">
                              Recovery Progress
                            </span>
                            <span className="text-xs font-mono font-medium text-foreground">
                              {progressPct}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Extra info */}
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground font-body">
                        <span>First Deduction: {firstDeduction}</span>
                        <span>
                          Installments Remaining:{" "}
                          <strong className="text-foreground">
                            {remaining}
                          </strong>
                        </span>
                        {advance.remarks && (
                          <span>Remarks: {advance.remarks}</span>
                        )}
                        {advance.isPaused && advance.cancelRemark && (
                          <span className="text-yellow-700">
                            Pause Reason: {advance.cancelRemark}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Note */}
            <div className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground font-body">
              Advance deductions appear as "Advance Recovery" on your monthly
              Salary Slip. Contact HR to update or cancel an advance.
            </div>
          </>
        )}
      </PageContent>
    </PortalLayout>
  );
}

function AdvField({
  label,
  value,
  highlight,
}: { label: string; value: string; highlight?: "green" | "red" }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground block">{label}</span>
      <p
        className={`font-medium mt-0.5 text-sm ${highlight === "green" ? "text-green-700" : highlight === "red" ? "text-destructive" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
