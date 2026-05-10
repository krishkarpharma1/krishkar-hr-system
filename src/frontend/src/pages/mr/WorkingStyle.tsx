import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ClipboardList,
  Clock,
  Loader2,
  MapPin,
  PlusCircle,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Role, WorkingMode, WorkingStationSource } from "../../backend";
import type { WorkingStationSource__1 } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { groupAreasByHq, useAllottedAreas } from "../../hooks/useAllottedAreas";
import { api } from "../../lib/api";
import {
  dispatchSessionExpired,
  isSessionError,
} from "../../lib/sessionErrorHandler";
import { useAuthStore } from "../../store/authStore";
import type { WorkingStyleRecord } from "../../types";

interface HistoryRow {
  id: string;
  date: string;
  workingMode: string;
  stationSource: string;
  workingWithName?: string;
  otherStationName?: string;
  workingType?: string;
}

interface HigherAuthorityEntry {
  userId: bigint;
  userName: string;
  role: string;
}

const STATION_OPTIONS = [
  { value: "AsPerPlan", label: "As Per Plan" },
  { value: "OtherStation", label: "Other Station" },
];

const WORKING_TYPE_OPTIONS = [
  { value: "Working", label: "Working" },
  { value: "Meeting", label: "Meeting" },
  { value: "Training", label: "Training" },
  { value: "Transit", label: "Transit" },
  { value: "CME_Camp_DoctorMeet", label: "CME / Camp / Doctor Meet" },
  { value: "AdminWork", label: "Admin Work" },
];

