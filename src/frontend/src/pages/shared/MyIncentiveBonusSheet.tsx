import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, Printer, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Role } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import { buildBrandingHtml } from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";
import type { IncentiveBonusSheet } from "../../types";
import { PaymentStatus } from "../../types";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

// Indian Financial Year quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
const QUARTERS = [
  { value: "1", label: "Q1 — April to June" },
  { value: "2", label: "Q2 — July to September" },
  { value: "3", label: "Q3 — October to December" },
  { value: "4", label: "Q4 — January to March" },
];

const QUARTER_END_MONTHS: Record<string, number> = {
  "1": 6,
  "2": 9,
  "3": 12,
  "4": 3,
};

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

function getExpectedPaymentDate(quarter: string, year: number): string {
  const endMonth = QUARTER_END_MONTHS[quarter];
  // Q4 ends in March of the following year, others end in the same year
  const endYear = quarter === "4" ? year + 1 : year;
  const endDate = new Date(endYear, endMonth - 1 + 1, 0); // last day of end month
  endDate.setDate(endDate.getDate() + 30);
  return endDate.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface Props {
  portalRole: Role;
}

function paymentStatusBadge(status: PaymentStatus, paymentDate?: bigint) {
  if (status === PaymentStatus.Paid) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        Paid{" "}
        {paymentDate
          ? `— ${new Date(Number(paymentDate) / 1_000_000).toLocaleDateString("en-IN")}`
          : ""}
      </Badge>
    );
  }
  if (status === PaymentStatus.DueForPayment) {
    return (
      <Badge className="bg-orange-100 text-orange-800 border-orange-200">
        Due for Payment
      </Badge>
    );
  }
  return (
    <Badge className="bg-muted text-muted-foreground border-border">
      Pending
    </Badge>
  );
}

