import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import type { Role } from "../../backend";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useEmployeeNames } from "../../lib/nameResolver";
import { useAuthStore } from "../../store/authStore";
import type { CallReportInfo } from "../../types";

interface Props {
  portalRole: Role;
}

export default function MRPortalEntriesPage({ portalRole }: Props) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";

  const [reports, setReports] = useState<CallReportInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const { getEmployeeName } = useEmployeeNames();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    // Use listSubmittedReports and filter for MR Portal entries (tagged by remarks)
    api
      .listSubmittedReports()
      .then((reps) => {
        const from = new Date(fromDate).getTime();
        const to = new Date(toDate).getTime() + 86400000;
        setReports(
          reps.filter((r) => {
            const dateMs = new Date(r.date).getTime();
            if (dateMs < from || dateMs >= to) return false;
            // MR Portal entries are tagged in remarks
            return r.remarks?.includes("[MR Portal") ?? false;
          }),
        );
      })
      .finally(() => setLoading(false));
  }, [token, fromDate, toDate]);

  function extractRole(remarks: string): string {
    const match = remarks.match(/\[MR Portal — ([^a]+?) acting as MR\]/);
    return match ? match[1] : "—";
  }

  function extractType(remarks: string): string {
    if (remarks.includes("Sample Distribution")) return "Sample Distribution";
    if (remarks.includes("Gift Distribution")) return "Gift Distribution";
    return "Doctor Call";
  }

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="MR Portal Entries"
        subtitle="Doctor Call, Sample & Gift Distribution entries submitted via Additional MR Charge"
      />
      <PageContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end mb-5 bg-card border border-border rounded-lg p-4">
          <div>
            <Label className="text-xs font-medium mb-1 block">From Date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 text-sm w-40"
              data-ocid="filter-from-date"
            />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1 block">To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 text-sm w-40"
              data-ocid="filter-to-date"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!token) return;
              setLoading(true);
              api
                .listSubmittedReports()
                .then((reps) => {
                  const from = new Date(fromDate).getTime();
                  const to = new Date(toDate).getTime() + 86400000;
                  setReports(
                    reps.filter((r) => {
                      const dateMs = new Date(r.date).getTime();
                      if (dateMs < from || dateMs >= to) return false;
                      return r.remarks?.includes("[MR Portal") ?? false;
                    }),
                  );
                })
                .finally(() => setLoading(false));
            }}
            data-ocid="btn-apply-filter"
          >
            Apply Filter
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <Stethoscope className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-foreground">
              {reports.length} entries
            </span>
          </div>
        </div>

        <DataTable<CallReportInfo>
          columns={[
            { key: "date", label: "Date" },
            { key: "employee", label: "Employee" },
            { key: "primaryRole", label: "Primary Role" },
            { key: "type", label: "Entry Type" },
            { key: "doctors", label: "Doctors" },
            { key: "status", label: "Status" },
          ]}
          data={reports}
          getKey={(item) => String(item.id)}
          loading={loading}
          emptyMessage="No MR Portal entries found for the selected date range."
          renderRow={(r) => (
            <>
              <td className="px-4 py-3 text-sm text-foreground">{r.date}</td>
              <td className="px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  {getEmployeeName(r.mrId)}
                </p>
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className="text-xs bg-amber-50 border-amber-200 text-amber-700"
                >
                  {extractRole(r.remarks || "")}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary" className="text-xs">
                  {extractType(r.remarks || "")}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm text-center text-foreground">
                {r.doctorsVisited.length}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="text-xs capitalize">
                  {r.status}
                </Badge>
              </td>
            </>
          )}
        />
      </PageContent>
    </PortalLayout>
  );
}
