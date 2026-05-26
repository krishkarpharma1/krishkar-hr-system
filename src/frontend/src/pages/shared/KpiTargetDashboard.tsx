import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  RefreshCw,
  Stethoscope,
  Target,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import ScrollableTable from "../../components/ScrollableTable";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { UserInfo } from "../../types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface KpiSummary {
  target: {
    doctorCallTarget: number;
    chemistTarget: number;
    stockistTarget: number;
    newDoctorsTarget: number;
  } | null;
  doctorCalls: number;
  chemistVisits: number;
  stockistVisits: number;
  newDoctors: number;
  doctorCallPct: number;
  chemistPct: number;
  stockistPct: number;
  newDoctorsPct: number;
}

interface MrKpiRow {
  mr: UserInfo;
  kpi: KpiSummary | null;
  loading: boolean;
}

interface SetTargetForm {
  doctorCallTarget: string;
  chemistTarget: string;
  stockistTarget: string;
  newDoctorsTarget: string;
}

interface KpiTargetDashboardProps {
  portalRole?: Role;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function achievementColor(pct: number, hasTarget: boolean): string {
  if (!hasTarget) return "text-muted-foreground";
  if (pct >= 80) return "text-emerald-700";
  if (pct >= 50) return "text-amber-600";
  return "text-red-600";
}

function achievementBg(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

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

// ── KPI Card (MR self-view) ───────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  actual: number;
  target: number;
  pct: number;
  loading: boolean;
}

function KpiCard({
  label,
  icon: Icon,
  actual,
  target,
  pct,
  loading,
}: KpiCardProps) {
  const hasTarget = target > 0;
  const displayPct = hasTarget ? Math.min(pct, 100) : 0;

  return (
    <div
      className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3"
      data-ocid={`kpi-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <span className="text-xs font-display uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </span>
      </div>

      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <>
          <div className="flex items-end justify-between gap-2">
            <div>
              <span className="text-2xl font-display font-bold text-foreground tabular-nums">
                {actual}
              </span>
              <span className="text-sm text-muted-foreground ml-1">
                / {hasTarget ? target : "—"}
              </span>
            </div>
            {hasTarget ? (
              <span
                className={`text-sm font-bold tabular-nums ${achievementColor(pct, hasTarget)}`}
              >
                {pct.toFixed(0)}%
              </span>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                No target
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${hasTarget ? achievementBg(pct) : "bg-muted-foreground/30"}`}
              style={{ width: `${hasTarget ? displayPct : 0}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function KpiTargetDashboard({
  portalRole,
}: KpiTargetDashboardProps) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const userId = session?.userId ?? BigInt(0);
  const effectiveRole =
    portalRole ?? (session?.role as Role | undefined) ?? Role.MR;
  const isManager = [
    Role.ASM,
    Role.RSM,
    Role.ZSM,
    Role.HRManager,
    Role.Admin,
  ].includes(effectiveRole);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  // MR self-view state
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [loadingKpi, setLoadingKpi] = useState(false);

  // Manager view state
  const [mrKpiRows, setMrKpiRows] = useState<MrKpiRow[]>([]);
  const [loadingMrs, setLoadingMrs] = useState(false);

  // Set target modal
  const [targetMr, setTargetMr] = useState<UserInfo | null>(null);
  const [targetForm, setTargetForm] = useState<SetTargetForm>({
    doctorCallTarget: "",
    chemistTarget: "",
    stockistTarget: "",
    newDoctorsTarget: "",
  });
  const [savingTarget, setSavingTarget] = useState(false);

  const yearOptions = [
    now.getFullYear() - 1,
    now.getFullYear(),
    now.getFullYear() + 1,
  ];

  // MR: fetch own KPI summary
  useEffect(() => {
    if (!token || isManager) return;
    setLoadingKpi(true);
    const rawApi = api as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    if (typeof rawApi.getMRKpiSummary !== "function") {
      setLoadingKpi(false);
      return;
    }
    rawApi
      .getMRKpiSummary(token, userId, BigInt(month), BigInt(year))
      .then((res) => setKpi(res as KpiSummary))
      .catch(() => toast.error("Failed to load KPI data"))
      .finally(() => setLoadingKpi(false));
  }, [token, userId, month, year, isManager]);

  // Manager: fetch reportees + their KPIs
  useEffect(() => {
    if (!token || !isManager) return;
    setLoadingMrs(true);
    api
      .listReportees(token, userId)
      .then((reps) => {
        setMrKpiRows(reps.map((mr) => ({ mr, kpi: null, loading: true })));
        // Fetch each MR's KPI
        const rawApi = api as unknown as Record<
          string,
          (...args: unknown[]) => Promise<unknown>
        >;
        if (typeof rawApi.getMRKpiSummary !== "function") {
          setMrKpiRows(reps.map((mr) => ({ mr, kpi: null, loading: false })));
          return;
        }
        Promise.all(
          reps.map((mr) =>
            rawApi
              .getMRKpiSummary(token, mr.id, BigInt(month), BigInt(year))
              .then((res) => ({ mr, kpi: res as KpiSummary, loading: false }))
              .catch(() => ({ mr, kpi: null, loading: false })),
          ),
        ).then((rows) => setMrKpiRows(rows));
      })
      .catch(() => toast.error("Failed to load team KPIs"))
      .finally(() => setLoadingMrs(false));
  }, [token, userId, month, year, isManager]);

  function openSetTarget(mr: UserInfo) {
    const existing = mrKpiRows.find((r) => r.mr.id === mr.id)?.kpi?.target;
    setTargetForm({
      doctorCallTarget: existing ? String(existing.doctorCallTarget) : "",
      chemistTarget: existing ? String(existing.chemistTarget) : "",
      stockistTarget: existing ? String(existing.stockistTarget) : "",
      newDoctorsTarget: existing ? String(existing.newDoctorsTarget) : "",
    });
    setTargetMr(mr);
  }

  async function handleSaveTarget() {
    if (!targetMr) return;
    const doctorCallTarget = Number.parseInt(targetForm.doctorCallTarget) || 0;
    const chemistTarget = Number.parseInt(targetForm.chemistTarget) || 0;
    const stockistTarget = Number.parseInt(targetForm.stockistTarget) || 0;
    const newDoctorsTarget = Number.parseInt(targetForm.newDoctorsTarget) || 0;

    setSavingTarget(true);
    try {
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (
        typeof rawApi.setMonthlyKpiTarget !== "function" &&
        typeof rawApi.setMonthlyTarget !== "function"
      ) {
        toast.error("Set target feature not available yet");
        return;
      }
      // Try setMonthlyKpiTarget first, fall back to setMonthlyTarget
      const fn =
        typeof rawApi.setMonthlyKpiTarget === "function"
          ? rawApi.setMonthlyKpiTarget
          : rawApi.setMonthlyTarget;

      const result = await fn(token, {
        mrId: targetMr.id,
        userId: targetMr.id,
        month: BigInt(month),
        year: BigInt(year),
        doctorCallTarget: BigInt(doctorCallTarget),
        chemistTarget: BigInt(chemistTarget),
        stockistTarget: BigInt(stockistTarget),
        newDoctorsTarget: BigInt(newDoctorsTarget),
      });
      const res = result as { __kind__?: string; err?: string } | null;
      if (
        res &&
        typeof res === "object" &&
        "__kind__" in res &&
        res.__kind__ === "err"
      ) {
        toast.error(res.err ?? "Failed to save target");
        return;
      }
      toast.success(`Target saved for ${targetMr.name}`);
      setTargetMr(null);
      // Refresh KPIs
      const fetchFn = rawApi.getMRKpiSummary as (
        ...args: unknown[]
      ) => Promise<unknown>;
      if (typeof fetchFn === "function") {
        fetchFn(token, targetMr.id, BigInt(month), BigInt(year))
          .then((res) => {
            setMrKpiRows((prev) =>
              prev.map((row) =>
                row.mr.id === targetMr.id
                  ? { ...row, kpi: res as KpiSummary, loading: false }
                  : row,
              ),
            );
          })
          .catch(() => {});
      }
    } catch {
      toast.error("Failed to save target");
    } finally {
      setSavingTarget(false);
    }
  }

  function pctCell(actual: number, target: number, pct: number) {
    const hasTarget = target > 0;
    return (
      <div className="text-right">
        <span
          className={`font-mono text-sm font-semibold tabular-nums ${achievementColor(pct, hasTarget)}`}
        >
          {actual}
          <span className="font-normal text-muted-foreground text-xs">
            {" "}
            / {hasTarget ? target : "—"}
          </span>
        </span>
        {hasTarget && (
          <div className="text-xs text-muted-foreground">{pct.toFixed(0)}%</div>
        )}
      </div>
    );
  }

  return (
    <PortalLayout portalRole={effectiveRole}>
      <PageHeader
        title={isManager ? "Team KPIs" : "My KPIs"}
        subtitle={
          isManager
            ? "Monthly KPI performance for your team"
            : "Your SFA KPI achievement for the selected month"
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-8 text-sm rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring"
              data-ocid="kpi.month_select"
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
            >
              <SelectTrigger
                className="w-24 h-8 text-sm"
                data-ocid="kpi.year_select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      <PageContent>
        {/* ── MR: 4 KPI Cards ── */}
        {!isManager && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Doctor Calls"
                icon={Stethoscope}
                actual={kpi?.doctorCalls ?? 0}
                target={kpi?.target?.doctorCallTarget ?? 0}
                pct={kpi?.doctorCallPct ?? 0}
                loading={loadingKpi}
              />
              <KpiCard
                label="Chemist Visits"
                icon={Target}
                actual={kpi?.chemistVisits ?? 0}
                target={kpi?.target?.chemistTarget ?? 0}
                pct={kpi?.chemistPct ?? 0}
                loading={loadingKpi}
              />
              <KpiCard
                label="Stockist Visits"
                icon={TrendingUp}
                actual={kpi?.stockistVisits ?? 0}
                target={kpi?.target?.stockistTarget ?? 0}
                pct={kpi?.stockistPct ?? 0}
                loading={loadingKpi}
              />
              <KpiCard
                label="New Doctors"
                icon={Stethoscope}
                actual={kpi?.newDoctors ?? 0}
                target={kpi?.target?.newDoctorsTarget ?? 0}
                pct={kpi?.newDoctorsPct ?? 0}
                loading={loadingKpi}
              />
            </div>

            {!loadingKpi && kpi === null && (
              <div
                className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3"
                data-ocid="kpi.empty_state"
              >
                <Target className="w-10 h-10 opacity-30" />
                <p className="text-sm font-medium">
                  No KPI data for this period
                </p>
                <p className="text-xs text-center max-w-xs">
                  KPI targets are set by your manager. Contact your ASM or Admin
                  to set targets for this month.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Manager: Team KPI Table ── */}
        {isManager && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                MR-Wise KPI — {MONTHS[month - 1]} {year}
              </h2>
              {loadingMrs && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <ScrollableTable>
              <table className="w-full text-sm font-body min-w-[860px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    {[
                      { label: "MR Name", align: "left" },
                      { label: "Doctor Calls", align: "right" },
                      { label: "Chemist Visits", align: "right" },
                      { label: "Stockist Visits", align: "right" },
                      { label: "New Doctors", align: "right" },
                      { label: "Actions", align: "center" },
                    ].map((col) => (
                      <th
                        key={col.label}
                        className={`px-4 py-2.5 text-xs uppercase tracking-wider font-display text-muted-foreground whitespace-nowrap text-${col.align}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingMrs ? (
                    [0, 1, 2, 3].map((i) => (
                      <tr
                        key={i}
                        className="border-b border-border last:border-0"
                      >
                        {[0, 1, 2, 3, 4, 5].map((j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : mrKpiRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-muted-foreground text-sm"
                        data-ocid="kpi-team.empty_state"
                      >
                        No MRs found under your team.
                      </td>
                    </tr>
                  ) : (
                    mrKpiRows.map(
                      ({ mr, kpi: mrKpi, loading: rowLoading }, idx) => (
                        <tr
                          key={String(mr.id)}
                          className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                          data-ocid={`kpi-team.item.${idx + 1}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-medium text-foreground text-sm">
                                  {mr.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {mr.territory || mr.employeeId || "—"}
                                </p>
                              </div>
                            </div>
                          </td>
                          {rowLoading ? (
                            [0, 1, 2, 3].map((j) => (
                              <td key={j} className="px-4 py-3 text-right">
                                <Skeleton className="h-4 w-16 ml-auto" />
                              </td>
                            ))
                          ) : mrKpi ? (
                            <>
                              <td className="px-4 py-3">
                                {pctCell(
                                  mrKpi.doctorCalls,
                                  mrKpi.target?.doctorCallTarget ?? 0,
                                  mrKpi.doctorCallPct,
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {pctCell(
                                  mrKpi.chemistVisits,
                                  mrKpi.target?.chemistTarget ?? 0,
                                  mrKpi.chemistPct,
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {pctCell(
                                  mrKpi.stockistVisits,
                                  mrKpi.target?.stockistTarget ?? 0,
                                  mrKpi.stockistPct,
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {pctCell(
                                  mrKpi.newDoctors,
                                  mrKpi.target?.newDoctorsTarget ?? 0,
                                  mrKpi.newDoctorsPct,
                                )}
                              </td>
                            </>
                          ) : (
                            [0, 1, 2, 3].map((j) => (
                              <td key={j} className="px-4 py-3 text-right">
                                <span className="text-muted-foreground text-xs">
                                  —
                                </span>
                              </td>
                            ))
                          )}
                          <td className="px-4 py-3 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => openSetTarget(mr)}
                              data-ocid={`kpi-team.set_target.${idx + 1}`}
                            >
                              Set Target
                            </Button>
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        )}
      </PageContent>

      {/* Set Target Modal */}
      <Dialog
        open={targetMr !== null}
        onOpenChange={(open) => !open && setTargetMr(null)}
      >
        <DialogContent data-ocid="kpi-set-target.dialog">
          <DialogHeader>
            <DialogTitle>Set Monthly KPI Target — {targetMr?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            {MONTHS[month - 1]} {year}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="target-doctor-calls">Doctor Calls Target</Label>
              <Input
                id="target-doctor-calls"
                type="number"
                min={0}
                placeholder="e.g. 120"
                value={targetForm.doctorCallTarget}
                onChange={(e) =>
                  setTargetForm((f) => ({
                    ...f,
                    doctorCallTarget: e.target.value,
                  }))
                }
                data-ocid="kpi-set-target.doctor_calls_input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-chemist">Chemist Visits Target</Label>
              <Input
                id="target-chemist"
                type="number"
                min={0}
                placeholder="e.g. 30"
                value={targetForm.chemistTarget}
                onChange={(e) =>
                  setTargetForm((f) => ({
                    ...f,
                    chemistTarget: e.target.value,
                  }))
                }
                data-ocid="kpi-set-target.chemist_input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-stockist">Stockist Visits Target</Label>
              <Input
                id="target-stockist"
                type="number"
                min={0}
                placeholder="e.g. 15"
                value={targetForm.stockistTarget}
                onChange={(e) =>
                  setTargetForm((f) => ({
                    ...f,
                    stockistTarget: e.target.value,
                  }))
                }
                data-ocid="kpi-set-target.stockist_input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-new-doctors">New Doctors Target</Label>
              <Input
                id="target-new-doctors"
                type="number"
                min={0}
                placeholder="e.g. 5"
                value={targetForm.newDoctorsTarget}
                onChange={(e) =>
                  setTargetForm((f) => ({
                    ...f,
                    newDoctorsTarget: e.target.value,
                  }))
                }
                data-ocid="kpi-set-target.new_doctors_input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setTargetMr(null)}
              data-ocid="kpi-set-target.cancel_button"
              disabled={savingTarget}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTarget}
              disabled={savingTarget}
              data-ocid="kpi-set-target.save_button"
            >
              {savingTarget ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Target"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
