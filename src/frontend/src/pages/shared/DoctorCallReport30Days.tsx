import type React from "react";
import { useEffect, useState } from "react";
import { Role } from "../../backend";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

const DoctorCallReport30Days: React.FC<{ mrId?: string }> = ({ mrId }) => {
  const { session } = useAuthStore();
  const today = new Date();
  const past30 = new Date(today);
  past30.setDate(today.getDate() - 30);
  const isoDate = (d: Date) => d.toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(isoDate(past30));
  const [toDate, setToDate] = useState(isoDate(today));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;
  const isManager = session?.role !== Role.MR;

  useEffect(() => {
    if (!session) return;
    if (isManager && !mrId) return;
    setLoading(true);
    const fetchData = async () => {
      try {
        let result: any[] = [];
        if (isManager && mrId) {
          const r = await api.getDoctorCallReportForMrs(session.token, [], {
            fromDate,
            toDate,
          });
          result = Array.isArray(r) ? r : [];
        } else {
          const r = await api.getDoctorCallReport(session.token, {
            fromDate,
            toDate,
          });
          result = Array.isArray(r) ? r : [];
        }
        setData(result);
        setPage(0);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [session, mrId, fromDate, toDate, isManager]);

  const paged = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const uniqueDoctors = new Set(
    data.map((r: any) => r.doctorName ?? r.doctorId ?? ""),
  ).size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label
            htmlFor="dcr-from-date"
            className="text-sm font-medium text-foreground"
          >
            From:
          </label>
          <input
            id="dcr-from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-input rounded px-2 py-1.5 text-sm bg-background text-foreground"
          />
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="dcr-to-date"
            className="text-sm font-medium text-foreground"
          >
            To:
          </label>
          <input
            id="dcr-to-date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-input rounded px-2 py-1.5 text-sm bg-background text-foreground"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div
          data-ocid="doctor_call_report.empty_state"
          className="text-center py-12 text-muted-foreground border border-border rounded-lg bg-card"
        >
          No doctor calls found for the selected period.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-primary/10 text-primary text-xs uppercase tracking-wide">
                  <th className="border-b border-border px-3 py-2.5 text-left">
                    Date
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left">
                    Time
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left">
                    Doctor Name
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left">
                    Specialty
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left">
                    Clinic / Hospital
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left">
                    Station / Area
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left">
                    Products
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left">
                    Samples
                  </th>
                  {isManager && (
                    <th className="border-b border-border px-3 py-2.5 text-left">
                      Location
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paged.map((r: any, i: number) => (
                  <tr
                    key={`row-${i}`}
                    data-ocid={`doctor_call_report.item.${page * PAGE_SIZE + i + 1}`}
                    className={i % 2 === 0 ? "bg-card" : "bg-muted/30"}
                  >
                    <td className="border-b border-border px-3 py-2 text-foreground">
                      {r.date ?? "—"}
                    </td>
                    <td className="border-b border-border px-3 py-2 text-foreground">
                      {r.visitTime ?? r.time ?? "—"}
                    </td>
                    <td className="border-b border-border px-3 py-2 font-medium text-foreground">
                      {r.doctorName ?? "—"}
                    </td>
                    <td className="border-b border-border px-3 py-2 text-foreground">
                      {r.specialty ?? "—"}
                    </td>
                    <td className="border-b border-border px-3 py-2 text-foreground">
                      {r.clinicHospital ?? r.clinic ?? "—"}
                    </td>
                    <td className="border-b border-border px-3 py-2 text-foreground">
                      {r.station ?? r.area ?? "—"}
                    </td>
                    <td className="border-b border-border px-3 py-2 text-foreground">
                      {Array.isArray(r.productsDetailed)
                        ? r.productsDetailed.join(", ")
                        : (r.productsDetailed ?? r.products ?? "—")}
                    </td>
                    <td className="border-b border-border px-3 py-2 text-foreground">
                      {r.samplesGiven ?? r.samples ?? "—"}
                    </td>
                    {isManager && (
                      <td className="border-b border-border px-3 py-2">
                        {r.gpsCoords?.lat != null ? (
                          <a
                            href={`https://www.google.com/maps?q=${r.gpsCoords.lat},${r.gpsCoords.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline text-xs hover:text-primary/80"
                          >
                            View on Map
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-primary/10 font-semibold text-primary text-xs">
                  <td className="px-3 py-2.5" colSpan={2}>
                    Summary
                  </td>
                  <td className="px-3 py-2.5">Total calls: {data.length}</td>
                  <td className="px-3 py-2.5">
                    Unique doctors: {uniqueDoctors}
                  </td>
                  <td className="px-3 py-2.5" colSpan={isManager ? 5 : 4} />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
            <span>
              Showing {page * PAGE_SIZE + 1}–
              {Math.min((page + 1) * PAGE_SIZE, data.length)} of {data.length}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                data-ocid="doctor_call_report.pagination_prev"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border border-border rounded text-sm disabled:opacity-40 hover:bg-muted transition-colors"
              >
                ← Prev
              </button>
              <button
                type="button"
                data-ocid="doctor_call_report.pagination_next"
                disabled={(page + 1) * PAGE_SIZE >= data.length}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-border rounded text-sm disabled:opacity-40 hover:bg-muted transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DoctorCallReport30Days;
