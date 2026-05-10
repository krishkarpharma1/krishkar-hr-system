import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DataTable } from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { SalesDashboardSummary, SalesTrackingData } from "../../types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color =
    clamped >= 80
      ? "bg-accent"
      : clamped >= 50
        ? "bg-primary"
        : "bg-yellow-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-2 min-w-0">
        <div
          className={`h-2 rounded-full ${color} transition-all`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs font-mono text-foreground tabular-nums w-10 text-right">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function SalesDashboard() {
  const { session } = useAuthStore();
  const token = session?.token ?? "";

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<SalesDashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const currentDay = new Date().getDate();
    api
      .getMySalesDashboard(
        token,
        BigInt(month),
        BigInt(year),
        BigInt(currentDay),
      )
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [token, month, year]);

  const breakdown = summary?.doctorBreakdown ?? [];
  const filtered = breakdown.filter(
    (d) => !search || d.doctorName.toLowerCase().includes(search.toLowerCase()),
  );

  const chartData = filtered.slice(0, 10).map((d) => ({
    name:
      d.doctorName.length > 14 ? `${d.doctorName.slice(0, 14)}…` : d.doctorName,
    actualSales: d.actualSales,
    crmSpent: d.crmSpent,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Sales Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            Track actual sales, CRM spend, and projected targets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(month)}
            onValueChange={(v) => setMonth(Number(v))}
          >
            <SelectTrigger
              className="w-36 h-8 text-xs"
              data-ocid="select-dash-month"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            className="w-24 h-8 text-xs"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={2020}
            max={2099}
            data-ocid="input-dash-year"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-display">
            Total Actual Sales
          </p>
          <p className="text-2xl font-display font-bold text-foreground mt-1">
            {loading
              ? "…"
              : `₹${(summary?.totalActualSales ?? 0).toLocaleString("en-IN")}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {MONTHS[month - 1]} {year}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-display">
            Total CRM Spent
          </p>
          <p className="text-2xl font-display font-bold text-foreground mt-1">
            {loading
              ? "…"
              : `₹${(summary?.totalCrmSpent ?? 0).toLocaleString("en-IN")}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Approved requests
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-display">
            Overall Progress
          </p>
          <p className="text-2xl font-display font-bold text-foreground mt-1">
            {loading
              ? "…"
              : `${(summary?.overallProgressPercent ?? 0).toFixed(1)}%`}
          </p>
          <ProgressBar pct={summary?.overallProgressPercent ?? 0} />
        </div>
      </div>

      {/* Sales Chart */}
      {chartData.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
            Doctor-wise Sales vs CRM Spend (Top 10)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: 12,
                }}
                formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
              />
              <Bar
                dataKey="actualSales"
                name="Actual Sales"
                fill="var(--chart-1)"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="crmSpent"
                name="CRM Spent"
                fill="var(--chart-3)"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Doctor Breakdown Table */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Doctor Breakdown
          </h3>
          <Input
            className="w-48 h-8 text-xs"
            placeholder="Search doctor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-ocid="input-doctor-search"
          />
        </div>
        <DataTable<SalesTrackingData>
          columns={[
            { key: "doctor", label: "Doctor" },
            {
              key: "actual",
              label: "Actual Sales (₹)",
              className: "text-right",
            },
            { key: "crm", label: "CRM Spent (₹)", className: "text-right" },
            { key: "progress", label: "Progress" },
            {
              key: "projected",
              label: "Projected Target",
              className: "text-right",
            },
          ]}
          data={filtered}
          getKey={(item) => String(item.doctorId)}
          loading={loading}
          emptyMessage="No sales data for the selected period"
          renderRow={(d) => (
            <>
              <td className="px-4 py-3 text-sm font-medium text-foreground">
                {d.doctorName}
              </td>
              <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-foreground">
                ₹{d.actualSales.toLocaleString("en-IN")}
              </td>
              <td className="px-4 py-3 text-sm text-right font-mono text-foreground">
                ₹{d.crmSpent.toLocaleString("en-IN")}
              </td>
              <td className="px-4 py-3 min-w-[140px]">
                <ProgressBar pct={d.salesProgressPercent} />
              </td>
              <td className="px-4 py-3 text-sm text-right font-mono text-muted-foreground">
                <span className="flex items-center justify-end gap-1">
                  ₹{d.projectedEndTarget.toLocaleString("en-IN")}
                  <span
                    title="(current sales ÷ current day) × days in month"
                    className="cursor-help"
                  >
                    <Info className="w-3 h-3 text-muted-foreground/50" />
                  </span>
                </span>
              </td>
            </>
          )}
        />
      </div>
    </div>
  );
}
