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
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle,
  ArrowUpDown,
  Download,
  Edit2,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChargeType, Role } from "../../backend";
import type { AdditionalCharge, HQRecord } from "../../backend.d";
import {
  HqBlockAllotment,
  useHqBlockData,
} from "../../components/HqBlockAllotment";
import {
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import ScrollToBottom from "../../components/ScrollToBottom";
import ScrollableTable from "../../components/ScrollableTable";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { HqAssignment, UserInfo } from "../../types";
import { formatDate } from "../../utils/dateFormatter";
type SortKey = "empName" | "effectiveFrom" | "status";
type SortDir = "asc" | "desc";

const ALL_ROLES = [Role.MR, Role.ASM, Role.RSM, Role.ZSM];

function daysUntil(ts: bigint): number {
  const ms = Number(ts) / 1_000_000;
  return Math.ceil((ms - Date.now()) / 86_400_000);
}

function getStatus(c: AdditionalCharge): "Active" | "Expired" | "Upcoming" {
  const now = Date.now();
  const from = Number(c.effectiveFrom) / 1_000_000;
  const to = Number(c.effectiveTo) / 1_000_000;
  if (now < from) return "Upcoming";
  if (now > to) return "Expired";
  return "Active";
}

function StatusBadge({ effectiveTo }: { effectiveTo: bigint }) {
  const days = daysUntil(effectiveTo);
  if (days < 0)
    return (
      <Badge className="text-xs bg-muted text-muted-foreground border-border">
        Expired
      </Badge>
    );
  if (days <= 7)
    return (
      <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-300 gap-1">
        <AlertTriangle className="w-3 h-3" /> Expiring Soon
      </Badge>
    );
  return (
    <Badge className="text-xs bg-green-100 text-green-700 border-green-300">
      Active
    </Badge>
  );
}

type TabId = "assign" | "report";

export default function AdditionalChargesAdmin({
  portalRole,
}: { portalRole?: Role }) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const effectiveRole = portalRole ?? session?.role ?? Role.Admin;

  const [activeTab, setActiveTab] = useState<TabId>("assign");
  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const [charges, setCharges] = useState<
    (AdditionalCharge & {
      empName?: string;
      primaryRole?: string;
      areaDisplayLabel?: string;
    })[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);

  // Assign form state
  const [selEmployee, setSelEmployee] = useState("none");
  const [chargeType, setChargeType] = useState<ChargeType>(ChargeType.Role);
  const [addlRole, setAddlRole] = useState<Role>(Role.ASM);
  // Multi-HQ blocks for Area charge type and optional area alongside role
  const [areaHqBlocks, setAreaHqBlocks] = useState<HqAssignment[]>([]);
  const [roleAreaHqBlocks, setRoleAreaHqBlocks] = useState<HqAssignment[]>([]);
  const [mrTerritoryHq, setMrTerritoryHq] = useState("");
  const [mrGradeLevel, setMrGradeLevel] = useState("Grade-II");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [hqs, setHqs] = useState<HQRecord[]>([]);

  // HqBlockData hook for area charge type
  const {
    areasByHq: areasByHqArea,
    stationsByHq: stationsByHqArea,
    loadingHqData: loadingHqDataArea,
    ensureLoaded: ensureLoadedArea,
  } = useHqBlockData(
    token,
    (hqId: bigint) => api.listActiveAreasByHQ(token, hqId),
    (hqId: bigint) => api.listStationsByHQ(token, hqId),
  );

  // HqBlockData hook for role + optional area
  const {
    areasByHq: areasByHqRole,
    stationsByHq: stationsByHqRole,
    loadingHqData: loadingHqDataRole,
    ensureLoaded: ensureLoadedRole,
  } = useHqBlockData(
    token,
    (hqId: bigint) => api.listActiveAreasByHQ(token, hqId),
    (hqId: bigint) => api.listStationsByHQ(token, hqId),
  );

  // Edit modal
  const [editCharge, setEditCharge] = useState<AdditionalCharge | null>(null);
  const [editFrom, setEditFrom] = useState("");
  const [editTo, setEditTo] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Report filters
  const [filterEmp, setFilterEmp] = useState("");
  const [filterPrimaryRole, setFilterPrimaryRole] = useState("all");
  const [filterAddlRole, setFilterAddlRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState<
    "All" | "Active" | "Expired" | "Upcoming"
  >("All");
  const [sortKey, setSortKey] = useState<SortKey>("effectiveFrom");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [users, hqList] = await Promise.all([
        api.listAllUsers(token),
        api.getAllActiveHQs(token),
      ]);
      setEmployees(users);
      setHqs(hqList as HQRecord[]);
    } catch {
      /* silent */
    }
  }, [token]);

  const loadCharges = useCallback(async () => {
    if (!token || employees.length === 0) return;
    setLoading(true);
    try {
      const raw = await api.listAllAdditionalCharges(token, {
        activeOnly: false,
      });
      const empMap = new Map(
        employees.map((e) => [e.id, { name: e.name, role: e.role }]),
      );
      const hqNameMap = new Map(hqs.map((h) => [String(h.id), h.name]));
      setCharges(
        raw.map((c) => {
          const emp = empMap.get(c.employeeId);
          // Build display label for Area charges
          let areaDisplayLabel: string | undefined;
          if (
            c.additionalHqAssignments &&
            c.additionalHqAssignments.length > 0
          ) {
            areaDisplayLabel = c.additionalHqAssignments
              .map((ha) => {
                const hqName =
                  hqNameMap.get(String(ha.hqId)) ?? `HQ ${String(ha.hqId)}`;
                const areaCount = ha.areaIds.length;
                return `${hqName} (${areaCount} area${areaCount !== 1 ? "s" : ""})`;
              })
              .join(", ");
          } else if (c.additionalAreaId != null && c.additionalHqId != null) {
            const hqName =
              hqNameMap.get(String(c.additionalHqId)) ??
              String(c.additionalHqId);
            areaDisplayLabel = `Area (${hqName})`;
          } else if (c.additionalArea) {
            areaDisplayLabel = c.additionalArea;
          }
          return {
            ...c,
            empName: emp?.name ?? `EMP-${String(c.employeeId)}`,
            primaryRole: emp?.role ?? "—",
            areaDisplayLabel,
          };
        }),
      );
    } catch {
      setCharges([]);
    } finally {
      setLoading(false);
    }
  }, [token, employees, hqs]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  useEffect(() => {
    loadCharges();
  }, [loadCharges]);

  // Filtered + sorted charges for Assign tab (activeOnly toggle)
  const assignTabCharges = useMemo(() => {
    if (!activeOnly) return charges;
    return charges.filter(
      (c) => getStatus(c) === "Active" || daysUntil(c.effectiveTo) >= 0,
    );
  }, [charges, activeOnly]);

  // Filtered + sorted charges for Report tab
  const reportCharges = useMemo(() => {
    let list = [...charges];
    if (filterEmp.trim()) {
      const q = filterEmp.toLowerCase();
      list = list.filter((c) => c.empName?.toLowerCase().includes(q));
    }
    if (filterPrimaryRole !== "all") {
      list = list.filter((c) => c.primaryRole === filterPrimaryRole);
    }
    if (filterAddlRole !== "all") {
      list = list.filter(
        (c) =>
          c.additionalRole === filterAddlRole ||
          c.additionalArea === filterAddlRole,
      );
    }
    if (filterStatus !== "All") {
      list = list.filter((c) => getStatus(c) === filterStatus);
    }
    list.sort((a, b) => {
      let av = 0;
      let bv = 0;
      if (sortKey === "empName") {
        const an = a.empName ?? "";
        const bn = b.empName ?? "";
        return sortDir === "asc" ? an.localeCompare(bn) : bn.localeCompare(an);
      }
      if (sortKey === "effectiveFrom") {
        av = Number(a.effectiveFrom);
        bv = Number(b.effectiveFrom);
      } else if (sortKey === "status") {
        const order = { Active: 0, Upcoming: 1, Expired: 2 };
        av = order[getStatus(a)];
        bv = order[getStatus(b)];
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return list;
  }, [
    charges,
    filterEmp,
    filterPrimaryRole,
    filterAddlRole,
    filterStatus,
    sortKey,
    sortDir,
  ]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return <span className="text-xs">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  async function handleAssign() {
    if (selEmployee === "none") {
      toast.error("Select an employee");
      return;
    }
    if (!effectiveFrom || !effectiveTo) {
      toast.error("Enter effective dates");
      return;
    }
    if (chargeType !== ChargeType.Role && chargeType !== ChargeType.Area) {
      toast.error("Select a valid charge type");
      return;
    }
    if (
      chargeType === ChargeType.Area &&
      areaHqBlocks.filter((b) => b.hqId !== BigInt(0)).length === 0
    ) {
      toast.error("Add at least one Headquarters with Areas");
      return;
    }
    setSaving(true);
    try {
      // Build additionalHqAssignments from blocks (filter out placeholder blocks)
      const validAreaBlocks = areaHqBlocks.filter((b) => b.hqId !== BigInt(0));
      const validRoleAreaBlocks = roleAreaHqBlocks.filter(
        (b) => b.hqId !== BigInt(0),
      );

      await api.assignAdditionalCharge(token, {
        employeeId: BigInt(selEmployee),
        chargeType,
        additionalRole: chargeType === ChargeType.Role ? addlRole : undefined,
        additionalHqAssignments:
          chargeType === ChargeType.Area
            ? validAreaBlocks.map((b) => ({ hqId: b.hqId, areaIds: b.areaIds }))
            : validRoleAreaBlocks.length > 0
              ? validRoleAreaBlocks.map((b) => ({
                  hqId: b.hqId,
                  areaIds: b.areaIds,
                }))
              : undefined,
        effectiveFrom:
          BigInt(new Date(effectiveFrom).getTime()) * BigInt(1_000_000),
        effectiveTo:
          BigInt(new Date(effectiveTo).getTime()) * BigInt(1_000_000),
        remarks:
          [
            remarks || undefined,
            chargeType === ChargeType.Role &&
            addlRole === Role.MR &&
            mrTerritoryHq
              ? `MR_TERRITORY_HQ:${mrTerritoryHq}`
              : undefined,
            chargeType === ChargeType.Role && addlRole === Role.MR
              ? `MR_GRADE:${mrGradeLevel}`
              : undefined,
          ]
            .filter(Boolean)
            .join("|") || undefined,
      });
      toast.success("Additional charge assigned");
      setSelEmployee("none");
      setAreaHqBlocks([]);
      setRoleAreaHqBlocks([]);
      setEffectiveFrom("");
      setEffectiveTo("");
      setRemarks("");
      setMrTerritoryHq("");
      setMrGradeLevel("Grade-II");
      await loadCharges();
    } catch (e) {
      toast.error(String(e) || "Failed to assign charge");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave() {
    if (!editCharge) return;
    setEditSaving(true);
    try {
      await api.updateAdditionalCharge(token, {
        chargeId: editCharge.id,
        effectiveFrom: editFrom
          ? BigInt(new Date(editFrom).getTime()) * BigInt(1_000_000)
          : undefined,
        effectiveTo: editTo
          ? BigInt(new Date(editTo).getTime()) * BigInt(1_000_000)
          : undefined,
        remarks: editRemarks || undefined,
      });
      toast.success("Charge updated");
      setEditCharge(null);
      await loadCharges();
    } catch (e) {
      toast.error(String(e) || "Failed to update charge");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleRemove(chargeId: string) {
    if (!confirm("Remove this additional charge?")) return;
    try {
      await api.removeAdditionalCharge(token, chargeId);
      toast.success("Charge removed");
      await loadCharges();
    } catch (e) {
      toast.error(String(e) || "Failed to remove charge");
    }
  }

  function handleExport() {
    const rows = reportCharges.map((c) => ({
      "Employee Name": c.empName ?? "",
      "Primary Role": c.primaryRole ?? "",
      "Additional Role/Area": c.additionalRole ?? c.additionalArea ?? "",
      "Effective From": formatDate(c.effectiveFrom),
      "Effective To": formatDate(c.effectiveTo),
      Status: getStatus(c),
      Remarks: c.remarks ?? "",
      "Assigned By": c.assignedBy ?? "",
      "Date Assigned": formatDate(c.assignedAt),
    }));

    const headers = Object.keys(rows[0] ?? {});
    const csvLines = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => `"${String(r[h as keyof typeof r]).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Additional_Charges_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  }

  const expiringCount = charges.filter((c) => {
    const d = daysUntil(c.effectiveTo);
    return d >= 0 && d <= 7;
  }).length;

  const allRoles = Object.values(Role);
  const allAddlValues = Array.from(
    new Set(
      charges.map((c) => c.additionalRole ?? c.additionalArea).filter(Boolean),
    ),
  ) as string[];

  return (
    <PortalLayout portalRole={effectiveRole}>
      <PageHeader
        title="Additional Charges"
        subtitle="Assign temporary additional roles or areas to employees"
      />
      <PageContent>
        {expiringCount > 0 && (
          <div className="mb-4 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
            <span className="text-sm text-orange-700 font-body">
              <strong>{expiringCount}</strong> charge
              {expiringCount > 1 ? "s" : ""} expiring within 7 days — review and
              extend if needed.
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-5">
          {(["assign", "report"] as TabId[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-ocid={`tab-charges-${t}`}
            >
              {t === "assign" ? "Assign & Manage" : "Charge Report"}
            </button>
          ))}
        </div>

        {activeTab === "assign" && (
          <>
            {/* Scroll to Bottom for long form */}
            <div className="flex justify-end mb-2">
              <ScrollToBottom label="Jump to bottom" />
            </div>
            {/* Assign New Charge */}
            <SectionCard title="Assign New Charge">
              <div className="grid gap-4 max-w-xl">
                <div className="space-y-1.5">
                  <Label className="text-xs">Employee</Label>
                  <Select value={selEmployee} onValueChange={setSelEmployee}>
                    <SelectTrigger data-ocid="select-charge-employee">
                      <SelectValue placeholder="Select employee…" />
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

                <div className="space-y-1.5">
                  <Label className="text-xs">Charge Type</Label>
                  <Select
                    value={chargeType}
                    onValueChange={(v) => setChargeType(v as ChargeType)}
                  >
                    <SelectTrigger data-ocid="select-charge-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ChargeType.Role}>
                        Additional Role
                      </SelectItem>
                      <SelectItem value={ChargeType.Area}>
                        Additional Area
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {chargeType === ChargeType.Role && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Additional Role</Label>
                      <Select
                        value={addlRole}
                        onValueChange={(v) => setAddlRole(v as Role)}
                      >
                        <SelectTrigger data-ocid="select-addl-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* MR-specific fields: Territory HQ and Grade Level */}
                    {chargeType === ChargeType.Role && addlRole === Role.MR && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                        <span className="text-xs font-display font-semibold text-amber-700 uppercase tracking-wider">
                          MR Territory Configuration
                        </span>
                        <p className="text-xs text-amber-600 font-body">
                          Required when assigning MR role to an RSM. DCR/MTP
                          approvals will be routed to ZSM to prevent
                          self-approval.
                        </p>
                        <div className="space-y-1.5">
                          <Label className="text-xs">
                            MR Territory HQ{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            placeholder="e.g. Andheri Station, Bandra HQ…"
                            value={mrTerritoryHq}
                            onChange={(e) => setMrTerritoryHq(e.target.value)}
                            data-ocid="input-mr-territory-hq"
                          />
                          <p className="text-xs text-muted-foreground">
                            The station/territory the employee will cover as MR.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Grade Level</Label>
                          <select
                            value={mrGradeLevel}
                            onChange={(e) => setMrGradeLevel(e.target.value)}
                            data-ocid="select-mr-grade-level"
                            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring h-10"
                          >
                            <option value="Grade-I">Grade-I</option>
                            <option value="Grade-II">Grade-II</option>
                            <option value="Grade-III">Grade-III</option>
                          </select>
                          <p className="text-xs text-muted-foreground">
                            TA/DA rates will use this grade when acting as MR.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Optional multi-HQ area assignment alongside the role */}
                    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-3">
                      <span className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                        Optional: Also assign additional areas
                      </span>
                      <p className="text-xs text-muted-foreground font-body">
                        The employee will have access to doctors and field data
                        for all selected areas during the charge period.
                      </p>
                      <HqBlockAllotment
                        hqOptions={hqs}
                        areaOptionsByHq={areasByHqRole}
                        stationOptionsByHq={stationsByHqRole}
                        value={roleAreaHqBlocks}
                        onChange={setRoleAreaHqBlocks}
                        loadingHqData={loadingHqDataRole}
                        onHqAdded={(hqId) => ensureLoadedRole(hqId)}
                        showExStations={false}
                      />
                    </div>
                  </>
                )}

                {chargeType === ChargeType.Area && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Headquarters &amp; Areas{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <p className="text-xs text-muted-foreground font-body">
                      Add one or more HQ blocks. For each HQ, select the areas
                      the employee should have access to.
                    </p>
                    <HqBlockAllotment
                      hqOptions={hqs}
                      areaOptionsByHq={areasByHqArea}
                      stationOptionsByHq={stationsByHqArea}
                      value={areaHqBlocks}
                      onChange={setAreaHqBlocks}
                      loadingHqData={loadingHqDataArea}
                      onHqAdded={(hqId) => ensureLoadedArea(hqId)}
                      showExStations={false}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Effective From</Label>
                    <Input
                      type="date"
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                      data-ocid="input-effective-from"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Effective To</Label>
                    <Input
                      type="date"
                      value={effectiveTo}
                      onChange={(e) => setEffectiveTo(e.target.value)}
                      data-ocid="input-effective-to"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Remarks (optional)</Label>
                  <Input
                    placeholder="Reason for assignment"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    data-ocid="input-charge-remarks"
                  />
                </div>

                <Button
                  onClick={handleAssign}
                  disabled={saving}
                  data-ocid="btn-assign-charge"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {saving ? "Assigning…" : "Assign Charge"}
                </Button>
              </div>
            </SectionCard>

            {/* Current Charges list */}
            <SectionCard
              title="Current Charges"
              headerActions={
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={activeOnly}
                      onCheckedChange={setActiveOnly}
                      id="active-only-toggle"
                      data-ocid="toggle-active-only"
                    />
                    <Label
                      htmlFor="active-only-toggle"
                      className="text-xs cursor-pointer"
                    >
                      Active only
                    </Label>
                  </div>
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
              ) : assignTabCharges.length === 0 ? (
                <div
                  className="py-10 text-center text-muted-foreground text-sm"
                  data-ocid="no-charges"
                >
                  No additional charges found
                </div>
              ) : (
                <ScrollableTable>
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        {[
                          "Employee",
                          "Charge Type",
                          "Role / Area",
                          "Effective From",
                          "Effective To",
                          "Days Left",
                          "Status",
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
                      {assignTabCharges.map((c) => {
                        const days = daysUntil(c.effectiveTo);
                        return (
                          <tr
                            key={c.id}
                            className="hover:bg-muted/20"
                            data-ocid={`charge-row-${c.id}`}
                          >
                            <td className="px-3 py-2 font-body font-medium text-foreground">
                              {c.empName}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">
                              {c.chargeType}
                            </td>
                            <td className="px-3 py-2">
                              {c.additionalRole ? (
                                <div className="flex flex-col gap-1">
                                  <Badge className="text-xs bg-accent/10 text-accent border-accent/30 w-fit">
                                    {c.additionalRole}
                                  </Badge>
                                  {c.areaDisplayLabel && (
                                    <span className="text-xs text-muted-foreground">
                                      + {c.areaDisplayLabel}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-foreground">
                                  {c.areaDisplayLabel ??
                                    c.additionalArea ??
                                    "—"}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {formatDate(c.effectiveFrom)}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {formatDate(c.effectiveTo)}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                              {days < 0 ? "—" : `${days}d`}
                            </td>
                            <td className="px-3 py-2">
                              <StatusBadge effectiveTo={c.effectiveTo} />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  title="Edit dates"
                                  onClick={() => {
                                    setEditCharge(c);
                                    setEditFrom(
                                      new Date(
                                        Number(c.effectiveFrom) / 1_000_000,
                                      )
                                        .toISOString()
                                        .slice(0, 10),
                                    );
                                    setEditTo(
                                      new Date(
                                        Number(c.effectiveTo) / 1_000_000,
                                      )
                                        .toISOString()
                                        .slice(0, 10),
                                    );
                                    setEditRemarks(c.remarks ?? "");
                                  }}
                                  className="text-primary hover:text-primary/80"
                                  data-ocid={`btn-edit-charge-${c.id}`}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  title="Remove charge"
                                  onClick={() => handleRemove(c.id)}
                                  className="text-destructive hover:text-destructive/80"
                                  data-ocid={`btn-remove-charge-${c.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollableTable>
              )}
            </SectionCard>
          </>
        )}

        {activeTab === "report" && (
          <SectionCard
            title={`Charge Report (${reportCharges.length} results)`}
            headerActions={
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={handleExport}
                disabled={reportCharges.length === 0}
                data-ocid="btn-export-charges"
              >
                <Download className="w-3 h-3" /> Export CSV
              </Button>
            }
          >
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <div className="space-y-1">
                <Label className="text-xs">Employee Name</Label>
                <Input
                  placeholder="Search name…"
                  value={filterEmp}
                  onChange={(e) => setFilterEmp(e.target.value)}
                  data-ocid="filter-report-emp"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Primary Role</Label>
                <Select
                  value={filterPrimaryRole}
                  onValueChange={setFilterPrimaryRole}
                >
                  <SelectTrigger data-ocid="filter-primary-role">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {allRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Additional Role / Area</Label>
                <Select
                  value={filterAddlRole}
                  onValueChange={setFilterAddlRole}
                >
                  <SelectTrigger data-ocid="filter-addl-role">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {allAddlValues.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={filterStatus}
                  onValueChange={(v) =>
                    setFilterStatus(v as typeof filterStatus)
                  }
                >
                  <SelectTrigger data-ocid="filter-charge-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Upcoming">Upcoming</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Report Table */}
            {loading ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 bg-muted rounded animate-pulse"
                  />
                ))}
              </div>
            ) : reportCharges.length === 0 ? (
              <div
                className="py-10 text-center text-muted-foreground text-sm"
                data-ocid="report-empty"
              >
                No charges match the selected filters
              </div>
            ) : (
              <ScrollableTable>
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider">
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                          onClick={() => toggleSort("empName")}
                        >
                          Employee <SortIcon k="empName" />
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider">
                        Primary Role
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider">
                        Additional Role / Area
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider">
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                          onClick={() => toggleSort("effectiveFrom")}
                        >
                          Effective From <SortIcon k="effectiveFrom" />
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider">
                        Effective To
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider">
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                          onClick={() => toggleSort("status")}
                        >
                          Status <SortIcon k="status" />
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider">
                        Remarks
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider">
                        Assigned By
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider">
                        Date Assigned
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportCharges.map((c) => {
                      const status = getStatus(c);
                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-muted/20"
                          data-ocid={`report-charge-row-${c.id}`}
                        >
                          <td className="px-3 py-2 font-body font-medium text-foreground">
                            {c.empName}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {c.primaryRole}
                          </td>
                          <td className="px-3 py-2">
                            {c.additionalRole ? (
                              <div className="flex flex-col gap-1">
                                <Badge className="text-xs bg-accent/10 text-accent border-accent/30 w-fit">
                                  {c.additionalRole}
                                </Badge>
                                {c.areaDisplayLabel && (
                                  <span className="text-xs text-muted-foreground">
                                    + {c.areaDisplayLabel}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-foreground">
                                {c.areaDisplayLabel ?? c.additionalArea ?? "—"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {formatDate(c.effectiveFrom)}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {formatDate(c.effectiveTo)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              className={`text-xs ${
                                status === "Active"
                                  ? "bg-green-100 text-green-700 border-green-300"
                                  : status === "Upcoming"
                                    ? "bg-blue-100 text-blue-700 border-blue-300"
                                    : "bg-muted text-muted-foreground border-border"
                              }`}
                            >
                              {status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[140px]">
                            {c.remarks || "—"}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {c.assignedBy || "—"}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {formatDate(c.assignedAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollableTable>
            )}
          </SectionCard>
        )}

        {/* Edit Modal */}
        <Dialog open={!!editCharge} onOpenChange={() => setEditCharge(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Charge Dates</DialogTitle>
            </DialogHeader>
            {editCharge && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {editCharge.chargeType} —{" "}
                  {editCharge.additionalRole ?? editCharge.additionalArea}
                  {editCharge.additionalRole &&
                    charges.find((c) => c.id === editCharge.id)
                      ?.areaDisplayLabel && (
                      <span className="ml-1 text-xs">
                        (+{" "}
                        {
                          charges.find((c) => c.id === editCharge.id)
                            ?.areaDisplayLabel
                        }
                        )
                      </span>
                    )}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Effective From</Label>
                    <Input
                      type="date"
                      value={editFrom}
                      onChange={(e) => setEditFrom(e.target.value)}
                      data-ocid="input-edit-from"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Effective To</Label>
                    <Input
                      type="date"
                      value={editTo}
                      onChange={(e) => setEditTo(e.target.value)}
                      data-ocid="input-edit-to"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Remarks</Label>
                  <Input
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    placeholder="Optional note"
                    data-ocid="input-edit-charge-remarks"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditCharge(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleEditSave}
                    disabled={editSaving}
                    data-ocid="btn-confirm-charge-edit"
                  >
                    {editSaving ? "Saving…" : "Save Changes"}
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
