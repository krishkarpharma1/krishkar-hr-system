/**
 * RSMTravelPlans.tsx — Monthly Tour Program (MTP) view for RSM portal.
 * Shows all submitted MTP plans for MRs under RSM's hierarchy.
 * Approve/Reject scaffold — full workflow in Phase 2.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarRange, CheckCircle, Route } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role, TravelPlanStatus } from "../../backend";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useEmployeeNames } from "../../lib/nameResolver";
import {
  handleResultError,
  handleSessionError,
} from "../../lib/sessionErrorHandler";
import { useAuthStore } from "../../store/authStore";
import type { TravelPlanInfo } from "../../types";

interface MtpFields {
  area: string;
  exStation: string;
  activityNotes: string;
}

function decodeMtpNotes(raw: string): MtpFields {
  const match = raw.match(
    /^\[MTP\|area=([^|]*)\|exstation=([^|]*)\|notes=(.*)\]$/s,
  );
  if (match)
    return { area: match[1], exStation: match[2], activityNotes: match[3] };
  return { area: "", exStation: "", activityNotes: raw };
}

const STATUS_VARIANT: Record<
  TravelPlanStatus,
  "default" | "secondary" | "outline"
> = {
  [TravelPlanStatus.Draft]: "secondary",
  [TravelPlanStatus.Submitted]: "default",
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const YEARS = Array.from({ length: 3 }, (_, i) =>
  String(new Date().getFullYear() + 1 - i),
);

export default function RSMTravelPlans() {
  const { session } = useAuthStore();
  const [plans, setPlans] = useState<TravelPlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [approvingId, setApprovingId] = useState<bigint | null>(null);
  const { getEmployeeName } = useEmployeeNames();

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      // RSM can see all travel plans for their region — use null userId to get all
      const data = await api.listAllTravelPlans(session.token, null, monthStr);
      setPlans(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [session, monthStr]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(plan: TravelPlanInfo) {
    if (!session) return;
    setApprovingId(plan.id);
    try {
      // Phase 1: Approve = mark as Submitted (locked)
      const res = await api.submitTravelPlan(session.token, plan.id);
      if (res.__kind__ === "err") {
        handleResultError(res.err, toast.error, "Failed to approve MTP");
        return;
      }
      toast.success(`MTP approved for ${getEmployeeName(plan.userId)}`);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleSessionError(msg, () => toast.error("Failed to approve MTP."));
    } finally {
      setApprovingId(null);
    }
  }

  const cols = [
    { key: "employee", label: "Employee" },
    { key: "date", label: "Date" },
    { key: "area", label: "Planned Area" },
    { key: "station", label: "Station" },
    { key: "exstation", label: "Ex-Station" },
    { key: "notes", label: "Activity Notes" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
  ];

  const draftCount = plans.filter(
    (p) => p.status === TravelPlanStatus.Draft,
  ).length;

  return (
    <PortalLayout portalRole={Role.RSM}>
      <PageHeader
        title="Monthly Tour Program (MTP)"
        subtitle="Review and approve MTP submissions from your team"
      />
      <PageContent>
        {/* Info banner */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20 text-primary text-sm mb-4">
          <CalendarRange className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-body leading-snug">
            <strong>Phase 1 scaffold:</strong> Full MTP approval workflow with
            Approved/Rejected status tracking comes in Phase 2. Currently,
            Approve marks the plan as Submitted (locked from editing).
          </p>
        </div>

        {draftCount > 0 && (
          <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-xs font-semibold">
            <Route className="w-3.5 h-3.5" />
            {draftCount} draft plan{draftCount !== 1 ? "s" : ""} pending review
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Route className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
            Period:
          </span>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger
              className="h-8 text-xs w-[110px]"
              data-ocid="mtp-filter-month"
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
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger
              className="h-8 text-xs w-[90px]"
              data-ocid="mtp-filter-year"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground font-body ml-2">
            {plans.length} plan{plans.length !== 1 ? "s" : ""} found
          </span>
        </div>

        <DataTable
          columns={cols}
          data={plans}
          getKey={(p) => String(p.id)}
          loading={loading}
          emptyMessage="No MTP entries for this period"
          renderRow={(p, idx) => {
            const mtp = decodeMtpNotes(p.notes);
            return (
              <>
                <td
                  className="px-4 py-3 text-sm font-body text-foreground"
                  data-ocid={`mtp.item.${idx + 1}`}
                >
                  {getEmployeeName(p.userId)}
                </td>
                <td className="px-4 py-3 text-sm font-body text-foreground font-mono whitespace-nowrap">
                  {p.date}
                </td>
                <td className="px-4 py-3 text-sm font-body text-foreground">
                  {mtp.area || <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-sm font-body text-foreground">
                  {p.plannedStation}
                </td>
                <td className="px-4 py-3 text-sm font-body text-foreground">
                  {mtp.exStation || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">
                  {mtp.activityNotes || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[p.status]} className="text-xs">
                    {p.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {p.status === TravelPlanStatus.Draft ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 gap-1 text-xs border-green-300 text-green-700 hover:bg-green-50"
                      onClick={() => handleApprove(p)}
                      disabled={approvingId === p.id}
                      data-ocid={`mtp.confirm_button.${idx + 1}`}
                    >
                      <CheckCircle className="w-3 h-3" />
                      Approve
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Submitted
                    </span>
                  )}
                </td>
              </>
            );
          }}
        />
      </PageContent>
    </PortalLayout>
  );
}
