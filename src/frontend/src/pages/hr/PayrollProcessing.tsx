import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  Download,
  Info,
  Loader2,
  Printer,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import { buildBrandingHtml } from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";
import type { PayrollRecord, UserInfo } from "../../types";

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

interface AdvanceDeduction {
  label: string;
  amount: bigint;
}

export default function PayrollProcessing() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [payroll, setPayroll] = useState<PayrollRecord | null>(null);
  const [payrollHistory, setPayrollHistory] = useState<PayrollRecord[]>([]);
  const [employee, setEmployee] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [fetchingDcrDa, setFetchingDcrDa] = useState(false);
  const [dcrDaTotal, setDcrDaTotal] = useState<bigint | null>(null);
  const [advanceDeductions, setAdvanceDeductions] = useState<
    AdvanceDeduction[]
  >([]);
  const [totalAdvanceDeduction, setTotalAdvanceDeduction] =
    useState<bigint>(0n);
  const slipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    api
      .listAllUsers(session.token)
      .then(setEmployees)
      .catch(() => {});
  }, [session]);

  const fetchDcrDa = useCallback(
    async (empId: string) => {
      if (!session) return;
      setFetchingDcrDa(true);
      try {
        const total = await api.getEmployeeDcrDaForMonth(
          session.token,
          BigInt(empId),
          BigInt(month),
          BigInt(year),
        );
        setDcrDaTotal(total);
      } catch {
        setDcrDaTotal(null);
      } finally {
        setFetchingDcrDa(false);
      }
    },
    [session, month, year],
  );

  const fetchAdvances = useCallback(
    async (empId: string) => {
      if (!session) return;
      try {
        const a = api as unknown as Record<
          string,
          (...args: unknown[]) => Promise<unknown>
        >;
        if (typeof a.getAdvancesByEmployee !== "function") return;
        const advances = (await a.getAdvancesByEmployee(
          session.token,
          BigInt(empId),
          BigInt(month),
          BigInt(year),
        )) as Array<{ label: string; amount: bigint }>;
        if (Array.isArray(advances)) {
          setAdvanceDeductions(advances);
          setTotalAdvanceDeduction(advances.reduce((s, d) => s + d.amount, 0n));
        }
      } catch {
        setAdvanceDeductions([]);
        setTotalAdvanceDeduction(0n);
      }
    },
    [session, month, year],
  );

  useEffect(() => {
    if (!selectedEmpId) {
      setEmployee(null);
      setPayroll(null);
      setPayrollHistory([]);
      setDcrDaTotal(null);
      setAdvanceDeductions([]);
      setTotalAdvanceDeduction(0n);
      return;
    }
    setEmployee(employees.find((e) => String(e.id) === selectedEmpId) ?? null);
    setPayroll(null);
    loadHistory(selectedEmpId);
    fetchDcrDa(selectedEmpId);
    fetchAdvances(selectedEmpId);
  }, [selectedEmpId, employees, fetchDcrDa, fetchAdvances]);

  const loadHistory = async (empId: string) => {
    if (!session) return;
    const records: PayrollRecord[] = [];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    for (let m = 1; m <= currentMonth; m++) {
      try {
        const rec = await api.getPayrollRecord(
          session.token,
          BigInt(empId),
          BigInt(m),
          BigInt(currentYear),
        );
        if (rec !== null) records.push(rec);
      } catch {
        /* no record for this month */
      }
    }
    setPayrollHistory(records);
  };

  const fetchPayroll = async () => {
    if (!session || !selectedEmpId) return;
    setLoading(true);
    try {
      const rec = await api.getPayrollRecord(
        session.token,
        BigInt(selectedEmpId),
        BigInt(month),
        BigInt(year),
      );
      if (rec !== null) setPayroll(rec);
    } catch {
      toast.error("Failed to load payroll");
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!session || !selectedEmpId) return;
    setProcessing(true);
    try {
      // Process advance deductions first if API available
      const a = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.processMonthlyAdvanceDeductions === "function") {
        await a
          .processMonthlyAdvanceDeductions(
            session.token,
            BigInt(selectedEmpId),
            BigInt(month),
            BigInt(year),
          )
          .catch(() => {});
      }
      const res = await api.processPayroll(
        session.token,
        BigInt(selectedEmpId),
        BigInt(month),
        BigInt(year),
      );
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      toast.success("Payroll processed successfully");
      await fetchPayroll();
      await fetchAdvances(selectedEmpId);
      loadHistory(selectedEmpId);
    } catch {
      toast.error("Payroll processing failed");
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = () => {
    const content = slipRef.current?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const brandingHtml = buildBrandingHtml(companyProfile ?? null);
    w.document.write(`<html><head><title>Salary Slip - ${employee?.name}</title><style>
      body { font-family: Arial, sans-serif; padding: 24px; font-size: 13px; color: #000; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 6px 10px; border: 1px solid #ccc; text-align: left; }
      th { background: #f0f0f0; }
      .header { text-align: center; margin-bottom: 20px; }
      .section-title { font-weight: bold; margin: 12px 0 4px; font-size: 12px; text-transform: uppercase; }
      .total-row { font-weight: bold; background: #f9f9f9; }
      .net-row { font-weight: bold; font-size: 15px; background: #e8f0fe; }
      @media print { body { margin: 0; } }
    </style></head><body>${brandingHtml}${content}</body></html>`);
    w.document.close();
    w.print();
  };

  const handleDownloadPDF = () => {
    handlePrint();
    toast.info("Use your browser's 'Save as PDF' option in the print dialog");
  };

  const fmt = (n: bigint) => `₹${Number(n).toLocaleString("en-IN")}`;
  const totalDeductions = payroll
    ? payroll.pfDeduction + payroll.esiDeduction + totalAdvanceDeduction
    : 0n;
  const adjustedNetPay = payroll ? payroll.netPay - totalAdvanceDeduction : 0n;

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="Payroll Processing"
        subtitle="Process salary and view salary slips"
      />
      <PageContent>
        {/* Controls */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground mb-1 block">
                Employee
              </Label>
              <Select
                value={selectedEmpId}
                onValueChange={(v) => {
                  setSelectedEmpId(v);
                  setPayroll(null);
                }}
              >
                <SelectTrigger data-ocid="payroll-emp-select">
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={String(e.id)} value={String(e.id)}>
                      {e.name} ({e.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Month
              </Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-[140px]" data-ocid="payroll-month">
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
              <Label className="text-xs text-muted-foreground mb-1 block">
                Year
              </Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="h-9 w-[90px]"
                data-ocid="payroll-year"
              />
            </div>
            <Button
              variant="outline"
              onClick={fetchPayroll}
              disabled={!selectedEmpId || loading}
              data-ocid="fetch-payroll-btn"
            >
              <RefreshCw
                className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
              />{" "}
              Fetch
            </Button>
          </div>

          {selectedEmpId && (
            <div className="mt-3 pt-3 border-t border-border">
              {/* DA from Daily Reports info */}
              <div className="flex flex-wrap items-center gap-2 mb-3 bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
                <Info className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-xs text-muted-foreground font-body">
                  DA from Daily Reports ({MONTH_NAMES[Number(month) - 1]} {year}
                  ):
                </span>
                {fetchingDcrDa ? (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                ) : (
                  <span
                    className="text-xs font-mono font-bold text-primary"
                    data-ocid="dcr-da-total"
                  >
                    {dcrDaTotal !== null ? fmt(dcrDaTotal) : "—"}
                  </span>
                )}
                <span className="text-xs text-muted-foreground italic ml-1">
                  · DA is managed via the separate Expense Sheet
                </span>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <Button
                  onClick={handleProcess}
                  disabled={!selectedEmpId || processing}
                  data-ocid="process-payroll-btn"
                >
                  {processing ? "Processing…" : "Process Payroll"}
                </Button>
                {payroll && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handlePrint}
                      data-ocid="print-slip-btn"
                    >
                      <Printer className="w-4 h-4 mr-1" /> Print Slip
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDownloadPDF}
                      data-ocid="download-pdf-btn"
                    >
                      <Download className="w-4 h-4 mr-1" /> Download PDF
                    </Button>
                  </>
                )}
                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 border border-border rounded-md px-3 py-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-accent" />
                  <span>
                    Expenses &amp; Incentives are managed on separate sheets
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {!selectedEmpId && (
          <div
            className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm"
            data-ocid="payroll-empty"
          >
            Select an employee and month to view or process payroll
          </div>
        )}

        {selectedEmpId && !payroll && !loading && (
          <div
            className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm"
            data-ocid="no-payroll-record"
          >
            No payroll record found for this period. Click "Process Payroll" to
            generate.
          </div>
        )}

        {/* Salary Slip — CORE components only, no expenses/incentives/bonus */}
        {payroll && employee && (
          <div
            ref={slipRef}
            className="bg-card border border-border rounded-lg overflow-hidden mb-6"
          >
            {/* Company header */}
            <div className="px-6 py-5 bg-primary/10 border-b border-border text-center">
              <h2 className="font-display font-bold text-xl text-foreground">
                Krishkar Pharmaceuticals
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                SALARY SLIP —{" "}
                {MONTH_NAMES[Number(payroll.month) - 1].toUpperCase()}{" "}
                {String(payroll.year)}
              </p>
            </div>

            {/* Employee details */}
            <div className="px-6 py-4 border-b border-border">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm font-body">
                <div>
                  <span className="text-muted-foreground text-xs">Name</span>
                  <p className="font-medium text-foreground">{employee.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Emp ID</span>
                  <p className="font-medium text-foreground">
                    {employee.employeeId}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">
                    Designation
                  </span>
                  <p className="font-medium text-foreground">
                    {employee.designation}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">
                    Department
                  </span>
                  <p className="font-medium text-foreground">
                    {employee.department}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">
                    Payable Days
                  </span>
                  <p className="font-medium text-foreground">
                    {String(payroll.payableDays)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Month</span>
                  <p className="font-medium text-foreground">
                    {MONTH_NAMES[Number(payroll.month) - 1]}{" "}
                    {String(payroll.year)}
                  </p>
                </div>
              </div>
            </div>

            {/* Earnings + Deductions */}
            <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs uppercase tracking-wider font-display text-muted-foreground mb-3">
                  Earnings
                </p>
                <table className="w-full text-sm font-body">
                  <tbody className="divide-y divide-border">
                    <SlipRow label="Basic Pay" value={fmt(payroll.basicPay)} />
                    <SlipRow
                      label="House Rent Allowance (HRA)"
                      value={fmt(payroll.hra)}
                    />
                    <SlipRow
                      label="Conveyance Allowance"
                      value={fmt(payroll.taAllowance)}
                    />
                    <SlipRow
                      label="Gross Pay"
                      value={fmt(payroll.grossPay)}
                      bold
                    />
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground mt-2 italic font-body">
                  Note: TA/DA expenses &amp; incentives are paid separately via
                  Expense &amp; Incentive Sheets.
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider font-display text-muted-foreground mb-3">
                  Deductions
                </p>
                <table className="w-full text-sm font-body">
                  <tbody className="divide-y divide-border">
                    <SlipRow
                      label="Provident Fund (PF 12%)"
                      value={fmt(payroll.pfDeduction)}
                      neg
                    />
                    <SlipRow
                      label="Employee State Insurance (ESI 0.75%)"
                      value={fmt(payroll.esiDeduction)}
                      neg
                    />
                    {advanceDeductions.map((d) => (
                      <SlipRow
                        key={d.label || "adv"}
                        label={d.label || "Advance Recovery"}
                        value={fmt(d.amount)}
                        neg
                      />
                    ))}
                    {totalAdvanceDeduction === 0n && (
                      <SlipRow label="Advance Recovery" value="₹0" neg />
                    )}
                    <SlipRow
                      label="Total Deductions"
                      value={fmt(totalDeductions)}
                      bold
                      neg
                    />
                  </tbody>
                </table>
              </div>
            </div>

            {/* Net Pay */}
            <div className="mx-6 mb-6 bg-primary/10 border border-primary/30 rounded-lg px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                  Net Take Home Pay
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 font-body">
                  {MONTH_NAMES[Number(payroll.month) - 1]}{" "}
                  {String(payroll.year)} · {String(payroll.payableDays)} payable
                  days
                </p>
              </div>
              <p
                className="font-display font-bold text-3xl text-primary"
                data-ocid="net-pay"
              >
                {fmt(
                  totalAdvanceDeduction > 0n ? adjustedNetPay : payroll.netPay,
                )}
              </p>
            </div>

            <div className="px-6 pb-4 text-xs text-muted-foreground font-body">
              Processed on:{" "}
              {new Date(
                Number(payroll.processedAt) / 1_000_000,
              ).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        )}

        {/* Payroll History */}
        {selectedEmpId && payrollHistory.length > 0 && (
          <div
            className="bg-card border border-border rounded-lg overflow-hidden"
            data-ocid="payroll-history"
          >
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                Payroll History — {employee?.name ?? "Employee"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {[
                      "Month",
                      "Basic",
                      "Gross",
                      "PF",
                      "ESI",
                      "Net Pay",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-2.5 text-xs text-muted-foreground font-display ${h && h !== "Month" ? "text-right" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payrollHistory.map((rec) => (
                    <tr
                      key={`${rec.month}-${rec.year}`}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {MONTH_NAMES[Number(rec.month) - 1]} {String(rec.year)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {fmt(rec.basicPay)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {fmt(rec.grossPay)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-destructive">
                        -{fmt(rec.pfDeduction)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-destructive">
                        -{fmt(rec.esiDeduction)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-primary">
                        {fmt(rec.netPay)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setPayroll(rec)}
                          data-ocid={`view-history-${rec.month}`}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PageContent>
    </PortalLayout>
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
