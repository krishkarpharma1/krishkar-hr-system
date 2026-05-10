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
import { AlertTriangle, FileText, Printer, Receipt } from "lucide-react";
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
import type { ExpenseSheet } from "../../types";
import { PaymentStatus } from "../../types";
import { formatDate } from "../../utils/dateFormatter";

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

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

interface Props {
  portalRole: Role;
}

function paymentStatusBadge(status: PaymentStatus, paymentDate?: bigint) {
  if (status === PaymentStatus.Paid) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        Paid{" "}
        {paymentDate
          ? `— ${formatDate(new Date(Number(paymentDate) / 1_000_000).toISOString().slice(0, 10))}`
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

export default function MyExpenseSheet({ portalRole }: Props) {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const [sheet, setSheet] = useState<ExpenseSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [year, setYear] = useState<string>(String(CURRENT_YEAR));
  const printRef = useRef<HTMLDivElement>(null);

  // Field activity warnings: map of "YYYY-MM-DD" -> hasActivity (boolean)
  const [activityWarnings, setActivityWarnings] = useState<
    Map<string, boolean>
  >(new Map());

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    api
      .getMyExpenseSheet(BigInt(month), BigInt(year))
      .then((s) => setSheet(s ?? null))
      .catch(() => {
        toast.error("Failed to load expense sheet");
        setSheet(null);
      })
      .finally(() => setLoading(false));
  }, [session, month, year]);

  // Check field activity for each unique date in the sheet
  useEffect(() => {
    if (!session?.token || !sheet?.lineItems?.length) {
      setActivityWarnings(new Map());
      return;
    }

    const uniqueDates = new Set<string>();
    for (const item of sheet.lineItems) {
      const d = new Date(Number(item.date) / 1_000_000);
      uniqueDates.add(d.toISOString().slice(0, 10));
    }

    const newMap = new Map<string, boolean>();
    Promise.all(
      [...uniqueDates].map(async (dateIso) => {
        try {
          const hasActivity = await api.checkExpenseFieldActivity(
            session.token,
            dateIso,
          );
          newMap.set(dateIso, hasActivity);
        } catch {
          newMap.set(dateIso, true); // assume active if call fails — don't block
        }
      }),
    )
      .then(() => setActivityWarnings(new Map(newMap)))
      .catch(() => {
        /* silently ignore */
      });
  }, [session, sheet]);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const brandingHtml = buildBrandingHtml({
      companyProfile: companyProfile ?? null,
      docTitle: `Expense Sheet — ${MONTH_NAMES[Number(month) - 1]} ${year}`,
      period: `${MONTH_NAMES[Number(month) - 1]} ${year}`,
      employeeInfo: session
        ? `${session.name} (${session.employeeId})`
        : undefined,
      generatedBy: session?.name,
      generatedByRole: session?.role,
      docType: "report",
    });
    w.document.write(`<html><head><title>Expense Sheet — ${MONTH_NAMES[Number(month) - 1]} ${year}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 24px; font-size: 13px; color: #000; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 10px; font-size: 12px; border: 1px solid #ddd; }
  th { background: #f5f5f5; font-weight: bold; text-align: left; }
  td:last-child { text-align: right; }
  .total-row td { font-weight: bold; background: #eef2ff; }
  .section-title { font-size: 13px; font-weight: bold; margin: 16px 0 6px; }
  @media print { body { margin: 0; } }
</style></head><body>${brandingHtml}${content}</body></html>`);
    w.document.close();
    w.print();
    toast.success("Print dialog opened");
  };

  // Check if a line item's date has a field activity warning
  function getDateWarning(dateNs: bigint): string | null {
    const iso = new Date(Number(dateNs) / 1_000_000).toISOString().slice(0, 10);
    const hasActivity = activityWarnings.get(iso);
    if (hasActivity === false) {
      return `No field activity recorded for ${formatDate(iso)}. Please verify with your manager before submitting.`;
    }
    return null;
  }

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="My Expense Sheet"
        subtitle="Monthly field expense reimbursement statement"
        actions={
          sheet ? (
            <Button
              onClick={handlePrint}
              data-ocid="print-expense-btn"
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
              Month
            </p>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[150px]" data-ocid="filter-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
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
          <div className="space-y-3" data-ocid="expense-loading">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        )}

        {!loading && !sheet && (
          <div
            className="bg-card border border-border rounded-lg p-12 text-center"
            data-ocid="expense-empty"
          >
            <Receipt className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-display font-medium text-foreground mb-1">
              No expense sheet found
            </p>
            <p className="text-sm text-muted-foreground font-body">
              No expense sheet has been generated for{" "}
              {MONTH_NAMES[Number(month) - 1]} {year}. Expense sheets are
              created by HR from your approved TA/DA claims.
            </p>
          </div>
        )}

        {!loading && sheet && (
          <div ref={printRef} className="space-y-5" data-ocid="expense-sheet">
            {/* Summary card */}
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-display font-semibold text-foreground text-base">
                    Expense Sheet — {MONTH_NAMES[Number(sheet.month) - 1]}{" "}
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
              <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800 font-body mb-4">
                <FileText className="w-3.5 h-3.5 inline mr-1.5 align-text-top" />
                Monthly Expenses are payable after the 15th of the following
                month.
              </div>

              {/* Line items table */}
              {sheet.lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground font-body text-center py-4">
                  No expense items recorded for this month.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-body">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="py-2.5 px-3 text-left font-display text-xs uppercase tracking-wider text-muted-foreground">
                          Date
                        </th>
                        <th className="py-2.5 px-3 text-left font-display text-xs uppercase tracking-wider text-muted-foreground">
                          Expense Type
                        </th>
                        <th className="py-2.5 px-3 text-left font-display text-xs uppercase tracking-wider text-muted-foreground">
                          Description
                        </th>
                        <th className="py-2.5 px-3 text-right font-display text-xs uppercase tracking-wider text-muted-foreground">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sheet.lineItems.map((item, idx) => {
                        const warning = getDateWarning(item.date);
                        const itemIso = new Date(Number(item.date) / 1_000_000)
                          .toISOString()
                          .slice(0, 10);
                        const rowKey = `${item.expenseType}-${String(item.date)}-${item.description ?? ""}`;
                        return (
                          <>
                            <tr key={rowKey} className="hover:bg-muted/20">
                              <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs">
                                {formatDate(itemIso)}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-foreground">
                                {item.expenseType}
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground">
                                {item.description ?? "—"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-medium text-foreground">
                                ₹
                                {item.amount.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                            {warning && (
                              <tr key={`warn-${rowKey}`}>
                                <td
                                  colSpan={4}
                                  className="pb-2 px-3"
                                  data-ocid={`expense-warning.${idx + 1}`}
                                >
                                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-800">
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
                                    <span>{warning}</span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-primary/5">
                        <td
                          colSpan={3}
                          className="py-3 px-3 font-display font-semibold text-foreground"
                        >
                          Total Approved Expense
                        </td>
                        <td className="py-3 px-3 text-right font-display font-bold text-primary text-base">
                          ₹
                          {sheet.totalAmount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Expected payment date info */}
              <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground font-body">
                Sheet generated on:{" "}
                {formatDate(
                  new Date(Number(sheet.generatedAt) / 1_000_000)
                    .toISOString()
                    .slice(0, 10),
                )}
                {sheet.paymentDate && (
                  <span className="ml-4 text-green-700 font-medium">
                    Payment Date:{" "}
                    {formatDate(
                      new Date(Number(sheet.paymentDate) / 1_000_000)
                        .toISOString()
                        .slice(0, 10),
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
