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
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart2,
  Download,
  FileSpreadsheet,
  FileText,
  MapPin,
  Printer,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Role } from "../../backend";
import type { CompanyProfile } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import {
  buildBrandingExcelRows,
  buildPdfPrintCss,
} from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";
import type { CallReportInfo, TravelPlanInfo, UserInfo } from "../../types";

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS = [
  { label: "January", value: "1" },
  { label: "February", value: "2" },
  { label: "March", value: "3" },
  { label: "April", value: "4" },
  { label: "May", value: "5" },
  { label: "June", value: "6" },
  { label: "July", value: "7" },
  { label: "August", value: "8" },
  { label: "September", value: "9" },
  { label: "October", value: "10" },
  { label: "November", value: "11" },
  { label: "December", value: "12" },
];

const YEARS = Array.from({ length: 5 }, (_, i) =>
  String(new Date().getFullYear() - i),
);

const ROLE_LABELS: Record<string, string> = {
  MR: "Medical Representative",
  ASM: "Area Sales Manager",
  RSM: "Regional Sales Manager",
  ZSM: "Zonal Sales Manager",
  HRManager: "HR Manager",
  Admin: "Administrator",
};

const MANAGER_ROLES: Role[] = [Role.ASM, Role.RSM, Role.ZSM];
const ADMIN_HR_ROLES: Role[] = [Role.Admin, Role.HRManager];

function isAdminOrHR(role: Role | null) {
  return role ? ADMIN_HR_ROLES.includes(role) : false;
}
function isManager(role: Role | null) {
  return role ? MANAGER_ROLES.includes(role) : false;
}

// ─── PDF print helper ─────────────────────────────────────────────────────────

/**
 * Triggers window.print() with branded A4 layout.
 * tableHtml: an HTML string containing the <table> and summary elements.
 * Cleans up the injected DOM after the print dialog closes.
 */
async function printReportPdf(opts: {
  reportTitle: string;
  filterSummary: string;
  tableHtml: string;
  filenameParts: string[];
  companyProfile: CompanyProfile | null;
  generatedBy?: string;
  generatedByRole?: string;
  period?: string;
  employeeInfo?: string;
}) {
  const {
    reportTitle,
    filterSummary,
    tableHtml,
    filenameParts,
    companyProfile,
    generatedBy,
    generatedByRole,
    period,
    employeeInfo,
  } = opts;

  // Remove any stale print CSS
  document.getElementById("pdf-report-print-css")?.remove();

  // Inject branded print CSS
  const cssHtml = buildPdfPrintCss(reportTitle, filterSummary, companyProfile, {
    generatedBy,
    generatedByRole,
    period,
    employeeInfo,
    docType: "report",
  });
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = cssHtml;
  const styleEl = tempDiv.querySelector("#pdf-report-print-css");
  if (styleEl) document.head.appendChild(styleEl.cloneNode(true));

  // Build print root
  let printRoot = document.getElementById("pdf-report-print-root");
  if (!printRoot) {
    printRoot = document.createElement("div");
    printRoot.id = "pdf-report-print-root";
    printRoot.style.display = "none";
    document.body.appendChild(printRoot);
  }

  const logoUrl = companyProfile?.logoUrl ?? "";

  printRoot.innerHTML = `
    <div class="pdf-page-break">
      ${logoUrl ? `<img class="pdf-watermark" src="${logoUrl}" alt="" aria-hidden="true" />` : ""}
      <div class="pdf-body">
        ${filterSummary ? `<p class="pdf-filter-summary">${filterSummary}</p>` : ""}
        ${tableHtml}
      </div>
    </div>`;
  printRoot.style.display = "block";

  const safeParts = filenameParts.map((p) => p.replace(/\s+/g, "")).join("_");
  const prevTitle = document.title;
  document.title = safeParts;

  return new Promise<void>((resolve) => {
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = prevTitle;
        if (printRoot) {
          printRoot.style.display = "none";
          printRoot.innerHTML = "";
        }
        document.getElementById("pdf-report-print-css")?.remove();
        resolve();
      }, 500);
    }, 150);
  });
}

// ─── Excel export helper ─────────────────────────────────────────────────────

