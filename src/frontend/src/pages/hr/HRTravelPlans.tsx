/**
 * HRTravelPlans.tsx — Monthly Tour Program (MTP) view for HR portal.
 * Shows all submitted MTP plans across employees with month/year filter.
 * Extended to show Planned Area, Ex-Station, and Activity Notes from encoded notes field.
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
import { CalendarRange, CheckCircle, Route, XCircle } from "lucide-react";
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

// ── MTP decode (mirrors MRTravelPlan encoding) ─────────────────────────────────
interface MtpFields {
  area: string;
  exStation: string;
  typeOfWork: string;
  activityNotes: string;
}

function decodeMtpNotes(raw: string): MtpFields {
  if (!raw)
    return { area: "", exStation: "", typeOfWork: "", activityNotes: raw };
  // 4-field format: [MTP|area=...|exstation=...|tow=...|notes=...]
  const match4 = raw.match(
    /^\[MTP\|area=([^|]*)\|exstation=([^|]*)\|tow=([^|]*)\|notes=(.*)\]$/s,
  );
  if (match4)
    return {
      area: match4[1],
      exStation: match4[2],
      typeOfWork: match4[3],
      activityNotes: match4[4],
    };
  // 3-field legacy format: [MTP|area=...|exstation=...|notes=...]
  const match3 = raw.match(
    /^\[MTP\|area=([^|]*)\|exstation=([^|]*)\|notes=(.*)\]$/s,
  );
  if (match3)
    return {
      area: match3[1],
      exStation: match3[2],
      typeOfWork: "",
      activityNotes: match3[3],
    };
  return { area: "", exStation: "", typeOfWork: "", activityNotes: raw };
}

// ── Status badge ───────────────────────────────────────────────────────────────
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

export default function HRTravelPlans() {
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
      // Submit marks plan as approved-by-manager (Submitted = locked & approved in Phase 1 scaffold)
      // Phase 2 will add dedicated approve/reject API calls
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
    { key: "station", label: "Planned Station" },
    { key: "exstation", label: "Ex-Station" },
    { key: "notes", label: "Activity Notes" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
  ];

  const pendingCount = plans.filter(
    (p) => p.status === TravelPlanStatus.Draft,
  ).length;

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="Monthly Tour Program (MTP)"
        subtitle="Review and approve employee Monthly Tour Programs"
      />
      <PageContent>
        {/* Info banner */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20 text-primary text-sm mb-4">
          <CalendarRange className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-body leading-snug">
            <strong>Phase 1 scaffold:</strong> Full MTP approval workflow
            (Approved/Rejected status) comes in Phase 2. Currently, clicking
            Approve marks the plan as Submitted (locked).
          </p>
        </div>

        {/* Summary badge */}
        {pendingCount > 0 && (
          <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-xs font-semibold">
            <Route className="w-3.5 h-3.5" />
            {pendingCount} draft plan{pendingCount !== 1 ? "s" : ""} awaiting
            submission
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
                  {p.plannedStation || (
                    <span className="text-muted-foreground">—</span>
                  )}
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
