import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import { useAuthStore } from "../../store/authStore";

const REPORT_TYPES = [
  "Employee Report",
  "Archived Employees",
  "Attendance Report",
  "Leave Report",
  "Payroll Report",
  "DCR Report",
  "Expense Report",
  "Tour Plan Report",
  "Doctor Master",
  "Chemist Master",
  "Stockist Master",
  "Sales Target Report",
  "Audit Trail",
  "Recruitment Pipeline",
  "Appraisal Report",
];

const REPORT_COLUMNS: Record<string, string[]> = {
  "Employee Report": [
    "Employee Code",
    "Full Name",
    "User ID",
    "Role",
    "Department",
    "Designation",
    "Reporting Manager",
    "Zone",
    "Region",
    "Area",
    "Station",
    "Territory",
    "Mobile",
    "Email",
    "Joining Date",
    "Status",
  ],
  "Archived Employees": [
    "Employee Code",
    "Full Name",
    "User ID",
    "Role",
    "Department",
    "Designation",
    "Reporting Manager",
    "Territory",
    "Mobile",
    "Email",
    "Joining Date",
    "Archived Date",
    "Status",
  ],
  "Attendance Report": [
    "Employee Code",
    "Employee Name",
    "Role",
    "Territory",
    "Month",
    "Total Days",
    "Present Days",
    "Absent Days",
    "Late Days",
    "Auto Check-Out Days",
    "Leave Days",
    "Attendance %",
  ],
  "Leave Report": [
    "Employee Code",
    "Employee Name",
    "Role",
    "Leave Type",
    "From Date",
    "To Date",
    "Days",
    "Reason",
    "Status",
    "Approved By",
    "Approval Date",
  ],
  "Payroll Report": [
    "Employee Code",
    "Employee Name",
    "Designation",
    "Department",
    "Basic",
    "HRA",
    "Travel Allowance",
    "Other Allowances",
    "Gross Salary",
    "PF Deduction",
    "ESIC Deduction",
    "PT Deduction",
    "TDS Deduction",
    "Total Deductions",
    "Net Pay",
    "Days Worked",
    "Loss of Pay Days",
    "Payroll Month",
    "Status",
  ],
  "DCR Report": [
    "Date",
    "Employee Code",
    "Employee Name",
    "Role",
    "Territory",
    "Visit Type",
    "Doctor/Chemist/Stockist Name",
    "Specialty",
    "Products Detailed",
    "Samples Given",
    "Gift Articles Given",
    "GPS Captured",
    "Submitted At (IST)",
    "Source",
  ],
  "Expense Report": [
    "Employee Code",
    "Employee Name",
    "Role",
    "Territory",
    "Claim Date",
    "Category",
    "Travel Mode",
    "From Location",
    "To Location",
    "Distance (km)",
    "Amount",
    "Receipt Uploaded",
    "Status",
    "Approved By",
    "Approval Date",
    "Remarks",
  ],
  "Tour Plan Report": [
    "Employee Code",
    "Employee Name",
    "Role",
    "Territory",
    "Plan Month",
    "Planned Visit Date",
    "Doctor/Entity Name",
    "Planned",
    "Visited",
    "Status",
  ],
  "Doctor Master": [
    "Doctor Name",
    "Specialty",
    "Qualification",
    "Category",
    "Prescription Potential",
    "Clinic/Hospital",
    "Territory",
    "Contact Number",
    "Visit Frequency",
    "Products Preferred",
  ],
  "Chemist Master": [
    "Chemist Name",
    "Address",
    "Territory",
    "Contact Number",
    "Outstanding Balance",
  ],
  "Stockist Master": [
    "Stockist Name",
    "Address",
    "Territory",
    "Contact Number",
    "Outstanding Balance",
  ],
  "Sales Target Report": [
    "Employee Code",
    "Employee Name",
    "Role",
    "Territory",
    "Period",
    "Product",
    "Target Value",
    "Achieved Value",
    "Achievement %",
    "Grade",
  ],
  "Audit Trail": [
    "Timestamp (IST)",
    "User ID",
    "User Name",
    "Role",
    "Action Type",
    "Details",
    "IP Address",
  ],
  "Recruitment Pipeline": [
    "Candidate Name",
    "Email",
    "Mobile",
    "Position Applied",
    "Department",
    "Territory",
    "Source",
    "Current Stage",
    "Interview Date",
    "Offer Issued",
    "Joining Date",
    "Status",
  ],
  "Appraisal Report": [
    "Employee Code",
    "Employee Name",
    "Role",
    "Department",
    "Cycle Name",
    "Period",
    "Overall Score",
    "Grade",
    "Status",
  ],
};

