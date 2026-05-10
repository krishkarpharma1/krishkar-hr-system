import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  FileText,
  Printer,
  Receipt,
  UserCog,
} from "lucide-react";
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
import type {
  AdditionalCharge,
  LeaveApplication,
  PayrollRecord,
} from "../../types";
import { LeaveStatus } from "../../types";
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

interface MySalarySlipsProps {
  portalRole: Role;
}

function countLeaveDays(
  leaves: LeaveApplication[],
  month: number,
  year: number,
) {
  let casual = 0;
  let sick = 0;
  let unpaid = 0;
  const approved = leaves.filter(
    (l) => String(l.status) === LeaveStatus.approved,
  );
  for (const l of approved) {
    const from = new Date(l.fromDate);
    if (from.getFullYear() === year && from.getMonth() + 1 === month) {
      const days = Number(l.numDays);
      const type = String(l.leaveType);
      if (type === "casual") casual += days;
      else if (type === "sick") sick += days;
      else if (type === "unpaid") unpaid += days;
    }
  }
  return { casual, sick, unpaid };
}

export default function MySalarySlips({ portalRole }: MySalarySlipsProps) {
  const { session } = useAuthStore();
  const [history, setHistory] = useState<PayrollRecord[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveApplication[]>([]);
  const [myCharges, setMyCharges] = useState<AdditionalCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const slipRef = useRef<HTMLDivElement>(null);
  const { companyProfile } = useCompanyProfile();

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.getMyPayrollHistory(session.token),
      api.getMyLeaves(session.token).then((res) => {
        if (res.__kind__ === "ok") return res.ok;
        return [] as LeaveApplication[];
      }),
      api
        .getActiveChargesForEmployee(session.token, session.userId)
        .catch(() => [] as AdditionalCharge[]),
    ])
      .then(([records, leaves, charges]) => {
        const sorted = [...records].sort((a, b) => {
          const ya = Number(a.year);
          const yb = Number(b.year);
          const ma = Number(a.month);
          const mb = Number(b.month);
          return yb !== ya ? yb - ya : mb - ma;
        });
        setHistory(sorted);
        setAllLeaves(leaves);
        setMyCharges(charges);
      })
      .catch(() => setError("Failed to load salary slips. Please try again."))
      .finally(() => setLoading(false));
  }, [session]);

  const years = Array.from(new Set(history.map((r) => Number(r.year)))).sort(
    (a, b) => b - a,
  );
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");

  const filtered = history.filter((r) => {
    const mOk =
      filterMonth === "all" || Number(r.month) === Number(filterMonth);
    const yOk = filterYear === "all" || Number(r.year) === Number(filterYear);
    return mOk && yOk;
  });

  const selectedSlip =
    history.find((r) => `${r.month}-${r.year}` === selectedKey) ?? null;

  const leaveSummary = selectedSlip
    ? countLeaveDays(
        allLeaves,
        Number(selectedSlip.month),
        Number(selectedSlip.year),
      )
    : null;

  const activeChargesForSlip: AdditionalCharge[] = selectedSlip
    ? myCharges.filter((c) => {
        const year = Number(selectedSlip.year);
        const month = Number(selectedSlip.month);
        const monthStart = new Date(year, month - 1, 1).getTime();
        const monthEnd = new Date(year, month, 0, 23, 59, 59).getTime();
        const from = Number(c.effectiveFrom) / 1_000_000;
        const to = Number(c.effectiveTo) / 1_000_000;
        return from <= monthEnd && to >= monthStart;
      })
    : [];

  const fmt = (n: bigint) => `₹${Number(n).toLocaleString("en-IN")}`;

  // Core deductions: PF + ESI + Advance Recovery
  const totalDeductions = (slip: PayrollRecord) =>
    slip.pfDeduction + slip.esiDeduction + slip.advanceRecovery;

  const handlePrint = () => {
    if (!selectedSlip || !session) return;
    const content = slipRef.current?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const brandingHtml = buildBrandingHtml(companyProfile);
    w.document.write(`<html><head><title>Salary Slip — ${MONTH_NAMES[Number(selectedSlip.month) - 1]} ${selectedSlip.year}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 24px; font-size: 13px; color: #000; margin: 0; }
  .slip-header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 12px; }
  .slip-header h1 { margin: 0 0 4px; font-size: 18px; }
  .slip-header p { margin: 2px 0; font-size: 12px; color: #555; }
  .emp-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid #ccc; padding-bottom: 12px; }
  .emp-field label { display: block; font-size: 10px; color: #777; text-transform: uppercase; }
  .emp-field p { margin: 2px 0 0; font-weight: 600; font-size: 13px; }
  .earnings-deductions { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #555; margin: 0 0 6px; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 4px 6px; font-size: 12px; }
  td:last-child { text-align: right; font-family: monospace; }
  .row-total td { font-weight: bold; border-top: 1px solid #ccc; }
  .net-pay-box { margin-top: 16px; background: #eef2ff; border: 1px solid #bbc; border-radius: 6px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
  .net-pay-box .label { font-size: 11px; text-transform: uppercase; color: #555; }
  .net-pay-box .amount { font-size: 22px; font-weight: bold; color: #3730a3; }
  .leave-summary-box { margin-top: 12px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 10px 16px; }
  .leave-summary-box .label { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #555; margin-bottom: 6px; }
  .leave-row td { font-size: 12px; }
  .footer-note { margin-top: 12px; font-size: 10px; color: #999; text-align: center; }
  @media print { body { margin: 0; } }
</style></head><body>${brandingHtml}${content}</body></html>`);
    w.document.close();
    w.print();
    toast.success("Print dialog opened");
  };

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="My Salary Slips"
        subtitle="All slips shown here have been approved by HR"
        actions={
          selectedSlip ? (
            <Button
              onClick={handlePrint}
              data-ocid="print-slip-btn"
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              Print Salary Slip
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-display uppercase tracking-wide">
              Month
            </p>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[150px]" data-ocid="filter-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
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
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[120px]" data-ocid="filter-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && (
          <div className="space-y-2 mb-6" data-ocid="slips-loading">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div
            className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 text-center"
            data-ocid="slips-error"
          >
            <p className="text-destructive text-sm font-body">{error}</p>
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <div
            className="bg-card border border-border rounded-lg p-12 text-center"
            data-ocid="slips-empty"
          >
            <Receipt className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-display font-medium text-foreground mb-1">
              No approved salary slips found
            </p>
            <p className="text-sm text-muted-foreground font-body">
              Please contact HR to generate your salary slip.
            </p>
          </div>
        )}

        {!loading && !error && history.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Slip list */}
            <div className="lg:col-span-1">
              <p className="text-xs uppercase tracking-wider font-display text-muted-foreground mb-2 px-1">
                {filtered.length} slip{filtered.length !== 1 ? "s" : ""}
              </p>
              <div
                className="space-y-2 overflow-y-auto scrollbar-thin"
                style={{ maxHeight: "calc(100vh - 280px)" }}
                data-ocid="slip-list"
              >
                {filtered.length === 0 ? (
                  <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
                    No slips match the selected filter.
                  </div>
                ) : (
                  filtered.map((rec) => {
                    const key = `${rec.month}-${rec.year}`;
                    const isSelected = key === selectedKey;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedKey(isSelected ? "" : key)}
                        className={`w-full text-left rounded-lg border px-4 py-3 transition-smooth font-body ${isSelected ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card hover:bg-muted/30"}`}
                        data-ocid={`slip-card-${key}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText
                              className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                            />
                            <span
                              className={`text-sm font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}
                            >
                              {MONTH_NAMES[Number(rec.month) - 1]}{" "}
                              {String(rec.year)}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-primary flex-shrink-0">
                            {fmt(rec.netPay)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 pl-6.5">
                          Gross {fmt(rec.grossPay)} · Deductions{" "}
                          {fmt(totalDeductions(rec))}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Slip detail */}
            <div className="lg:col-span-2">
              {!selectedSlip ? (
                <div
                  className="bg-card border border-dashed border-border rounded-lg p-12 text-center h-full flex flex-col items-center justify-center"
                  data-ocid="slip-detail-empty"
                >
                  <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground font-body">
                    Select a salary slip from the list to view details
                  </p>
                </div>
              ) : (
                <div
                  ref={slipRef}
                  className="bg-card border border-border rounded-lg overflow-hidden"
                  data-ocid="slip-detail"
                >
                  {/* Header */}
                  <div className="slip-header px-6 py-5 bg-primary/10 border-b border-border text-center">
                    <h2 className="font-display font-bold text-xl text-foreground">
                      Krishkar Pharmaceuticals
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 font-body">
                      SALARY SLIP —{" "}
                      {MONTH_NAMES[
                        Number(selectedSlip.month) - 1
                      ].toUpperCase()}{" "}
                      {String(selectedSlip.year)}
                    </p>
                  </div>

                  {/* Employee Info */}
                  <div className="emp-grid px-6 py-4 border-b border-border">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm font-body">
                      <EmpField
                        label="Employee UID"
                        value={session?.employeeId ?? "—"}
                      />
                      <EmpField label="Name" value={session?.name ?? "—"} />
                      <EmpField
                        label="Month"
                        value={`${MONTH_NAMES[Number(selectedSlip.month) - 1]} ${String(selectedSlip.year)}`}
                      />
                      <EmpField
                        label="Payable Days"
                        value={String(selectedSlip.payableDays)}
                      />
                    </div>
                  </div>

                  {/* Earnings + Deductions */}
                  <div className="earnings-deductions px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Earnings */}
                    <div>
                      <p className="section-title text-xs uppercase tracking-wider font-display text-muted-foreground mb-3">
                        Earnings
                      </p>
                      <table className="w-full text-sm font-body">
                        <tbody className="divide-y divide-border">
                          <SlipRow
                            label="Basic Pay"
                            value={fmt(selectedSlip.basicPay)}
                          />
                          <SlipRow
                            label="House Rent Allowance (HRA)"
                            value={fmt(selectedSlip.hra)}
                          />
                          <SlipRow
                            label="Conveyance Allowance"
                            value={fmt(selectedSlip.taAllowance)}
                          />
                          <SlipRow
                            label="Other Allowances"
                            value={fmt(selectedSlip.daAllowance)}
                          />
                          <SlipRow
                            label="Gross Pay"
                            value={fmt(selectedSlip.grossPay)}
                            bold
                          />
                        </tbody>
                      </table>
                    </div>

                    {/* Deductions — core only: PF, ESI, Advance Recovery */}
                    <div>
                      <p className="section-title text-xs uppercase tracking-wider font-display text-muted-foreground mb-3">
                        Deductions
                      </p>
                      <table className="w-full text-sm font-body">
                        <tbody className="divide-y divide-border">
                          <SlipRow
                            label="Provident Fund (PF 12%)"
                            value={fmt(selectedSlip.pfDeduction)}
                            neg
                          />
                          <SlipRow
                            label="Employee State Insurance (ESI 0.75%)"
                            value={fmt(selectedSlip.esiDeduction)}
                            neg
                          />
                          {selectedSlip.advanceRecovery > BigInt(0) && (
                            <SlipRow
                              label="Advance Recovery"
                              value={fmt(selectedSlip.advanceRecovery)}
                              neg
                            />
                          )}
                          <SlipRow
                            label="Total Deductions"
                            value={fmt(totalDeductions(selectedSlip))}
                            bold
                            neg
                          />
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Net Pay */}
                  <div className="net-pay-box mx-6 mb-4 bg-primary/10 border border-primary/30 rounded-lg px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                        Net Take Home Pay
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-body">
                        {MONTH_NAMES[Number(selectedSlip.month) - 1]}{" "}
                        {String(selectedSlip.year)} ·{" "}
                        {String(selectedSlip.payableDays)} payable days
                      </p>
                    </div>
                    <p
                      className="font-display font-bold text-3xl text-primary"
                      data-ocid="net-pay"
                    >
                      {fmt(selectedSlip.netPay)}
                    </p>
                  </div>

                  {/* Separation Note */}
                  <div className="mx-6 mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
                    <p className="text-xs text-amber-800 font-body">
                      <strong>Note:</strong> Field Expenses (TA/DA), Incentives,
                      and Bonus are paid separately on their own schedules. View
                      them in <em>My Expense Sheet</em> and{" "}
                      <em>My Incentive & Bonus Sheet</em>.
                    </p>
                  </div>

                  {/* Leave Summary */}
                  {leaveSummary !== null && (
                    <div
                      className="leave-summary-box mx-6 mb-4 bg-muted/40 border border-border rounded-lg px-4 py-3"
                      data-ocid="leave-summary"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-xs uppercase tracking-wider font-display font-semibold text-muted-foreground">
                          Leave Summary This Month
                        </p>
                      </div>
                      <table className="w-full leave-row text-sm font-body">
                        <tbody className="divide-y divide-border/50">
                          <tr>
                            <td className="py-1.5 text-muted-foreground">
                              Casual Leave Taken
                            </td>
                            <td className="py-1.5 text-right font-mono text-foreground">
                              {leaveSummary.casual} day
                              {leaveSummary.casual !== 1 ? "s" : ""}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-muted-foreground">
                              Sick Leave Taken
                            </td>
                            <td className="py-1.5 text-right font-mono text-foreground">
                              {leaveSummary.sick} day
                              {leaveSummary.sick !== 1 ? "s" : ""}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-muted-foreground">
                              Un-Paid Leave Taken
                            </td>
                            <td className="py-1.5 text-right font-mono text-foreground">
                              {leaveSummary.unpaid} day
                              {leaveSummary.unpaid !== 1 ? "s" : ""}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 font-medium text-foreground">
                              Total Leave Days
                            </td>
                            <td className="py-1.5 text-right font-mono font-bold text-foreground">
                              {leaveSummary.casual +
                                leaveSummary.sick +
                                leaveSummary.unpaid}{" "}
                              day
                              {leaveSummary.casual +
                                leaveSummary.sick +
                                leaveSummary.unpaid !==
                              1
                                ? "s"
                                : ""}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Additional Charges */}
                  {activeChargesForSlip.length > 0 && (
                    <div
                      className="mx-6 mb-4 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3"
                      data-ocid="additional-charges-slip"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <UserCog className="w-3.5 h-3.5 text-primary" />
                        <p className="text-xs uppercase tracking-wider font-display font-semibold text-muted-foreground">
                          Additional Charges (Active This Month)
                        </p>
                      </div>
                      <table className="w-full text-sm font-body">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="pb-1 text-left text-xs text-muted-foreground font-medium">
                              Type
                            </th>
                            <th className="pb-1 text-left text-xs text-muted-foreground font-medium">
                              Role / Area
                            </th>
                            <th className="pb-1 text-left text-xs text-muted-foreground font-medium">
                              Effective From
                            </th>
                            <th className="pb-1 text-left text-xs text-muted-foreground font-medium">
                              Effective To
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {activeChargesForSlip.map((c) => (
                            <tr key={c.id}>
                              <td className="py-1.5 text-muted-foreground text-xs">
                                {c.chargeType}
                              </td>
                              <td className="py-1.5 font-medium text-foreground">
                                {c.additionalRole ?? c.additionalArea ?? "—"}
                              </td>
                              <td className="py-1.5 font-mono text-xs text-muted-foreground">
                                {formatDate(c.effectiveFrom)}
                              </td>
                              <td className="py-1.5 font-mono text-xs text-muted-foreground">
                                {formatDate(c.effectiveTo)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="footer-note px-6 pb-4 text-xs text-muted-foreground font-body">
                    Processed on: {formatDate(selectedSlip.processedAt)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}

function EmpField({ label, value }: { label: string; value: string }) {
  return (
    <div className="emp-field">
      <span className="text-muted-foreground text-xs block">{label}</span>
      <p className="font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function SlipRow({
  label,
  value,
  bold,
  neg,
}: { label: string; value: string; bold?: boolean; neg?: boolean }) {
  return (
    <tr>
      <td
        className={`py-2 pr-4 text-muted-foreground ${bold ? "font-medium text-foreground" : ""}`}
      >
        {label}
      </td>
      <td
        className={`py-2 text-right font-mono ${bold ? "font-bold text-foreground" : ""} ${neg ? "text-destructive" : ""}`}
      >
        {value}
      </td>
    </tr>
  );
}
