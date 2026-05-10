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
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import { buildBrandingExcelRows } from "../../lib/brandingHtml";
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

const ADVANCE_REASONS = [
  "Medical Emergency",
  "Personal Need",
  "Festival Advance",
  "Home Loan",
  "Education",
  "Other",
];

type AdvanceStatus = "Active" | "FullyRecovered" | "Cancelled" | "Paused";

interface EmployeeAdvance {
  id: string;
  employeeId: bigint;
  employeeName?: string;
  advanceAmount: bigint;
  advanceDate: string;
  reason: string;
  totalInstallments: bigint;
  installmentAmount: bigint;
  installmentStartMonth: bigint;
  installmentStartYear: bigint;
  firstDeductionMonth: bigint;
  firstDeductionYear: bigint;
  amountRecovered: bigint;
  installmentsCompleted: bigint;
  status: AdvanceStatus;
  createdBy: string;
  createdAt: bigint;
  remarks?: string;
  cancelRemark?: string;
  isPaused: boolean;
}

function statusBadge(status: AdvanceStatus, isPaused: boolean) {
  if (isPaused)
    return (
      <Badge className="bg-orange-500/15 text-orange-700 border-orange-300">
        Paused
      </Badge>
    );
  if (status === "FullyRecovered")
    return (
      <Badge className="bg-green-500/15 text-green-700 border-green-300">
        Fully Recovered
      </Badge>
    );
  if (status === "Cancelled")
    return (
      <Badge className="bg-red-500/15 text-red-700 border-red-300">
        Cancelled
      </Badge>
    );
  return (
    <Badge className="bg-primary/15 text-primary border-primary/30">
      Active
    </Badge>
  );
}

