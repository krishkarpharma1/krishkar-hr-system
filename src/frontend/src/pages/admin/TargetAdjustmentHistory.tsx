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
import { Download, History, Search } from "lucide-react";
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
import type { TargetAdjustmentLog, UserInfo } from "../../types";

const PERIOD_LABELS: Record<TargetPeriod, string> = {
  Monthly: "Monthly",
  Quarterly: "Quarterly",
  HalfYearly: "Half-Yearly",
  Yearly: "Yearly",
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

function fmtDate(ts: bigint) {
  return new Date(Number(ts) / 1_000_000).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TargetAdjustmentHistory({
  portalRole,
}: {
  portalRole?: Role;
}) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const role = portalRole ?? session?.role;

  const [logs, setLogs] = useState<TargetAdjustmentLog[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [logData, userData] = await Promise.all([
        api.getTargetAdjustmentLogs(token, {
          period:
            periodFilter !== "all" ? (periodFilter as TargetPeriod) : undefined,
          role: roleFilter !== "all" ? (roleFilter as Role) : undefined,
          year: yearFilter !== "all" ? BigInt(yearFilter) : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        api.listAllUsers(token),
      ]);
      setLogs(logData);
      setUsers(userData);
    } catch {
      toast.error("Failed to load adjustment history");
    } finally {
      setLoading(false);
    }
  }, [token, periodFilter, roleFilter, yearFilter, startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const userMap = new Map(users.map((u) => [u.id, u]));

  const filtered = logs.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const emp = userMap.get(log.userId);
    const changer = userMap.get(log.changedBy);
    return (
      (emp?.name.toLowerCase().includes(q) ?? false) ||
      (emp?.employeeId.toLowerCase().includes(q) ?? false) ||
      (changer?.name.toLowerCase().includes(q) ?? false) ||
      log.role.toLowerCase().includes(q)
    );
  });

  function exportExcel() {
    setExporting(true);
    try {
      const rows = filtered.map((log) => {
        const emp = userMap.get(log.userId);
        const changer = userMap.get(log.changedBy);
        return {
          "Employee Name": emp?.name ?? `User #${String(log.userId)}`,
          "Employee ID": emp?.employeeId ?? "",
          Role: log.role,
          Period: PERIOD_LABELS[log.period],
          Year: String(log.year),
          "Previous Target (₹)": log.previousValue,
          "New Target (₹)": log.newValue,
          "Change Amount (₹)": log.newValue - log.previousValue,
          Reason: log.reason ?? "",
          "Changed By": changer?.name ?? `User #${String(log.changedBy)}`,
          "Date & Time": fmtDate(log.changedAt),
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Target History");
      XLSX.writeFile(
        wb,
        `TargetAdjustmentHistory_${new Date().getFullYear()}.xlsx`,
      );
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
        title="Target Adjustment History"
        subtitle="Read-only audit log of all target changes"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={exportExcel}
            disabled={exporting || filtered.length === 0}
            data-ocid="btn-export-history"
          >
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? "Exporting…" : "Export Excel"}
          </Button>
        }
      />
      <PageContent>
        {/* Filters */}
        <SectionCard title="Filters">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Employee name, ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  data-ocid="filter-search-history"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger data-ocid="filter-role-history">
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
                <SelectTrigger data-ocid="filter-period-history">
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
                <SelectTrigger data-ocid="filter-year-history">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-ocid="filter-start-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-ocid="filter-end-date"
              />
            </div>
          </div>
        </SectionCard>

        {/* Results table */}
        <SectionCard
          title={`Change Log (${filtered.length} entries)`}
          headerActions={
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <History className="w-3.5 h-3.5" />
              Read-only · No edits allowed
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body min-w-[900px]">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  {[
                    "Employee",
                    "Role",
                    "Period",
                    "Year",
                    "Previous Target",
                    "New Target",
                    "Change",
                    "Reason",
                    "Changed By",
                    "Date & Time",
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
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-3 py-2.5">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-12 text-center text-muted-foreground text-sm"
                    >
                      No adjustment history found for selected filters
                    </td>
                  </tr>
                ) : (
                  filtered.map((log) => {
                    const emp = userMap.get(log.userId);
                    const changer = userMap.get(log.changedBy);
                    const delta = log.newValue - log.previousValue;
                    return (
                      <tr
                        key={String(log.id)}
                        className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                        data-ocid={`history-row-${log.id}`}
                      >
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-foreground text-sm whitespace-nowrap">
                            {emp?.name ?? `User #${String(log.userId)}`}
                          </p>
                          {emp?.employeeId && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {emp.employeeId}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge className="text-xs bg-primary/10 text-primary border-primary/30">
                            {log.role}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                          {PERIOD_LABELS[log.period]}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-sm">
                          {String(log.year)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-sm text-right">
                          ₹{log.previousValue.toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-sm text-right font-semibold text-foreground">
                          ₹{log.newValue.toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-sm text-right">
                          <span
                            className={
                              delta >= 0 ? "text-accent" : "text-destructive"
                            }
                          >
                            {delta >= 0 ? "+" : ""}
                            {delta.toLocaleString("en-IN")}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate">
                          {log.reason || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                          {changer?.name ?? `User #${String(log.changedBy)}`}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap font-mono">
                          {fmtDate(log.changedAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </PageContent>
    </PortalLayout>
  );
}