function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  companyProfile?: CompanyProfile | null,
) {
  if (data.length === 0) {
    toast.warning("No data to export for the selected filters.");
    return;
  }
  const headerRows = buildBrandingExcelRows(companyProfile ?? null);
  const allRows = [...headerRows, ...data] as Record<string, unknown>[];
  const ws = XLSX.utils.json_to_sheet(allRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(
    wb,
    `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
  toast.success(`Exported ${data.length} rows to ${filename}.xlsx`);
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <div>
          <h3 className="text-sm font-display font-semibold text-foreground">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground font-body">
            {description}
          </p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function FilterRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function UserSelect({
  users,
  value,
  onValueChange,
  placeholder = "All Users",
}: {
  users: UserInfo[];
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className="h-9 text-xs w-[180px]"
        data-ocid="export-user-select"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {users.map((u) => (
          <SelectItem key={String(u.id)} value={String(u.id)}>
            {u.name} ({u.employeeId})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Section: Daily Call Reports ──────────────────────────────────────────────

function DailyCallReportSection({
  users,
  canSelectUser,
  companyProfile,
}: {
  users: UserInfo[];
  canSelectUser: boolean;
  companyProfile: CompanyProfile | null;
}) {
  const { session } = useAuthStore();
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedUser, setSelectedUser] = useState("all");
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const fetchData = useCallback(async (): Promise<CallReportInfo[]> => {
    if (!session) return [];
    let reports: CallReportInfo[];
    if (canSelectUser && selectedUser !== "all") {
      const userId = BigInt(selectedUser);
      const monthStr = startDate.slice(0, 7);
      reports = await api.listMyCallReportsByMonth(userId, monthStr);
    } else if (!canSelectUser) {
      const monthStr = startDate.slice(0, 7);
      reports = await api.listMyCallReportsByMonth(session.userId, monthStr);
    } else {
      reports = await api.listSubmittedReports();
    }
    return (reports ?? []).filter(
      (r) => r.date >= startDate && r.date <= endDate,
    );
  }, [session, startDate, endDate, selectedUser, canSelectUser]);

  const handleExport = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const filtered = await fetchData();
      const rows = filtered.map((r) => ({
        "Report ID": String(r.id),
        "Employee UID": String(r.mrId),
        Date: r.date,
        Status: r.status,
        "Work Type": r.workType,
        "Working Station": r.workingStation ?? "",
        "Station Type": r.stationType,
        "DA Amount (₹)": String(r.daAmount),
        "Doctors Visited": r.doctorsVisited.length,
        "Samples Distributed": r.samplesDistributed.length,
        Remarks: r.remarks,
      }));
      exportToExcel(rows, "daily-call-reports", companyProfile);
    } catch {
      toast.error("Failed to export Daily Call Reports");
    } finally {
      setLoading(false);
    }
  }, [fetchData, companyProfile, session]);

  const handleExportPdf = useCallback(async () => {
    if (!session) return;
    setPdfLoading(true);
    try {
      const filtered = await fetchData();
      if (filtered.length === 0) {
        toast.warning("No data to export.");
        return;
      }
      const userName =
        canSelectUser && selectedUser !== "all"
          ? (users.find((u) => String(u.id) === selectedUser)?.name ??
            selectedUser)
          : "All Users";
      const filterSummary = `User: ${userName} | Date: ${startDate} to ${endDate}`;
      const tableHtml = `
        <table class="pdf-table">
          <thead><tr><th>Date</th><th>Status</th><th>Station Type</th><th>Doctors Visited</th><th>DA (₹)</th><th>Remarks</th></tr></thead>
          <tbody>${filtered.map((r) => `<tr><td>${r.date}</td><td>${r.status}</td><td>${r.stationType}</td><td>${r.doctorsVisited.length}</td><td>${r.daAmount}</td><td>${r.remarks || ""}</td></tr>`).join("")}</tbody>
        </table>`;
      await printReportPdf({
        reportTitle: "Daily Call Report",
        filterSummary,
        tableHtml,
        filenameParts: ["DailyCallReport", userName, `${startDate}_${endDate}`],
        companyProfile,
      });
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setPdfLoading(false);
    }
  }, [
    session,
    fetchData,
    canSelectUser,
    selectedUser,
    users,
    startDate,
    endDate,
    companyProfile,
  ]);

  return (
    <SectionCard
      icon={FileText}
      title="Daily Call Reports"
      description="Export daily call activity reports with station type, DA, and doctor visit counts"
    >
      <FilterRow>
        <FilterField label="Start Date">
          <Input
            type="date"
            className="h-9 text-xs"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            data-ocid="export-dcr-start"
          />
        </FilterField>
        <FilterField label="End Date">
          <Input
            type="date"
            className="h-9 text-xs"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            data-ocid="export-dcr-end"
          />
        </FilterField>
        {canSelectUser && (
          <FilterField label="User">
            <UserSelect
              users={users}
              value={selectedUser}
              onValueChange={setSelectedUser}
            />
          </FilterField>
        )}
        <Button
          size="sm"
          className="h-9 gap-1.5 mt-auto"
          onClick={handleExport}
          disabled={loading}
          data-ocid="export-dcr-btn"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Excel
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 mt-auto"
          onClick={handleExportPdf}
          disabled={pdfLoading}
          data-ocid="export-dcr-pdf-btn"
        >
          {pdfLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Printer className="w-4 h-4" />
          )}
          {pdfLoading ? "Generating PDF…" : "Export PDF"}
        </Button>
      </FilterRow>
    </SectionCard>
  );
}

// ─── Section: TP Report ───────────────────────────────────────────────────────

function TravelPlanSection({
  users,
  canSelectUser,
  companyProfile,
}: {
  users: UserInfo[];
  canSelectUser: boolean;
  companyProfile: CompanyProfile | null;
}) {
  const { session } = useAuthStore();
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [selectedUser, setSelectedUser] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const fetchData = useCallback(async (): Promise<TravelPlanInfo[]> => {
    if (!session) return [];
    const monthStr = `${year}-${month.padStart(2, "0")}`;
    let plans: TravelPlanInfo[];
    if (canSelectUser) {
      const userId = selectedUser !== "all" ? BigInt(selectedUser) : null;
      plans = await api.listAllTravelPlans(session.token, userId, monthStr);
    } else {
      plans = await api.listMyTravelPlans(session.token, monthStr);
    }
    return canSelectUser && roleFilter !== "all"
      ? (plans ?? []).filter((p) => {
          const u = users.find((u) => String(u.id) === String(p.userId));
          return u?.role === roleFilter;
        })
      : (plans ?? []);
  }, [session, month, year, selectedUser, roleFilter, canSelectUser, users]);

  const handleExport = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const filtered = await fetchData();
      const rows = filtered.map((p) => ({
        "Plan ID": String(p.id),
        "Employee UID": String(p.userId),
        Date: p.date,
        "Planned Station": p.plannedStation,
        Notes: p.notes ?? "",
        Status: p.status,
        "Updated At": p.updatedAt
          ? new Date(Number(p.updatedAt) / 1_000_000).toLocaleDateString(
              "en-IN",
            )
          : "",
      }));
      exportToExcel(rows, "travel-plans", companyProfile);
    } catch {
      toast.error("Failed to export Travel Plans");
    } finally {
      setLoading(false);
    }
  }, [fetchData, companyProfile, session]);

  const handleExportPdf = useCallback(async () => {
    if (!session) return;
    setPdfLoading(true);
    try {
      const filtered = await fetchData();
      if (filtered.length === 0) {
        toast.warning("No data to export.");
        return;
      }
      const userName =
        canSelectUser && selectedUser !== "all"
          ? (users.find((u) => String(u.id) === selectedUser)?.name ??
            selectedUser)
          : "All Users";
      const monthStr = `${year}-${month.padStart(2, "0")}`;
      const filterSummary = `User: ${userName} | Month: ${monthStr}${roleFilter !== "all" ? ` | Role: ${roleFilter}` : ""}`;
      const tableHtml = `
        <table class="pdf-table">
          <thead><tr><th>Date</th><th>Planned Station</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>${filtered.map((p) => `<tr><td>${p.date}</td><td>${p.plannedStation}</td><td>${p.status}</td><td>${p.notes || ""}</td></tr>`).join("")}</tbody>
        </table>`;
      await printReportPdf({
        reportTitle: "Tour Plan Report",
        filterSummary,
        tableHtml,
        filenameParts: ["TourPlanReport", userName, monthStr],
        companyProfile,
      });
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setPdfLoading(false);
    }
  }, [
    session,
    fetchData,
    canSelectUser,
    selectedUser,
    users,
    month,
    year,
    roleFilter,
    companyProfile,
  ]);

  return (
    <SectionCard
      icon={MapPin}
      title="TP Report"
      description="Export travel plans by month with station, notes, and submission status"
    >
      <FilterRow>
        <FilterField label="Month">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger
              className="h-9 text-xs w-[130px]"
              data-ocid="export-tp-month"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Year">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger
              className="h-9 text-xs w-[90px]"
              data-ocid="export-tp-year"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        {canSelectUser && (
          <>
            <FilterField label="Role">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger
                  className="h-9 text-xs w-[150px]"
                  data-ocid="export-tp-role"
                >
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="User">
              <UserSelect
                users={users}
                value={selectedUser}
                onValueChange={setSelectedUser}
              />
            </FilterField>
          </>
        )}
        <Button
          size="sm"
          className="h-9 gap-1.5 mt-auto"
          onClick={handleExport}
          disabled={loading}
          data-ocid="export-tp-btn"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Excel
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 mt-auto"
          onClick={handleExportPdf}
          disabled={pdfLoading}
          data-ocid="export-tp-pdf-btn"
        >
          {pdfLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Printer className="w-4 h-4" />
          )}
          {pdfLoading ? "Generating PDF…" : "Export PDF"}
        </Button>
      </FilterRow>
    </SectionCard>
  );
}

// ─── Section: DA Report ───────────────────────────────────────────────────────

function DaReportSection({
  users,
  canSelectUser,
  companyProfile,
}: {
  users: UserInfo[];
  canSelectUser: boolean;
  companyProfile: CompanyProfile | null;
}) {
  const { session } = useAuthStore();
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [selectedUser, setSelectedUser] = useState("all");
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  type DaRow = {
    "Employee Name": string;
    "Employee UID": string;
    Date: string;
    "Station Type": string;
    "Doctors Visited": string;
    "DA Amount (₹)": string;
    Role?: string;
  };

  const fetchData = useCallback(async (): Promise<DaRow[]> => {
    if (!session) return [];
    const allRows: DaRow[] = [];
    if (canSelectUser && selectedUser !== "all") {
      const rows_data = await api.getEmployeeDaHistory(
        session.token,
        BigInt(selectedUser),
        BigInt(month),
        BigInt(year),
      );
      const user = users.find((u) => String(u.id) === selectedUser);
      return rows_data.map((r) => ({
        "Employee Name": user?.name ?? "",
        "Employee UID": user?.employeeId ?? selectedUser,
        Date: r.date,
        "Station Type": r.stationType,
        "Doctors Visited": String(r.doctorCount),
        "DA Amount (₹)": String(r.daAmount),
      }));
    }
    if (canSelectUser) {
      await Promise.all(
        users.slice(0, 50).map(async (u) => {
          try {
            const history = await api.getEmployeeDaHistory(
              session.token,
              u.id,
              BigInt(month),
              BigInt(year),
            );
            for (const r of history)
              allRows.push({
                "Employee Name": u.name,
                "Employee UID": u.employeeId,
                Role: u.role,
                Date: r.date,
                "Station Type": r.stationType,
                "Doctors Visited": String(r.doctorCount),
                "DA Amount (₹)": String(r.daAmount),
              });
          } catch {
            /* skip */
          }
        }),
      );
      return allRows;
    }
    const rows_data = await api.getMyDaHistory(
      session.token,
      BigInt(month),
      BigInt(year),
    );
    return rows_data.map((r) => ({
      "Employee Name": "",
      "Employee UID": "",
      Date: r.date,
      "Station Type": r.stationType,
      "Doctors Visited": String(r.doctorCount),
      "DA Amount (₹)": String(r.daAmount),
    }));
  }, [session, month, year, selectedUser, canSelectUser, users]);

  const handleExport = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const rows = await fetchData();
      exportToExcel(
        rows,
        canSelectUser && selectedUser === "all" ? "da-report-all" : "da-report",
        companyProfile,
      );
    } catch {
      toast.error("Failed to export DA Report");
    } finally {
      setLoading(false);
    }
  }, [fetchData, canSelectUser, selectedUser, companyProfile, session]);

  const handleExportPdf = useCallback(async () => {
    if (!session) return;
    setPdfLoading(true);
    try {
      const rows = await fetchData();
      if (rows.length === 0) {
        toast.warning("No data to export.");
        return;
      }
      const userName =
        canSelectUser && selectedUser !== "all"
          ? (users.find((u) => String(u.id) === selectedUser)?.name ??
            selectedUser)
          : "All Users";
      const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? month;
      const filterSummary = `User: ${userName} | Month: ${monthLabel} ${year}`;
      const showRole = canSelectUser && selectedUser === "all";
      const tableHtml = `
        <table class="pdf-table">
          <thead><tr>${showRole ? "<th>Employee</th><th>Role</th>" : ""}<th>Date</th><th>Station Type</th><th>Doctors Visited</th><th>DA Amount (₹)</th></tr></thead>
          <tbody>${rows.map((r) => `<tr>${showRole ? `<td>${r["Employee Name"]}</td><td>${r.Role ?? ""}</td>` : ""}<td>${r.Date}</td><td>${r["Station Type"]}</td><td>${r["Doctors Visited"]}</td><td>${r["DA Amount (₹)"]}</td></tr>`).join("")}</tbody>
        </table>`;
      await printReportPdf({
        reportTitle: "DA Report",
        filterSummary,
        tableHtml,
        filenameParts: ["DAReport", userName, `${monthLabel}${year}`],
        companyProfile,
      });
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setPdfLoading(false);
    }
  }, [
    session,
    fetchData,
    canSelectUser,
    selectedUser,
    users,
    month,
    year,
    companyProfile,
  ]);

  return (
    <SectionCard
      icon={Wallet}
      title="DA Report"
      description="Export Daily Allowance records by user and month"
    >
      <FilterRow>
        <FilterField label="Month">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger
              className="h-9 text-xs w-[130px]"
              data-ocid="export-da-month"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Year">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger
              className="h-9 text-xs w-[90px]"
              data-ocid="export-da-year"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        {canSelectUser && (
          <FilterField label="User">
            <UserSelect
              users={users}
              value={selectedUser}
              onValueChange={setSelectedUser}
            />
          </FilterField>
        )}
        <Button
          size="sm"
          className="h-9 gap-1.5 mt-auto"
          onClick={handleExport}
          disabled={loading}
          data-ocid="export-da-btn"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Excel
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 mt-auto"
          onClick={handleExportPdf}
          disabled={pdfLoading}
          data-ocid="export-da-pdf-btn"
        >
          {pdfLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Printer className="w-4 h-4" />
          )}
          {pdfLoading ? "Generating PDF…" : "Export PDF"}
        </Button>
      </FilterRow>
    </SectionCard>
  );
}

// ─── Section: Doctor Visits ────────────────────────────────────────────────────

function DoctorVisitsSection({
  users,
  canSelectUser,
  companyProfile,
}: {
  users: UserInfo[];
  canSelectUser: boolean;
  companyProfile: CompanyProfile | null;
}) {
  const { session } = useAuthStore();
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedUser, setSelectedUser] = useState("all");
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session) return [];
    let reports: CallReportInfo[];
    if (!canSelectUser) {
      const monthStr = startDate.slice(0, 7);
      reports = await api.listMyCallReportsByMonth(session.userId, monthStr);
    } else if (selectedUser !== "all") {
      const monthStr = startDate.slice(0, 7);
      reports = await api.listMyCallReportsByMonth(
        BigInt(selectedUser),
        monthStr,
      );
    } else {
      reports = await api.listSubmittedReports();
    }
    return (reports ?? []).filter(
      (r) => r.date >= startDate && r.date <= endDate,
    );
  }, [session, startDate, endDate, selectedUser, canSelectUser]);

  const handleExport = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const filtered = await fetchData();
      const rows: Record<string, unknown>[] = [];
      for (const r of filtered) {
        if (r.doctorsVisited.length === 0) {
          rows.push({
            "Report ID": String(r.id),
            "Employee UID": String(r.mrId),
            Date: r.date,
            "Doctor ID": "(No visits recorded)",
            "Product IDs": "",
            "Gift Articles": "",
            Notes: "",
          });
        } else {
          for (const v of r.doctorsVisited) {
            rows.push({
              "Report ID": String(r.id),
              "Employee UID": String(r.mrId),
              Date: r.date,
              "Doctor ID": String(v.doctorId),
              "Product IDs": v.productIds.map((id) => String(id)).join(", "),
              "Gift Articles": v.giftArticles
                .map((g) => `${g.giftArticleName} x${String(g.quantity)}`)
                .join(", "),
              Notes: v.notes,
            });
          }
        }
      }
      exportToExcel(rows, "doctor-visits", companyProfile);
    } catch {
      toast.error("Failed to export Doctor Visits");
    } finally {
      setLoading(false);
    }
  }, [fetchData, companyProfile, session]);

  const handleExportPdf = useCallback(async () => {
    if (!session) return;
    setPdfLoading(true);
    try {
      const filtered = await fetchData();
      if (filtered.length === 0) {
        toast.warning("No data to export.");
        return;
      }
      const userName =
        canSelectUser && selectedUser !== "all"
          ? (users.find((u) => String(u.id) === selectedUser)?.name ??
            selectedUser)
          : "All Users";
      const filterSummary = `User: ${userName} | Date: ${startDate} to ${endDate}`;
      const rows: Array<{
        date: string;
        doctorId: string;
        products: string;
        gifts: string;
        notes: string;
      }> = [];
      for (const r of filtered) {
        for (const v of r.doctorsVisited) {
          rows.push({
            date: r.date,
            doctorId: String(v.doctorId),
            products: v.productIds.map(String).join(", "),
            gifts: v.giftArticles
              .map((g) => `${g.giftArticleName} x${g.quantity}`)
              .join(", "),
            notes: v.notes,
          });
        }
      }
      const tableHtml = `
        <table class="pdf-table">
          <thead><tr><th>Date</th><th>Doctor ID</th><th>Products</th><th>Gifts</th><th>Notes</th></tr></thead>
          <tbody>${rows.map((r) => `<tr><td>${r.date}</td><td>${r.doctorId}</td><td>${r.products || "—"}</td><td>${r.gifts || "—"}</td><td>${r.notes || ""}</td></tr>`).join("")}</tbody>
        </table>`;
      await printReportPdf({
        reportTitle: "Doctor Visit Report",
        filterSummary,
        tableHtml,
        filenameParts: [
          "DoctorVisitReport",
          userName,
          `${startDate}_${endDate}`,
        ],
        companyProfile,
      });
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setPdfLoading(false);
    }
  }, [
    session,
    fetchData,
    canSelectUser,
    selectedUser,
    users,
    startDate,
    endDate,
    companyProfile,
  ]);

  return (
    <SectionCard
      icon={Users}
      title="Doctor Visit Report"
      description="Export doctor visits with samples, gifts, and products discussed"
    >
      <FilterRow>
        <FilterField label="Start Date">
          <Input
            type="date"
            className="h-9 text-xs"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            data-ocid="export-dv-start"
          />
        </FilterField>
        <FilterField label="End Date">
          <Input
            type="date"
            className="h-9 text-xs"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            data-ocid="export-dv-end"
          />
        </FilterField>
        {canSelectUser && (
          <FilterField label="User">
            <UserSelect
              users={users}
              value={selectedUser}
              onValueChange={setSelectedUser}
            />
          </FilterField>
        )}
        <Button
          size="sm"
          className="h-9 gap-1.5 mt-auto"
          onClick={handleExport}
          disabled={loading}
          data-ocid="export-dv-btn"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Excel
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 mt-auto"
          onClick={handleExportPdf}
          disabled={pdfLoading}
          data-ocid="export-dv-pdf-btn"
        >
          {pdfLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Printer className="w-4 h-4" />
          )}
          {pdfLoading ? "Generating PDF…" : "Export PDF"}
        </Button>
      </FilterRow>
    </SectionCard>
  );
}

// ─── Section: CRM & Sales ─────────────────────────────────────────────────────

function CrmSalesSection({
  users,
  canSelectUser,
  companyProfile,
}: {
  users: UserInfo[];
  canSelectUser: boolean;
  companyProfile: CompanyProfile | null;
}) {
  const { session } = useAuthStore();
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [selectedUser, setSelectedUser] = useState("all");
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session) return { crmRows: [], salesRows: [] };
    const userId =
      canSelectUser && selectedUser !== "all" ? BigInt(selectedUser) : null;
    const [crmReqs, bizReports] = await Promise.all([
      canSelectUser
        ? api.listAllCrmRequests(session.token, null)
        : api.listMyCrmRequests(session.token),
      canSelectUser
        ? api.listAllBusinessReports(
            session.token,
            userId,
            BigInt(month),
            BigInt(year),
          )
        : api.listMyBusinessReports(session.token, BigInt(month), BigInt(year)),
    ]);
    const filteredCrm =
      canSelectUser && selectedUser !== "all"
        ? crmReqs.filter((r) => String(r.userId) === selectedUser)
        : crmReqs;
    const crmRows = filteredCrm.map((r) => ({
      Type: "CRM Request",
      "Employee UID": String(r.userId),
      "Doctor Name": r.doctorName,
      "CRM Amount (₹)": r.crmAmount.toFixed(2),
      Status: r.status,
      "Products Committed": r.productCommitments.length,
      Notes: r.requestNotes ?? "",
      "Submitted Date": new Date(
        Number(r.createdAt) / 1_000_000,
      ).toLocaleDateString("en-IN"),
      "Decision Date": r.approvedAt
        ? new Date(Number(r.approvedAt) / 1_000_000).toLocaleDateString("en-IN")
        : "",
    }));
    const salesRows = bizReports.map((r) => ({
      Type: "Business Report",
      "Employee UID": String(r.userId),
      "Doctor Name": r.doctorName,
      Month: MONTHS[Number(r.month) - 1]?.label ?? String(r.month),
      Year: String(r.year),
      "Actual Sales (₹)": r.actualSales.toFixed(2),
      "Prescription Count": String(r.prescriptionCount),
    }));
    return { crmRows, salesRows };
  }, [session, month, year, selectedUser, canSelectUser]);

  const handleExport = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { crmRows, salesRows } = await fetchData();
      exportToExcel(
        [...crmRows, ...salesRows],
        "crm-sales-report",
        companyProfile,
      );
    } catch {
      toast.error("Failed to export CRM & Sales Report");
    } finally {
      setLoading(false);
    }
  }, [fetchData, companyProfile, session]);

  const handleExportPdf = useCallback(async () => {
    if (!session) return;
    setPdfLoading(true);
    try {
      const { crmRows, salesRows } = await fetchData();
      if (crmRows.length === 0 && salesRows.length === 0) {
        toast.warning("No data to export.");
        return;
      }
      const userName =
        canSelectUser && selectedUser !== "all"
          ? (users.find((u) => String(u.id) === selectedUser)?.name ??
            selectedUser)
          : "All Users";
      const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? month;
      const filterSummary = `User: ${userName} | Month: ${monthLabel} ${year}`;
      const tableHtml = `
        <p class="pdf-section-title">CRM Requests</p>
        <table class="pdf-table">
          <thead><tr><th>Doctor</th><th>CRM Amount</th><th>Status</th><th>Submitted</th></tr></thead>
          <tbody>${crmRows.map((r) => `<tr><td>${r["Doctor Name"]}</td><td>₹${r["CRM Amount (₹)"]}</td><td>${r.Status}</td><td>${r["Submitted Date"]}</td></tr>`).join("") || "<tr><td colspan='4' style='color:#9ca3af;font-style:italic'>No CRM records</td></tr>"}</tbody>
        </table>
        <p class="pdf-section-title" style="margin-top:16px">Business / Sales Reports</p>
        <table class="pdf-table">
          <thead><tr><th>Doctor</th><th>Month</th><th>Actual Sales</th><th>Prescriptions</th></tr></thead>
          <tbody>${salesRows.map((r) => `<tr><td>${r["Doctor Name"]}</td><td>${r.Month} ${r.Year}</td><td>₹${r["Actual Sales (₹)"]}</td><td>${r["Prescription Count"]}</td></tr>`).join("") || "<tr><td colspan='4' style='color:#9ca3af;font-style:italic'>No sales records</td></tr>"}</tbody>
        </table>`;
      await printReportPdf({
        reportTitle: "CRM & Sales Report",
        filterSummary,
        tableHtml,
        filenameParts: ["CRMSalesReport", userName, `${monthLabel}${year}`],
        companyProfile,
      });
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setPdfLoading(false);
    }
  }, [
    session,
    fetchData,
    canSelectUser,
    selectedUser,
    users,
    month,
    year,
    companyProfile,
  ]);

  return (
    <SectionCard
      icon={TrendingUp}
      title="CRM & Sales Report"
      description="Export CRM requests and business/sales reports by user and month"
    >
      <FilterRow>
        <FilterField label="Month">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger
              className="h-9 text-xs w-[130px]"
              data-ocid="export-crm-month"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Year">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger
              className="h-9 text-xs w-[90px]"
              data-ocid="export-crm-year"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        {canSelectUser && (
          <FilterField label="User">
            <UserSelect
              users={users}
              value={selectedUser}
              onValueChange={setSelectedUser}
            />
          </FilterField>
        )}
        <Button
          size="sm"
          className="h-9 gap-1.5 mt-auto"
          onClick={handleExport}
          disabled={loading}
          data-ocid="export-crm-btn"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Excel
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 mt-auto"
          onClick={handleExportPdf}
          disabled={pdfLoading}
          data-ocid="export-crm-pdf-btn"
        >
          {pdfLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Printer className="w-4 h-4" />
          )}
          {pdfLoading ? "Generating PDF…" : "Export PDF"}
        </Button>
      </FilterRow>
    </SectionCard>
  );
}

// ─── Section: Salary Slips ────────────────────────────────────────────────────

function SalarySlipsSection({
  users,
  companyProfile,
}: {
  users: UserInfo[];
  companyProfile: CompanyProfile | null;
}) {
  const { session } = useAuthStore();
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  type SlipRow = {
    "Employee Name": string;
    "Employee Code": string;
    Designation: string;
    Department: string;
    Month: string;
    Year: string;
    "Basic Pay (₹)": string;
    "HRA (₹)": string;
    "TA Allowance (₹)": string;
    "DA Allowance (₹)": string;
    "Gross Pay (₹)": string;
    "PF Deduction (₹)": string;
    "ESI Deduction (₹)": string;
    "Total Deductions (₹)": string;
    "Net Pay (₹)": string;
    Approved: string;
  };

  const fetchData = useCallback(async (): Promise<SlipRow[]> => {
    if (!session) return [];
    const allRows: SlipRow[] = [];
    await Promise.all(
      users.slice(0, 100).map(async (u) => {
        try {
          const slip = await api.getPayrollRecord(
            session.token,
            u.id,
            BigInt(month),
            BigInt(year),
          );
          if (slip) {
            allRows.push({
              "Employee Name": u.name,
              "Employee Code": u.employeeId,
              Designation: u.designation,
              Department: u.department,
              Month: MONTHS[Number(month) - 1]?.label ?? month,
              Year: year,
              "Basic Pay (₹)": String(slip.basicPay),
              "HRA (₹)": String(slip.hra),
              "TA Allowance (₹)": String(slip.taAllowance),
              "DA Allowance (₹)": String(slip.daAllowance),
              "Gross Pay (₹)": String(slip.grossPay),
              "PF Deduction (₹)": String(slip.pfDeduction),
              "ESI Deduction (₹)": String(slip.esiDeduction),
              "Total Deductions (₹)": String(
                slip.pfDeduction + slip.esiDeduction,
              ),
              "Net Pay (₹)": String(slip.netPay),
              Approved: slip.isApproved ? "Yes" : "No",
            });
          }
        } catch {
          /* skip */
        }
      }),
    );
    return allRows;
  }, [session, month, year, users]);

  const handleExport = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const allRows = await fetchData();
      exportToExcel(allRows, "salary-slips-bulk", companyProfile);
    } catch {
      toast.error("Failed to export Salary Slips");
    } finally {
      setLoading(false);
    }
  }, [fetchData, companyProfile, session]);

  const handleExportPdf = useCallback(async () => {
    if (!session) return;
    setPdfLoading(true);
    try {
      const allRows = await fetchData();
      if (allRows.length === 0) {
        toast.warning("No salary data to export.");
        return;
      }
      const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? month;
      const filterSummary = `All Employees | Month: ${monthLabel} ${year}`;
      const tableHtml = `
        <table class="pdf-table">
          <thead><tr><th>Employee</th><th>Designation</th><th>Basic (₹)</th><th>HRA (₹)</th><th>TA (₹)</th><th>DA (₹)</th><th>Gross (₹)</th><th>Deductions (₹)</th><th>Net Pay (₹)</th><th>Approved</th></tr></thead>
          <tbody>${allRows.map((r) => `<tr><td>${r["Employee Name"]}<br/><span style="font-size:9px;color:#6b7280">${r["Employee Code"]}</span></td><td>${r.Designation || "—"}</td><td>${r["Basic Pay (₹)"]}</td><td>${r["HRA (₹)"]}</td><td>${r["TA Allowance (₹)"]}</td><td>${r["DA Allowance (₹)"]}</td><td><strong>${r["Gross Pay (₹)"]}</strong></td><td>${r["Total Deductions (₹)"]}</td><td><strong>${r["Net Pay (₹)"]}</strong></td><td>${r.Approved}</td></tr>`).join("")}</tbody>
        </table>`;
      await printReportPdf({
        reportTitle: "Salary Slip Bulk Export",
        filterSummary,
        tableHtml,
        filenameParts: ["SalarySlips", `${monthLabel}${year}`],
        companyProfile,
      });
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setPdfLoading(false);
    }
  }, [session, fetchData, month, year, companyProfile]);

  return (
    <SectionCard
      icon={BarChart2}
      title="Salary Slip Export"
      description="Bulk export salary slips for all employees for a selected month"
    >
      <FilterRow>
        <FilterField label="Month">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger
              className="h-9 text-xs w-[130px]"
              data-ocid="export-salary-month"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Year">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger
              className="h-9 text-xs w-[90px]"
              data-ocid="export-salary-year"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <p className="text-xs text-muted-foreground mt-auto pb-2">
          Exports all {users.length} employees for the selected month
        </p>
        <Button
          size="sm"
          className="h-9 gap-1.5 mt-auto"
          onClick={handleExport}
          disabled={loading || users.length === 0}
          data-ocid="export-salary-btn"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Bulk Excel
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 mt-auto"
          onClick={handleExportPdf}
          disabled={pdfLoading || users.length === 0}
          data-ocid="export-salary-pdf-btn"
        >
          {pdfLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Printer className="w-4 h-4" />
          )}
          {pdfLoading ? "Generating PDF…" : "Bulk PDF"}
        </Button>
      </FilterRow>
    </SectionCard>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface ExportReportsProps {
  portalRole: Role;
}

export default function ExportReports({ portalRole }: ExportReportsProps) {
  const { session } = useAuthStore();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { companyProfile } = useCompanyProfile();

  const adminOrHR = isAdminOrHR(portalRole);
  const manager = isManager(portalRole);
  const canSelectUser = adminOrHR || manager;
  const canExportSalary = adminOrHR;
  const canExportCRM = adminOrHR || manager;

  useEffect(() => {
    if (!session?.token || !canSelectUser) return;
    setLoadingUsers(true);
    const fetchUsers = async () => {
      try {
        if (adminOrHR) {
          const all = await api.listAllUsers(session.token);
          setUsers(
            all.filter(
              (u) => u.role !== Role.Admin && u.role !== Role.HRManager,
            ),
          );
        } else {
          // Managers fetch their reportees
          const reportees = await api.listReportees(
            session.token,
            session.userId,
          );
          setUsers(reportees);
        }
      } catch {
        // silently fail
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [session, canSelectUser, adminOrHR]);

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Export & Reports"
        subtitle={
          adminOrHR
            ? "Download Excel exports for all users, teams, and reports"
            : manager
              ? "Download Excel exports for your team"
              : "Download your own activity and report exports"
        }
      />
      <PageContent>
        {loadingUsers && (
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground font-body">
            <Skeleton className="w-4 h-4 rounded-full" />
            Loading user list…
          </div>
        )}

        {/* Header info */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 mb-6 flex items-start gap-3">
          <FileSpreadsheet className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-display font-semibold text-foreground">
              Export to Excel (.xlsx) or PDF — each report has both buttons
            </p>
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              {adminOrHR
                ? "As Admin/HR you can export data for all users. PDF exports use your browser print dialog — set destination to 'Save as PDF'."
                : manager
                  ? "As a manager you can export data for your team members only."
                  : "You can export your own reports and activity data."}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Daily Call Reports — all roles */}
          <DailyCallReportSection
            users={users}
            canSelectUser={canSelectUser}
            companyProfile={companyProfile ?? null}
          />

          {/* TP Report — all roles */}
          <TravelPlanSection
            users={users}
            canSelectUser={canSelectUser}
            companyProfile={companyProfile ?? null}
          />

          {/* DA Report — all roles */}
          <DaReportSection
            users={users}
            canSelectUser={canSelectUser}
            companyProfile={companyProfile ?? null}
          />

          {/* Doctor Visits — all roles */}
          <DoctorVisitsSection
            users={users}
            canSelectUser={canSelectUser}
            companyProfile={companyProfile ?? null}
          />

          {/* CRM & Sales — managers and above only */}
          {canExportCRM && (
            <CrmSalesSection
              users={users}
              canSelectUser={canSelectUser}
              companyProfile={companyProfile ?? null}
            />
          )}

          {/* Salary Slips — Admin/HR only */}
          {canExportSalary && (
            <SalarySlipsSection
              users={users}
              companyProfile={companyProfile ?? null}
            />
          )}
        </div>
      </PageContent>
    </PortalLayout>
  );
}
