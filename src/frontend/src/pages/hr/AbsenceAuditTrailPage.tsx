import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  FileText,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Role } from "../../backend";
import type { AbsenceInactivationLogView } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import {
  buildBrandingExcelRows,
  buildBrandingHtml,
} from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";

const ROLES = ["all", "MR", "ASM", "RSM", "ZSM", "HRManager", "Admin"] as const;
const PAGE_SIZE = 25;

function fmtTs(ts: bigint): string {
  if (!ts) return "—";
  const ms = Number(ts) / 1_000_000;
  return new Date(ms).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AbsenceAuditTrailPage({
  portalRole,
}: {
  portalRole?: Role;
}) {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const role =
    portalRole ?? (session?.role === "Admin" ? Role.Admin : Role.HRManager);

  const [logs, setLogs] = useState<AbsenceInactivationLogView[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    try {
      const a = await import("../../backend");
      const { createActorWithConfig } = await import(
        "@caffeineai/core-infrastructure"
      );
      const actor = await createActorWithConfig(a.createActor);
      const data = await actor.getAbsenceInactivationLog(session.token);
      setLogs(data);
    } catch {
      // fail silently — informational report
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = logs;
    if (roleFilter !== "all") list = list.filter((l) => l.role === roleFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.employeeName.toLowerCase().includes(q) ||
          l.employeeCode.toLowerCase().includes(q),
      );
    }
    if (fromDate) {
      const from = new Date(fromDate).getTime() * 1_000_000;
      list = list.filter((l) => Number(l.inactivatedAt) >= from);
    }
    if (toDate) {
      const to = new Date(`${toDate}T23:59:59`).getTime() * 1_000_000;
      list = list.filter((l) => Number(l.inactivatedAt) <= to);
    }
    // newest first
    return [...list].sort(
      (a, b) => Number(b.inactivatedAt) - Number(a.inactivatedAt),
    );
  }, [logs, roleFilter, search, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSlice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filters change (deps match filtered derivation)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset on filter changes
  useEffect(() => {
    setPage(1);
  }, [filtered]);

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const brandingRows = buildBrandingExcelRows(companyProfile ?? null);
    const titleRow = {
      "Employee Name": `Absence Inactivation Audit Trail — Generated ${new Date().toLocaleDateString("en-IN")}`,
    };
    const headerRow = {
      "Employee Name": "Employee Name",
      "Employee Code": "Employee Code",
      Role: "Role",
      HQ: "HQ",
      "Inactivated At": "Inactivated At",
      "Absent Dates": "Absent Dates",
      Source: "Source",
      Status: "Status",
      "Reactivated By": "Reactivated By",
      "Reactivated At": "Reactivated At",
    };
    const dataRows = filtered.map((l) => ({
      "Employee Name": l.employeeName,
      "Employee Code": l.employeeCode,
      Role: l.role,
      HQ: l.hq,
      "Inactivated At": fmtTs(l.inactivatedAt),
      "Absent Dates": l.absentDates.join(", "),
      Source: l.source,
      Status: l.isReactivated ? "Reactivated" : "Inactivated",
      "Reactivated By": l.reactivatedBy ?? "—",
      "Reactivated At": l.reactivatedAt ? fmtTs(l.reactivatedAt) : "—",
    }));
    const footerRow = {
      "Employee Name": "Krishkar Pharmaceuticals : Empowering Health",
    };
    const ws = XLSX.utils.json_to_sheet([
      ...brandingRows,
      titleRow,
      headerRow,
      ...dataRows,
      footerRow,
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Audit Trail");
    XLSX.writeFile(
      wb,
      `AbsenceAuditTrail_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  function exportPdf() {
    const filterParts: string[] = [];
    if (roleFilter !== "all") filterParts.push(`Role: ${roleFilter}`);
    if (fromDate) filterParts.push(`From: ${fromDate}`);
    if (toDate) filterParts.push(`To: ${toDate}`);
    if (search) filterParts.push(`Search: "${search}"`);
    const filterSummary =
      filterParts.length > 0 ? filterParts.join(" | ") : "All records";

    const rows = filtered
      .map(
        (l) => `
      <tr>
        <td>${l.employeeName}</td>
        <td>${l.employeeCode}</td>
        <td>${l.role}</td>
        <td>${l.hq}</td>
        <td>${fmtTs(l.inactivatedAt)}</td>
        <td>${l.absentDates.join(", ")}</td>
        <td>${l.isReactivated ? `<span style="color:#16a34a;font-weight:bold">Reactivated</span>` : `<span style="color:#dc2626;font-weight:bold">Inactivated</span>`}</td>
        <td>${l.reactivatedBy ?? "—"}</td>
      </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    ${buildBrandingHtml(companyProfile ?? null)}
    <style>
      @page { size: A4; margin: 1cm 1.5cm 2cm 1.5cm; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding-bottom: 80px; }
      h2 { font-size: 16px; color: #00838f; margin: 8px 0 2px; }
      p.subtitle { font-size: 10px; color: #666; font-style: italic; margin: 0 0 10px; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
      th { background: #e0f7fa; color: #00838f; border: 1px solid #b2ebf2; padding: 5px 6px; text-align: left; }
      td { border: 1px solid #ddd; padding: 4px 6px; vertical-align: top; }
      tr:nth-child(even) td { background: #f9fafb; }
    </style>
    </head><body>
    <h2>Absence Inactivation Audit Trail</h2>
    <p class="subtitle">Filtered by: ${filterSummary}</p>
    <table>
      <thead><tr>
        <th>Employee Name</th><th>Code</th><th>Role</th><th>HQ</th>
        <th>Inactivated At</th><th>Absent Dates</th><th>Status</th><th>Reactivated By</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </body></html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 500);
  }

  return (
    <PortalLayout portalRole={role}>
      <PageHeader
        title="Absence Inactivation Audit Trail"
        subtitle="All auto-inactivation and reactivation events"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportExcel}
              data-ocid="absence-audit.export_excel_button"
            >
              <Download className="w-4 h-4 mr-1.5" /> Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportPdf}
              data-ocid="absence-audit.export_pdf_button"
            >
              <FileText className="w-4 h-4 mr-1.5" /> PDF
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder="Search by name or employee code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-ocid="absence-audit.search_input"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger
              className="h-9 w-[140px]"
              data-ocid="absence-audit.role_filter"
            >
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r === "all" ? "All Roles" : r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-col gap-0.5">
            <label
              htmlFor="audit-from"
              className="text-xs text-muted-foreground"
            >
              From
            </label>
            <input
              id="audit-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              data-ocid="absence-audit.from_date_input"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label htmlFor="audit-to" className="text-xs text-muted-foreground">
              To
            </label>
            <input
              id="audit-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              data-ocid="absence-audit.to_date_input"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={load}
            disabled={loading}
            data-ocid="absence-audit.refresh_button"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            Refresh
          </Button>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-4 mb-3 text-sm">
          <span className="text-muted-foreground font-body">
            Showing{" "}
            <strong className="text-foreground">{filtered.length}</strong> event
            {filtered.length !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground">
            Inactivated:{" "}
            <strong className="text-red-600">
              {filtered.filter((l) => !l.isReactivated).length}
            </strong>
          </span>
          <span className="text-muted-foreground">
            Reactivated:{" "}
            <strong className="text-emerald-600">
              {filtered.filter((l) => l.isReactivated).length}
            </strong>
          </span>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm font-body flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading audit
              trail…
            </div>
          ) : pageSlice.length === 0 ? (
            <div
              className="py-16 text-center"
              data-ocid="absence-audit.empty_state"
            >
              <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm font-body">
                No inactivation events found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table
                className="w-full text-sm font-body"
                data-ocid="absence-audit.table"
              >
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {[
                      "Employee Name",
                      "Code",
                      "Role",
                      "HQ",
                      "Inactivated At",
                      "Absent Dates",
                      "Source",
                      "Status",
                      "Reactivated By",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageSlice.map((log, idx) => (
                    <tr
                      key={log.id}
                      className="hover:bg-muted/20 transition-colors"
                      data-ocid={`absence-audit.item.${(page - 1) * PAGE_SIZE + idx + 1}`}
                    >
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                        {log.employeeName}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {log.employeeCode}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">
                          {log.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {log.hq || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtTs(log.inactivatedAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground max-w-[200px]">
                        {log.absentDates.join(", ")}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <span className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded text-xs">
                          Auto
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.isReactivated ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                            Reactivated
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded">
                            Inactivated
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {log.isReactivated ? (
                          <div>
                            <p className="font-medium text-foreground">
                              {log.reactivatedBy ?? "—"}
                            </p>
                            <p className="text-muted-foreground">
                              {log.reactivatedAt
                                ? fmtTs(log.reactivatedAt)
                                : ""}
                            </p>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-muted-foreground font-body">
              Page {page} of {totalPages} ({filtered.length} total)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                data-ocid="absence-audit.pagination_prev"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                data-ocid="absence-audit.pagination_next"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
