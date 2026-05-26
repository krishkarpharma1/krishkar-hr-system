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
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Download,
  History,
  Pencil,
  RotateCcw,
  Settings2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { CalculationStatus, Role, TargetPeriod } from "../../backend";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  BottomUpTarget,
  BottomUpTargetSummaryRow,
  TargetHierarchyNode,
  UserInfo,
} from "../../types";

// ── constants ────────────────────────────────────────────────────────────────

export const TARGET_PERIOD_LABELS: Record<TargetPeriod, string> = {
  [TargetPeriod.Monthly]: "Monthly",
  [TargetPeriod.Quarterly]: "Quarterly",
  [TargetPeriod.HalfYearly]: "Half-Yearly",
  [TargetPeriod.Yearly]: "Yearly",
};

const TABS = ["Set MR Targets", "Target Hierarchy", "Summary Report"] as const;
type Tab = (typeof TABS)[number];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

// ── helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ isOverridden }: { isOverridden: boolean }) {
  if (isOverridden)
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
        Manually Overridden
      </Badge>
    );
  return (
    <Badge className="bg-accent/15 text-accent border-accent/30 text-xs">
      Auto-Calculated
    </Badge>
  );
}

function calcStatusBadge(status: CalculationStatus) {
  if (status === CalculationStatus.ManuallyOverridden)
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
        Overridden
      </Badge>
    );
  return (
    <Badge className="bg-accent/15 text-accent border-accent/30 text-xs">
      Auto
    </Badge>
  );
}

