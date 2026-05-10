import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  ClipboardList,
  Loader2,
  MapPin,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { DaHistoryRow, TaDaExpense, UserInfo } from "../../types";

type ExpenseStatus = TaDaExpense["status"];

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

function statusBadge(s: ExpenseStatus) {
  if (s === "approved")
    return (
      <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded font-mono">
        Approved
      </span>
    );
  if (s === "rejected")
    return (
      <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded font-mono">
        Rejected
      </span>
    );
  return (
    <span className="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded font-mono">
      Pending
    </span>
  );
}

type Tab = "expenses" | "da-verification";

export default function ExpenseManagement() {
  const { session } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>("expenses");
  const [expenses, setExpenses] = useState<TaDaExpense[]>([]);
  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionExp, setActionExp] = useState<{
    exp: TaDaExpense;
    approve: boolean;
  } | null>(null);
  const [acting, setActing] = useState(false);

  // DA Verification state
  const now = new Date();
  const [daEmpId, setDaEmpId] = useState<string>("");
  const [daMonth, setDaMonth] = useState(String(now.getMonth() + 1));
  const [daYear, setDaYear] = useState(String(now.getFullYear()));
  const [daHistory, setDaHistory] = useState<DaHistoryRow[]>([]);
  const [daLoading, setDaLoading] = useState(false);
  const [daFetched, setDaFetched] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [exps, emps] = await Promise.all([
        api.getPendingExpenses(session.token),
        api.listAllUsers(session.token),
      ]);
      setExpenses(exps);
      setEmployees(emps);
    } catch {
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const empName = (id: bigint) => {
    const e = employees.find(
      (emp) => emp.id === id || BigInt(emp.employeeId) === id,
    );
    return e ? e.name : `EMP-${String(id)}`;
  };

  const filtered =
    statusFilter === "all"
      ? expenses
      : expenses.filter((e) => e.status === statusFilter);

  const handleAction = async () => {
    if (!session || !actionExp) return;
    setActing(true);
    try {
      const res = await api.approveExpense(
        session.token,
        actionExp.exp.id,
        actionExp.approve,
      );
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      toast.success(
        actionExp.approve ? "Expense approved" : "Expense rejected",
      );
      setActionExp(null);
      await load();
    } catch {
      toast.error("Action failed");
    } finally {
      setActing(false);
    }
  };

  const handleFetchDaHistory = async () => {
    if (!session || !daEmpId) return;
    setDaLoading(true);
    setDaFetched(false);
    try {
      const rows = await api.getEmployeeDaHistory(
        session.token,
        BigInt(daEmpId),
        BigInt(daMonth),
        BigInt(daYear),
      );
      setDaHistory(rows);
      setDaFetched(true);
    } catch {
      toast.error("Failed to load DA history");
    } finally {
      setDaLoading(false);
    }
  };

  const daTotal = daHistory.reduce((sum, r) => sum + r.daAmount, 0n);
  const fmt = (n: bigint) => `₹${Number(n).toLocaleString("en-IN")}`;

  const cols = [
    { key: "emp", label: "Employee" },
    { key: "date", label: "Date" },
    { key: "route", label: "Route" },
    { key: "km", label: "KM", className: "text-right" },
    { key: "travel", label: "Travel ₹", className: "text-right" },
    { key: "da", label: "DA ₹", className: "text-right" },
    { key: "total", label: "Total ₹", className: "text-right" },
    { key: "status", label: "Status" },
    { key: "actions", label: "", className: "text-right" },
  ];

  const selectedEmployee = employees.find((e) => String(e.id) === daEmpId);

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="TA/DA Management"
        subtitle="Review expense claims and verify DA from daily reports"
      />
      <PageContent>
        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("expenses")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "expenses"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-ocid="tab-expenses"
          >
            Expense Claims
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("da-verification")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === "da-verification"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-ocid="tab-da-verification"
          >
            <ClipboardList className="w-4 h-4" />
            DA Verification
          </button>
        </div>

        {/* ── Expense Claims Tab ── */}
        {activeTab === "expenses" && (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Total Pending</p>
                <p className="font-display font-bold text-xl text-yellow-500">
                  {expenses.filter((e) => e.status === "pending").length}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Pending Amount</p>
                <p className="font-display font-bold text-xl text-foreground">
                  {fmt(
                    expenses
                      .filter((e) => e.status === "pending")
                      .reduce((sum, e) => sum + e.totalAmount, 0n),
                  )}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">TA Rate</p>
                <p className="font-display font-bold text-xl text-foreground">
                  ₹2.75/km
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4">
              {["pending", "approved", "rejected", "all"].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors capitalize ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary"}`}
                  data-ocid={`expense-filter-${s}`}
                >
                  {s}
                </button>
              ))}
            </div>

            <DataTable
              columns={cols}
              data={filtered}
              getKey={(e) => String(e.id)}
              loading={loading}
              emptyMessage="No expense claims"
              renderRow={(e) => (
                <>
                  <td className="px-4 py-3 font-body">
                    <p className="text-sm text-foreground font-medium">
                      {empName(e.employeeId)}
                    </p>
                    <p className="text-xs text-muted-foreground">{e.purpose}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {e.date}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-1 text-xs text-muted-foreground font-body">
                      <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                      <span>
                        {e.fromLocation}
                        <br />→ {e.toLocation}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {String(e.distanceKm)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {fmt(e.travelAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {fmt(e.dailyAllowance)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-accent">
                    {fmt(e.totalAmount)}
                  </td>
                  <td className="px-4 py-3">{statusBadge(e.status)}</td>
                  <td className="px-4 py-3 text-right">
                    {e.status === "pending" && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-accent hover:text-accent"
                          onClick={() =>
                            setActionExp({ exp: e, approve: true })
                          }
                          data-ocid={`approve-expense-${e.id}`}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() =>
                            setActionExp({ exp: e, approve: false })
                          }
                          data-ocid={`reject-expense-${e.id}`}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                </>
              )}
            />

            {/* Confirm dialog */}
            <Dialog open={!!actionExp} onOpenChange={() => setActionExp(null)}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="font-display">
                    {actionExp?.approve ? "Approve Expense" : "Reject Expense"}
                  </DialogTitle>
                </DialogHeader>
                {actionExp && (
                  <div className="bg-muted/30 rounded p-3 text-sm font-body space-y-1.5 py-1">
                    <p>
                      <span className="text-muted-foreground">Employee:</span>{" "}
                      {empName(actionExp.exp.employeeId)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Route:</span>{" "}
                      {actionExp.exp.fromLocation} → {actionExp.exp.toLocation}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Distance:</span>{" "}
                      {String(actionExp.exp.distanceKm)} km
                    </p>
                    <p>
                      <span className="text-muted-foreground">Travel:</span>{" "}
                      {fmt(actionExp.exp.travelAmount)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">DA:</span>{" "}
                      {fmt(actionExp.exp.dailyAllowance)}
                    </p>
                    <p className="font-bold">
                      <span className="text-muted-foreground">Total:</span>{" "}
                      {fmt(actionExp.exp.totalAmount)}
                    </p>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setActionExp(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant={actionExp?.approve ? "default" : "destructive"}
                    onClick={handleAction}
                    disabled={acting}
                    data-ocid="confirm-expense-action"
                  >
                    {acting
                      ? "Processing…"
                      : actionExp?.approve
                        ? "Approve"
                        : "Reject"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* ── DA Verification Tab ── */}
        {activeTab === "da-verification" && (
          <div data-ocid="da-verification-panel">
            {/* Controls */}
            <div className="bg-card border border-border rounded-lg p-4 mb-5">
              <p className="text-xs uppercase tracking-wider font-display text-muted-foreground mb-3">
                Employee DA Verification
              </p>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Employee
                  </Label>
                  <Select value={daEmpId} onValueChange={setDaEmpId}>
                    <SelectTrigger data-ocid="da-emp-select">
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
                  <Select value={daMonth} onValueChange={setDaMonth}>
                    <SelectTrigger
                      className="w-[140px]"
                      data-ocid="da-month-select"
                    >
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
                    value={daYear}
                    onChange={(e) => setDaYear(e.target.value)}
                    className="h-9 w-[90px]"
                    data-ocid="da-year-input"
                  />
                </div>
                <Button
                  onClick={handleFetchDaHistory}
                  disabled={!daEmpId || daLoading}
                  data-ocid="fetch-da-history-btn"
                >
                  {daLoading ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <ClipboardList className="w-4 h-4 mr-1" />
                  )}
                  Load DA History
                </Button>
              </div>
            </div>

            {/* Loading skeleton */}
            {daLoading && (
              <div className="space-y-2" data-ocid="da-history-loading">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            )}

            {/* Empty prompt */}
            {!daLoading && !daFetched && (
              <div
                className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm"
                data-ocid="da-history-prompt"
              >
                Select an employee and period, then click "Load DA History"
              </div>
            )}

            {/* Results */}
            {!daLoading && daFetched && (
              <div
                className="bg-card border border-border rounded-lg overflow-hidden"
                data-ocid="da-history-table"
              >
                {/* Header */}
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                      DA History —{" "}
                      {selectedEmployee?.name ?? `Employee ${daEmpId}`}
                    </span>
                    <span className="text-xs text-muted-foreground font-body ml-2">
                      · {MONTH_NAMES[Number(daMonth) - 1]} {daYear}
                    </span>
                  </div>
                  <span
                    className="text-xs font-mono font-bold text-primary"
                    data-ocid="da-history-total"
                  >
                    Total: {fmt(daTotal)}
                  </span>
                </div>

                {daHistory.length === 0 ? (
                  <div
                    className="p-8 text-center text-sm text-muted-foreground"
                    data-ocid="da-history-empty"
                  >
                    No DA records found for this employee in the selected
                    period.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm font-body">
                        <thead>
                          <tr className="border-b border-border bg-muted/20">
                            <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-display">
                              Date
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-display">
                              Station Type
                            </th>
                            <th className="px-4 py-2.5 text-right text-xs text-muted-foreground font-display">
                              Doctors Visited
                            </th>
                            <th className="px-4 py-2.5 text-right text-xs text-muted-foreground font-display">
                              DA Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {daHistory.map((row) => (
                            <tr
                              key={row.date}
                              className="hover:bg-muted/20 transition-colors"
                              data-ocid={`da-row-${row.date}`}
                            >
                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {row.date}
                              </td>
                              <td className="px-4 py-3">
                                <StationBadge type={row.stationType} />
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                                {String(row.doctorCount)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-sm font-bold text-primary">
                                {fmt(row.daAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Total row */}
                    <div className="px-4 py-3 border-t border-border bg-primary/5 flex items-center justify-between">
                      <span className="text-sm font-display font-medium text-foreground">
                        Total DA — {daHistory.length} working day
                        {daHistory.length !== 1 ? "s" : ""}
                      </span>
                      <span
                        className="font-mono font-bold text-primary text-lg"
                        data-ocid="da-total-amount"
                      >
                        {fmt(daTotal)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}

function StationBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    "Head Quarter": "bg-primary/10 text-primary",
    "Ex Station": "bg-accent/10 text-accent",
    "Out Station": "bg-yellow-500/10 text-yellow-600",
  };
  const cls = colorMap[type] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-mono ${cls}`}>
      {type}
    </span>
  );
}
