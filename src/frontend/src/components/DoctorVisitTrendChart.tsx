import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api";

interface MonthlyVisitData {
  monthYear: string; // "Jan 2026"
  mrId: string;
  mrName: string;
  visitPct: number;
  doctorsVisited: number;
  totalDoctors: number;
}

interface ConsolidatedMonthData {
  monthYear: string;
  avgVisitPct: number;
  totalVisited: number;
  totalAllotted: number;
}

interface Props {
  managerId: number;
  managerRole: string;
  token: string;
}

type ViewMode = "individual" | "consolidated";
type MonthRange = 6 | 12;

// Determine trend direction from last 3 data points
function getTrendColor(values: number[]): string {
  if (values.length < 2) return "var(--chart-4)";
  const last3 = values.slice(-3);
  const first = last3[0];
  const last = last3[last3.length - 1];
  const diff = last - first;
  if (diff >= 3) return "#22c55e"; // improving — green
  if (diff <= -3) return "#ef4444"; // declining — red
  return "#94a3b8"; // flat — slate
}

// Generate consistent chart colors for MR lines
const LINE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#8b5cf6",
  "#f59e0b",
  "#06b6d4",
];

function generateFallbackIndividualData(months: number): MonthlyVisitData[] {
  const now = new Date();
  const mrNames = ["No MR data"];
  const result: MonthlyVisitData[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });
    mrNames.forEach((name, idx) => {
      result.push({
        monthYear: label,
        mrId: String(idx),
        mrName: name,
        visitPct: 0,
        doctorsVisited: 0,
        totalDoctors: 0,
      });
    });
  }
  return result;
}

function generateFallbackConsolidatedData(
  months: number,
): ConsolidatedMonthData[] {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return {
      monthYear: d.toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      }),
      avgVisitPct: 0,
      totalVisited: 0,
      totalAllotted: 0,
    };
  });
}

// Build chart-ready data: one row per monthYear, columns per MR
function buildIndividualChartData(
  rawData: MonthlyVisitData[],
): { monthYear: string; [mrName: string]: number | string }[] {
  const monthMap = new Map<
    string,
    { monthYear: string; [mrName: string]: number | string }
  >();
  for (const d of rawData) {
    if (!monthMap.has(d.monthYear)) {
      monthMap.set(d.monthYear, { monthYear: d.monthYear });
    }
    const row = monthMap.get(d.monthYear)!;
    row[d.mrName] = d.visitPct;
  }
  return Array.from(monthMap.values());
}