const ROLE_BADGE_CLASSES: Partial<Record<Role, string>> = {
  [Role.MR]: "bg-muted text-muted-foreground border-border",
  [Role.ASM]: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  [Role.RSM]: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  [Role.ZSM]: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  [Role.Admin]: "bg-primary/15 text-primary border-primary/30",
};

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded border font-display ${ROLE_BADGE_CLASSES[role] ?? "bg-muted text-muted-foreground border-border"}`}
    >
      {role}
    </span>
  );
}

function fmt(amount: bigint) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

// ── Tab 1 : Set MR Targets ────────────────────────────────────────────────────

function SetMrTargetsTab({ canEdit }: { canEdit: boolean }) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";

  const [users, setUsers] = useState<UserInfo[]>([]);
  const [targets, setTargets] = useState<BottomUpTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedMr, setSelectedMr] = useState("none");
  const [period, setPeriod] = useState<TargetPeriod>(TargetPeriod.Monthly);
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [editId, setEditId] = useState<bigint | null>(null);

  const mrs = useMemo(() => users.filter((u) => u.role === Role.MR), [users]);
  const mrTargets = useMemo(
    () => targets.filter((t) => t.role === Role.MR),
    [targets],
  );

  const load = useCallback(async () => {
    try {
      const [allUsers, allTargets] = await Promise.all([
        api.listAllUsers(token),
        api.listAllBottomUpTargets(token),
      ]);
      setUsers(allUsers);
      setTargets(allTargets);
    } catch {
      toast.error("Failed to load users or targets");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      load();
    }
  }, [token, load]);

  function startEdit(t: BottomUpTarget) {
    setEditId(t.id);
    setSelectedMr(String(t.userId));
    setPeriod(t.period);
    setYear(String(t.year));
    setAmount(String(t.targetAmount));
    setNotes(t.overrideReason ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditId(null);
    setSelectedMr("none");
    setPeriod(TargetPeriod.Monthly);
    setYear(String(CURRENT_YEAR));
    setAmount("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedMr === "none") {
      toast.error("Please select an MR");
      return;
    }
    const amt = Number.parseInt(amount, 10);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid target amount");
      return;
    }
    setSubmitting(true);
    try {
      await api.setMrTarget(token, {
        userId: BigInt(selectedMr),
        period,
        year: BigInt(year),
        targetAmount: BigInt(amt),
        description: notes || undefined,
      });
      toast.success("Target set — cascade auto-calculated for higher roles");
      resetForm();
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to set target");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(t: BottomUpTarget) {
    if (!confirm("Delete this MR target? The hierarchy will be recalculated."))
      return;
    setSubmitting(true);
    try {
      await api.setMrTarget(token, {
        userId: t.userId,
        period: t.period,
        year: t.year,
        targetAmount: BigInt(0),
        description: "Deleted",
      });
      toast.success("Target removed and hierarchy recalculated");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setSubmitting(false);
    }
  }

  const mrInfo = mrs.find((u) => String(u.id) === selectedMr);

  return (
    <div className="space-y-6">
      {canEdit && (
        <SectionCard
          title={editId ? "Edit MR Target" : "Set MR Target"}
          headerActions={
            editId ? (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Cancel Edit
              </Button>
            ) : undefined
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="mr-select">
                  Select MR <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedMr} onValueChange={setSelectedMr}>
                  <SelectTrigger id="mr-select" data-ocid="select-mr">
                    <SelectValue placeholder="— Choose MR —" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="none" disabled>
                      — Choose MR —
                    </SelectItem>
                    {mrs.map((u) => (
                      <SelectItem key={String(u.id)} value={String(u.id)}>
                        {u.name} ({u.employeeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mrInfo && (
                  <p className="text-xs text-muted-foreground">
                    Territory:{" "}
                    <span className="font-medium">
                      {mrInfo.territory || "—"}
                    </span>
                    {mrInfo.reportsTo && (
                      <> · Reports to EMP-{String(mrInfo.reportsTo)}</>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="period-select">Period</Label>
                <Select
                  value={period}
                  onValueChange={(v) => setPeriod(v as TargetPeriod)}
                >
                  <SelectTrigger id="period-select" data-ocid="select-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TargetPeriod).map((p) => (
                      <SelectItem key={p} value={p}>
                        {TARGET_PERIOD_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="year-select">Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger id="year-select" data-ocid="select-year">
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
                <Label htmlFor="amount-input">
                  Target Amount (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="amount-input"
                  type="number"
                  min="1"
                  placeholder="e.g. 500000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-ocid="input-target-amount"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes-input">
                Notes / Description (optional)
              </Label>
              <Textarea
                id="notes-input"
                placeholder="Add context for this target…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                data-ocid="textarea-target-notes"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="submit"
                disabled={submitting}
                data-ocid="btn-submit-target"
              >
                {submitting
                  ? "Saving…"
                  : editId
                    ? "Update Target"
                    : "Set Target & Auto-Calculate"}
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard title="MR Target Records">
        <DataTable<BottomUpTarget>
          columns={[
            { key: "mr", label: "MR Name" },
            { key: "period", label: "Period" },
            { key: "year", label: "Year" },
            {
              key: "amount",
              label: "Amount (₹)",
              className: "text-right",
            },
            { key: "status", label: "Status" },
            ...(canEdit ? [{ key: "actions", label: "Actions" }] : []),
          ]}
          data={mrTargets}
          getKey={(t) => String(t.id)}
          loading={loading}
          emptyMessage="No MR targets set yet. Use the form above to add one."
          renderRow={(t) => {
            const mrUser = mrs.find((u) => u.id === t.userId);
            return (
              <>
                <td className="px-4 py-3">
                  <p className="font-medium text-sm text-foreground">
                    {mrUser?.name ?? `EMP-${String(t.userId)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {mrUser?.territory || "—"}
                  </p>
                </td>
                <td className="px-4 py-3 text-sm">
                  {TARGET_PERIOD_LABELS[t.period]}
                </td>
                <td className="px-4 py-3 text-sm font-mono">
                  {String(t.year)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                  {fmt(t.targetAmount)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge isOverridden={t.isOverridden} />
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Edit target"
                        className="text-primary hover:text-primary/80 transition-colors"
                        onClick={() => startEdit(t)}
                        data-ocid={`btn-edit-target-${t.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete target"
                        className="text-destructive hover:text-destructive/80 transition-colors"
                        onClick={() => handleDelete(t)}
                        data-ocid={`btn-delete-target-${t.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </>
            );
          }}
        />
      </SectionCard>
    </div>
  );
}

// ── Tree Node ─────────────────────────────────────────────────────────────────