const ROLE_OPTIONS = ["MR", "ASM", "RSM", "ZSM", "HRManager", "Admin"];

function getISTDateString() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = ist.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export default function BulkExport({ portalRole }: { portalRole?: Role }) {
  const { session } = useAuthStore();
  const effectiveRole = portalRole ?? session?.role ?? Role.Admin;

  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [territory, setTerritory] = useState("");
  const [role, setRole] = useState("all");
  const [department, setDepartment] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggleReport(name: string) {
    setSelectedReports((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name],
    );
  }

  function toggleAll() {
    if (selectedReports.length === REPORT_TYPES.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports([...REPORT_TYPES]);
    }
  }

  async function handleGenerate() {
    if (selectedReports.length === 0) {
      toast.error("Please select at least one report type.");
      return;
    }
    setIsGenerating(true);
    setProgress(0);

    try {
      const wb = XLSX.utils.book_new();
      const total = selectedReports.length;
      const filterLine = [
        fromDate && `From: ${fromDate}`,
        toDate && `To: ${toDate}`,
        territory && `Territory: ${territory}`,
        role !== "all" && `Role: ${role}`,
        department && `Department: ${department}`,
      ]
        .filter(Boolean)
        .join(" | ");
      const exportDate = getISTDateString();

      for (let i = 0; i < total; i++) {
        const reportName = selectedReports[i];
        const cols = REPORT_COLUMNS[reportName] ?? [];
        const titleRow = [`${reportName} — Krishkar Pharmaceuticals`];
        const filterRow = [
          `Exported on: ${exportDate}${filterLine ? ` | Filters: ${filterLine}` : ""}`,
        ];
        const blankRow: string[] = [];
        const headerRow = cols;
        const aoa = [titleRow, filterRow, blankRow, headerRow];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const sheetName = reportName.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        setProgress(Math.round(((i + 1) / total) * 100));
        // yield to UI
        await new Promise((r) => setTimeout(r, 30));
      }

      const filename = `Krishkar_BulkExport_${exportDate}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Bulk export ready: ${filename}`);
    } catch (e) {
      toast.error(String(e) || "Export failed");
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  }

  return (
    <PortalLayout portalRole={effectiveRole}>
      <PageHeader
        title="Bulk Export"
        subtitle="Generate a single Excel file with one sheet per selected report"
      />
      <PageContent>
        {/* Report Selection */}
        <SectionCard title="Select Reports">
          <div className="mb-3">
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-primary underline"
              data-ocid="bulk-export.select-all-toggle"
            >
              {selectedReports.length === REPORT_TYPES.length
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {REPORT_TYPES.map((name) => {
              const checkboxId = `bulk-export-report-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
              return (
                <label
                  key={name}
                  htmlFor={checkboxId}
                  className="flex items-center gap-2.5 cursor-pointer group p-2 rounded-md hover:bg-muted/40 transition-colors"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={selectedReports.includes(name)}
                    onCheckedChange={() => toggleReport(name)}
                    data-ocid={`bulk-export.report-checkbox.${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  />
                  <span className="text-sm text-foreground">{name}</span>
                </label>
              );
            })}
          </div>
        </SectionCard>

        {/* Filters */}
        <SectionCard title="Common Filters (Optional)">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs mb-1 block">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                data-ocid="bulk-export.from-date-input"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">To Date</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                data-ocid="bulk-export.to-date-input"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Territory</Label>
              <Input
                placeholder="e.g. Pune East"
                value={territory}
                onChange={(e) => setTerritory(e.target.value)}
                data-ocid="bulk-export.territory-input"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger data-ocid="bulk-export.role-select">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Department</Label>
              <Input
                placeholder="e.g. Sales"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                data-ocid="bulk-export.department-input"
              />
            </div>
          </div>
        </SectionCard>

        {/* Generate */}
        <SectionCard>
          {isGenerating && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Generating export…</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || selectedReports.length === 0}
            size="lg"
            className="gap-2"
            data-ocid="bulk-export.generate-button"
          >
            <Download className="w-4 h-4" />
            {isGenerating ? "Generating…" : "Generate Bulk Export"}
          </Button>
          {selectedReports.length > 0 && !isGenerating && (
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedReports.length} report
              {selectedReports.length !== 1 ? "s" : ""} selected. File will be
              named:{" "}
              <span className="font-mono">
                Krishkar_BulkExport_{getISTDateString()}.xlsx
              </span>
            </p>
          )}
        </SectionCard>
      </PageContent>
    </PortalLayout>
  );
}
