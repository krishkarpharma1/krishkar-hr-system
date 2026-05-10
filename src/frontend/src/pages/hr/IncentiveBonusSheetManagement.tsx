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
  CheckCircle2,
  Download,
  Gift,
  Loader2,
  Plus,
  Printer,
  Sparkles,
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

// Indian FY: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
const QUARTERS = [
  { value: "1", label: "Q1 (April – June)", dueDateLabel: "Due after 30 July" },
  {
    value: "2",
    label: "Q2 (July – September)",
    dueDateLabel: "Due after 30 October",
  },
  {
    value: "3",
    label: "Q3 (October – December)",
    dueDateLabel: "Due after 30 January",
  },
  {
    value: "4",
    label: "Q4 (January – March)",
    dueDateLabel: "Due after 30 April",
  },
];

type PaymentStatus = "Pending" | "DueForPayment" | "Paid";

interface IncentiveMonthEntry {
  month: bigint;
  target: bigint;
  achievement: bigint;
  slabLabel: string;
  incentivePercent: number;
  incentiveAmount: bigint;
}

interface BonusEntry {
  bonusType: string;
  amount: bigint;
  remarks: string;
}

interface IncentiveBonusSheet {
  id: string;
  employeeId: bigint;
  quarter: bigint;
  year: bigint;
  monthlyBreakdown: IncentiveMonthEntry[];
  bonusEntries: BonusEntry[];
  totalIncentiveAmount: bigint;
  totalBonusAmount: bigint;
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

export default function IncentiveBonusSheetManagement() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const now = new Date();
  const [quarter, setQuarter] = useState("1");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [sheets, setSheets] = useState<IncentiveBonusSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [payingSheetId, setPayingSheetId] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(
    now.toISOString().slice(0, 10),
  );
  const [selectedSheet, setSelectedSheet] =
    useState<IncentiveBonusSheet | null>(null);
  const [showBonusForm, setShowBonusForm] = useState<string | null>(null);
  const [bonusType, setBonusType] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusRemarks, setBonusRemarks] = useState("");
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
        if (typeof a.getAllIncentiveBonusSheets !== "function") {
          setSheets([]);
          return;
        }
        const result = (await a.getAllIncentiveBonusSheets(
          session.token,
          BigInt(empId),
        )) as IncentiveBonusSheet[];
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
      if (typeof a.generateIncentiveBonusSheet !== "function") {
        toast.info("Incentive/bonus sheet generation not yet available");
        return;
      }
      await a.generateIncentiveBonusSheet(
        session.token,
        BigInt(selectedEmpId),
        BigInt(quarter),
        BigInt(year),
      );
      toast.success("Incentive & bonus sheet generated");
      await loadSheets(selectedEmpId);
    } catch {
      toast.error("Failed to generate sheet");
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPaid = async (sheetId: string) => {
    if (!session || !paymentDate) return;
    try {
      const a = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.markIncentiveBonusSheetPaid !== "function") {
        toast.info("Mark paid not yet available");
        return;
      }
      await a.markIncentiveBonusSheetPaid(session.token, sheetId, paymentDate);
      toast.success("Sheet marked as paid");
      setPayingSheetId(null);
      if (selectedEmpId) await loadSheets(selectedEmpId);
    } catch {
      toast.error("Failed to mark as paid");
    }
  };

  const handleAddBonus = async (sheetId: string) => {
    if (!session || !bonusType || !bonusAmount) return;
    try {
      const a = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.addBonusEntry !== "function") {
        toast.info("Add bonus not yet available");
        return;
      }
      await a.addBonusEntry(
        session.token,
        sheetId,
        bonusType,
        BigInt(bonusAmount),
        bonusRemarks,
      );
      toast.success("Bonus entry added");
      setBonusType("");
      setBonusAmount("");
      setBonusRemarks("");
      setShowBonusForm(null);
      if (selectedEmpId) await loadSheets(selectedEmpId);
    } catch {
      toast.error("Failed to add bonus");
    }
  };

  const handlePrintSheet = (sheet: IncentiveBonusSheet) => {
    setSelectedSheet(sheet);
    setTimeout(() => {
      const content = printRef.current?.innerHTML;
      if (!content) return;
      const w = window.open("", "_blank");
      if (!w) return;
      const brandingHtml = buildBrandingHtml(companyProfile ?? null);
      w.document.write(`<html><head><title>Incentive Sheet - ${employee?.name}</title><style>
        body { font-family: Arial, sans-serif; padding: 24px; font-size: 13px; color: #000; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px 10px; border: 1px solid #ccc; text-align: left; }
        th { background: #f0f0f0; }
        @media print { body { margin: 0; } }
      </style></head><body>${brandingHtml}${content}</body></html>`);
      w.document.close();
      w.print();
    }, 100);
  };

  const fmt = (n: bigint) => `₹${Number(n).toLocaleString("en-IN")}`;
  const quarterLabel = (q: bigint) =>
    QUARTERS.find((x) => x.value === String(q))?.label ?? `Q${q}`;

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="Incentive & Bonus Sheet Management"
        subtitle="Manage quarterly incentive and bonus sheets"
      />
      <PageContent>
        {/* Payment schedule note */}
        <div className="bg-accent/10 border border-accent/30 rounded-lg px-4 py-3 mb-6 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground font-body">
            <strong className="text-foreground">Payment Schedule:</strong>{" "}
            Monthly incentives and bonuses are payable 30 days after the end of
            each quarter. Q1 (Apr–Jun): due after 30 July · Q2 (Jul–Sep): due
            after 30 October · Q3 (Oct–Dec): due after 30 January · Q4
            (Jan–Mar): due after 30 April.
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
                <SelectTrigger data-ocid="incentive-sheet-emp-select">
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
                Quarter (Indian FY)
              </Label>
              <Select value={quarter} onValueChange={setQuarter}>
                <SelectTrigger
                  className="w-[220px]"
                  data-ocid="incentive-quarter"
                >
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
              <Label className="text-xs text-muted-foreground mb-1 block">
                Year
              </Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="h-9 w-[90px]"
                data-ocid="incentive-year"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={!selectedEmpId || generating}
              data-ocid="generate-incentive-sheet-btn"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-1" />
              )}
              Generate Sheet
            </Button>
          </div>
        </div>

        {!selectedEmpId && (
          <div
            className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm"
            data-ocid="incentive-empty"
          >
            Select an employee to view their incentive &amp; bonus sheets
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {!loading && selectedEmpId && sheets.length === 0 && (
          <div
            className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm"
            data-ocid="incentive-no-records"
          >
            No sheets found. Generate one using the controls above.
          </div>
        )}

        {/* Sheets List */}
        {!loading &&
          sheets.map((sheet) => {
            const qInfo = QUARTERS.find(
              (q) => q.value === String(sheet.quarter),
            );
            return (
              <div
                key={sheet.id}
                className="bg-card border border-border rounded-lg overflow-hidden mb-4"
                data-ocid={`incentive-sheet-${sheet.id}`}
              >
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Gift className="w-4 h-4 text-accent" />
                    <span className="font-display font-semibold text-sm text-foreground">
                      {quarterLabel(sheet.quarter)} — FY {String(sheet.year)}
                    </span>
                    {statusBadge(sheet.paymentStatus)}
                    {qInfo && (
                      <span className="text-xs text-muted-foreground">
                        {qInfo.dueDateLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <div className="text-right mr-2">
                      <p className="text-xs text-muted-foreground font-body">
                        Total
                      </p>
                      <p className="font-mono font-bold text-primary text-sm">
                        {fmt(sheet.totalAmount)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handlePrintSheet(sheet)}
                      data-ocid={`print-incentive-${sheet.id}`}
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" /> Print
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handlePrintSheet(sheet)}
                      data-ocid={`download-incentive-${sheet.id}`}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" /> PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        setShowBonusForm(
                          showBonusForm === sheet.id ? null : sheet.id,
                        )
                      }
                      data-ocid={`add-bonus-${sheet.id}`}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Bonus
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
                        data-ocid={`mark-paid-incentive-${sheet.id}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Paid
                      </Button>
                    )}
                  </div>
                </div>

                {/* Mark Paid form */}
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
                    <Button size="sm" onClick={() => handleMarkPaid(sheet.id)}>
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

                {/* Add Bonus form */}
                {showBonusForm === sheet.id && (
                  <div className="px-4 py-3 bg-primary/5 border-b border-border flex flex-wrap gap-3 items-end">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Bonus Type
                      </Label>
                      <Input
                        placeholder="e.g. Performance Bonus"
                        value={bonusType}
                        onChange={(e) => setBonusType(e.target.value)}
                        className="h-8 w-[200px]"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Amount (₹)
                      </Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={bonusAmount}
                        onChange={(e) => setBonusAmount(e.target.value)}
                        className="h-8 w-[120px]"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Remarks
                      </Label>
                      <Input
                        placeholder="Optional"
                        value={bonusRemarks}
                        onChange={(e) => setBonusRemarks(e.target.value)}
                        className="h-8 w-[200px]"
                      />
                    </div>
                    <Button size="sm" onClick={() => handleAddBonus(sheet.id)}>
                      Add Bonus
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowBonusForm(null)}
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

                {/* Monthly Breakdown */}
                {sheet.monthlyBreakdown.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-muted/20 text-xs text-muted-foreground font-display uppercase tracking-wider border-b border-border">
                      Monthly Incentive Breakdown
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm font-body">
                        <thead>
                          <tr className="border-b border-border bg-muted/10">
                            <th className="px-4 py-2 text-xs text-left text-muted-foreground font-display">
                              Month
                            </th>
                            <th className="px-4 py-2 text-xs text-right text-muted-foreground font-display">
                              Target
                            </th>
                            <th className="px-4 py-2 text-xs text-right text-muted-foreground font-display">
                              Achievement
                            </th>
                            <th className="px-4 py-2 text-xs text-left text-muted-foreground font-display">
                              Slab Applied
                            </th>
                            <th className="px-4 py-2 text-xs text-right text-muted-foreground font-display">
                              Incentive %
                            </th>
                            <th className="px-4 py-2 text-xs text-right text-muted-foreground font-display">
                              Incentive Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {sheet.monthlyBreakdown.map((row) => (
                            <tr
                              key={String(row.month)}
                              className="hover:bg-muted/20"
                            >
                              <td className="px-4 py-2.5">
                                {MONTH_NAMES[Number(row.month) - 1]}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs">
                                {fmt(row.target)}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs">
                                {fmt(row.achievement)}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                {row.slabLabel}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs">
                                {row.incentivePercent}%
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-accent">
                                {fmt(row.incentiveAmount)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-muted/30 font-bold">
                            <td
                              colSpan={5}
                              className="px-4 py-2.5 text-right text-sm text-foreground"
                            >
                              Total Incentive
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-sm text-primary">
                              {fmt(sheet.totalIncentiveAmount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Bonus Entries */}
                {sheet.bonusEntries.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-muted/20 text-xs text-muted-foreground font-display uppercase tracking-wider border-t border-b border-border">
                      Bonus Entries
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm font-body">
                        <thead>
                          <tr className="border-b border-border bg-muted/10">
                            <th className="px-4 py-2 text-xs text-left text-muted-foreground font-display">
                              Bonus Type
                            </th>
                            <th className="px-4 py-2 text-xs text-left text-muted-foreground font-display">
                              Remarks
                            </th>
                            <th className="px-4 py-2 text-xs text-right text-muted-foreground font-display">
                              Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {sheet.bonusEntries.map((b) => (
                            <tr key={b.bonusType} className="hover:bg-muted/20">
                              <td className="px-4 py-2.5">{b.bonusType}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                {b.remarks}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-sm font-bold text-accent">
                                {fmt(b.amount)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-muted/30 font-bold">
                            <td
                              colSpan={2}
                              className="px-4 py-2.5 text-right text-sm text-foreground"
                            >
                              Total Bonus
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-sm text-primary">
                              {fmt(sheet.totalBonusAmount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Grand Total */}
                <div className="px-4 py-3 bg-primary/5 border-t border-border flex items-center justify-between">
                  <span className="font-display font-semibold text-sm text-foreground">
                    Grand Total (Incentive + Bonus)
                  </span>
                  <span className="font-display font-bold text-lg text-primary">
                    {fmt(sheet.totalAmount)}
                  </span>
                </div>
              </div>
            );
          })}

        {/* Hidden print template */}
        <div className="hidden">
          <div ref={printRef}>
            {selectedSheet && employee && (
              <div style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}>
                <h3 style={{ textAlign: "center", marginBottom: 8 }}>
                  INCENTIVE & BONUS SHEET
                </h3>
                <p style={{ textAlign: "center" }}>
                  {quarterLabel(selectedSheet.quarter)} — FY{" "}
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
                {selectedSheet.monthlyBreakdown.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 16 }}>
                      Monthly Incentive Breakdown
                    </h4>
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr style={{ background: "#f0f0f0" }}>
                          <th
                            style={{
                              border: "1px solid #ccc",
                              padding: "6px 10px",
                            }}
                          >
                            Month
                          </th>
                          <th
                            style={{
                              border: "1px solid #ccc",
                              padding: "6px 10px",
                              textAlign: "right",
                            }}
                          >
                            Target
                          </th>
                          <th
                            style={{
                              border: "1px solid #ccc",
                              padding: "6px 10px",
                              textAlign: "right",
                            }}
                          >
                            Achievement
                          </th>
                          <th
                            style={{
                              border: "1px solid #ccc",
                              padding: "6px 10px",
                            }}
                          >
                            Slab
                          </th>
                          <th
                            style={{
                              border: "1px solid #ccc",
                              padding: "6px 10px",
                              textAlign: "right",
                            }}
                          >
                            %
                          </th>
                          <th
                            style={{
                              border: "1px solid #ccc",
                              padding: "6px 10px",
                              textAlign: "right",
                            }}
                          >
                            Incentive
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSheet.monthlyBreakdown.map((r) => (
                          <tr key={String(r.month)}>
                            <td
                              style={{
                                border: "1px solid #ccc",
                                padding: "6px 10px",
                              }}
                            >
                              {MONTH_NAMES[Number(r.month) - 1]}
                            </td>
                            <td
                              style={{
                                border: "1px solid #ccc",
                                padding: "6px 10px",
                                textAlign: "right",
                              }}
                            >
                              ₹{Number(r.target).toLocaleString("en-IN")}
                            </td>
                            <td
                              style={{
                                border: "1px solid #ccc",
                                padding: "6px 10px",
                                textAlign: "right",
                              }}
                            >
                              ₹{Number(r.achievement).toLocaleString("en-IN")}
                            </td>
                            <td
                              style={{
                                border: "1px solid #ccc",
                                padding: "6px 10px",
                              }}
                            >
                              {r.slabLabel}
                            </td>
                            <td
                              style={{
                                border: "1px solid #ccc",
                                padding: "6px 10px",
                                textAlign: "right",
                              }}
                            >
                              {r.incentivePercent}%
                            </td>
                            <td
                              style={{
                                border: "1px solid #ccc",
                                padding: "6px 10px",
                                textAlign: "right",
                              }}
                            >
                              ₹
                              {Number(r.incentiveAmount).toLocaleString(
                                "en-IN",
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr
                          style={{ fontWeight: "bold", background: "#f9f9f9" }}
                        >
                          <td
                            colSpan={5}
                            style={{
                              border: "1px solid #ccc",
                              padding: "6px 10px",
                              textAlign: "right",
                            }}
                          >
                            Total Incentive
                          </td>
                          <td
                            style={{
                              border: "1px solid #ccc",
                              padding: "6px 10px",
                              textAlign: "right",
                            }}
                          >
                            ₹
                            {Number(
                              selectedSheet.totalIncentiveAmount,
                            ).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}
                {selectedSheet.bonusEntries.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 16 }}>Bonus Entries</h4>
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr style={{ background: "#f0f0f0" }}>
                          <th
                            style={{
                              border: "1px solid #ccc",
                              padding: "6px 10px",
                            }}
                          >
                            Bonus Type
                          </th>
                          <th
                            style={{
                              border: "1px solid #ccc",
                              padding: "6px 10px",
                            }}
                          >
                            Remarks
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
                        {selectedSheet.bonusEntries.map((b) => (
                          <tr key={b.bonusType}>
                            <td
                              style={{
                                border: "1px solid #ccc",
                                padding: "6px 10px",
                              }}
                            >
                              {b.bonusType}
                            </td>
                            <td
                              style={{
                                border: "1px solid #ccc",
                                padding: "6px 10px",
                              }}
                            >
                              {b.remarks}
                            </td>
                            <td
                              style={{
                                border: "1px solid #ccc",
                                padding: "6px 10px",
                                textAlign: "right",
                              }}
                            >
                              ₹{Number(b.amount).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                <p style={{ marginTop: 16, fontWeight: "bold" }}>
                  Grand Total: ₹
                  {Number(selectedSheet.totalAmount).toLocaleString("en-IN")}
                </p>
                <p
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: "#555",
                    fontStyle: "italic",
                  }}
                >
                  Monthly Incentives and Bonus are payable 30 days after the end
                  of the Quarter.
                </p>
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </PortalLayout>
  );
}
