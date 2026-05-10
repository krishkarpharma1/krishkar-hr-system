import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Download,
  FileSpreadsheet,
  Printer,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { Role } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import {
  buildBrandingExcelRows,
  buildBrandingHtml,
} from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";
import type { ExpenseClaimSummaryRow } from "../../types";
import { formatDate } from "../../utils/dateFormatter";

interface Props {
  portalRole: Role;
}

function isoToDisplayDate(iso: string): string {
  if (!iso) return "";
  return formatDate(iso);
}

export default function ExpenseClaimSummaryReport({ portalRole }: Props) {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [fromDate, setFromDate] = useState(
    firstOfMonth.toISOString().slice(0, 10),
  );
  const [toDate, setToDate] = useState(today.toISOString().slice(0, 10));
  const [rows, setRows] = useState<ExpenseClaimSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getExpenseClaimSummary(
        session.token,
        fromDate,
        toDate,
      );
      setRows(data ?? []);
      setFetched(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      setError(msg);
      toast.error("Could not load Expense Claim Summary. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [session, fromDate, toDate]);

  const handleExportExcel = useCallback(() => {
    if (rows.length === 0) {
      toast.warning("No data to export.");
      return;
    }
    const headerRows = buildBrandingExcelRows(companyProfile ?? null);
    const dataRows = rows.map((r) => {
      const byType = Object.fromEntries(
        (r.byType ?? []).map(([type, amt]) => [`${type} (₹)`, amt.toFixed(2)]),
      );
      return {
        "MR Name": r.mrName,
        "Total Claimed (₹)": r.totalClaimed.toFixed(2),
        ...byType,
        "Doctor Calls": Number(r.doctorCallsInPeriod),
        "Chemist Visits": Number(r.chemistVisitsInPeriod),
        "Stockist Visits": Number(r.stockistVisitsInPeriod),
      };
    });
    const allRows = [...headerRows, ...dataRows] as Record<string, unknown>[];
    const ws = XLSX.utils.json_to_sheet(allRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expense Summary");
    const filename = `ExpenseClaimSummary_${fromDate}_to_${toDate}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Exported ${rows.length} rows`);
  }, [rows, companyProfile, fromDate, toDate]);

  const handleExportPdf = useCallback(() => {
    if (rows.length === 0) {
      toast.warning("No data to export.");
      return;
    }

    // Gather all expense types for column headers
    const allTypes = new Set<string>();
    for (const r of rows) {
      for (const [t] of r.byType ?? []) {
        allTypes.add(t);
      }
    }
    const typeArr = [...allTypes];

    const tableHtml = `
      <table class="pdf-table">
        <thead>
          <tr>
            <th>MR Name</th>
            <th>Total Claimed (₹)</th>
            ${typeArr.map((t) => `<th>${t} (₹)</th>`).join("")}
            <th>Doctor Calls</th>
            <th>Chemist Visits</th>
            <th>Stockist Visits</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr>
              <td>${r.mrName}</td>
              <td style="text-align:right;font-weight:bold">₹${r.totalClaimed.toFixed(2)}</td>
              ${typeArr
                .map((t) => {
                  const amt = (r.byType ?? []).find(([k]) => k === t)?.[1] ?? 0;
                  return `<td style="text-align:right">₹${amt.toFixed(2)}</td>`;
                })
                .join("")}
              <td style="text-align:center">${Number(r.doctorCallsInPeriod)}</td>
              <td style="text-align:center">${Number(r.chemistVisitsInPeriod)}</td>
              <td style="text-align:center">${Number(r.stockistVisitsInPeriod)}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
        <tfoot>
          <tr style="background:#e0f2fe;font-weight:bold">
            <td>TOTAL</td>
            <td style="text-align:right">₹${rows.reduce((s, r) => s + r.totalClaimed, 0).toFixed(2)}</td>
            ${typeArr
              .map((t) => {
                const sum = rows.reduce(
                  (s, r) =>
                    s + ((r.byType ?? []).find(([k]) => k === t)?.[1] ?? 0),
                  0,
                );
                return `<td style="text-align:right">₹${sum.toFixed(2)}</td>`;
              })
              .join("")}
            <td style="text-align:center">${rows.reduce((s, r) => s + Number(r.doctorCallsInPeriod), 0)}</td>
            <td style="text-align:center">${rows.reduce((s, r) => s + Number(r.chemistVisitsInPeriod), 0)}</td>
            <td style="text-align:center">${rows.reduce((s, r) => s + Number(r.stockistVisitsInPeriod), 0)}</td>
          </tr>
        </tfoot>
      </table>`;

    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Pop-up blocked. Please allow pop-ups and try again.");
      return;
    }
    const brandingHtml = buildBrandingHtml({
      companyProfile: companyProfile ?? null,
      docTitle: "Expense Claim Summary Report",
      period: `${isoToDisplayDate(fromDate)} to ${isoToDisplayDate(toDate)}`,
      generatedBy: session?.name,
      generatedByRole: session?.role,
      docType: "report",
      orientation: "landscape",
    });
    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Expense Claim Summary — ${fromDate} to ${toDate}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; }
  </style>
</head>
<body>
${brandingHtml}
<div class="pdf-body">
  <p class="pdf-filter-summary">Period: ${isoToDisplayDate(fromDate)} to ${isoToDisplayDate(toDate)} | Records: ${rows.length} MRs</p>
  ${tableHtml}
</div>
</body>
</html>`);
    w.document.close();
    setTimeout(() => {
      w.print();
    }, 300);
    toast.success("Print dialog opened — select 'Save as PDF'");
  }, [rows, companyProfile, fromDate, toDate, session]);

  // Grand total
  const grandTotal = rows.reduce((s, r) => s + r.totalClaimed, 0);

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Expense Claim Summary"
        subtitle="Total expense claimed per MR alongside field activity counts"
      />
      <PageContent>
        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">From Date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 text-xs w-[160px]"
              data-ocid="expense-summary.from-date"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 text-xs w-[160px]"
              data-ocid="expense-summary.to-date"
            />
          </div>
          <Button
            size="sm"
            className="h-9 gap-1.5 mt-auto"
            onClick={() => void fetchData()}
            disabled={loading}
            data-ocid="expense-summary.search-btn"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            {loading ? "Loading…" : "Apply Filter"}
          </Button>

          {fetched && rows.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1.5 mt-auto"
                onClick={handleExportExcel}
                data-ocid="expense-summary.excel-btn"
              >
                <Download className="w-4 h-4" />
                Excel
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1.5 mt-auto"
                onClick={handleExportPdf}
                data-ocid="expense-summary.pdf-btn"
              >
                <Printer className="w-4 h-4" />
                Export PDF
              </Button>
            </>
          )}
        </div>

        {/* Error state */}
        {error && !loading && (
          <div
            className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-4 flex items-center gap-3 mb-4"
            data-ocid="expense-summary.error_state"
          >
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-destructive font-medium">
                Could not load data.
              </p>
              <p className="text-xs text-destructive/80 font-body mt-0.5">
                {error}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void fetchData()}
              data-ocid="expense-summary.retry-btn"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2" data-ocid="expense-summary.loading_state">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && fetched && rows.length === 0 && !error && (
          <div
            className="bg-card border border-border rounded-lg p-12 text-center"
            data-ocid="expense-summary.empty_state"
          >
            <Receipt className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-display font-medium text-foreground mb-1">
              No expense claims found
            </p>
            <p className="text-sm text-muted-foreground font-body">
              No expense claims were found for the selected date range. Try
              widening the filter period.
            </p>
          </div>
        )}

        {/* Not yet fetched nudge */}
        {!loading && !fetched && !error && (
          <div className="bg-card border border-border rounded-lg p-10 text-center">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-body">
              Select a date range and click <strong>Apply Filter</strong> to
              load the expense summary.
            </p>
          </div>
        )}

        {/* Results table */}
        {!loading && rows.length > 0 && (
          <div
            className="bg-card border border-border rounded-lg overflow-hidden"
            data-ocid="expense-summary.table"
          >
            {/* Grand total banner */}
            <div className="px-5 py-3 bg-primary/5 border-b border-border flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-display font-semibold text-foreground">
                {rows.length} MR{rows.length !== 1 ? "s" : ""} ·{" "}
                {isoToDisplayDate(fromDate)} to {isoToDisplayDate(toDate)}
              </p>
              <p className="text-base font-display font-bold text-primary">
                Grand Total: ₹
                {grandTotal.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="py-2.5 px-4 text-left font-display text-xs uppercase tracking-wider text-muted-foreground">
                      #
                    </th>
                    <th className="py-2.5 px-4 text-left font-display text-xs uppercase tracking-wider text-muted-foreground">
                      MR Name
                    </th>
                    <th className="py-2.5 px-4 text-right font-display text-xs uppercase tracking-wider text-muted-foreground">
                      Total Claimed (₹)
                    </th>
                    <th className="py-2.5 px-4 text-left font-display text-xs uppercase tracking-wider text-muted-foreground">
                      Breakdown
                    </th>
                    <th className="py-2.5 px-4 text-center font-display text-xs uppercase tracking-wider text-muted-foreground">
                      Doctor Calls
                    </th>
                    <th className="py-2.5 px-4 text-center font-display text-xs uppercase tracking-wider text-muted-foreground">
                      Chemist Visits
                    </th>
                    <th className="py-2.5 px-4 text-center font-display text-xs uppercase tracking-wider text-muted-foreground">
                      Stockist Visits
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, idx) => (
                    <tr
                      key={String(row.mrId)}
                      className="hover:bg-muted/20 transition-colors"
                      data-ocid={`expense-summary.item.${idx + 1}`}
                    >
                      <td className="py-3 px-4 text-xs text-muted-foreground font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {row.mrName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                        ₹
                        {row.totalClaimed.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4">
                        {(row.byType ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {(row.byType ?? []).map(([type, amt]) => (
                              <span
                                key={type}
                                className="inline-flex items-center gap-1 text-[10px] bg-muted border border-border rounded px-1.5 py-0.5 text-foreground"
                              >
                                <span className="text-muted-foreground">
                                  {type}:
                                </span>
                                <span className="font-mono font-medium">
                                  ₹{amt.toFixed(2)}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-muted-foreground font-mono text-sm">
                        {Number(row.doctorCallsInPeriod)}
                      </td>
                      <td className="py-3 px-4 text-center text-muted-foreground font-mono text-sm">
                        {Number(row.chemistVisitsInPeriod)}
                      </td>
                      <td className="py-3 px-4 text-center text-muted-foreground font-mono text-sm">
                        {Number(row.stockistVisitsInPeriod)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-primary/5">
                    <td
                      colSpan={2}
                      className="py-3 px-4 font-display font-semibold text-foreground"
                    >
                      Total ({rows.length} MRs)
                    </td>
                    <td className="py-3 px-4 text-right font-display font-bold text-primary">
                      ₹
                      {grandTotal.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4 text-center font-display font-bold text-foreground font-mono">
                      {rows.reduce(
                        (s, r) => s + Number(r.doctorCallsInPeriod),
                        0,
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-display font-bold text-foreground font-mono">
                      {rows.reduce(
                        (s, r) => s + Number(r.chemistVisitsInPeriod),
                        0,
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-display font-bold text-foreground font-mono">
                      {rows.reduce(
                        (s, r) => s + Number(r.stockistVisitsInPeriod),
                        0,
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
