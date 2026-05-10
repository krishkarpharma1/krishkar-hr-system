import { Badge } from "@/components/ui/badge";
import { BarChart2, Clock, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
  StatCard,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { MrMonthlySummary, UserInfo } from "../../types";

export default function ASMPerformance() {
  const { session } = useAuthStore();
  const [summaries, setSummaries] = useState<MrMonthlySummary[]>([]);
  const [reportees, setReportees] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const token = session?.token ?? "";
  const userId = session?.userId ?? BigInt(0);
  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      api.listAllMrSummaries(currentMonth),
      api.listReportees(token, userId),
    ])
      .then(([sums, reps]) => {
        setSummaries(sums);
        setReportees(reps);
      })
      .finally(() => setLoading(false));
  }, [token, userId, currentMonth]);

  const chartData = summaries.map((s) => {
    const mr = reportees.find((r) => r.id === s.mrId);
    return {
      name: mr?.name?.split(" ")[0] ?? `MR#${s.mrId}`,
      calls: Number(s.totalCalls),
      doctors: Number(s.uniqueDoctors),
      orders: Number(s.totalOrders),
    };
  });

  const totalCalls = summaries.reduce(
    (sum, s) => sum + Number(s.totalCalls),
    0,
  );
  const totalDoctors = summaries.reduce(
    (sum, s) => sum + Number(s.uniqueDoctors),
    0,
  );
  const totalOrders = summaries.reduce(
    (sum, s) => sum + Number(s.totalOrders),
    0,
  );

  return (
    <PortalLayout portalRole={Role.ASM}>
      <PageHeader
        title="Area Performance"
        subtitle={`MR performance summary for ${currentMonth}`}
      />
      <PageContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="MRs Tracked"
            value={loading ? "…" : summaries.length}
            icon={Users}
          />
          <StatCard
            label="Total Calls"
            value={loading ? "…" : totalCalls}
            icon={BarChart2}
          />
          <StatCard
            label="Doctors Visited"
            value={loading ? "…" : totalDoctors}
            icon={Users}
          />
          <StatCard
            label="Chemist Orders"
            value={loading ? "…" : totalOrders}
            icon={BarChart2}
          />
        </div>

        <div className="bg-card border border-border rounded-lg p-4 mb-4">
          <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4" /> MR Performance — {currentMonth}
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="calls"
                  name="Total Calls"
                  fill="var(--chart-1)"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="doctors"
                  name="Doctors Visited"
                  fill="var(--chart-3)"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="orders"
                  name="Chemist Orders"
                  fill="var(--chart-2)"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm gap-2">
              <Clock className="w-8 h-8 opacity-40" />
              <p>No performance data available for {currentMonth}</p>
            </div>
          )}
        </div>

        {/* MR detail table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-display font-semibold text-sm text-foreground">
              MR-wise Breakdown
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    MR
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Calls
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Doctors
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Orders
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summaries.map((s) => {
                  const mr = reportees.find((r) => r.id === s.mrId);
                  return (
                    <tr key={String(s.mrId)} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {mr?.name ?? `MR #${s.mrId}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {mr?.employeeId ?? ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {String(s.totalCalls)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {String(s.uniqueDoctors)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {String(s.totalOrders)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge
                          variant={
                            Number(s.totalCalls) > 0 ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {Number(s.totalCalls) > 0 ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {summaries.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground text-sm"
                    >
                      No performance data for {currentMonth}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageContent>
    </PortalLayout>
  );
}
