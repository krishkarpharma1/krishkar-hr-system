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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  Edit2,
  History,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import type { TargetVsActual } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  MonthlyTarget,
  SetMonthlyTargetInput,
  TargetRevision,
  UserInfo,
} from "../../types";

const FIELD_ROLES = [Role.MR, Role.ASM, Role.RSM, Role.ZSM];
const MONTHS = [
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

function perfColor(pct: number, daysPct: number): string {
  if (pct >= daysPct * 0.9)
    return "text-green-600 bg-green-50 border-green-200";
  if (pct >= daysPct * 0.7)
    return "text-yellow-600 bg-yellow-50 border-yellow-200";
  return "text-red-600 bg-red-50 border-red-200";
}

interface ProductTargetRow {
  productName: string;
  targetQty: number;
}

export default function MonthlyTargetsAdmin({
  portalRole,
}: { portalRole?: Role }) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const effectiveRole = portalRole ?? session?.role ?? Role.Admin;

  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());

  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const [selEmployee, setSelEmployee] = useState("none");
  const [targetAmount, setTargetAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [productRows, setProductRows] = useState<ProductTargetRow[]>([]);
  const [saving, setSaving] = useState(false);

  const [targets, setTargets] = useState<MonthlyTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterRole, setFilterRole] = useState("all");
  const [editTarget, setEditTarget] = useState<MonthlyTarget | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [historyTarget, setHistoryTarget] = useState<MonthlyTarget | null>(
    null,
  );

  const [bulkRows, setBulkRows] = useState<
    { user: UserInfo; amount: string }[]
  >([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  const [tvaData, setTvaData] = useState<TargetVsActual[]>([]);
  const [tvaLoading, setTvaLoading] = useState(false);

  const loadEmployees = useCallback(async () => {
    if (!token) return;
    try {
      const all = await api.listAllUsers(token);
      setEmployees(all.filter((u) => FIELD_ROLES.includes(u.role as Role)));
    } catch {
      /* silent */
    }
  }, [token]);

  const loadTargets = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.listMonthlyTargets(token, {
        month: BigInt(selMonth),
        year: BigInt(selYear),
        ...(filterRole !== "all" ? { role: filterRole as Role } : {}),
      });
      setTargets(data);
    } catch {
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }, [token, selMonth, selYear, filterRole]);

  const loadTva = useCallback(async () => {
    if (!token) return;
    setTvaLoading(true);
    try {
      const data = await api.getTeamTargetVsActual(
        token,
        BigInt(selMonth),
        BigInt(selYear),
      );
      setTvaData(data);
    } catch {
      setTvaData([]);
    } finally {
      setTvaLoading(false);
    }
  }, [token, selMonth, selYear]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);
  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset
  useEffect(() => {
    setBulkRows(employees.map((u) => ({ user: u, amount: "" })));
  }, [employees, selMonth, selYear]);

  const selectedEmployee = employees.find((e) => String(e.id) === selEmployee);

  async function handleSaveTarget() {
    if (!selEmployee || selEmployee === "none") {
      toast.error("Select an employee");
      return;
    }
    const amount = Number(targetAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid target amount");
      return;
    }
    setSaving(true);
    try {
      const input: SetMonthlyTargetInput = {
        userId: BigInt(selEmployee),
        month: BigInt(selMonth),
        year: BigInt(selYear),
        targetAmount: amount,
        productTargets: productRows
          .filter((r) => r.productName.trim())
          .map((r) => ({
            productId: r.productName,
            productName: r.productName,
            targetQty: r.targetQty,
          })),
        remarks: remarks || undefined,
      };
      await api.setMonthlyTarget(token, input);
      toast.success("Target saved successfully");
      setTargetAmount("");
      setRemarks("");
      setProductRows([]);
      setSelEmployee("none");
      await loadTargets();
    } catch (e) {
      toast.error(String(e) || "Failed to save target");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave() {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const input: SetMonthlyTargetInput = {
        userId: editTarget.userId,
        month: editTarget.month,
        year: editTarget.year,
        targetAmount: Number(editAmount),
        remarks: editRemarks || undefined,
      };
      await api.setMonthlyTarget(token, input);
      toast.success("Target updated");
      setEditTarget(null);
      await loadTargets();
    } catch (e) {
      toast.error(String(e) || "Failed to update target");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleBulkSave() {
    const rows = bulkRows.filter((r) => r.amount && Number(r.amount) > 0);
    if (!rows.length) {
      toast.error("Enter at least one target amount");
      return;
    }
    setBulkSaving(true);
    try {
      await api.bulkSetMonthlyTargets(token, {
        month: BigInt(selMonth),
        year: BigInt(selYear),
        rows: rows.map((r) => ({
          userId: r.user.id,
          targetAmount: Number(r.amount),
          remarks: undefined,
        })),
      });
      toast.success(`Saved ${rows.length} targets`);
      await loadTargets();
    } catch (e) {
      toast.error(String(e) || "Failed to save bulk targets");
    } finally {
      setBulkSaving(false);
    }
  }

  const daysPct = (() => {
    const d = new Date(selYear, selMonth, 0).getDate();
    return (now.getDate() / d) * 100;
  })();

  const filteredTargets = targets.filter(
    (t) => filterRole === "all" || t.role === filterRole,
  );

  return (
    <PortalLayout portalRole={effectiveRole}>
      <PageHeader
        title="Monthly Sales Targets"
        subtitle="Set, review, and track monthly sales targets for field staff"
      />
      <PageContent>
        <SectionCard title="Select Period">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Month</Label>
              <Select
                value={String(selMonth)}
                onValueChange={(v) => setSelMonth(Number(v))}
              >
                <SelectTrigger className="w-36" data-ocid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Year</Label>
              <Input
                type="number"
                value={selYear}
                onChange={(e) => setSelYear(Number(e.target.value))}
                className="w-24"
                data-ocid="input-year"
              />
            </div>
          </div>
        </SectionCard>

        <Tabs defaultValue="set">
          <TabsList className="mb-4">
            <TabsTrigger value="set">Set Targets</TabsTrigger>
            <TabsTrigger value="list">All Targets</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Entry</TabsTrigger>
            <TabsTrigger value="tva" onClick={loadTva}>
              Target vs. Achievement
            </TabsTrigger>
          </TabsList>

          {/* Tab 1 — Set Target */}
          <TabsContent value="set">
            <SectionCard
              title={`Set Target — ${MONTHS[selMonth - 1]} ${selYear}`}
            >
              <div className="grid gap-4 max-w-lg">
                <div className="space-y-1.5">
                  <Label className="text-xs">Employee (field staff only)</Label>
                  <Select value={selEmployee} onValueChange={setSelEmployee}>
                    <SelectTrigger data-ocid="select-employee">
                      <SelectValue placeholder="Search employee…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select Employee —</SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={String(e.id)} value={String(e.id)}>
                          {e.name} ({e.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedEmployee && (
                  <div className="flex gap-4 text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
                    <span>
                      Role:{" "}
                      <strong className="text-foreground">
                        {selectedEmployee.role}
                      </strong>
                    </span>
                    <span>
                      Territory:{" "}
                      <strong className="text-foreground">
                        {selectedEmployee.territory || "—"}
                      </strong>
                    </span>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Target Amount (₹)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 500000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    data-ocid="input-target-amount"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Remarks (optional)</Label>
                  <Input
                    placeholder="Optional note"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    data-ocid="input-remarks"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">
                      Product-wise Breakdown (optional)
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() =>
                        setProductRows((p) => [
                          ...p,
                          { productName: "", targetQty: 0 },
                        ])
                      }
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Product
                    </Button>
                  </div>
                  {productRows.map((row, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: positional
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        placeholder="Product name"
                        value={row.productName}
                        onChange={(e) =>
                          setProductRows((p) =>
                            p.map((r, j) =>
                              j === i
                                ? { ...r, productName: e.target.value }
                                : r,
                            ),
                          )
                        }
                        className="flex-1 h-8 text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={row.targetQty}
                        onChange={(e) =>
                          setProductRows((p) =>
                            p.map((r, j) =>
                              j === i
                                ? { ...r, targetQty: Number(e.target.value) }
                                : r,
                            ),
                          )
                        }
                        className="w-20 h-8 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setProductRows((p) => p.filter((_, j) => j !== i))
                        }
                        className="text-destructive hover:text-destructive/80"
                        aria-label="Remove product row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleSaveTarget}
                  disabled={saving}
                  data-ocid="btn-save-target"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {saving ? "Saving…" : "Save Target"}
                </Button>
              </div>
            </SectionCard>
          </TabsContent>

          {/* Tab 2 — All Targets */}
          <TabsContent value="list">
            <SectionCard
              title="All Targets"
              headerActions={
                <div className="flex gap-2 items-center">
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {FIELD_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                  >
                    <Download className="w-3 h-3" /> Export
                  </Button>
                </div>
              }
            >
              {loading ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 bg-muted rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredTargets.length === 0 ? (
                <div
                  className="py-10 text-center text-muted-foreground text-sm"
                  data-ocid="no-targets"
                >
                  No targets set for {MONTHS[selMonth - 1]} {selYear}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        {[
                          "Employee",
                          "Role",
                          "Territory",
                          "Month/Year",
                          "Target (₹)",
                          "Actions",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredTargets.map((t) => {
                        const emp = employees.find((e) => e.id === t.userId);
                        return (
                          <tr
                            key={t.id}
                            className="hover:bg-muted/20"
                            data-ocid={`target-row-${t.id}`}
                          >
                            <td className="px-3 py-2 font-body font-medium text-foreground">
                              {emp?.name ?? `EMP-${String(t.userId)}`}
                            </td>
                            <td className="px-3 py-2">
                              <Badge className="text-xs bg-primary/10 text-primary border-primary/30">
                                {t.role}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {emp?.territory ?? "—"}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {MONTHS[Number(t.month) - 1]} {String(t.year)}
                            </td>
                            <td className="px-3 py-2 font-mono font-semibold">
                              ₹{t.targetAmount.toLocaleString("en-IN")}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  title="Edit"
                                  onClick={() => {
                                    setEditTarget(t);
                                    setEditAmount(String(t.targetAmount));
                                    setEditRemarks(t.remarks ?? "");
                                  }}
                                  className="text-primary hover:text-primary/80"
                                  data-ocid={`btn-edit-${t.id}`}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  title="Revision History"
                                  onClick={() => setHistoryTarget(t)}
                                  className="text-muted-foreground hover:text-foreground"
                                  data-ocid={`btn-history-${t.id}`}
                                >
                                  <History className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </TabsContent>

          {/* Tab 3 — Bulk Entry */}
          <TabsContent value="bulk">
            <SectionCard
              title={`Bulk Target Entry — ${MONTHS[selMonth - 1]} ${selYear}`}
              headerActions={
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                  >
                    <Upload className="w-3 h-3" /> Upload Excel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={handleBulkSave}
                    disabled={bulkSaving}
                    data-ocid="btn-bulk-save"
                  >
                    <Save className="w-3 h-3" />
                    {bulkSaving ? "Saving…" : "Save All"}
                  </Button>
                </div>
              }
            >
              <p className="text-xs text-muted-foreground mb-3">
                Enter targets for multiple employees at once. Leave blank to
                skip.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      {[
                        "Employee",
                        "Role",
                        "Territory",
                        "Target Amount (₹)",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bulkRows.map((row, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: positional
                      <tr key={i} className="hover:bg-muted/10">
                        <td className="px-3 py-2 font-body font-medium text-foreground">
                          {row.user.name}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className="text-xs bg-primary/10 text-primary border-primary/30">
                            {row.user.role}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.user.territory || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            placeholder="e.g. 500000"
                            value={row.amount}
                            onChange={(e) =>
                              setBulkRows((p) =>
                                p.map((r, j) =>
                                  j === i
                                    ? { ...r, amount: e.target.value }
                                    : r,
                                ),
                              )
                            }
                            className="h-8 w-36"
                            data-ocid={`bulk-amount-${i}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </TabsContent>

          {/* Tab 4 — Target vs Achievement */}
          <TabsContent value="tva">
            <SectionCard
              title={`Target vs. Achievement — ${MONTHS[selMonth - 1]} ${selYear}`}
              headerActions={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={loadTva}
                >
                  Refresh
                </Button>
              }
            >
              {tvaLoading ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 bg-muted rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : tvaData.length === 0 ? (
                <div
                  className="py-10 text-center text-muted-foreground text-sm"
                  data-ocid="no-tva"
                >
                  No data available for this period
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        {[
                          "Employee",
                          "Role",
                          "Territory",
                          "Target (₹)",
                          "Actual (₹)",
                          "Achievement %",
                          "Remaining",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tvaData.map((row) => {
                        const pct = row.achievementPct;
                        const colorCls = perfColor(pct, daysPct);
                        return (
                          <tr
                            key={String(row.userId)}
                            className="hover:bg-muted/10"
                            data-ocid={`tva-row-${row.userId}`}
                          >
                            <td className="px-3 py-2 font-body font-medium text-foreground">
                              {row.name}
                            </td>
                            <td className="px-3 py-2">
                              <Badge className="text-xs bg-primary/10 text-primary border-primary/30">
                                {row.role}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {row.territory ?? "—"}
                            </td>
                            <td className="px-3 py-2 font-mono">
                              ₹{row.targetAmount.toLocaleString("en-IN")}
                            </td>
                            <td className="px-3 py-2 font-mono">
                              ₹{row.actualAmount.toLocaleString("en-IN")}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`text-xs px-2 py-0.5 rounded border font-mono ${colorCls}`}
                              >
                                {pct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">
                              ₹{row.remainingTarget.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </TabsContent>
        </Tabs>

        {/* Edit Modal */}
        <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Monthly Target</DialogTitle>
            </DialogHeader>
            {editTarget && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {MONTHS[Number(editTarget.month) - 1]}{" "}
                  {String(editTarget.year)} — {editTarget.role}
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">New Target Amount (₹)</Label>
                  <Input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    data-ocid="input-edit-amount"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Remarks</Label>
                  <Input
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    placeholder="Reason for revision"
                    data-ocid="input-edit-remarks"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditTarget(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleEditSave}
                    disabled={editSaving}
                    data-ocid="btn-confirm-edit"
                  >
                    {editSaving ? "Saving…" : "Save Revision"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* History Modal */}
        <Dialog
          open={!!historyTarget}
          onOpenChange={() => setHistoryTarget(null)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Revision History</DialogTitle>
            </DialogHeader>
            {historyTarget && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {MONTHS[Number(historyTarget.month) - 1]}{" "}
                  {String(historyTarget.year)} — {historyTarget.role}
                </p>
                {historyTarget.revisionHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No revisions recorded
                  </p>
                ) : (
                  <div className="divide-y divide-border max-h-72 overflow-y-auto">
                    {[...historyTarget.revisionHistory]
                      .reverse()
                      .map((rev: TargetRevision, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: display
                        <div key={i} className="py-2.5 text-sm">
                          <div className="flex justify-between">
                            <span className="font-mono text-foreground">
                              ₹{rev.previousAmount.toLocaleString("en-IN")} → ₹
                              {rev.newAmount.toLocaleString("en-IN")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(
                                Number(rev.revisedAt) / 1_000_000,
                              ).toLocaleDateString("en-IN")}
                            </span>
                          </div>
                          {rev.remarks && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {rev.remarks}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageContent>
    </PortalLayout>
  );
}