function formatDateTs(ts: bigint): string {
  return new Date(Number(ts) / 1_000_000).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function workingModeLabel(mode: string): string {
  return mode === "WorkingWith" ? "With Higher Authority" : "Alone";
}

function stationLabel(src: string, otherName?: string): string {
  if (src === "OtherStation")
    return otherName ? `Other — ${otherName}` : "Other Station";
  return "As Per Plan";
}

function workingTypeLabel(type?: string): string {
  if (!type) return "—";
  const opt = WORKING_TYPE_OPTIONS.find((o) => o.value === type);
  return opt ? opt.label : type;
}

export default function WorkingStyle() {
  const session = useAuthStore((s) => s.session);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [_resubmitting, _setResubmitting] = useState(false);
  const [todayRecord, setTodayRecord] = useState<WorkingStyleRecord | null>(
    null,
  );
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [higherAuthorities, setHigherAuthorities] = useState<
    HigherAuthorityEntry[]
  >([]);

  // Travel plan station for today (pre-populate)
  const [travelPlanStation, setTravelPlanStation] = useState<string>("");

  // Form fields
  const [workingMode, setWorkingMode] = useState<
    "WorkingAlone" | "WorkingWith"
  >("WorkingAlone");
  const [selectedAuthorityId, setSelectedAuthorityId] = useState<string>("");
  const [stationSource, setStationSource] = useState<
    "AsPerPlan" | "OtherStation"
  >("AsPerPlan");
  const [otherStation, setOtherStation] = useState("");
  const [workingType, setWorkingType] = useState<string>("");
  const [additionalStation, setAdditionalStation] = useState<string>("");
  const [showAdditionalStation, setShowAdditionalStation] =
    useState<boolean>(false);

  // Re-submission state removed (V81 rollback)
  const [_showResubmitForm, _setShowResubmitForm] = useState(false);
  const [_resubmitStation, _setResubmitStation] = useState<string>("");

  const todayStr = new Date().toISOString().slice(0, 10);

  const { areas: allottedAreas } = useAllottedAreas();
  const areaGroups = groupAreasByHq(allottedAreas);

  useEffect(() => {
    if (!session) return;
    const load = async () => {
      try {
        const thirtyDaysAgo =
          BigInt(Date.now() - 30 * 24 * 60 * 60 * 1000) * BigInt(1_000_000);
        const nowNs = BigInt(Date.now()) * BigInt(1_000_000);

        const [ws, histRecords, authorities, todayPlans] = await Promise.all([
          api.getTodayWorkingStyle(session.employeeId),
          api.getWorkingStyleHistory(session.employeeId, thirtyDaysAgo, nowNs),
          api.getHigherAuthoritiesForMe(session.token),
          api
            .listMyTravelPlans(
              session.token,
              new Date().toISOString().slice(0, 7),
            )
            .catch(() => []),
        ]);

        // Find today's travel plan station
        const todayTP = (
          todayPlans as { date: string; plannedStation: string }[]
        ).find((p) => p.date === todayStr);
        if (todayTP?.plannedStation) {
          setTravelPlanStation(todayTP.plannedStation);
          setAdditionalStation(todayTP.plannedStation);
        }

        // Today's record
        if (ws) {
          const rec = ws as WorkingStyleRecord;
          const recDate = new Date(Number(rec.date) / 1_000_000)
            .toISOString()
            .slice(0, 10);
          if (recDate === todayStr) {
            setTodayRecord(rec);
          }
        }

        // History
        const rows: HistoryRow[] = (histRecords as WorkingStyleRecord[])
          .map((r) => ({
            id: r.id,
            date: formatDateTs(r.date),
            workingMode: r.workingMode as string,
            stationSource: r.stationSource as string,
            workingWithName: r.workingWithName,
            otherStationName: r.otherStationName,
            workingType: (r as WorkingStyleRecord & { workingType?: string })
              .workingType,
          }))
          .reverse();
        setHistory(rows);

        setHigherAuthorities(
          authorities.map((a) => ({
            userId: a.userId,
            userName: a.userName,
            role: String(a.role),
          })),
        );
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, todayStr]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;

    if (!workingType) {
      toast.error("Please select a Working Type.");
      return;
    }
    if (workingMode === "WorkingWith" && !selectedAuthorityId) {
      toast.error("Please select a higher authority.");
      return;
    }
    if (stationSource === "OtherStation" && !otherStation.trim()) {
      toast.error("Please enter the station name.");
      return;
    }

    setSaving(true);
    try {
      const sessionCheck = await api.whoami(session.token);
      if (!sessionCheck) {
        sessionStorage.setItem(
          "workingStyleDraft",
          JSON.stringify({
            workingMode,
            selectedAuthorityId,
            stationSource,
            otherStation,
            workingType,
            additionalStation: showAdditionalStation ? additionalStation : "",
          }),
        );
        dispatchSessionExpired();
        return;
      }

      const selectedAuthority = higherAuthorities.find(
        (u) => u.userId.toString() === selectedAuthorityId,
      );

      const todayMs = new Date(todayStr).getTime();

      const basePayload = {
        employeeId: session.employeeId,
        date: BigInt(todayMs * 1_000_000),
        workingMode:
          workingMode === "WorkingWith"
            ? WorkingMode.WorkingWith
            : WorkingMode.WorkingAlone,
        stationSource:
          stationSource === "OtherStation"
            ? WorkingStationSource.OtherStation
            : WorkingStationSource.AsPerPlan,
        workingWithUserId:
          workingMode === "WorkingWith" && selectedAuthorityId
            ? selectedAuthorityId
            : undefined,
        otherStationName:
          stationSource === "OtherStation" ? otherStation.trim() : undefined,
      };

      const extendedPayload = {
        ...basePayload,
        workingType: workingType || undefined,
      };

      const result = await api.submitWorkingStyle(
        session.token,
        extendedPayload as unknown as Parameters<
          typeof api.submitWorkingStyle
        >[1],
      );

      if (result.__kind__ === "err") {
        const errMsg = result.err ?? "Failed to submit. Please try again.";
        if (isSessionError(errMsg)) {
          sessionStorage.setItem(
            "workingStyleDraft",
            JSON.stringify({
              workingMode,
              selectedAuthorityId,
              stationSource,
              otherStation,
              workingType,
              additionalStation: showAdditionalStation ? additionalStation : "",
            }),
          );
          dispatchSessionExpired();
        } else {
          toast.error(errMsg);
        }
        return;
      }

      toast.success("Working style submitted successfully!");

      const updated = await api.getTodayWorkingStyle(session.employeeId);
      if (updated) {
        const rec = updated as WorkingStyleRecord;
        setTodayRecord(rec);
        setHistory((prev) => [
          {
            id: rec.id,
            date: formatDateTs(rec.date),
            workingMode: rec.workingMode as string,
            stationSource: rec.stationSource as string,
            workingWithName: rec.workingWithName ?? selectedAuthority?.userName,
            otherStationName: rec.otherStationName,
            workingType,
          },
          ...prev.filter((h) => h.id !== rec.id),
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isSessionError(msg)) {
        sessionStorage.setItem(
          "workingStyleDraft",
          JSON.stringify({
            workingMode,
            selectedAuthorityId,
            stationSource,
            otherStation,
            workingType,
            additionalStation: showAdditionalStation ? additionalStation : "",
          }),
        );
        dispatchSessionExpired();
      } else {
        toast.error("Failed to submit. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalLayout portalRole={Role.MR}>
      <PageHeader
        title="Working Style"
        subtitle="Record your daily working mode and station"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/" })}
            className="gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </Button>
        }
      />

      <PageContent>
        <div className="max-w-lg mx-auto space-y-6">
          {/* ── Today's Status Card ── */}
          {!loading && todayRecord ? (
            <div
              className="bg-card border border-border rounded-xl p-5 space-y-4"
              data-ocid="working-style-submitted-card"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    Working Style Submitted
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You've already submitted your working style for today
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Working Mode
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {workingModeLabel(todayRecord.workingMode as string)}
                  </p>
                  {todayRecord.workingWithName && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      with {todayRecord.workingWithName}
                    </p>
                  )}
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Station</p>
                  <p className="text-sm font-semibold text-foreground">
                    {stationLabel(
                      todayRecord.stationSource as string,
                      todayRecord.otherStationName,
                    )}
                  </p>
                </div>
                {(todayRecord as WorkingStyleRecord & { workingType?: string })
                  .workingType && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      Working Type
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {workingTypeLabel(
                        (
                          todayRecord as WorkingStyleRecord & {
                            workingType?: string;
                          }
                        ).workingType,
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : !loading ? (
            /* ── Entry Form ── */
            <form
              onSubmit={handleSubmit}
              className="bg-card border border-border rounded-xl p-5 space-y-5"
              data-ocid="working-style-form"
            >
              <div className="flex items-center gap-2.5 pb-1">
                <ClipboardList className="w-5 h-5 text-primary" />
                <h3 className="font-display font-semibold text-foreground">
                  Today's Working Style
                </h3>
              </div>

              {/* Travel Plan pre-fill banner */}
              {travelPlanStation && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-primary/20 bg-primary/5 text-primary text-xs">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Travel Plan for today:{" "}
                    <span className="font-semibold">{travelPlanStation}</span>
                  </span>
                </div>
              )}

              {/* Working Type */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Working Type <span className="text-destructive">*</span>
                </Label>
                <Select value={workingType} onValueChange={setWorkingType}>
                  <SelectTrigger data-ocid="working-type-select">
                    <SelectValue placeholder="Select working type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKING_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Working Mode */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Working Mode <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      value: "WorkingAlone",
                      label: "Alone",
                      desc: "Working independently",
                    },
                    {
                      value: "WorkingWith",
                      label: "With",
                      desc: "With higher authority",
                    },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setWorkingMode(
                          opt.value as "WorkingAlone" | "WorkingWith",
                        );
                        if (opt.value === "WorkingAlone")
                          setSelectedAuthorityId("");
                      }}
                      data-ocid={`working-mode-${opt.value.toLowerCase()}`}
                      className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-4 transition-all text-sm font-semibold ${
                        workingMode === opt.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-background text-foreground hover:bg-muted/30"
                      }`}
                    >
                      <Users className="w-5 h-5" />
                      <span>{opt.label}</span>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Higher Authority */}
              {workingMode === "WorkingWith" && (
                <div className="space-y-2" data-ocid="higher-authority-section">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Higher Authority <span className="text-destructive">*</span>
                  </Label>
                  {higherAuthorities.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      No higher authorities found in your hierarchy.
                    </div>
                  ) : (
                    <Select
                      value={selectedAuthorityId}
                      onValueChange={setSelectedAuthorityId}
                    >
                      <SelectTrigger data-ocid="higher-authority-select">
                        <SelectValue placeholder="Select higher authority" />
                      </SelectTrigger>
                      <SelectContent>
                        {higherAuthorities.map((u) => {
                          const uid = u.userId.toString();
                          return (
                            <SelectItem key={uid} value={uid}>
                              {u.userName} — {u.role}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Station */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Station <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={stationSource}
                  onValueChange={(v) => {
                    setStationSource(v as "AsPerPlan" | "OtherStation");
                    if (v === "AsPerPlan") setOtherStation("");
                  }}
                >
                  <SelectTrigger data-ocid="station-source-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {stationSource === "AsPerPlan" && travelPlanStation && (
                  <p className="text-xs text-primary/80 flex items-center gap-1.5 mt-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    Plan:{" "}
                    <span className="font-medium">{travelPlanStation}</span>
                  </p>
                )}
              </div>

              {/* Other Station name */}
              {stationSource === "OtherStation" && (
                <div className="space-y-2" data-ocid="other-station-section">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Station Name <span className="text-destructive">*</span>
                  </Label>
                  <input
                    placeholder="Enter station name"
                    value={otherStation}
                    onChange={(e) => setOtherStation(e.target.value)}
                    data-ocid="other-station-input"
                    required
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring h-10"
                  />
                </div>
              )}

              {/* Additional Station toggle + dropdown */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Additional Station
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowAdditionalStation((v) => !v)}
                    data-ocid="additional-station-toggle"
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                      showAdditionalStation
                        ? "bg-primary"
                        : "bg-muted-foreground/30"
                    }`}
                    role="switch"
                    aria-checked={showAdditionalStation}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-card shadow transition-transform ${
                        showAdditionalStation
                          ? "translate-x-4"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {showAdditionalStation ? "On" : "Off"}
                  </span>
                </div>

                {showAdditionalStation && (
                  <div
                    className="space-y-2"
                    data-ocid="additional-station-section"
                  >
                    {allottedAreas.length === 0 ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-700 text-sm">
                        <MapPin className="w-4 h-4 shrink-0" />
                        No areas allotted yet — contact HR.
                      </div>
                    ) : (
                      <>
                        <select
                          value={additionalStation}
                          onChange={(e) => setAdditionalStation(e.target.value)}
                          data-ocid="additional-station-select"
                          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring h-10"
                        >
                          <option value="">Select additional area</option>
                          {areaGroups.map((group) => (
                            <optgroup
                              key={group.hqName}
                              label={
                                group.isAdditionalHq
                                  ? `${group.hqName} (Additional HQ)`
                                  : group.hqName
                              }
                            >
                              {group.areas.map((area) => (
                                <option
                                  key={area.areaId.toString()}
                                  value={area.areaName}
                                >
                                  {area.areaName}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {travelPlanStation &&
                          additionalStation === travelPlanStation && (
                            <p className="text-xs text-primary/80 flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              Pre-filled from today's travel plan
                            </p>
                          )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="w-full gap-2"
                data-ocid="submit-working-style"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {saving ? "Submitting…" : "Submit Working Style"}
              </Button>
            </form>
          ) : (
            /* Loading skeleton */
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          )}

          {/* ── History Table ── */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-display font-semibold text-sm text-foreground">
                Last 30 Days History
              </h3>
            </div>
            {history.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No working style records in the last 30 days.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                        Date
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                        Type
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                        Mode
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                        Station
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                        With
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={`border-b border-border/50 last:border-0 ${
                          idx % 2 === 0 ? "" : "bg-muted/10"
                        }`}
                        data-ocid={`history-row-${row.id}`}
                      >
                        <td className="px-4 py-2.5 text-foreground font-medium whitespace-nowrap">
                          {row.date}
                        </td>
                        <td className="px-4 py-2.5 text-foreground text-xs">
                          {workingTypeLabel(row.workingType)}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              row.workingMode === "WorkingWith"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {workingModeLabel(row.workingMode)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {stationLabel(
                            row.stationSource,
                            row.otherStationName,
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">
                          {row.workingWithName ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </PortalLayout>
  );
}
