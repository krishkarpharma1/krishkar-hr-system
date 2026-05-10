import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit2,
  Loader2,
  MapPin,
  MessageSquare,
  Paperclip,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import type { DcrInfo } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useGps } from "../../hooks/useGps";
import { api } from "../../lib/api";
import {
  handleResultError,
  handleSessionError,
} from "../../lib/sessionErrorHandler";
import { useAuthStore } from "../../store/authStore";
import { useAttachmentMailto } from "../../utils/attachmentMailto";
import { formatDate, formatDateTime } from "../../utils/dateFormatter";

type WorkingType =
  | "FieldWork"
  | "OfficeWork"
  | "Leave"
  | "Holiday"
  | "Training"
  | "SickLeave";

const WORKING_TYPE_LABELS: Record<WorkingType, string> = {
  FieldWork: "Field Work",
  OfficeWork: "Office Work",
  Leave: "Leave",
  Holiday: "Holiday",
  Training: "Training",
  SickLeave: "Sick Leave",
};

const WORKING_TYPES: WorkingType[] = [
  "FieldWork",
  "OfficeWork",
  "Leave",
  "Holiday",
  "Training",
  "SickLeave",
];

const DCR_DEADLINE = "9:00 PM";

interface DcrForm {
  date: string;
  workingType: WorkingType;
  doctorsVisited: number;
  chemistsVisited: number;
  stockistsVisited: number;
  stationCovered: string;
  areaCovered: string;
  remarks: string;
}

const BLANK_FORM = (): DcrForm => ({
  date: new Date().toISOString().slice(0, 10),
  workingType: "FieldWork",
  doctorsVisited: 0,
  chemistsVisited: 0,
  stockistsVisited: 0,
  stationCovered: "",
  areaCovered: "",
  remarks: "",
});

// Extended status map covering all DCR status variants
const DCR_STATUS_MAP: Record<string, string> = {
  Submitted: "bg-green-50 text-green-700 border-green-200",
  "Auto-Submitted": "bg-blue-50 text-blue-700 border-blue-200",
  "Auto-Checkout Submitted": "bg-blue-50 text-blue-700 border-blue-200",
  Draft: "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Unlocked for Edit": "bg-orange-50 text-orange-700 border-orange-200",
  Resubmitted: "bg-green-50 text-green-700 border-green-200",
  "No Activity - Not Checked In":
    "bg-muted text-muted-foreground border-border",
  Late: "bg-orange-50 text-orange-700 border-orange-200",
  Approved: "bg-green-50 text-green-700 border-green-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  "Not Submitted": "bg-muted text-muted-foreground border-border",
};

function statusBadge(status: string, isLate?: boolean) {
  const base = "text-xs font-semibold px-2 py-0.5 rounded-full border";
  return (
    <span
      className={`${base} ${DCR_STATUS_MAP[status] ?? DCR_STATUS_MAP["Not Submitted"]}`}
    >
      {status}
      {isLate && status === "Submitted" && (
        <span className="ml-1 text-orange-600">⚠ Late</span>
      )}
    </span>
  );
}