const fmt = (n: bigint) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function EmployeeAdvances() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterEmpId, setFilterEmpId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelRemark, setCancelRemark] = useState("");
  const now = new Date();

  // Create form state
  const [formEmpId, setFormEmpId] = useState<string>("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(now.toISOString().slice(0, 10));
  const [formReason, setFormReason] = useState(ADVANCE_REASONS[0]);
  const [formInstallments, setFormInstallments] = useState("6");
  const [formStartMonth, setFormStartMonth] = useState(
    String(now.getMonth() + 1),
  );
  const [formStartYear, setFormStartYear] = useState(String(now.getFullYear()));
  const [formRemarks, setFormRemarks] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit form state
  const [editInstallments, setEditInstallments] = useState("");
  const [editInstallmentAmount, setEditInstallmentAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const formInstallmentAmount =
    formAmount && formInstallments
      ? Math.ceil(Number(formAmount) / Number(formInstallments))
      : 0;

  const firstDeductionMonth = (() => {
    const m = Number(formStartMonth);
    const y = Number(formStartYear);
    if (m === 12) return { month: 1, year: y + 1 };
    return { month: m + 1, year: y };
  })();

  useEffect(() => {
    if (!session) return;
    api
      .listAllUsers(session.token)
      .then(setEmployees)
      .catch(() => {});
    loadAdvances();
  }, [session]);

  const loadAdvances = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const a = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getAllAdvances !== "function") {
        setAdvances([]);
        return;
      }
      const result = (await a.getAllAdvances(
        session.token,
      )) as EmployeeAdvance[];
      if (Array.isArray(result)) {
        const empMap = new Map(
          (await api.listAllUsers(session.token)).map((e) => [
            String(e.id),
            e.name,
          ]),
        );
        setAdvances(
          result.map((adv) => ({
            ...adv,
            employeeName:
              empMap.get(String(adv.employeeId)) ??
              `EMP-${String(adv.employeeId)}`,
          })),
        );
      }
    } catch {
      setAdvances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!session || !formEmpId || !formAmount || !formInstallments) return;
    setCreating(true);
    try {
      const a = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.createAdvance !== "function") {
        toast.info("Create advance not yet available");
        return;
      }
      await a.createAdvance(session.token, {
        employeeId: BigInt(formEmpId),
        advanceAmount: BigInt(formAmount),
        advanceDate: formDate,
        reason: formReason,
        totalInstallments: BigInt(formInstallments),
        installmentAmount: BigInt(formInstallmentAmount),
        installmentStartMonth: BigInt(formStartMonth),
        installmentStartYear: BigInt(formStartYear),
        remarks: formRemarks || null,
      });
      toast.success("Advance created successfully");
      setShowCreateForm(false);
      setFormEmpId("");
      setFormAmount("");
      setFormInstallments("6");
      setFormRemarks("");
      await loadAdvances();
    } catch {
      toast.error("Failed to create advance");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!session) return;
    setSaving(true);
    try {
      const a = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.updateAdvance !== "function") {
        toast.info("Update not yet available");
        return;
      }
      const updates: Record<string, unknown> = {};
      if (editInstallments)
        updates.remainingInstallments = BigInt(editInstallments);
      if (editInstallmentAmount)
        updates.installmentAmount = BigInt(editInstallmentAmount);
      await a.updateAdvance(session.token, id, updates);
      toast.success("Advance updated");
      setEditingId(null);
      await loadAdvances();
    } catch {
      toast.error("Failed to update advance");
    } finally {
      setSaving(false);
    }
  };

  const handlePause = async (id: string, paused: boolean) => {
    if (!session) return;
    try {
      const a = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      const fn = paused ? a.pauseAdvance : (a.resumeAdvance ?? a.updateAdvance);
      if (typeof fn !== "function") {
        toast.info("Not yet available");
        return;
      }
      await fn(session.token, id);
      toast.success(paused ? "Advance paused" : "Advance resumed");
      await loadAdvances();
    } catch {
      toast.error("Failed to update advance");
    }
  };

  const handleCancel = async (id: string) => {
    if (!session) return;
    try {
      const a = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.cancelAdvance !== "function") {
        toast.info("Cancel not yet available");
        return;
      }
      await a.cancelAdvance(session.token, id, cancelRemark);
      toast.success("Advance cancelled");
      setCancelId(null);
      setCancelRemark("");
      await loadAdvances();
    } catch {
      toast.error("Failed to cancel");
    }
  };

  const handleExport = async () => {
    try {
      const { utils, writeFile } = await import("xlsx");
      const brandingRows = buildBrandingExcelRows(companyProfile ?? null);
      const dataRows = filtered.map((adv) => ({
        "Employee Name": adv.employeeName ?? "",
        "Advance Amount": Number(adv.advanceAmount),
        "Advance Date": adv.advanceDate,
        Reason: adv.reason,
        "Total Installments": Number(adv.totalInstallments),
        "Installment Amount": Number(adv.installmentAmount),
        "Amount Recovered": Number(adv.amountRecovered),
        "Balance Remaining": Number(adv.advanceAmount - adv.amountRecovered),
        "Installments Completed": Number(adv.installmentsCompleted),
        "Installments Remaining": Number(
          adv.totalInstallments - adv.installmentsCompleted,
        ),
        Status: adv.isPaused ? "Paused" : adv.status,
        Remarks: adv.remarks ?? "",
      }));
      const ws = utils.json_to_sheet([...brandingRows, ...dataRows]);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Advances");
      writeFile(wb, "employee_advances.xlsx");
    } catch {
      toast.error("Export failed");
    }
  };

  const filtered = advances.filter((adv) => {
    const empMatch =
      filterEmpId === "all" || String(adv.employeeId) === filterEmpId;
    const statusMatch =
      filterStatus === "all" ||
      (filterStatus === "Active" && adv.status === "Active" && !adv.isPaused) ||
      (filterStatus === "Paused" && adv.isPaused) ||
      (filterStatus === adv.status && !adv.isPaused);
    return empMatch && statusMatch;
  });

  const expectedCompletion = (adv: EmployeeAdvance) => {
    const remaining = Number(adv.totalInstallments - adv.installmentsCompleted);
    const startM = Number(adv.firstDeductionMonth);
    const startY = Number(adv.firstDeductionYear);
    const endAt = new Date(
      startY,
      startM - 1 + Number(adv.totalInstallments) - 1,
    );
    if (remaining <= 0) return "Completed";
    return `${MONTH_NAMES[endAt.getMonth()]} ${endAt.getFullYear()}`;
  };

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="Employee Advances"
        subtitle="Manage advance payments and monthly installment deductions"
      />
      <PageContent>
        {/* Action bar */}
        <div className="flex flex-wrap gap-3 items-center mb-6">
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            data-ocid="add-advance-btn"
          >
            <Plus className="w-4 h-4 mr-1" /> Add New Advance
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <Select value={filterEmpId} onValueChange={setFilterEmpId}>
              <SelectTrigger
                className="w-[200px]"
                data-ocid="advance-filter-emp"
              >
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={String(e.id)} value={String(e.id)}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger
                className="w-[160px]"
                data-ocid="advance-filter-status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Paused">Paused</SelectItem>
                <SelectItem value="FullyRecovered">Fully Recovered</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleExport}
              data-ocid="export-advances-btn"
            >
              <Download className="w-4 h-4 mr-1" /> Export Excel
            </Button>
          </div>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="bg-card border border-primary/30 rounded-lg p-5 mb-6">
            <h3 className="font-display font-semibold text-sm text-foreground mb-4">
              New Advance Record
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Employee *
                </Label>
                <Select value={formEmpId} onValueChange={setFormEmpId}>
                  <SelectTrigger data-ocid="create-advance-emp">
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
                  Advance Amount (₹) *
                </Label>
                <Input
                  type="number"
                  placeholder="e.g. 50000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  data-ocid="create-advance-amount"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Advance Date *
                </Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Reason *
                </Label>
                <Select value={formReason} onValueChange={setFormReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADVANCE_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Number of Installments *
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={formInstallments}
                  onChange={(e) => setFormInstallments(e.target.value)}
                  data-ocid="create-advance-installments"
                />
                {formInstallmentAmount > 0 && (
                  <p className="text-xs text-primary mt-1 font-body">
                    Monthly installment: ₹
                    {formInstallmentAmount.toLocaleString("en-IN")}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Installment Start Month
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={formStartMonth}
                    onValueChange={setFormStartMonth}
                  >
                    <SelectTrigger className="flex-1">
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
                  <Input
                    type="number"
                    value={formStartYear}
                    onChange={(e) => setFormStartYear(e.target.value)}
                    className="w-[90px]"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-body">
                  First deduction: {MONTH_NAMES[firstDeductionMonth.month - 1]}{" "}
                  {firstDeductionMonth.year}
                </p>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Remarks
                </Label>
                <Input
                  placeholder="Optional"
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                onClick={handleCreate}
                disabled={creating || !formEmpId || !formAmount}
                data-ocid="save-advance-btn"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                )}
                Save Advance
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div
            className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm"
            data-ocid="advances-empty"
          >
            No advance records found. Click "Add New Advance" to create one.
          </div>
        )}

        {/* Advances List */}
        {!loading &&
          filtered.map((adv) => {
            const balance = adv.advanceAmount - adv.amountRecovered;
            const remaining = adv.totalInstallments - adv.installmentsCompleted;
            const progressPct =
              adv.advanceAmount > 0n
                ? Math.min(
                    100,
                    Math.round(
                      (Number(adv.amountRecovered) * 100) /
                        Number(adv.advanceAmount),
                    ),
                  )
                : 0;

            return (
              <div
                key={adv.id}
                className="bg-card border border-border rounded-lg overflow-hidden mb-4"
                data-ocid={`advance-${adv.id}`}
              >
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="font-display font-semibold text-sm text-foreground">
                      {adv.employeeName}
                    </span>
                    {statusBadge(adv.status, adv.isPaused)}
                    <span className="text-xs text-muted-foreground font-body">
                      {adv.reason}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    {adv.status === "Active" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setEditingId(editingId === adv.id ? null : adv.id);
                            setEditInstallments("");
                            setEditInstallmentAmount("");
                          }}
                          data-ocid={`edit-advance-${adv.id}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handlePause(adv.id, true)}
                          data-ocid={`pause-advance-${adv.id}`}
                        >
                          <PauseCircle className="w-3.5 h-3.5 mr-1" /> Pause
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => setCancelId(adv.id)}
                          data-ocid={`cancel-advance-${adv.id}`}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                        </Button>
                      </>
                    )}
                    {adv.isPaused && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handlePause(adv.id, false)}
                        data-ocid={`resume-advance-${adv.id}`}
                      >
                        <PlayCircle className="w-3.5 h-3.5 mr-1" /> Resume
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="px-4 py-1.5 border-b border-border bg-muted/10">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1 font-body">
                    <span>Recovery Progress</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Edit form */}
                {editingId === adv.id && (
                  <div className="px-4 py-3 bg-primary/5 border-b border-border flex flex-wrap gap-3 items-end">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Remaining Installments
                      </Label>
                      <Input
                        type="number"
                        placeholder={String(remaining)}
                        value={editInstallments}
                        onChange={(e) => setEditInstallments(e.target.value)}
                        className="h-8 w-[130px]"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Installment Amount (₹)
                      </Label>
                      <Input
                        type="number"
                        placeholder={String(adv.installmentAmount)}
                        value={editInstallmentAmount}
                        onChange={(e) =>
                          setEditInstallmentAmount(e.target.value)
                        }
                        className="h-8 w-[140px]"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(adv.id)}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      )}
                      Update
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                {/* Cancel form */}
                {cancelId === adv.id && (
                  <div className="px-4 py-3 bg-destructive/5 border-b border-border flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Cancel Reason *
                      </Label>
                      <Input
                        placeholder="Reason for cancellation…"
                        value={cancelRemark}
                        onChange={(e) => setCancelRemark(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleCancel(adv.id)}
                      disabled={!cancelRemark}
                      data-ocid={`confirm-cancel-${adv.id}`}
                    >
                      Confirm Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCancelId(null);
                        setCancelRemark("");
                      }}
                    >
                      Back
                    </Button>
                  </div>
                )}

                {/* Details grid */}
                <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm font-body">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Total Advance
                    </p>
                    <p className="font-mono font-semibold text-foreground">
                      {fmt(adv.advanceAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Monthly Installment
                    </p>
                    <p className="font-mono font-semibold text-foreground">
                      {fmt(adv.installmentAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Amount Recovered
                    </p>
                    <p className="font-mono font-semibold text-green-600">
                      {fmt(adv.amountRecovered)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Balance Remaining
                    </p>
                    <p className="font-mono font-semibold text-destructive">
                      {fmt(balance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Installments
                    </p>
                    <p className="font-mono text-foreground">
                      {String(adv.installmentsCompleted)}/
                      {String(adv.totalInstallments)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Expected Completion
                    </p>
                    <p className="text-xs text-foreground font-medium">
                      {expectedCompletion(adv)}
                    </p>
                  </div>
                </div>

                {adv.remarks && (
                  <div className="px-4 pb-3 text-xs text-muted-foreground font-body">
                    Remarks: {adv.remarks}
                  </div>
                )}
                {adv.cancelRemark && (
                  <div className="px-4 pb-3 text-xs text-destructive font-body">
                    Cancel reason: {adv.cancelRemark}
                  </div>
                )}
              </div>
            );
          })}
      </PageContent>
    </PortalLayout>
  );
}
