import { Stethoscope, TrendingDown, TrendingUp } from "lucide-react";
/**
 * MrDoctorVisitWidget
 *
 * Shows Doctor Visit % for each MR under the manager:
 *   (Unique Doctors Visited This Month / Total Allotted Doctors) × 100
 *
 * Highlights the Top Performer (highest %) and Bottom Performer (lowest %).
 */
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { MrMonthlySummary, UserInfo } from "../types";

interface MrVisitRow {
  mrId: bigint;
  name: string;
  allotted: number;
  visited: number;
  pct: number;
}

interface Props {
  reportees: UserInfo[];
  month: string; // "YYYY-MM"
}

function pctBar(pct: number) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color =
    clamped >= 80
      ? "bg-green-500"
      : clamped >= 50
        ? "bg-amber-400"
        : "bg-destructive";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs font-mono w-10 text-right shrink-0">
        {clamped.toFixed(0)}%
      </span>
    </div>
  );
}

export function MrDoctorVisitWidget({ reportees, month }: Props) {
  const [rows, setRows] = useState<MrVisitRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (reportees.length === 0) return;

    setLoading(true);
    // Fetch all summaries once + doctor counts per MR in parallel
    Promise.all([
      api.listAllMrSummaries(month).catch(() => [] as MrMonthlySummary[]),
      ...reportees.map((mr) =>
        api
          .listMyDoctors(mr.id)
          .catch(() => [])
          .then((docs) => ({
            mrId: mr.id,
            allotted: docs.length,
          })),
      ),
    ])
      .then(([summaryArr, ...doctorCounts]) => {
        const allSummaries = summaryArr as MrMonthlySummary[];
        const data: MrVisitRow[] = reportees.map((mr, idx) => {
          const dc = (doctorCounts as { mrId: bigint; allotted: number }[])[
            idx
          ];
          const summary = allSummaries.find((s) => s.mrId === mr.id);
          const allotted = dc?.allotted ?? 0;
          const visited = summary ? Number(summary.uniqueDoctors) : 0;
          const pct = allotted > 0 ? (visited / allotted) * 100 : 0;
          return { mrId: mr.id, name: mr.name, allotted, visited, pct };
        });
        data.sort((a, b) => b.pct - a.pct);
        setRows(data);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [reportees, month]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="h-4 w-48 bg-muted animate-pulse rounded mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-muted animate-pulse rounded mb-2" />
        ))}
      </div>
    );
  }

  const topMr = rows[0];
  const bottomMr = rows[rows.length - 1];

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Stethoscope className="w-4 h-4 text-primary" />
        <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground flex-1">
          Doctor Visits by MR — {month}
        </h3>
        <span className="text-xs text-muted-foreground">{rows.length} MRs</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No visit data for {month}
        </p>
      ) : (
        <>
          {/* Top / Bottom performer badges */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {topMr && (
              <div
                className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
                data-ocid="mr-top-performer"
              >
                <TrendingUp className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-display font-semibold text-green-800 uppercase tracking-wider">
                    Top Performer
                  </p>
                  <p
                    className="text-sm font-body font-medium text-green-900 truncate"
                    title={topMr.name}
                  >
                    {topMr.name}
                  </p>
                  <p className="text-xs text-green-700">
                    {topMr.visited}/{topMr.allotted} doctors —{" "}
                    <strong>{topMr.pct.toFixed(0)}%</strong>
                  </p>
                </div>
              </div>
            )}
            {bottomMr && bottomMr.mrId !== topMr?.mrId && (
              <div
                className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                data-ocid="mr-bottom-performer"
              >
                <TrendingDown className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-display font-semibold text-red-700 uppercase tracking-wider">
                    Bottom Performer
                  </p>
                  <p
                    className="text-sm font-body font-medium text-red-900 truncate"
                    title={bottomMr.name}
                  >
                    {bottomMr.name}
                  </p>
                  <p className="text-xs text-red-700">
                    {bottomMr.visited}/{bottomMr.allotted} doctors —{" "}
                    <strong>{bottomMr.pct.toFixed(0)}%</strong>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Full list */}
          <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
            {rows.map((row, idx) => (
              <div
                key={String(row.mrId)}
                className="flex items-center gap-3"
                data-ocid={`mr-visit-row-${String(row.mrId)}`}
              >
                <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                  {idx + 1}.
                </span>
                <span
                  className="text-sm font-body text-foreground truncate w-32 shrink-0"
                  title={row.name}
                >
                  {row.name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 w-16">
                  {row.visited}/{row.allotted}
                </span>
                <div className="flex-1 min-w-0">{pctBar(row.pct)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
