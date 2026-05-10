/**
 * RSM Attendance Tracking — view attendance records for all MRs and ASMs
 * under the RSM's reporting hierarchy (RSM → ASMs → MRs).
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, RefreshCw, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import { buildBrandingExcelRows } from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";

interface AttendanceRecord {
  userId: bigint;
  userName: string;
  role: string;
  date: string;
  status: string;
  checkInTime?: string;
  location?: string;
}

export default function RSMAttendanceTracking() {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const { companyProfile } = useCompanyProfile();

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (token) fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchAttendance = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Fetch all MRs under RSM hierarchy, then get their attendance
      const groups = await api.getMrsGroupedByAsmForManager(token);
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;

      const allRecords: AttendanceRecord[] = [];

      // Also include ASMs
      const uid = session?.userId ?? BigInt(0);
      const asms = await api.listReportees(token, uid);

      for (const asm of asms) {
        if (typeof rawApi.getAttendanceForUser === "function") {
          try {
            const res = (await rawApi.getAttendanceForUser(
              token,
              asm.id,
              selectedDate,
            )) as { __kind__: string; ok?: unknown; err?: string } | null;
            if (res && res.__kind__ === "ok" && res.ok) {
              const rec = res.ok as {
                status?: string;
                checkInTime?: string;
                location?: string;
              };
              allRecords.push({
                userId: asm.id,
                userName: asm.name,
                role: "ASM",
                date: selectedDate,
                status: (rec.status as string) || "Absent",
                checkInTime: rec.checkInTime as string | undefined,
                location: rec.location as string | undefined,
              });
            } else {
              allRecords.push({
                userId: asm.id,
                userName: asm.name,
                role: "ASM",
                date: selectedDate,
                status: "No Data",
              });
            }
          } catch {
            allRecords.push({
              userId: asm.id,
              userName: asm.name,
              role: "ASM",
              date: selectedDate,
              status: "No Data",
            });
          }
        } else {
          allRecords.push({
            userId: asm.id,
            userName: asm.name,
            role: "ASM",
            date: selectedDate,
            status: "No Data",
          });
        }
      }

      for (const group of groups) {
        for (const mr of group.mrs) {
          if (typeof rawApi.getAttendanceForUser === "function") {
            try {
              const res = (await rawApi.getAttendanceForUser(
                token,
                mr.mrId,
                selectedDate,
              )) as { __kind__: string; ok?: unknown; err?: string } | null;
              if (res && res.__kind__ === "ok" && res.ok) {
                const rec = res.ok as {
                  status?: string;
                  checkInTime?: string;
                  location?: string;
                };
                allRecords.push({
                  userId: mr.mrId,
                  userName: mr.mrName,
                  role: "MR",
                  date: selectedDate,
                  status: (rec.status as string) || "Absent",
                  checkInTime: rec.checkInTime as string | undefined,
                  location: rec.location as string | undefined,
                });
              } else {
                allRecords.push({
                  userId: mr.mrId,
                  userName: mr.mrName,
                  role: "MR",
                  date: selectedDate,
                  status: "No Data",
                });
              }
            } catch {
              allRecords.push({
                userId: mr.mrId,
                userName: mr.mrName,
                role: "MR",
                date: selectedDate,
                status: "No Data",
              });
            }
          } else {
            allRecords.push({
              userId: mr.mrId,
              userName: mr.mrName,
              role: "MR",
              date: selectedDate,
              status: "No Data",
            });
          }
        }
      }

      setRecords(allRecords);
      setHasFetched(true);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const brandingRows = buildBrandingExcelRows(companyProfile ?? null);
    const dataRows = records.map((r) => ({
      Name: r.userName,
      Role: r.role,
      Date: r.date,
      Status: r.status,
      "Check-In Time": r.checkInTime || "—",
      Location: r.location || "—",
    }));
    const wb = XLSX.utils.book_new();
    const allRows = [
      ...brandingRows.map((r) => ({ Name: r[""] ?? "" })),
      { Name: `Attendance Tracking — ${selectedDate}` },
      { Name: "" },
      {
        Name: "Name",
        Role: "Role",
        Date: "Date",
        Status: "Status",
        "Check-In Time": "Check-In Time",
        Location: "Location",
      },
      ...dataRows,
    ];
    const ws = XLSX.utils.json_to_sheet(allRows, { skipHeader: true });
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `rsm-attendance-${selectedDate}.xlsx`);
  };

  const present = records.filter((r) =>
    r.status.toLowerCase().includes("present"),
  ).length;
  const absent = records.filter(
    (r) => r.status.toLowerCase().includes("absent") || r.status === "No Data",
  ).length;

  return (
    <PortalLayout portalRole={Role.RSM}>
      <PageHeader
        title="Attendance Tracking"
        subtitle="View attendance for all ASMs and MRs under your region"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={records.length === 0}
            data-ocid="btn-export-attendance"
          >
            <Download className="w-4 h-4 mr-1.5" /> Export Excel
          </Button>
        }
      />
      <PageContent>
        {/* Date picker + fetch button */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label
              htmlFor="attendance-date"
              className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5"
            >
              Date
            </label>
            <Input
              id="attendance-date"
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => setSelectedDate(e.target.value)}
              data-ocid="attendance-date-input"
            />
          </div>
          <Button
            onClick={fetchAttendance}
            disabled={loading}
            data-ocid="btn-fetch-attendance"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading…
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" /> Load Attendance
              </>
            )}
          </Button>
        </div>

        {/* Summary */}
        {hasFetched && !loading && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold font-display text-foreground">
                {records.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Team Members</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold font-display text-green-700">
                {present}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Present</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold font-display text-destructive">
                {absent}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Absent / No Data
              </p>
            </div>
          </div>
        )}

        {/* Records table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : hasFetched && records.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
            data-ocid="attendance.empty_state"
          >
            <UserCheck className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">
              No attendance records for {selectedDate}
            </p>
          </div>
        ) : hasFetched ? (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-ocid="attendance.table">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {[
                      "Name",
                      "Role",
                      "Status",
                      "Check-In Time",
                      "Location",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.map((r, idx) => (
                    <tr
                      key={String(r.userId)}
                      className="hover:bg-muted/20"
                      data-ocid={`attendance.item.${idx + 1}`}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {r.userName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                            r.role === "ASM"
                              ? "bg-orange-100 text-orange-700 border-orange-200"
                              : "bg-blue-100 text-blue-700 border-blue-200"
                          }`}
                        >
                          {r.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            r.status.toLowerCase().includes("present")
                              ? "bg-green-50 text-green-700 border-green-200"
                              : r.status.toLowerCase().includes("leave")
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {r.checkInTime || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[200px]">
                        {r.location || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <UserCheck className="w-10 h-10 opacity-30" />
            <p className="text-sm">
              Select a date and click "Load Attendance" to view records.
            </p>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
