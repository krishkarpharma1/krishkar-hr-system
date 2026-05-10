import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useParams } from "@tanstack/react-router";
import { Calendar, RefreshCw, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { Role } from "../../backend";
import { DataTable } from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { TravelPlanInfo, UserInfo } from "../../types";

interface Props {
  chargeRole?: Role;
  chargeId?: string;
  effectiveTo?: bigint;
}

export default function AdditionalRoleTab({
  chargeRole: propRole,
  effectiveTo,
}: Props) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const routeParams = useParams({ strict: false }) as Record<string, string>;
  const chargeRole = propRole ?? (routeParams.chargeRole as Role | undefined);
  const [reportees, setReportees] = useState<UserInfo[]>([]);
  const [travelPlans, setTravelPlans] = useState<TravelPlanInfo[]>([]);
  const [tpUserMap, setTpUserMap] = useState<Map<bigint, UserInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<"team" | "travel-plans">("team");
  const currentMonth = new Date().toISOString().slice(0, 7);
  const expiryMs = effectiveTo ? Number(effectiveTo) / 1_000_000 : null;
  const expiryStr = expiryMs
    ? new Date(expiryMs).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;
  const isExpiringSoon = expiryMs
    ? expiryMs - Date.now() < 7 * 24 * 60 * 60 * 1000
    : false;

  useEffect(() => {
    if (!token || !session?.userId) return;
    setLoading(true);
    api
      .listReportees(token, session.userId)
      .then(setReportees)
      .finally(() => setLoading(false));
  }, [token, session?.userId]);

  useEffect(() => {
    if (!token || activeView !== "travel-plans") return;
    Promise.all([
      api.listAllTravelPlans(token, null, currentMonth),
      api.listAllUsers(token),
    ]).then(([plans, users]) => {
      setTravelPlans(plans);
      setTpUserMap(new Map(users.map((u) => [u.id, u])));
    });
  }, [token, activeView, currentMonth]);

  function refresh() {
    if (!session?.userId) return;
    setLoading(true);
    api
      .listReportees(token, session.userId)
      .then(setReportees)
      .finally(() => setLoading(false));
  }

  return (
    <div
      className="border border-border rounded-lg overflow-hidden bg-card"
      data-ocid={`additional-role-tab-${String(chargeRole ?? "unknown")}`}
    >
      <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Acting as{" "}
              <Badge variant="secondary" className="ml-1 font-mono text-xs">
                {chargeRole ?? "—"}
              </Badge>
            </p>
            {expiryStr && (
              <p
                className={`text-xs ${isExpiringSoon ? "text-yellow-600 font-medium" : "text-muted-foreground"}`}
              >
                {isExpiringSoon ? "⚠ Expiring soon — " : ""}Until {expiryStr}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={refresh}
          className="h-7 px-2 text-xs"
          data-ocid="btn-refresh-charge"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
      </div>
      <div className="flex border-b border-border bg-card">
        <button
          type="button"
          onClick={() => setActiveView("team")}
          onKeyDown={(e) => e.key === "Enter" && setActiveView("team")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeView === "team" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          data-ocid="tab-charge-team"
        >
          <Users className="w-3.5 h-3.5" /> Team Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveView("travel-plans")}
          onKeyDown={(e) => e.key === "Enter" && setActiveView("travel-plans")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeView === "travel-plans" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          data-ocid="tab-charge-tp"
        >
          <Calendar className="w-3.5 h-3.5" /> Travel Plans
        </button>
      </div>
      <div className="p-4">
        {activeView === "team" && (
          <DataTable<UserInfo>
            columns={[
              { key: "name", label: "Name" },
              { key: "empId", label: "Emp ID" },
              { key: "role", label: "Role" },
              { key: "territory", label: "Territory" },
              { key: "status", label: "Status" },
            ]}
            data={reportees}
            getKey={(item) => String(item.id)}
            loading={loading}
            emptyMessage="No team members found under additional charge"
            renderRow={(user) => (
              <>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground text-sm">
                    {user.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.designation}
                  </p>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                  {user.employeeId}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="text-xs">
                    {user.role}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {user.territory || "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={user.status === "Active" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {user.status}
                  </Badge>
                </td>
              </>
            )}
          />
        )}
        {activeView === "travel-plans" && (
          <DataTable<TravelPlanInfo>
            columns={[
              { key: "employee", label: "Employee" },
              { key: "date", label: "Date" },
              { key: "station", label: "Planned Station" },
              { key: "status", label: "Status" },
              { key: "notes", label: "Notes" },
            ]}
            data={travelPlans}
            getKey={(item) => String(item.id)}
            emptyMessage="No travel plans submitted for this month"
            renderRow={(tp) => (
              <>
                <td className="px-4 py-3 text-sm text-foreground">
                  {tpUserMap.get(tp.userId)?.name ?? String(tp.userId)}
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{tp.date}</td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {tp.plannedStation}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-xs">
                    {tp.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[200px]">
                  {tp.notes || "—"}
                </td>
              </>
            )}
          />
        )}
      </div>
    </div>
  );
}