export default function MyIncentiveBonusSheet({ portalRole }: Props) {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const [sheet, setSheet] = useState<IncentiveBonusSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [quarter, setQuarter] = useState<string>("1");
  const [year, setYear] = useState<string>(String(CURRENT_YEAR));
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    api
      .getMyIncentiveBonusSheet(BigInt(quarter), BigInt(year))
      .then((s) => setSheet(s ?? null))
      .catch(() => {
        toast.error("Failed to load incentive & bonus sheet");
        setSheet(null);
      })
      .finally(() => setLoading(false));
  }, [session, quarter, year]);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const brandingHtml = buildBrandingHtml(companyProfile);
    w.document.write(`<html><head><title>Incentive & Bonus Sheet — Q${quarter} ${year}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 24px; font-size: 13px; color: #000; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 10px; font-size: 12px; border: 1px solid #ddd; }
  th { background: #f5f5f5; font-weight: bold; text-align: left; }
  td.num { text-align: right; font-family: monospace; }
  .total-row td { font-weight: bold; background: #eef2ff; }
  .section-title { font-size: 13px; font-weight: bold; margin: 16px 0 6px; }
  @media print { body { margin: 0; } }
</style></head><body>${brandingHtml}${content}</body></html>`);
    w.document.close();
    w.print();
    toast.success("Print dialog opened");
  };

  const expectedPayment = getExpectedPaymentDate(quarter, Number(year));

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="My Incentive & Bonus Sheet"
        subtitle="Quarterly incentive and bonus statement"
        actions={
          sheet ? (
            <Button
              onClick={handlePrint}
              data-ocid="print-incentive-btn"
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              Print / Export
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        {/* Selectors */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-display uppercase tracking-wide">
              Quarter
            </p>
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger className="w-[230px]" data-ocid="filter-quarter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUARTERS.map((q) => (
                  <SelectItem key={q.value} value={q.value}>
                    {q.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-display uppercase tracking-wide">
              Year
            </p>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[110px]" data-ocid="filter-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && (
          <div className="space-y-3" data-ocid="incentive-loading">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        )}

        {!loading && !sheet && (
          <div
            className="bg-card border border-border rounded-lg p-12 text-center"
            data-ocid="incentive-empty"
          >
            <Award className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-display font-medium text-foreground mb-1">
              No incentive & bonus sheet found
            </p>
            <p className="text-sm text-muted-foreground font-body">
              No sheet has been generated for Q{quarter} (
              {QUARTERS[Number(quarter) - 1]?.label}) {year}. Sheets are created
              by HR after the quarter ends.
            </p>
          </div>
        )}

        {!loading && sheet && (
          <div ref={printRef} className="space-y-5" data-ocid="incentive-sheet">
            {/* Summary header */}
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-display font-semibold text-foreground text-base">
                    {QUARTERS[Number(sheet.quarter) - 1]?.label} —{" "}
                    {String(sheet.year)}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-body">
                    Employee: {session?.name ?? "—"} &nbsp;|&nbsp; ID:{" "}
                    {session?.employeeId ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {paymentStatusBadge(sheet.paymentStatus, sheet.paymentDate)}
                </div>
              </div>

              {/* Payment schedule note */}
              <div className="rounded-md border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-800 font-body mb-5">
                <TrendingUp className="w-3.5 h-3.5 inline mr-1.5 align-text-top" />
                Monthly Incentives and Bonus are payable 30 days after the end
                of the Quarter. Expected payment date:{" "}
                <strong>{expectedPayment}</strong>.
              </div>

              {/* Monthly Incentive Breakdown */}
              <div className="mb-5">
                <p className="text-xs uppercase tracking-wider font-display font-semibold text-muted-foreground mb-3">
                  Monthly Incentive Breakdown
                </p>
                {sheet.monthlyBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground font-body py-2">
                    No monthly incentive data recorded.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-body">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="py-2.5 px-3 text-left font-display text-xs uppercase tracking-wider text-muted-foreground">
                            Month
                          </th>
                          <th className="py-2.5 px-3 text-right font-display text-xs uppercase tracking-wider text-muted-foreground">
                            Achievement %
                          </th>
                          <th className="py-2.5 px-3 text-left font-display text-xs uppercase tracking-wider text-muted-foreground">
                            Slab Applied
                          </th>
                          <th className="py-2.5 px-3 text-right font-display text-xs uppercase tracking-wider text-muted-foreground">
                            Incentive Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {sheet.monthlyBreakdown.map((entry, idx) => (
                          <tr
                            key={`${String(entry.year)}-${String(entry.month)}-${idx}`}
                            className="hover:bg-muted/20"
                          >
                            <td className="py-2.5 px-3 font-medium text-foreground">
                              {MONTH_NAMES[Number(entry.month) - 1]}{" "}
                              {String(entry.year)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-foreground">
                              {entry.achievementPct.toFixed(1)}%
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {entry.slabApplied || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium text-foreground">
                              ₹
                              {entry.incentiveAmount.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border bg-violet-50">
                          <td
                            colSpan={3}
                            className="py-3 px-3 font-display font-semibold text-foreground"
                          >
                            Total Incentive
                          </td>
                          <td className="py-3 px-3 text-right font-display font-bold text-violet-700 text-base">
                            ₹
                            {sheet.totalIncentiveAmount.toLocaleString(
                              "en-IN",
                              { minimumFractionDigits: 2 },
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Bonus Entries */}
              {sheet.bonusEntries.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs uppercase tracking-wider font-display font-semibold text-muted-foreground mb-3">
                    Bonus Details
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-body">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="py-2.5 px-3 text-left font-display text-xs uppercase tracking-wider text-muted-foreground">
                            Bonus Type
                          </th>
                          <th className="py-2.5 px-3 text-left font-display text-xs uppercase tracking-wider text-muted-foreground">
                            Remarks
                          </th>
                          <th className="py-2.5 px-3 text-right font-display text-xs uppercase tracking-wider text-muted-foreground">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {sheet.bonusEntries.map((b, idx) => (
                          <tr
                            key={`${b.bonusType}-${idx}`}
                            className="hover:bg-muted/20"
                          >
                            <td className="py-2.5 px-3 font-medium text-foreground">
                              {b.bonusType}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {b.remarks ?? "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium text-foreground">
                              ₹
                              {b.amount.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border bg-amber-50">
                          <td
                            colSpan={2}
                            className="py-3 px-3 font-display font-semibold text-foreground"
                          >
                            Total Bonus
                          </td>
                          <td className="py-3 px-3 text-right font-display font-bold text-amber-700 text-base">
                            ₹
                            {sheet.totalBonusAmount.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Grand Total */}
              <div className="bg-primary/10 border border-primary/30 rounded-lg px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                    Total Incentive + Bonus
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-body">
                    Q{quarter} {year}
                  </p>
                </div>
                <p
                  className="font-display font-bold text-3xl text-primary"
                  data-ocid="total-incentive-bonus"
                >
                  ₹
                  {sheet.totalAmount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground font-body">
                Sheet generated on:{" "}
                {new Date(
                  Number(sheet.generatedAt) / 1_000_000,
                ).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
