import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Role } from "../../backend";
import type { HqHierarchyEmployee, ReportingChainEntry } from "../../backend.d";
import { PortalLayout } from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { buildBrandingExcelRows } from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";

function roleFromString(role: string): Role {
  const map: Record<string, Role> = {
    Admin: Role.Admin,
    HRManager: Role.HRManager,
    ZSM: Role.ZSM,
    RSM: Role.RSM,
    ASM: Role.ASM,
    MR: Role.MR,
  };
  return map[role] ?? Role.Admin;
}

// ── Role display config ───────────────────────────────────────────────────────

const ROLE_ORDER = ["ZSM", "RSM", "ASM", "MR"] as const;

const ROLE_COLORS: Record<string, string> = {
  MR: "bg-blue-600 text-white",
  ASM: "bg-orange-600 text-white",
  RSM: "bg-purple-600 text-white",
  ZSM: "bg-green-600 text-white",
};

const ROLE_INDENT: Record<string, number> = {
  ZSM: 0,
  RSM: 1,
  ASM: 2,
  MR: 3,
};

function roleSortIndex(role: string): number {
  const idx = ROLE_ORDER.indexOf(role as (typeof ROLE_ORDER)[number]);
  return idx === -1 ? 99 : idx;
}

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_COLORS[role] ?? "bg-muted text-foreground";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${cls}`}
    >
      {role}
    </span>
  );
}

// ── Reporting chain modal ─────────────────────────────────────────────────────

function ReportingChainPanel({
  employee,
  onClose,
}: {
  employee: HqHierarchyEmployee;
  onClose: () => void;
}) {
  const session = useAuthStore((s) => s.session);
  const [chain, setChain] = useState<ReportingChainEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    api
      .getEmployeeReportingChain(session.token, employee.userId)
      .then(setChain)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [session?.token, employee.userId]);

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 m-0 w-full h-full max-w-none max-h-none border-0"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="bg-card rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md mx-0 sm:mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        data-ocid="hq-hierarchy.dialog"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border">
          <div className="min-w-0">
            <p className="font-display font-bold text-foreground text-base leading-tight truncate">
              {employee.employeeName}
            </p>
            <p className="text-muted-foreground text-sm mt-0.5 font-body">
              Reporting Chain
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-ocid="hq-hierarchy.close_button"
            className="ml-3 p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Chain */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          )}
          {error && (
            <p className="text-destructive text-sm font-body">{error}</p>
          )}
          {!loading && !error && chain.length === 0 && (
            <p className="text-muted-foreground text-sm font-body text-center py-6">
              No reporting chain data available.
            </p>
          )}
          {!loading && !error && chain.length > 0 && (
            <ol className="space-y-2">
              {chain.map((entry, idx) => (
                <li
                  key={String(entry.userId)}
                  className="flex items-start gap-3"
                >
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">
                        {idx + 1}
                      </span>
                    </div>
                    {idx < chain.length - 1 && (
                      <div className="w-0.5 flex-1 bg-border mt-1 min-h-[12px]" />
                    )}
                  </div>
                  <div className="bg-muted/50 rounded-lg px-3 py-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-body font-medium text-sm text-foreground truncate">
                        {entry.name}
                      </span>
                      <RoleBadge role={entry.role} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </dialog>
  );
}

// ── Employee card ─────────────────────────────────────────────────────────────

function EmployeeCard({
  emp,
  index,
  onSelect,
}: {
  emp: HqHierarchyEmployee;
  index: number;
  onSelect: (emp: HqHierarchyEmployee) => void;
}) {
  const indent = ROLE_INDENT[emp.role] ?? 0;
  const areas = emp.hqAssignments[0]?.areaNames?.join(", ") || "—";

  return (
    <button
      type="button"
      className="relative flex items-start gap-3 py-3 pr-3 hover:bg-muted/30 rounded-lg transition-colors cursor-pointer group w-full text-left"
      style={{ paddingLeft: `${indent * 16 + 12}px` }}
      onClick={() => onSelect(emp)}
      data-ocid={`hq-hierarchy.item.${index + 1}`}
    >
      {/* Tree connector — show for indented rows */}
      {indent > 0 && (
        <div
          className="absolute top-0 bottom-0 border-l border-border"
          style={{ left: `${(indent - 1) * 16 + 20}px` }}
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-body font-semibold text-sm text-foreground truncate">
            {emp.employeeName}
          </span>
          <RoleBadge role={emp.role} />
          <Badge
            variant="outline"
            className={`text-xs ${
              emp.status === "Active"
                ? "border-green-500 text-green-700 bg-green-50"
                : "border-red-400 text-red-700 bg-red-50"
            }`}
          >
            {emp.status}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground font-body">
          {emp.territory && <span>📍 {emp.territory}</span>}
          {emp.primaryHqName && <span>🏢 {emp.primaryHqName}</span>}
          {areas !== "—" && <span>🗺 {areas}</span>}
          {emp.mobileNumber && <span>📱 {emp.mobileNumber}</span>}
          {emp.reportingManagerName && (
            <span>👤 Reports to: {emp.reportingManagerName}</span>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ── HQ Group ──────────────────────────────────────────────────────────────────

function HqGroup({
  hqName,
  employees,
  startIndex,
  onSelect,
}: {
  hqName: string;
  employees: HqHierarchyEmployee[];
  startIndex: number;
  onSelect: (emp: HqHierarchyEmployee) => void;
}) {
  const [open, setOpen] = useState(true);
  const sorted = useMemo(
    () =>
      [...employees].sort(
        (a, b) => roleSortIndex(a.role) - roleSortIndex(b.role),
      ),
    [employees],
  );

  return (
    <div className="border border-border rounded-xl overflow-hidden mb-3">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/30 transition-colors"
        data-ocid={`hq-hierarchy.${hqName.replace(/\s+/g, "-").toLowerCase()}.toggle`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-display font-bold text-foreground text-sm truncate">
            {hqName}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {employees.length}{" "}
            {employees.length === 1 ? "Employee" : "Employees"}
          </span>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-2 pb-2 bg-background divide-y divide-border/50">
          {sorted.map((emp, i) => (
            <EmployeeCard
              key={String(emp.userId)}
              emp={emp}
              index={startIndex + i}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function HqEmployeeHierarchyPage() {
  const session = useAuthStore((s) => s.session);
  const [employees, setEmployees] = useState<HqHierarchyEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HqHierarchyEmployee | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterTerritory, setFilterTerritory] = useState("all");
  const [filterHq, setFilterHq] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchEmployees = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.listEmployeesForHqHierarchy(session.token);
      setEmployees(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Unique filter options
  const territories = useMemo(
    () =>
      Array.from(
        new Set(employees.map((e) => e.territory).filter(Boolean)),
      ).sort(),
    [employees],
  );
  const hqNames = useMemo(
    () =>
      Array.from(
        new Set(employees.map((e) => e.primaryHqName).filter(Boolean)),
      ).sort(),
    [employees],
  );
  const roles = useMemo(
    () =>
      Array.from(new Set(employees.map((e) => e.role).filter(Boolean))).sort(
        (a, b) => roleSortIndex(a) - roleSortIndex(b),
      ),
    [employees],
  );

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) => {
      if (filterTerritory !== "all" && e.territory !== filterTerritory)
        return false;
      if (filterHq !== "all" && e.primaryHqName !== filterHq) return false;
      if (filterRole !== "all" && e.role !== filterRole) return false;
      if (filterStatus !== "all" && e.status !== filterStatus) return false;
      if (q && !e.employeeName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [employees, search, filterTerritory, filterHq, filterRole, filterStatus]);

  // Group by HQ
  const grouped = useMemo(() => {
    const map = new Map<string, HqHierarchyEmployee[]>();
    for (const emp of filtered) {
      const hq = emp.primaryHqName || "Unassigned";
      if (!map.has(hq)) map.set(hq, []);
      map.get(hq)!.push(emp);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // Running index offset per HQ group
  const groupStartIndices = useMemo(() => {
    const result: number[] = [];
    let count = 0;
    for (const [, emps] of grouped) {
      result.push(count);
      count += emps.length;
    }
    return result;
  }, [grouped]);

  // Export to Excel
  const handleExport = useCallback(async () => {
    if (!session?.token) return;
    try {
      const { default: XLSX } = await import("xlsx");
      const companyProfile = await api.getCompanyProfile(session.token);
      const brandingRows = buildBrandingExcelRows(companyProfile);

      const dataRows = filtered.map((e) => ({
        "Employee Name": e.employeeName,
        "Employee Code": e.employeeCode,
        Role: e.role,
        Territory: e.territory,
        HQ: e.primaryHqName,
        Areas: e.hqAssignments.flatMap((h) => h.areaNames).join(", ") || "—",
        Stations:
          e.hqAssignments.flatMap((h) => h.stationNames).join(", ") || "—",
        Mobile: e.mobileNumber,
        "Reporting Manager": e.reportingManagerName,
        Status: e.status,
      }));

      const sheetData = [...brandingRows, ...dataRows];
      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "HQ Employee List");
      XLSX.writeFile(
        wb,
        `HQ_Employee_Hierarchy_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    } catch (e) {
      console.error("Export failed:", e);
    }
  }, [session?.token, filtered]);

  const hasFilters =
    search ||
    filterTerritory !== "all" ||
    filterHq !== "all" ||
    filterRole !== "all" ||
    filterStatus !== "all";

  return (
    <PortalLayout portalRole={roleFromString(session?.role ?? "Admin")}>
      {/* Page header */}
      <div className="bg-card border-b border-border px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-foreground text-xl leading-tight">
              HQ-wise Employee Hierarchy
            </h1>
            <p className="text-muted-foreground text-sm font-body mt-0.5">
              All employees grouped by HQ, ordered by hierarchy
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEmployees}
              disabled={loading}
              data-ocid="hq-hierarchy.refresh_button"
              className="font-body"
            >
              <RefreshCw
                className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={loading || filtered.length === 0}
              data-ocid="hq-hierarchy.export_button"
              className="font-body"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-muted/30 border-b border-border px-4 py-3 sm:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="font-body text-sm col-span-2 sm:col-span-3 lg:col-span-1"
            data-ocid="hq-hierarchy.search_input"
          />

          <Select value={filterTerritory} onValueChange={setFilterTerritory}>
            <SelectTrigger
              className="font-body text-sm"
              data-ocid="hq-hierarchy.territory_filter"
            >
              <SelectValue placeholder="Territory" />
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

          <Select value={filterHq} onValueChange={setFilterHq}>
            <SelectTrigger
              className="font-body text-sm"
              data-ocid="hq-hierarchy.hq_filter"
            >
              <SelectValue placeholder="HQ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All HQs</SelectItem>
              {hqNames.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger
              className="font-body text-sm"
              data-ocid="hq-hierarchy.role_filter"
            >
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger
              className="font-body text-sm"
              data-ocid="hq-hierarchy.status_filter"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-body">
              {filtered.length} of {employees.length} employees
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilterTerritory("all");
                setFilterHq("all");
                setFilterRole("all");
                setFilterStatus("all");
              }}
              className="text-xs text-primary hover:underline font-body"
              data-ocid="hq-hierarchy.clear_filters_button"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 sm:px-6">
        {/* Loading state */}
        {loading && (
          <div className="space-y-3" data-ocid="hq-hierarchy.loading_state">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="border border-border rounded-xl overflow-hidden"
              >
                <Skeleton className="h-12 w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-14 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div
            className="flex flex-col items-center justify-center py-12 gap-3"
            data-ocid="hq-hierarchy.error_state"
          >
            <p className="text-destructive font-body text-sm text-center">
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={fetchEmployees}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && grouped.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-16 gap-3"
            data-ocid="hq-hierarchy.empty_state"
          >
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
            <p className="font-display font-semibold text-foreground text-base">
              No employees found
            </p>
            <p className="text-muted-foreground text-sm font-body text-center max-w-xs">
              {hasFilters
                ? "Try adjusting your filters."
                : "No employees have been assigned to HQs yet."}
            </p>
          </div>
        )}

        {/* Grouped list */}
        {!loading && !error && grouped.length > 0 && (
          <div>
            {grouped.map(([hqName, emps], gi) => (
              <HqGroup
                key={hqName}
                hqName={hqName}
                employees={emps}
                startIndex={groupStartIndices[gi]}
                onSelect={setSelected}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reporting chain modal */}
      {selected && (
        <ReportingChainPanel
          employee={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </PortalLayout>
  );
}