// Custom tooltip
function CustomTooltip({
  active,
  payload,
  label,
  viewMode,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  viewMode: ViewMode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs min-w-[160px]">
      <p className="font-display font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ background: p.color }}
            />
            <span className="text-muted-foreground">
              {viewMode === "consolidated" ? "Team Avg" : p.name}
            </span>
          </span>
          <span className="font-mono font-semibold text-foreground">
            {(p.value ?? 0).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function DoctorVisitTrendChart({
  managerId,
  managerRole,
  token,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("individual");
  const [monthRange, setMonthRange] = useState<MonthRange>(6);
  const [individualData, setIndividualData] = useState<MonthlyVisitData[]>([]);
  const [consolidatedData, setConsolidatedData] = useState<
    ConsolidatedMonthData[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver for lazy loading
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Fetch trend data when visible / params change
  useEffect(() => {
    if (!isVisible || !token || !managerId) return;
    setLoading(true);

    const apiAny = api as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;

    if (viewMode === "individual") {
      const fn = apiAny.getDoctorVisitTrend;
      if (typeof fn === "function") {
        fn(token, managerId, monthRange)
          .then((d) => setIndividualData(d as MonthlyVisitData[]))
          .catch(() =>
            setIndividualData(generateFallbackIndividualData(monthRange)),
          )
          .finally(() => setLoading(false));
      } else {
        setIndividualData(generateFallbackIndividualData(monthRange));
        setLoading(false);
      }
    } else {
      const fn = apiAny.getConsolidatedVisitTrend;
      if (typeof fn === "function") {
        fn(token, managerId, monthRange)
          .then((d) => setConsolidatedData(d as ConsolidatedMonthData[]))
          .catch(() =>
            setConsolidatedData(generateFallbackConsolidatedData(monthRange)),
          )
          .finally(() => setLoading(false));
      } else {
        setConsolidatedData(generateFallbackConsolidatedData(monthRange));
        setLoading(false);
      }
    }
  }, [isVisible, token, managerId, viewMode, monthRange]);

  // Derive MR names from individual data
  const mrNames = Array.from(
    new Set(individualData.map((d) => d.mrName)),
  ).filter((n) => n !== "No MR data");

  // Build per-MR trend color
  const mrTrendColors: Record<string, string> = {};
  for (const name of mrNames) {
    const values = individualData
      .filter((d) => d.mrName === name)
      .map((d) => d.visitPct);
    mrTrendColors[name] = getTrendColor(values);
  }

  const chartDataIndividual = buildIndividualChartData(individualData);
  const consolidatedTrendColor = getTrendColor(
    consolidatedData.map((d) => d.avgVisitPct),
  );

  // Compute improving/declining counts
  const improvingCount = Object.values(mrTrendColors).filter(
    (c) => c === "#22c55e",
  ).length;
  const decliningCount = Object.values(mrTrendColors).filter(
    (c) => c === "#ef4444",
  ).length;

  return (
    <div
      ref={containerRef}
      className="bg-card border border-border rounded-lg p-4"
      data-ocid="doctor-visit-trend-chart"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary" />
            Doctor Visit % Trend
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {managerRole} · last {monthRange} months · doctor coverage trends
          </p>
        </div>
        {/* Trend summary badges */}
        {viewMode === "individual" && mrNames.length > 0 && (
          <div className="flex items-center gap-2">
            {improvingCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                <TrendingUp className="w-3 h-3" />
                {improvingCount} improving
              </span>
            )}
            {decliningCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                <TrendingDown className="w-3 h-3" />
                {decliningCount} declining
              </span>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-lg overflow-hidden border border-border text-xs">
          <button
            type="button"
            onClick={() => setViewMode("individual")}
            className={`px-3 py-1.5 font-medium transition-colors ${
              viewMode === "individual"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted/40"
            }`}
            data-ocid="trend-view-individual"
          >
            Individual MR
          </button>
          <button
            type="button"
            onClick={() => setViewMode("consolidated")}
            className={`px-3 py-1.5 font-medium transition-colors ${
              viewMode === "consolidated"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted/40"
            }`}
            data-ocid="trend-view-consolidated"
          >
            Team Overview
          </button>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-border text-xs">
          <button
            type="button"
            onClick={() => setMonthRange(6)}
            className={`px-3 py-1.5 font-medium transition-colors ${
              monthRange === 6
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted/40"
            }`}
            data-ocid="trend-range-6m"
          >
            6 Months
          </button>
          <button
            type="button"
            onClick={() => setMonthRange(12)}
            className={`px-3 py-1.5 font-medium transition-colors ${
              monthRange === 12
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted/40"
            }`}
            data-ocid="trend-range-12m"
          >
            12 Months
          </button>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[220px] w-full" />
        </div>
      ) : viewMode === "individual" ? (
        mrNames.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            No trend data available. Doctor visit history will appear here once
            MRs submit reports.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={chartDataIndividual}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="monthYear"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={38}
              />
              <Tooltip
                content={(props) => (
                  <CustomTooltip
                    {...props}
                    payload={
                      props.payload as {
                        name: string;
                        value: number;
                        color: string;
                      }[]
                    }
                    viewMode="individual"
                  />
                )}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
              {mrNames.slice(0, 8).map((name, idx) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={name}
                  stroke={
                    mrTrendColors[name] ?? LINE_COLORS[idx % LINE_COLORS.length]
                  }
                  strokeWidth={2}
                  dot={{
                    r: 3,
                    fill:
                      mrTrendColors[name] ??
                      LINE_COLORS[idx % LINE_COLORS.length],
                  }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )
      ) : consolidatedData.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          No consolidated trend data yet.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart
            data={consolidatedData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="monthYear"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip
              content={(props) => (
                <CustomTooltip
                  {...props}
                  payload={
                    props.payload as {
                      name: string;
                      value: number;
                      color: string;
                    }[]
                  }
                  viewMode="consolidated"
                />
              )}
            />
            <Line
              type="monotone"
              dataKey="avgVisitPct"
              name="Team Avg Visit %"
              stroke={consolidatedTrendColor}
              strokeWidth={2.5}
              dot={{ r: 4, fill: consolidatedTrendColor }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Legend note */}
      {viewMode === "individual" && mrNames.length > 0 && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            Improving trend
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            Declining trend
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
            Stable
          </span>
        </div>
      )}
    </div>
  );
}
