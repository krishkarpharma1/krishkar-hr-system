import { Badge } from "@/components/ui/badge";
import { BarChart2, Clock, FileText, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

export default function ZSMReports() {
  const { session } = useAuthStore();
  const [summaries, setSummaries] = useState<MrMonthlySummary[]>([]);
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const token = session?.token ?? "";
  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      api.listAllMrSummaries(currentMonth),
      api.listUsersByRole(token, Role.MR),
    ])
      .then(([sums, mrs]) => {
        setSummaries(sums);
        setAllUsers(mrs);
      })
      .finally(() => setLoading(false));
  }, [token, currentMonth]);

  const zoneData = summaries.reduce<
    Record<string, { calls: number; doctors: number; orders: number }>
  >((acc, s) => {
    const mr = allUsers.find((u) => u.id === s.mrId);
    const zone = mr?.territory || "Unknown";
    if (!acc[zone]) acc[zone] = { calls: 0, doctors: 0, orders: 0 };
    acc[zone].calls += Number(s.totalCalls);
    acc[zone].doctors += Number(s.uniqueDoctors);
    acc[zone].orders += Number(s.totalOrders);
    return acc;
  }, {});

  const zoneChartData = Object.entries(zoneData).map(([zone, v]) => ({
    zone: zone.length > 12 ? `${zone.slice(0, 12)}…` : zone,
    ...v,
  }));

  const mrTrendData = summaries.map((s) => {
    const mr = allUsers.find((u) => u.id === s.mrId);
    return {
      name: mr?.name?.split(" ")[0] ?? `MR#${s.mrId}`,
      calls: Number(s.totalCalls),
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

  return (
    <PortalLayout portalRole={Role.ZSM}>
      <PageHeader
        title="Call Reports"
        subtitle={`Zone-wide call activity summary for ${currentMonth}`}
      />
      <PageContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="MRs Active"
            value={loading ? "…" : summaries.length}
            icon={FileText}
          />
          <StatCard
            label="Total Calls"
            value={loading ? "…" : totalCalls}
            icon={BarChart2}
          />
          <StatCard
            label="Doctors Visited"
            value={loading ? "…" : totalDoctors}
            icon={FileText}
          />
          <StatCard
            label="Zones"
            value={loading ? "…" : Object.keys(zoneData).length}
            icon={TrendingUp}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4" /> Zone Activity — {currentMonth}
            </h3>
            {zoneChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={zoneChartData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="zone"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      fontSize: 11,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="calls"
                    name="Calls"
                    fill="var(--chart-1)"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="doctors"
                    name="Doctors"
                    fill="var(--chart-3)"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="orders"
                    name="Orders"
                    fill="var(--chart-2)"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm gap-2">
                <Clock className="w-8 h-8 opacity-40" />
                <p>No zone data for {currentMonth}</p>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> MR-wise Trend
            </h3>
            {mrTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={mrTrendData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      fontSize: 11,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="calls"
                    name="Calls"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    name="Orders"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm gap-2">
                <Clock className="w-8 h-8 opacity-40" />
                <p>No MR data for {currentMonth}</p>
              </div>
            )}
          </div>
        </div>

        {/* Detail table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-display font-semibold text-sm text-foreground">
              MR-wise Call Summary — {currentMonth}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {[
                    "MR",
                    "Zone",
                    "Territory",
                    "Calls",
                    "Doctors",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summaries.map((s) => {
                  const mr = allUsers.find((u) => u.id === s.mrId);
                  return (
                    <tr key={String(s.mrId)} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {mr?.name ?? `MR #${s.mrId}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {mr?.employeeId}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {mr?.territory || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {mr?.territory || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground">
                        {String(s.totalCalls)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground">
                        {String(s.uniqueDoctors)}
                      </td>
                      <td className="px-4 py-3">
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
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground text-sm"
                    >
                      No report data for {currentMonth}
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
