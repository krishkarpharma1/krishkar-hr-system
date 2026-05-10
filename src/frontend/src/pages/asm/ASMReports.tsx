import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ReportStatus, Role } from "../../backend";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { CallReportInfo } from "../../types";
import { formatDate } from "../../utils/dateFormatter";

export default function ASMReports() {
  const { session } = useAuthStore();
  const [reports, setReports] = useState<CallReportInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const token = session?.token ?? "";
  const userId = session?.userId ?? BigInt(0);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .listSubmittedReports()
      .then(setReports)
      .finally(() => setLoading(false));
  }, [token]);

  async function handleApprove(reportId: bigint, approved: boolean) {
    const res = await api.reviewCallReport(
      userId,
      reportId,
      approved,
      approved ? "Approved" : "Rejected",
    );
    if (res.__kind__ === "ok") {
      toast.success(approved ? "Report approved" : "Report rejected");
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } else {
      toast.error(res.err);
    }
  }

  const pending = reports.filter((r) => r.status === ReportStatus.Submitted);

  return (
    <PortalLayout portalRole={Role.ASM}>
      <PageHeader
        title="Call Reports"
        subtitle="Review and approve Daily Call Reports from your MRs"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.location.href = "/asm/doctor-calls";
              }}
              className="gap-1.5"
              data-ocid="btn-mr-doctor-calls"
            >
              <FileText className="w-3.5 h-3.5" /> MR Doctor Calls (30d)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setLoading(true);
                api
                  .listSubmittedReports()
                  .then(setReports)
                  .finally(() => setLoading(false));
              }}
              disabled={loading}
              data-ocid="btn-refresh-reports"
            >
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>
        }
      />
      <PageContent>
        <DataTable<CallReportInfo>
          columns={[
            { key: "date", label: "Date" },
            { key: "mr", label: "MR" },
            { key: "type", label: "Work Type" },
            { key: "doctors", label: "Doctors" },
            { key: "status", label: "Status" },
            { key: "actions", label: "Actions", className: "text-right" },
          ]}
          data={pending}
          getKey={(item) => String(item.id)}
          loading={loading}
          emptyMessage="No submitted reports pending review"
          renderRow={(report) => (
            <>
              <td className="px-4 py-3 text-sm text-foreground">
                {formatDate(report.date)}
              </td>
              <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                MR#{String(report.mrId)}
              </td>
              <td className="px-4 py-3 text-sm text-foreground">
                {report.workType}
              </td>
              <td className="px-4 py-3 text-sm text-foreground">
                {report.doctorsVisited.length}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="text-xs">
                  <FileText className="w-3 h-3 mr-1" />
                  {report.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                    onClick={() => handleApprove(report.id, true)}
                    data-ocid="btn-approve-report"
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => handleApprove(report.id, false)}
                    data-ocid="btn-reject-report"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                  </Button>
                </div>
              </td>
            </>
          )}
        />
      </PageContent>
    </PortalLayout>
  );
}