function TodayDcrStatus({
  dcr,
  onResubmit,
}: {
  dcr: DcrInfo | null;
  onResubmit: () => void;
}) {
  if (!dcr) {
    return (
      <div
        className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5"
        data-ocid="dcr-today-status"
      >
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">
            DCR not yet submitted for today
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Submit your DCR (Daily Call Report) below.
          </p>
        </div>
      </div>
    );
  }

  const isRejected = (dcr.status as string) === "Rejected";

  return (
    <div
      className={`flex items-start gap-3 rounded-lg px-4 py-3 mb-5 border ${
        isRejected
          ? "bg-red-50 border-red-200"
          : (dcr.status as string) === "Approved"
            ? "bg-green-50 border-green-200"
            : "bg-blue-50 border-blue-200"
      }`}
      data-ocid="dcr-today-status"
    >
      {isRejected ? (
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            Today&apos;s DCR
          </span>
          {statusBadge(dcr.status as string, dcr.isLate)}
          {dcr.submittedAt && (
            <span className="text-xs text-muted-foreground">
              at {formatDateTime(dcr.submittedAt)}
            </span>
          )}
        </div>
        {dcr.approverRemark && (
          <p className="text-xs text-foreground/80">
            <span className="font-medium">Manager note:</span>{" "}
            {dcr.approverRemark}
          </p>
        )}
        {isRejected && (
          <Button
            size="sm"
            variant="outline"
            className="mt-1 h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
            onClick={onResubmit}
            data-ocid="dcr-resubmit-btn"
          >
            Re-submit DCR
          </Button>
        )}
      </div>
    </div>
  );
}

// Modal for requesting DCR edit
function EditRequestModal({
  dcr,
  onClose,
  onSubmit,
}: {
  dcr: DcrInfo;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleSubmit() {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      data-ocid="dcr-edit-request.dialog"
    >
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-lg p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-base text-foreground">
              Request DCR Edit
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              DCR Date: {formatDate(dcr.date)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            data-ocid="dcr-edit-request.close_button"
          >
            ×
          </button>
        </div>
        <div>
          <label
            htmlFor="edit-req-reason"
            className="block text-sm font-medium mb-1.5"
          >
            Reason for Edit Request <span className="text-destructive">*</span>
          </label>
          <textarea
            id="edit-req-reason"
            ref={textareaRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Describe the error or correction needed…"
            data-ocid="dcr-edit-request-reason-input"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            data-ocid="dcr-edit-request.cancel_button"
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || !reason.trim()}
            data-ocid="dcr-edit-request.confirm_button"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Submitting…
              </>
            ) : (
              "Submit Request"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function HistoryRow({
  dcr,
  onRequestEdit,
}: {
  dcr: DcrInfo;
  onRequestEdit: (dcr: DcrInfo) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const dcrStatus = dcr.status as string;
  const canRequestEdit = [
    "Submitted",
    "Auto-Submitted",
    "Auto-Checkout Submitted",
  ].includes(dcrStatus);

  return (
    <>
      <tr
        className="border-b border-border hover:bg-muted/20 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v);
        }}
        tabIndex={0}
        data-ocid={`dcr-history-row-${dcr.id}`}
      >
        <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap">
          {formatDate(dcr.date)}
        </td>
        <td className="px-3 py-2.5 text-xs">{dcr.workingType as string}</td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {statusBadge(dcrStatus, dcr.isLate)}
          </div>
        </td>
        <td className="px-3 py-2.5 text-xs text-center font-mono">
          {Number(dcr.totalDoctorsVisited)}
        </td>
        <td className="px-3 py-2.5 text-xs text-center font-mono">
          {Number(dcr.totalChemistsVisited)}
        </td>
        <td className="px-3 py-2.5 text-xs text-center font-mono">
          {Number(dcr.totalStockistsVisited)}
        </td>
        <td className="px-3 py-2.5 text-xs text-muted-foreground text-right">
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 inline" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 inline" />
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/10 border-b border-border">
          <td colSpan={7} className="px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {dcr.stationCovered && (
                <div>
                  <span className="text-muted-foreground">Station: </span>
                  <span className="font-medium">{dcr.stationCovered}</span>
                </div>
              )}
              {dcr.areaCovered && (
                <div>
                  <span className="text-muted-foreground">Area: </span>
                  <span className="font-medium">{dcr.areaCovered}</span>
                </div>
              )}
              {dcr.submittedAt && (
                <div>
                  <span className="text-muted-foreground">Submitted: </span>
                  <span>{formatDateTime(dcr.submittedAt)}</span>
                </div>
              )}
              {dcr.remarks && (
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Remarks: </span>
                  <span>{dcr.remarks}</span>
                </div>
              )}
              {dcr.approverRemark ? (
                <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  <span className="text-amber-700 font-medium">
                    Manager note:{" "}
                  </span>
                  <span className="text-amber-800">{dcr.approverRemark}</span>
                </div>
              ) : null}
              {/* Request Edit button for submitted DCRs */}
              {canRequestEdit && (
                <div className="sm:col-span-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestEdit(dcr);
                    }}
                    data-ocid={`dcr-request-edit-btn-${dcr.id}`}
                  >
                    <Edit2 className="w-3 h-3" />
                    Request Edit
                  </Button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function DcrSubmission() {
  const session = useAuthStore((s) => s.session);
  const { coords: gpsCoords, loading: gpsLoading, refreshGps } = useGps();
  const { buildMailto } = useAttachmentMailto();

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState<DcrForm>(BLANK_FORM);
  const [todayDcr, setTodayDcr] = useState<DcrInfo | null | undefined>(
    undefined,
  );
  const [history, setHistory] = useState<DcrInfo[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRequestDcr, setEditRequestDcr] = useState<DcrInfo | null>(null);

  // Date range filter for history
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5)
    .toISOString()
    .slice(0, 10);
  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);

  const loadTodayDcr = useCallback(async () => {
    if (!session) return;
    try {
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof rawApi.getMyDcr !== "function") {
        setTodayDcr(null);
        return;
      }
      const res = (await rawApi.getMyDcr(
        session.token,
        today,
      )) as DcrInfo | null;
      setTodayDcr(res);
      // If rejected → pre-open form for resubmit
      if ((res?.status as string) === "Rejected") {
        setShowForm(true);
        setForm((f) => ({ ...f, date: today }));
      }
    } catch {
      setTodayDcr(null);
    }
  }, [session, today]);

  const loadHistory = useCallback(async () => {
    if (!session) return;
    setHistoryLoading(true);
    try {
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof rawApi.listMyDcrs !== "function") {
        setHistory([]);
        return;
      }
      const res = (await rawApi.listMyDcrs(
        session.token,
        fromDate,
        toDate,
      )) as DcrInfo[];
      setHistory(res.sort((a, b) => b.date.localeCompare(a.date)));
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [session, fromDate, toDate]);

  useEffect(() => {
    loadTodayDcr();
  }, [loadTodayDcr]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleSubmit() {
    if (!session) return;
    if (!form.date) {
      toast.error("Please select a date.");
      return;
    }
    // Prevent future date
    if (form.date > today) {
      toast.error("Cannot submit DCR for a future date.");
      return;
    }
    setSaving(true);
    try {
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof rawApi.submitDcr !== "function") {
        toast.error("DCR submission is not available yet.");
        return;
      }
      const gpsLocation = gpsCoords
        ? {
            lat: gpsCoords.lat,
            lng: gpsCoords.lng,
            timestamp: BigInt(Date.now()),
          }
        : undefined;
      const res = (await rawApi.submitDcr(session.token, {
        date: form.date,
        workingType: form.workingType,
        totalDoctorsVisited: BigInt(form.doctorsVisited),
        totalChemistsVisited: BigInt(form.chemistsVisited),
        totalStockistsVisited: BigInt(form.stockistsVisited),
        stationCovered: form.stationCovered,
        areaCovered: form.areaCovered,
        remarks: form.remarks,
        gpsLocation,
      })) as { __kind__: string; ok?: bigint; err?: string };

      if (res.__kind__ === "err") {
        handleResultError(
          res.err ?? "Unknown error",
          toast.error,
          "Failed to submit DCR",
        );
        return;
      }
      toast.success("DCR submitted successfully!");
      setShowForm(false);
      setForm(BLANK_FORM());
      await loadTodayDcr();
      await loadHistory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleSessionError(msg, () =>
        toast.error("Failed to submit DCR. Please try again."),
      );
    } finally {
      setSaving(false);
    }
  }

  const canShowForm = !todayDcr || (todayDcr.status as string) === "Rejected";
  const todayAlreadySubmitted =
    todayDcr && (todayDcr.status as string) !== "Rejected";

  async function handleEditRequestSubmit(reason: string) {
    if (!session || !editRequestDcr) return;
    try {
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof rawApi.requestDcrEdit === "function") {
        await rawApi.requestDcrEdit(session.token, editRequestDcr.id, reason);
      }
      toast.success(
        "Edit request submitted. Your ASM or Admin will review it.",
      );
      setEditRequestDcr(null);
    } catch (e) {
      toast.error(
        `Failed to submit edit request: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw e;
    }
  }

  async function handleAttachment() {
    const userInfo = session
      ? await api.getUser(session.token, session.userId).catch(() => null)
      : null;
    const userTyped = userInfo as {
      designation?: string;
      hqAssignments?: { hqName?: string }[];
    } | null;
    const url = await buildMailto("dcrSubmission", {
      employeeName: session?.name ?? "",
      name: session?.name ?? "",
      designation: userTyped?.designation ?? "",
      hq: userTyped?.hqAssignments?.[0]?.hqName ?? "",
      date: formatDate(form.date || today),
    });
    window.location.href = url;
  }

  return (
    <PortalLayout portalRole={Role.MR}>
      {/* Edit request modal */}
      {editRequestDcr && (
        <EditRequestModal
          dcr={editRequestDcr}
          onClose={() => setEditRequestDcr(null)}
          onSubmit={handleEditRequestSubmit}
        />
      )}
      <PageHeader
        title="DCR (Daily Call Report)"
        subtitle={`Today: ${formatDate(today)}`}
      />
      <PageContent>
        {/* Deadline info banner */}
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5 mb-4 text-sm text-primary">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            Today&apos;s DCR deadline:{" "}
            <span className="font-semibold">{DCR_DEADLINE}</span>. Submit before
            the deadline to avoid a late flag.
          </span>
        </div>

        {/* Today's status */}
        <TodayDcrStatus
          dcr={todayDcr ?? null}
          onResubmit={() => {
            setShowForm(true);
            setForm((f) => ({ ...f, date: today }));
          }}
        />

        {/* GPS status */}
        <div className="flex items-center gap-2 text-xs mb-4">
          {gpsLoading ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Fetching location…
            </span>
          ) : gpsCoords ? (
            <span className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
              <MapPin className="w-3 h-3" />
              GPS ready ({gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)})
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 border border-border rounded px-2 py-1">
              <MapPin className="w-3 h-3" />
              No GPS — will submit without location
              <button
                type="button"
                onClick={refreshGps}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
                data-ocid="dcr-gps-retry"
              >
                Retry
              </button>
            </span>
          )}
        </div>

        {/* Open form CTA when not yet submitted or toggled */}
        {canShowForm && !showForm && (
          <Button
            className="mb-5 w-full sm:w-auto"
            onClick={() => setShowForm(true)}
            data-ocid="dcr-open-form-btn"
          >
            Submit Today's DCR
          </Button>
        )}

        {todayAlreadySubmitted && !showForm && null}

        {/* DCR Submission Form */}
        {showForm && canShowForm && (
          <div
            className="bg-card border border-border rounded-xl p-5 mb-6 space-y-4"
            data-ocid="dcr-form"
          >
            <h2 className="font-display font-semibold text-base text-foreground">
              {todayDcr?.status === "Rejected"
                ? "Re-submit DCR (Daily Call Report)"
                : "Submit DCR (Daily Call Report)"}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <label
                  htmlFor="dcr-date"
                  className="block text-sm font-medium mb-1.5"
                >
                  Date <span className="text-destructive">*</span>
                </label>
                <input
                  id="dcr-date"
                  type="date"
                  value={form.date}
                  max={today}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                  data-ocid="dcr-date-input"
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm h-10 focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Cannot submit for future dates.
                </p>
              </div>

              {/* Working Type */}
              <div>
                <p className="block text-sm font-medium mb-1.5">
                  Working Type <span className="text-destructive">*</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {WORKING_TYPES.map((wt) => (
                    <button
                      key={wt}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, workingType: wt }))
                      }
                      data-ocid={`dcr-working-type-${wt.toLowerCase()}`}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        form.workingType === wt
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-foreground hover:bg-muted/40"
                      }`}
                    >
                      {WORKING_TYPE_LABELS[wt]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Visit counts */}
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  {
                    key: "doctorsVisited",
                    label: "Doctors",
                    ocid: "dcr-doctors-input",
                  },
                  {
                    key: "chemistsVisited",
                    label: "Chemists",
                    ocid: "dcr-chemists-input",
                  },
                  {
                    key: "stockistsVisited",
                    label: "Stockists",
                    ocid: "dcr-stockists-input",
                  },
                ] as const
              ).map(({ key, label, ocid }) => (
                <div key={key}>
                  <label
                    htmlFor={ocid}
                    className="block text-sm font-medium mb-1.5"
                  >
                    {label} Calls Made
                  </label>
                  <input
                    id={ocid}
                    type="number"
                    min={0}
                    value={form[key]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        [key]: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    data-ocid={ocid}
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm h-10 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="dcr-station"
                  className="block text-sm font-medium mb-1.5"
                >
                  Territory / Station Covered
                </label>
                <input
                  id="dcr-station"
                  type="text"
                  placeholder="e.g. Andheri East"
                  value={form.stationCovered}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stationCovered: e.target.value }))
                  }
                  data-ocid="dcr-station-input"
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm h-10 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label
                  htmlFor="dcr-area"
                  className="block text-sm font-medium mb-1.5"
                >
                  Area / Beat Covered
                </label>
                <input
                  id="dcr-area"
                  type="text"
                  placeholder="e.g. Mumbai West"
                  value={form.areaCovered}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, areaCovered: e.target.value }))
                  }
                  data-ocid="dcr-area-input"
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm h-10 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="dcr-remarks"
                className="block text-sm font-medium mb-1.5"
              >
                Remarks
              </label>
              <textarea
                id="dcr-remarks"
                placeholder="Notes on today's field activity, coverage, and key outcomes…"
                value={form.remarks}
                onChange={(e) =>
                  setForm((f) => ({ ...f, remarks: e.target.value }))
                }
                data-ocid="dcr-remarks-input"
                rows={3}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* GPS capture note */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              {gpsCoords
                ? `GPS location captured at ${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}`
                : "GPS location not captured — will submit without GPS data."}
              {!gpsCoords && (
                <button
                  type="button"
                  onClick={refreshGps}
                  className="ml-1 flex items-center gap-0.5 text-primary hover:underline underline-offset-2"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleAttachment()}
                className="border-primary/40 text-primary hover:bg-primary/5"
                title="Tap to email your file to the company and your reporting managers. Your email app will open with all recipients pre-filled."
                data-ocid="dcr-attachment-button"
              >
                <Paperclip className="w-3.5 h-3.5 mr-1.5" />
                Attachment
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  data-ocid="dcr-cancel-btn"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={saving}
                  data-ocid="dcr-submit-btn"
                >
                  {saving && (
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  )}
                  {saving ? "Submitting…" : "Submit DCR"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* DCR History */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-display font-semibold text-sm text-foreground">
              DCR History
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                data-ocid="dcr-history-from-date"
                className="bg-background border border-input rounded px-2 py-1 text-xs h-8 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                max={today}
                onChange={(e) => setToDate(e.target.value)}
                data-ocid="dcr-history-to-date"
                className="bg-background border border-input rounded px-2 py-1 text-xs h-8 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading history…
            </div>
          ) : history.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2"
              data-ocid="dcr-history.empty_state"
            >
              <Clock className="w-8 h-8 opacity-30" />
              <p className="text-sm">
                No DCR (Daily Call Report) records found for the selected
                period.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-left whitespace-nowrap">
                      Date
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-left">
                      Working Type
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-left">
                      Status
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-center">
                      Drs
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-center">
                      Chems
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-center">
                      Stks
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-right" />
                  </tr>
                </thead>
                <tbody>
                  {history.map((dcr) => (
                    <HistoryRow
                      key={String(dcr.id)}
                      dcr={dcr}
                      onRequestEdit={(d) => setEditRequestDcr(d)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary footer */}
        {!historyLoading && history.length > 0 && (
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">
                {
                  history.filter((d) => (d.status as string) === "Approved")
                    .length
                }
              </span>{" "}
              approved
            </span>
            <span>
              <span className="font-semibold text-orange-600">
                {history.filter((d) => d.isLate).length}
              </span>{" "}
              late
            </span>
            <span>
              <span className="font-semibold text-foreground">
                {history.length}
              </span>{" "}
              total
            </span>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
