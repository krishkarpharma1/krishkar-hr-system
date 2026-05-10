import { Badge } from "@/components/ui/badge";
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
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
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
import type { UserInfo } from "../../types";

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

type PaymentStatus = "Pending" | "DueForPayment" | "Paid";

interface ExpenseLineItem {
  category: string;
  description: string;
  amount: bigint;
  date: string;
}

interface ExpenseSheet {
  id: string;
  employeeId: bigint;
  month: bigint;
  year: bigint;
  lineItems: ExpenseLineItem[];
  totalAmount: bigint;
  paymentStatus: PaymentStatus;
  paymentDate?: string;
  markedPaidBy?: string;
  generatedAt: bigint;
}

function statusBadge(status: PaymentStatus) {
  if (status === "Paid")
    return (
      <Badge className="bg-green-500/15 text-green-700 border-green-300">
        Paid
      </Badge>
    );
  if (status === "DueForPayment")
    return (
      <Badge className="bg-amber-500/15 text-amber-700 border-amber-300">
        Due for Payment
      </Badge>
    );
  return (
    <Badge className="bg-muted text-muted-foreground border-border">
      Pending
    </Badge>
  );
}

export default function ExpenseSheetManagement() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [sheets, setSheets] = useState<ExpenseSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [payingSheetId, setPayingSheetId] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(
    now.toISOString().slice(0, 10),
  );
  const [selectedSheet, setSelectedSheet] = useState<ExpenseSheet | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const employee = employees.find((e) => String(e.id) === selectedEmpId);

  useEffect(() => {
    if (!session) return;
    api
      .listAllUsers(session.token)
      .then(setEmployees)
      .catch(() => {});
  }, [session]);

  const loadSheets = useCallback(
    async (empId: string) => {
      if (!session) return;
      setLoading(true);
      try {
        const a = api as unknown as Record<
          string,
          (...args: unknown[]) => Promise<unknown>
        >;
        if (typeof a.getAllExpenseSheets !== "function") {
          setSheets([]);
          return;
        }
        const result = (await a.getAllExpenseSheets(
          session.token,
          BigInt(empId),
        )) as ExpenseSheet[];
        setSheets(Array.isArray(result) ? result : []);
      } catch {
        setSheets([]);
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  useEffect(() => {
    if (!selectedEmpId) {
      setSheets([]);
      return;
    }
    loadSheets(selectedEmpId);
  }, [selectedEmpId, loadSheets]);

  const handleGenerate = async () => {
    if (!session || !selectedEmpId) return;
    setGenerating(true);
    try {
      const a = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.generateExpenseSheet !== "function") {
        toast.info("Expense sheet generation not yet available");
        return;
      }
      await a.generateExpenseSheet(
        session.token,
        BigInt(selectedEmpId),
        BigInt(month),
        BigInt(year),
      );
      toast.success("Expense sheet generated");
      await loadSheets(selectedEmpId);
    } catch {
      toast.error("Failed to generate expense sheet");
    } finally {
      setGenerating(false);
    }
  };

  const handleRefreshStatus = async (sheetId: string) => {
    if (!session) return;
    try {
      const a = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.refreshExpenseSheetStatus !== "function") return;
      await a.refreshExpenseSheetStatus(session.token, sheetId);
      if (selectedEmpId) await loadSheets(selectedEmpId);
    } catch {
      /* silent */
    }
  };

  const handleMarkPaid = async (sheetId: string) => {
    if (!session || !paymentDate) return;
    try {
      const a = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.markExpenseSheetPaid !== "function") {
        toast.info("Mark paid not yet available");
        return;
      }
      await a.markExpenseSheetPaid(session.token, sheetId, paymentDate);
      toast.success("Expense sheet marked as paid");
      setPayingSheetId(null);
      if (selectedEmpId) await loadSheets(selectedEmpId);
    } catch {
      toast.error("Failed to mark as paid");
    }
  };

  const handlePrintSheet = (sheet: ExpenseSheet) => {
    setSelectedSheet(sheet);
    setTimeout(() => {
      const content = printRef.current?.innerHTML;
      if (!content) return;
      const w = window.open("", "_blank");
      if (!w) return;
      const brandingHtml = buildBrandingHtml(companyProfile ?? null);
      w.document.write(`<html><head><title>Expense Sheet - ${employee?.name}</title><style>
        body { font-family: Arial, sans-serif; padding: 24px; font-size: 13px; color: #000; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px 10px; border: 1px solid #ccc; text-align: left; }
        th { background: #f0f0f0; }
        .section-title { font-weight: bold; margin: 12px 0 4px; font-size: 12px; text-transform: uppercase; }
        .total-row { font-weight: bold; background: #f9f9f9; }
        @media print { body { margin: 0; } }
      </style></head><body>${brandingHtml}${content}</body></html>`);
      w.document.close();
      w.print();
    }, 100);
  };

  const fmt = (n: bigint) => `₹${Number(n).toLocaleString("en-IN")}`;

  const filtered = sheets.filter(
    (s) => filterStatus === "all" || s.paymentStatus === filterStatus,
  );
  const totalPending = sheets
    .filter((s) => s.paymentStatus === "Pending")
    .reduce((s, sh) => s + sh.totalAmount, 0n);
  const totalDue = sheets
    .filter((s) => s.paymentStatus === "DueForPayment")
    .reduce((s, sh) => s + sh.totalAmount, 0n);

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="Expense Sheet Management"
        subtitle="Manage monthly employee expense sheets"
      />
      <PageContent>
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground font-body mb-1">
              Total Pending
            </p>
            <p className="font-display font-bold text-lg text-foreground">
              {fmt(totalPending)}
            </p>
          </div>
          <div className="bg-card border border-amber-200 rounded-lg p-4">
            <p className="text-xs text-muted-foreground font-body mb-1">
              Due for Payment
            </p>
            <p className="font-display font-bold text-lg text-amber-600">
              {fmt(totalDue)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground font-body mb-1">
              Total Sheets
            </p>
            <p className="font-display font-bold text-lg text-foreground">
              {sheets.length}
            </p>
          </div>
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 col-span-1">
            <p className="text-xs text-accent font-body">Payment Schedule</p>
            <p className="text-xs text-muted-foreground mt-1 font-body">
              Monthly expenses are payable after the 15th of the following
              month.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground mb-1 block">
                Employee
              </Label>
              <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                <SelectTrigger data-ocid="expense-sheet-emp-select">
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
                <SelectTrigger className="w-[140px]" data-ocid="expense-month">
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
                data-ocid="expense-year"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={!selectedEmpId || generating}
              data-ocid="generate-expense-sheet-btn"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-1" />
              )}
              Generate Sheet
            </Button>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Filter Status
              </Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]" data-ocid="expense-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="DueForPayment">Due for Payment</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {!selectedEmpId && (
          <div
            className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm"
            data-ocid="expense-empty"
          >
            Select an employee to view their expense sheets
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {!loading && selectedEmpId && filtered.length === 0 && (
          <div
            className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm"
            data-ocid="expense-no-records"
          >
            No expense sheets found. Generate one using the controls above.
          </div>
        )}

        {/* Sheets List */}
        {!loading &&
          filtered.map((sheet) => (
            <div
              key={sheet.id}
              className="bg-card border border-border rounded-lg overflow-hidden mb-4"
              data-ocid={`expense-sheet-${sheet.id}`}
            >
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="font-display font-semibold text-sm text-foreground">
                    {MONTH_NAMES[Number(sheet.month) - 1]} {String(sheet.year)}
                  </span>
                  {statusBadge(sheet.paymentStatus)}
                  {sheet.paymentStatus === "DueForPayment" && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <AlertCircle className="w-3.5 h-3.5" /> Due for payment
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="font-mono font-bold text-primary text-sm">
                    {fmt(sheet.totalAmount)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleRefreshStatus(sheet.id)}
                    aria-label="Refresh status"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handlePrintSheet(sheet)}
                    data-ocid={`print-expense-${sheet.id}`}
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" /> Print
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handlePrintSheet(sheet)}
                    data-ocid={`download-expense-${sheet.id}`}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> PDF
                  </Button>
                  {(sheet.paymentStatus === "Pending" ||
                    sheet.paymentStatus === "DueForPayment") && (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        setPayingSheetId(
                          payingSheetId === sheet.id ? null : sheet.id,
                        )
                      }
                      data-ocid={`mark-paid-${sheet.id}`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Paid
                    </Button>
                  )}
                </div>
              </div>

              {payingSheetId === sheet.id && (
                <div className="px-4 py-3 bg-accent/5 border-b border-border flex items-center gap-3 flex-wrap">
                  <Label className="text-xs text-muted-foreground">
                    Payment Date
                  </Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="h-8 w-[160px]"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleMarkPaid(sheet.id)}
                    data-ocid={`confirm-paid-${sheet.id}`}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPayingSheetId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {sheet.paymentStatus === "Paid" && sheet.paymentDate && (
                <div className="px-4 py-2 bg-green-500/5 border-b border-border flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Paid on {sheet.paymentDate}
                  {sheet.markedPaidBy && ` · by ${sheet.markedPaidBy}`}
                </div>
              )}

              {sheet.lineItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-body">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="px-4 py-2 text-xs text-left text-muted-foreground font-display">
                          Date
                        </th>
                        <th className="px-4 py-2 text-xs text-left text-muted-foreground font-display">
                          Category
                        </th>
                        <th className="px-4 py-2 text-xs text-left text-muted-foreground font-display">
                          Description
                        </th>
                        <th className="px-4 py-2 text-xs text-right text-muted-foreground font-display">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sheet.lineItems.map((item) => (
                        <tr
                          key={`${item.date}-${item.category}`}
                          className="hover:bg-muted/20"
                        >
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {item.date}
                          </td>
                          <td className="px-4 py-2.5 text-sm">
                            {item.category}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-muted-foreground">
                            {item.description}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-sm">
                            {fmt(item.amount)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/30 font-bold">
                        <td
                          colSpan={3}
                          className="px-4 py-2.5 text-sm text-right text-foreground"
                        >
                          Total
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm text-primary">
                          {fmt(sheet.totalAmount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" /> No expense line items recorded
                  for this period
                </div>
              )}
            </div>
          ))}

        {/* Hidden print template */}
        <div className="hidden">
          <div ref={printRef}>
            {selectedSheet && employee && (
              <div style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}>
                <h3 style={{ textAlign: "center", marginBottom: 8 }}>
                  EXPENSE SHEET
                </h3>
                <p style={{ textAlign: "center" }}>
                  {MONTH_NAMES[Number(selectedSheet.month) - 1]}{" "}
                  {String(selectedSheet.year)}
                </p>
                <table style={{ width: "100%", marginTop: 12 }}>
                  <tbody>
                    <tr>
                      <td>
                        <strong>Employee:</strong> {employee.name}
                      </td>
                      <td>
                        <strong>Emp ID:</strong> {employee.employeeId}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Designation:</strong> {employee.designation}
                      </td>
                      <td>
                        <strong>Status:</strong> {selectedSheet.paymentStatus}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginTop: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f0f0f0" }}>
                      <th
                        style={{
                          border: "1px solid #ccc",
                          padding: "6px 10px",
                        }}
                      >
                        Date
                      </th>
                      <th
                        style={{
                          border: "1px solid #ccc",
                          padding: "6px 10px",
                        }}
                      >
                        Category
                      </th>
                      <th
                        style={{
                          border: "1px solid #ccc",
                          padding: "6px 10px",
                        }}
                      >
                        Description
                      </th>
                      <th
                        style={{
                          border: "1px solid #ccc",
                          padding: "6px 10px",
                          textAlign: "right",
                        }}
                      >
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSheet.lineItems.map((item) => (
                      <tr key={`${item.date}-${item.category}`}>
                        <td
                          style={{
                            border: "1px solid #ccc",
                            padding: "6px 10px",
                          }}
                        >
                          {item.date}
                        </td>
                        <td
                          style={{
                            border: "1px solid #ccc",
                            padding: "6px 10px",
                          }}
                        >
                          {item.category}
                        </td>
                        <td
                          style={{
                            border: "1px solid #ccc",
                            padding: "6px 10px",
                          }}
                        >
                          {item.description}
                        </td>
                        <td
                          style={{
                            border: "1px solid #ccc",
                            padding: "6px 10px",
                            textAlign: "right",
                          }}
                        >
                          ₹{Number(item.amount).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: "bold", background: "#f9f9f9" }}>
                      <td
                        colSpan={3}
                        style={{
                          border: "1px solid #ccc",
                          padding: "6px 10px",
                          textAlign: "right",
                        }}
                      >
                        Total Approved Amount
                      </td>
                      <td
                        style={{
                          border: "1px solid #ccc",
                          padding: "6px 10px",
                          textAlign: "right",
                        }}
                      >
                        ₹
                        {Number(selectedSheet.totalAmount).toLocaleString(
                          "en-IN",
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p
                  style={{
                    marginTop: 16,
                    fontSize: 11,
                    color: "#555",
                    fontStyle: "italic",
                  }}
                >
                  Monthly Expenses are payable after the 15th of the following
                  month.
                </p>
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </PortalLayout>
  );
}
