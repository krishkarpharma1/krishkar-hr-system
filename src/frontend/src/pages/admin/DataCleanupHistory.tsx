import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Lock, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";

interface CleanupLog {
  id: string;
  adminUsername: string;
  timestamp: string;
  reason: string;
  status: "success" | "failed";
  recordsDeleted: number;
}

interface Props {
  portalRole?: Role;
}

export default function DataCleanupHistory({ portalRole = Role.Admin }: Props) {
  const [logs, setLogs] = useState<CleanupLog[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("cleanup_audit_log");
    if (stored) {
      try {
        setLogs(JSON.parse(stored) as CleanupLog[]);
      } catch {
        setLogs([]);
      }
    }
  }, []);

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Data Cleanup Audit Log"
        subtitle="Read-only record of all data cleanup actions — immutable audit trail"
      />
      <PageContent>
        {/* Read-only notice */}
        <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-4 py-3 mb-4 text-sm">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <p className="text-muted-foreground font-body">
            This log is read-only and immutable. No entries can be edited or
            deleted. Records are sorted newest first.
          </p>
        </div>

        <SectionCard title="Cleanup History">
          {logs.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2"
              data-ocid="cleanup-history-empty"
            >
              <Clock className="w-10 h-10 opacity-30" />
              <p className="text-sm font-body">
                No cleanup actions recorded yet
              </p>
              <p className="text-xs font-body opacity-70">
                Data cleanup actions will appear here after they are executed.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body min-w-[600px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    {[
                      "Date & Time",
                      "Admin",
                      "Records Deleted",
                      "Reason",
                      "Status",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs uppercase tracking-wider font-display text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-muted/20 transition-colors"
                      data-ocid={`cleanup-log-row-${log.id}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {log.adminUsername}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        {log.status === "success"
                          ? log.recordsDeleted.toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                        {log.reason || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {log.status === "success" ? (
                          <Badge className="gap-1 bg-green-100 text-green-800 border-green-300 text-xs">
                            <CheckCircle2 className="w-3 h-3" />
                            Success
                          </Badge>
                        ) : (
                          <Badge
                            variant="destructive"
                            className="gap-1 text-xs"
                          >
                            <XCircle className="w-3 h-3" />
                            Failed
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </PageContent>
    </PortalLayout>
  );
}
