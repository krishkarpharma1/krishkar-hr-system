import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Download, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Role, TargetPeriod } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  IncentiveCalculation,
  IncentiveCalculationStatus,
  UserInfo,
} from "../../types";

const PERIOD_LABELS: Record<TargetPeriod, string> = {
  Monthly: "Monthly",
  Quarterly: "Quarterly",
  HalfYearly: "Half-Yearly",
  Yearly: "Yearly",
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
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

function StatusBadge({ status }: { status: IncentiveCalculationStatus }) {
  const map: Record<string, string> = {
    Calculated: "bg-blue-100 text-blue-700 border-blue-300",
    HRApproved: "bg-green-100 text-green-700 border-green-300",
    PaidOnSlip: "bg-purple-100 text-purple-700 border-purple-300",
  };
  return (
    <Badge
      className={`text-xs ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </Badge>
  );
}

export default function IncentiveManagement({
  portalRole,
}: {
  portalRole?: Role;
}) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const role = portalRole ?? session?.role;

  const [calculations, setCalculations] = useState<IncentiveCalculation[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [triggering, setTriggering] = useState(false);

  // Filters
  const [roleFilter, setRoleFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(String(CURRENT_YEAR));
  const [statusFilter, setStatusFilter] = useState("all");

  // Approve modal
  const [approveItem, setApproveItem] = useState<IncentiveCalculation | null>(
    null,
  );
  const [adjustedAmount, setAdjustedAmount] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [calcs, userData] = await Promise.all([
        api.getAllIncentiveCalculations(token, {
          role: roleFilter !== "all" ? (roleFilter as Role) : undefined,
          period:
            periodFilter !== "all" ? (periodFilter as TargetPeriod) : undefined,
          year: yearFilter ? BigInt(yearFilter) : undefined,
          status:
            statusFilter !== "all"
              ? (statusFilter as IncentiveCalculationStatus)
              : undefined,
        }),
        api.listAllUsers(token),
      ]);
      setCalculations(calcs);
      setUsers(userData);
    } catch {
      toast.error("Failed to load incentive calculations");
    } finally {
      setLoading(false);
    }
  }, [token, roleFilter, periodFilter, yearFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const userMap = new Map(users.map((u) => [u.id, u]));

  async function handleTrigger() {
    if (!yearFilter) return;
    setTriggering(true);
    try {
      const result = await api.triggerIncentiveCalculation(
        token,
        periodFilter !== "all"
          ? (periodFilter as TargetPeriod)
          : TargetPeriod.Monthly,
        BigInt(yearFilter),
        null,
      );
      if (result.__kind__ === "err") {
        toast.error(result.err);
        return;
      }
      toast.success(`Calculated incentives for ${result.ok} employees`);
      await load();
    } catch {
      toast.error("Failed to trigger calculation");
    } finally {
      setTriggering(false);
    }
  }

  async function handleApprove() {
    if (!approveItem) return;
    setApproving(true);
    try {
      const result = await api.approveIncentiveCalculation(token, {
        calculationId: approveItem.id,
        adjustedAmount: adjustedAmount ? Number(adjustedAmount) : undefined,
        notes: approveNotes || undefined,
      });
      if (result.__kind__ === "err") {
        toast.error(result.err);
        return;
      }
      toast.success("Incentive approved");
      setApproveItem(null);
      setAdjustedAmount("");
      setApproveNotes("");
      await load();
    } catch {
      toast.error("Approval failed");
    } finally {
      setApproving(false);
    }
  }

  function exportExcel() {
    setExporting(true);
    try {
      const rows = calculations.map((c) => {
        const emp = userMap.get(c.userId);
        return {
          "Employee Name": emp?.name ?? `User #${String(c.userId)}`,
          "Employee ID": emp?.employeeId ?? "",
          Role: c.role,
          Period: PERIOD_LABELS[c.period],
          Year: String(c.year),
          Month: c.month ? MONTH_NAMES[Number(c.month) - 1] : "",
          "Target (₹)": c.targetAmount,
          "Actual (₹)": c.actualAmount,
          "Achievement %": c.achievementPct.toFixed(1),
          "Slab Applied": c.slabApplied,
          "Incentive Amount (₹)": c.incentiveAmount,
          "Adjusted Amount (₹)": c.adjustedAmount ?? "",
          Status: c.status,
          Notes: c.notes ?? "",
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Incentives");
      XLSX.writeFile(wb, `IncentiveReport_${yearFilter}.xlsx`);
      toast.success("Exported to Excel");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <PortalLayout portalRole={role ?? Role.Admin}>
      <PageHeader
        title="Incentive Management"
        subtitle="View, approve and export employee incentive calculations"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportExcel}
              disabled={exporting || calculations.length === 0}
              data-ocid="btn-export-incentives"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export Excel
            </Button>
            <Button
              size="sm"
              onClick={handleTrigger}
              disabled={triggering}
              data-ocid="btn-trigger-calc"
            >
              <Play className="w-4 h-4 mr-1.5" />
              {triggering ? "Calculating…" : "Trigger Calculation"}
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* Filters */}
        <SectionCard title="Filters">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger data-ocid="filter-incentive-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {[Role.MR, Role.ASM, Role.RSM, Role.ZSM].map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Period</Label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger data-ocid="filter-incentive-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Periods</SelectItem>
                  {Object.values(TargetPeriod).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PERIOD_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Year</Label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger data-ocid="filter-incentive-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-ocid="filter-incentive-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Calculated">Calculated</SelectItem>
                  <SelectItem value="HRApproved">HR Approved</SelectItem>
                  <SelectItem value="PaidOnSlip">Paid on Slip</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        {/* Table */}
        <SectionCard title={`Incentive Calculations (${calculations.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body min-w-[900px]">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  {[
                    "Employee",
                    "Role",
                    "Period",
                    "Target",
                    "Actual",
                    "Achievement%",
                    "Slab",
                    "Incentive",
                    "Adjusted",
                    "Status",
                    "Approved By",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-xs uppercase tracking-wider font-display text-muted-foreground whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3].map((i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 12 }).map((_, j) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                        <td key={j} className="px-3 py-2.5">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : calculations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-4 py-12 text-center text-muted-foreground text-sm"
                      data-ocid="no-calculations"
                    >
                      No incentive calculations found. Use "Trigger Calculation"
                      to generate.
                    </td>
                  </tr>
                ) : (
                  calculations.map((c) => {
                    const emp = userMap.get(c.userId);
                    const approver = c.approvedBy
                      ? userMap.get(c.approvedBy)
                      : null;
                    const pct = c.achievementPct.toFixed(1);
                    return (
                      <tr
                        key={String(c.id)}
                        className="border-b border-border last:border-0 hover:bg-muted/20"
                        data-ocid={`incentive-row-${c.id}`}
                      >
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-sm text-foreground whitespace-nowrap">
                            {emp?.name ?? `User #${String(c.userId)}`}
                          </p>
                          {emp?.employeeId && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {emp.employeeId}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge className="text-xs bg-primary/10 text-primary border-primary/30">
                            {c.role}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                          {PERIOD_LABELS[c.period]}
                          {c.month
                            ? ` · ${MONTH_NAMES[Number(c.month) - 1]}`
                            : ""}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-sm text-right">
                          ₹{c.targetAmount.toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-sm text-right">
                          ₹{c.actualAmount.toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-right">
                          <span
                            className={
                              c.achievementPct >= 100
                                ? "text-accent font-semibold"
                                : c.achievementPct >= 80
                                  ? "text-yellow-600"
                                  : "text-destructive"
                            }
                          >
                            {pct}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[100px] truncate">
                          {c.slabApplied || "—"}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-foreground text-right">
                          ₹{c.incentiveAmount.toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-right text-accent">
                          {c.adjustedAmount != null
                            ? `₹${c.adjustedAmount.toLocaleString("en-IN")}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">
                          {approver?.name ?? "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {c.status === "Calculated" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setApproveItem(c);
                                setAdjustedAmount("");
                                setApproveNotes("");
                              }}
                              data-ocid={`btn-approve-${c.id}`}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Approve
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Approve Dialog */}
        <Dialog
          open={!!approveItem}
          onOpenChange={(o) => {
            if (!o) {
              setApproveItem(null);
              setAdjustedAmount("");
              setApproveNotes("");
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Approve Incentive</DialogTitle>
            </DialogHeader>
            {approveItem && (
              <div className="space-y-4 pt-2">
                <div className="bg-muted/30 rounded-lg px-4 py-3 space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Employee: </span>
                    <span className="font-medium text-foreground">
                      {userMap.get(approveItem.userId)?.name ??
                        `User #${String(approveItem.userId)}`}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Achievement: </span>
                    <span className="font-semibold">
                      {approveItem.achievementPct.toFixed(1)}%
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">
                      Calculated Incentive:{" "}
                    </span>
                    <span className="font-mono font-bold text-primary">
                      ₹{approveItem.incentiveAmount.toLocaleString("en-IN")}
                    </span>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adjusted-amount">
                    Adjusted Amount (₹) — optional
                  </Label>
                  <Input
                    id="adjusted-amount"
                    type="number"
                    min="0"
                    placeholder={`Default: ₹${approveItem.incentiveAmount.toLocaleString("en-IN")}`}
                    value={adjustedAmount}
                    onChange={(e) => setAdjustedAmount(e.target.value)}
                    data-ocid="input-adjusted-amount"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="approve-notes">Notes (optional)</Label>
                  <Textarea
                    id="approve-notes"
                    placeholder="Add approval notes…"
                    value={approveNotes}
                    onChange={(e) => setApproveNotes(e.target.value)}
                    rows={2}
                    data-ocid="textarea-approve-notes"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setApproveItem(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={approving}
                    data-ocid="btn-confirm-approve"
                  >
                    {approving ? "Approving…" : "Confirm Approval"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageContent>
    </PortalLayout>
  );
}