function HierarchyNode({
  node,
  depth,
  canOverride,
  onOverride,
  onUndo,
}: {
  node: TargetHierarchyNode;
  depth: number;
  canOverride: boolean;
  onOverride: (node: TargetHierarchyNode) => void;
  onUndo: (node: TargetHierarchyNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const paddingClass = ["pl-0", "pl-4", "pl-8", "pl-12", "pl-16"][
    Math.min(depth, 4)
  ];

  return (
    <div>
      <div
        className={`${paddingClass} flex items-center gap-2 py-2 px-3 hover:bg-muted/20 rounded-md group`}
      >
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded((e) => !e)}
          disabled={!hasChildren}
          data-ocid={`btn-tree-toggle-${node.userId}`}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )
          ) : (
            <span className="w-4 h-4 block" />
          )}
        </button>

        <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 items-center">
          <div className="min-w-0">
            <p className="font-medium text-sm text-foreground truncate">
              {node.name}
            </p>
            {(node.territory || node.area) && (
              <p className="text-xs text-muted-foreground truncate">
                {node.territory}
                {node.area ? ` / ${node.area}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <RoleBadge role={node.role} />
            {calcStatusBadge(node.status)}
          </div>
          <div className="text-right sm:text-left">
            <p className="text-xs text-muted-foreground">Monthly</p>
            <p className="font-mono text-sm font-semibold text-foreground">
              {fmt(node.monthly)}
            </p>
          </div>
          <div className="text-right sm:text-left">
            <p className="text-xs text-muted-foreground">Yearly</p>
            <p className="font-mono text-sm font-semibold text-foreground">
              {fmt(node.yearly)}
            </p>
          </div>
        </div>

        {node.isOverridden && node.overrideReason && (
          <span
            title={`Override reason: ${node.overrideReason}`}
            className="flex-shrink-0"
            aria-label="Override reason"
          >
            <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
          </span>
        )}

        {canOverride && (
          <div className="flex-shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
              onClick={() => onOverride(node)}
              data-ocid={`btn-override-${node.userId}`}
            >
              <Settings2 className="w-3 h-3" />
              Override
            </button>
            {node.isOverridden && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline flex items-center gap-0.5"
                onClick={() => onUndo(node)}
                data-ocid={`btn-undo-override-${node.userId}`}
              >
                <RotateCcw className="w-3 h-3" />
                Undo
              </button>
            )}
          </div>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="border-l border-border ml-6 pl-2 mt-0.5">
          {node.children.map((child) => (
            <HierarchyNode
              key={String(child.userId)}
              node={child}
              depth={depth + 1}
              canOverride={canOverride}
              onOverride={onOverride}
              onUndo={onUndo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 2 : Target Hierarchy ─────────────────────────────────────────────────

function TargetHierarchyTab({ canOverride }: { canOverride: boolean }) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";

  const [hierarchy, setHierarchy] = useState<TargetHierarchyNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTargets, setAllTargets] = useState<BottomUpTarget[]>([]);
  const [overrideNode, setOverrideNode] = useState<TargetHierarchyNode | null>(
    null,
  );
  const [overrideAmount, setOverrideAmount] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overridePeriod, setOverridePeriod] = useState<TargetPeriod>(
    TargetPeriod.Yearly,
  );
  const [overriding, setOverriding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tree, targets] = await Promise.all([
        api.getTargetHierarchy(token),
        api.listAllBottomUpTargets(token),
      ]);
      setHierarchy(tree);
      setAllTargets(targets);
    } catch {
      toast.error("Failed to load hierarchy");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  async function handleOverrideSave() {
    if (!overrideNode) return;
    const amt = Number.parseInt(overrideAmount, 10);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!overrideReason.trim()) {
      toast.error("Override reason is required");
      return;
    }
    const periodTarget = allTargets.find(
      (t) => t.userId === overrideNode.userId && t.period === overridePeriod,
    );
    if (!periodTarget) {
      toast.error(
        `No ${TARGET_PERIOD_LABELS[overridePeriod]} target found for this user — set a target first before overriding.`,
      );
      return;
    }
    setOverriding(true);
    try {
      await api.overrideBottomUpTarget(token, {
        targetId: periodTarget.id,
        newAmount: BigInt(amt),
        overrideReason: overrideReason.trim(),
      });
      toast.success("Override saved and hierarchy updated");
      setOverrideNode(null);
      setOverrideAmount("");
      setOverrideReason("");
      setOverridePeriod(TargetPeriod.Yearly);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Override failed");
    } finally {
      setOverriding(false);
    }
  }

  async function handleUndo(node: TargetHierarchyNode) {
    // Find any overridden target for this user — prefer Yearly, but accept any period
    const overriddenTarget =
      allTargets.find(
        (t) =>
          t.userId === node.userId &&
          t.isOverridden &&
          t.period === TargetPeriod.Yearly,
      ) ?? allTargets.find((t) => t.userId === node.userId && t.isOverridden);
    if (!overriddenTarget) {
      toast.error("No overridden target found to undo");
      return;
    }
    try {
      await api.undoBottomUpTargetOverride(token, overriddenTarget.id);
      toast.success("Override reverted — auto-calculation restored");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Undo failed");
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Target Hierarchy Tree">
        {loading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : hierarchy.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <span className="text-lg">∅</span>
            </div>
            <p className="text-sm">
              No hierarchy data — set MR-level targets first.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {hierarchy.map((node) => (
              <HierarchyNode
                key={String(node.userId)}
                node={node}
                depth={0}
                canOverride={canOverride}
                onOverride={setOverrideNode}
                onUndo={handleUndo}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <Dialog
        open={!!overrideNode}
        onOpenChange={(o) => {
          if (!o) {
            setOverrideNode(null);
            setOverrideAmount("");
            setOverrideReason("");
            setOverridePeriod(TargetPeriod.Yearly);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Override Target</DialogTitle>
          </DialogHeader>
          {overrideNode && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Overriding auto-calculated target for{" "}
                <span className="font-semibold text-foreground">
                  {overrideNode.name}
                </span>{" "}
                ({overrideNode.role})
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="override-period">
                  Period to Override <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={overridePeriod}
                  onValueChange={(v) => setOverridePeriod(v as TargetPeriod)}
                >
                  <SelectTrigger
                    id="override-period"
                    data-ocid="select-override-period"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TargetPeriod).map((p) => {
                      const hasTarget = allTargets.some(
                        (t) =>
                          t.userId === overrideNode.userId && t.period === p,
                      );
                      return (
                        <SelectItem key={p} value={p}>
                          {TARGET_PERIOD_LABELS[p]}
                          {!hasTarget && (
                            <span className="ml-1 text-muted-foreground text-xs">
                              (no target set)
                            </span>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {!allTargets.some(
                  (t) =>
                    t.userId === overrideNode.userId &&
                    t.period === overridePeriod,
                ) && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    No target set for this period — set a target first before
                    overriding.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="override-amount">
                  New Amount (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="override-amount"
                  type="number"
                  min="1"
                  placeholder="e.g. 1200000"
                  value={overrideAmount}
                  onChange={(e) => setOverrideAmount(e.target.value)}
                  data-ocid="input-override-amount"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="override-reason">
                  Reason / Notes <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="override-reason"
                  placeholder="Explain why you are manually overriding…"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                  data-ocid="textarea-override-reason"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOverrideNode(null);
                    setOverrideAmount("");
                    setOverrideReason("");
                    setOverridePeriod(TargetPeriod.Yearly);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleOverrideSave}
                  disabled={overriding}
                  data-ocid="btn-save-override"
                >
                  {overriding ? "Saving…" : "Save Override"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Tab 3 : Summary Report ────────────────────────────────────────────────────

function SummaryReportTab() {
  const { session } = useAuthStore();
  const token = session?.token ?? "";

  const [rows, setRows] = useState<BottomUpTargetSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [territory, setTerritory] = useState("all");
  const [area, setArea] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [exporting, setExporting] = useState(false);

  const territories = useMemo(() => {
    const seen = new Set<string>();
    return rows
      .map((r) => r.territory)
      .filter((t) => t && !seen.has(t) && seen.add(t));
  }, [rows]);

  const areas = useMemo(() => {
    const seen = new Set<string>();
    return rows
      .filter((r) => territory === "all" || r.territory === territory)
      .map((r) => r.area)
      .filter((a) => a && !seen.has(a) && seen.add(a));
  }, [rows, territory]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBottomUpSummaryReport(
        token,
        territory !== "all" ? territory : undefined,
        area !== "all" ? area : undefined,
        roleFilter !== "all" ? (roleFilter as Role) : undefined,
      );
      setRows(data);
    } catch {
      toast.error("Failed to fetch summary report");
    } finally {
      setLoading(false);
    }
  }, [token, territory, area, roleFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  function exportToExcel() {
    setExporting(true);
    try {
      const dataRows = rows.map((r) => ({
        Level: r.level,
        "Employee Name": r.employeeName,
        Territory: r.territory,
        Area: r.area,
        "Monthly (₹)": Number(r.monthly),
        "Quarterly (₹)": Number(r.quarterly),
        "Half-Yearly (₹)": Number(r.halfYearly),
        "Yearly (₹)": Number(r.yearly),
        Status: r.status,
        "Override Notes": r.overrideNotes,
      }));
      const totalRow = {
        Level: "TOTAL",
        "Employee Name": "",
        Territory: "",
        Area: "",
        "Monthly (₹)": rows.reduce((s, r) => s + Number(r.monthly), 0),
        "Quarterly (₹)": rows.reduce((s, r) => s + Number(r.quarterly), 0),
        "Half-Yearly (₹)": rows.reduce((s, r) => s + Number(r.halfYearly), 0),
        "Yearly (₹)": rows.reduce((s, r) => s + Number(r.yearly), 0),
        Status: "",
        "Override Notes": "",
      };
      const ws = XLSX.utils.json_to_sheet([...dataRows, totalRow]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Target Summary");
      XLSX.writeFile(
        wb,
        `BottomUpTargetReport_${new Date().getFullYear()}.xlsx`,
      );
      toast.success("Report exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  const grandTotals = useMemo(
    () => ({
      monthly: rows.reduce((s, r) => s + Number(r.monthly), 0),
      quarterly: rows.reduce((s, r) => s + Number(r.quarterly), 0),
      halfYearly: rows.reduce((s, r) => s + Number(r.halfYearly), 0),
      yearly: rows.reduce((s, r) => s + Number(r.yearly), 0),
    }),
    [rows],
  );

  return (
    <div className="space-y-4">
      <SectionCard title="Filters">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Territory</Label>
            <Select
              value={territory}
              onValueChange={(v) => {
                setTerritory(v);
                setArea("all");
              }}
            >
              <SelectTrigger data-ocid="filter-territory">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Territories</SelectItem>
                {territories.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Area</Label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger data-ocid="filter-area">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Areas</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger data-ocid="filter-role">
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
        </div>
      </SectionCard>

      <SectionCard
        title="Target Summary"
        headerActions={
          <Button
            size="sm"
            variant="outline"
            onClick={exportToExcel}
            disabled={exporting || rows.length === 0}
            data-ocid="btn-export-summary"
          >
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? "Exporting…" : "Export to Excel"}
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body min-w-[700px]">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {[
                  "Level",
                  "Employee Name",
                  "Territory",
                  "Area",
                  "Monthly",
                  "Quarterly",
                  "Half-Yearly",
                  "Yearly",
                  "Status",
                  "Override Notes",
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
                (["sk0", "sk1", "sk2"] as const).map((sk) => (
                  <tr key={sk} className="border-b border-border">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-muted-foreground text-sm"
                  >
                    No data for selected filters
                  </td>
                </tr>
              ) : (
                <>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                      data-ocid={`summary-row-${i}`}
                    >
                      <td className="px-3 py-2.5 font-medium text-xs">
                        {row.level}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">
                        {row.employeeName}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">
                        {row.territory || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">
                        {row.area || "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right">
                        {fmt(row.monthly)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right">
                        {fmt(row.quarterly)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right">
                        {fmt(row.halfYearly)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right">
                        {fmt(row.yearly)}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge
                          isOverridden={row.status === "ManuallyOverridden"}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate">
                        {row.overrideNotes || "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 border-t-2 border-border font-semibold">
                    <td className="px-3 py-2.5 text-xs font-display uppercase tracking-wide">
                      Grand Total
                    </td>
                    <td colSpan={3} />
                    <td className="px-3 py-2.5 font-mono text-right text-foreground">
                      ₹{grandTotals.monthly.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right text-foreground">
                      ₹{grandTotals.quarterly.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right text-foreground">
                      ₹{grandTotals.halfYearly.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right text-foreground">
                      ₹{grandTotals.yearly.toLocaleString("en-IN")}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BottomUpTargetsAdmin() {
  const [activeTab, setActiveTab] = useState<Tab>("Set MR Targets");

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Bottom-Up Target Management"
        subtitle="Set MR-level targets — higher roles are auto-calculated"
        actions={
          <Button
            variant="outline"
            size="sm"
            data-ocid="btn-target-history"
            onClick={() => {
              window.location.href = "/admin/targets/history";
            }}
          >
            <History className="w-4 h-4 mr-1.5" />
            Target History
          </Button>
        }
      />
      <PageContent>
        {/* Tab bar */}
        <div className="flex gap-1 bg-muted/40 rounded-lg p-1 mb-6 overflow-x-auto scrollbar-thin">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              data-ocid={`tab-${tab.toLowerCase().replace(/\s+/g, "-")}`}
              className={`px-3 py-2 text-sm font-display font-medium rounded-md transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === tab
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Set MR Targets" && <SetMrTargetsTab canEdit />}
        {activeTab === "Target Hierarchy" && <TargetHierarchyTab canOverride />}
        {activeTab === "Summary Report" && <SummaryReportTab />}
      </PageContent>
    </PortalLayout>
  );
}
