import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Star,
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
import { formatDate } from "../../utils/dateFormatter";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DoctorRow {
  name: string;
  station: string;
}

interface JfwInfo {
  id: number;
  mrId: bigint;
  managerName?: string;
  date: string;
  areaVisited: string;
  stationVisited: string;
  doctorsJointlyVisited: DoctorRow[];
  observations: string;
  rating: "Excellent" | "Good" | "Average" | "Poor";
  acknowledged: boolean;
  acknowledgedAt?: string;
}

type Rating = "Excellent" | "Good" | "Average" | "Poor";

// ── Rating Badge ──────────────────────────────────────────────────────────────

const RATING_STYLES: Record<
  Rating,
  { color: string; bgColor: string; borderColor: string }
> = {
  Excellent: {
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-400",
  },
  Good: {
    color: "text-sky-700",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-400",
  },
  Average: {
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-400",
  },
  Poor: {
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-400",
  },
};

function RatingBadge({ rating }: { rating: Rating }) {
  const s = RATING_STYLES[rating] ?? RATING_STYLES.Good;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.bgColor} ${s.color} ${s.borderColor}`}
    >
      <Star className="w-3 h-3 fill-current" />
      {rating}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function JfwAcknowledgement() {
  const { session } = useAuthStore();
  const token = session?.token ?? "";

  const [jfwList, setJfwList] = useState<JfwInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadJfws();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function loadJfws() {
    setLoading(true);
    const rawApi = api as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    if (typeof rawApi.listJfwsAboutMe !== "function") {
      setLoading(false);
      return;
    }
    rawApi
      .listJfwsAboutMe(token)
      .then((res) => setJfwList((res as JfwInfo[]) ?? []))
      .catch(() => toast.error("Failed to load field visit reports"))
      .finally(() => setLoading(false));
  }

  async function handleAcknowledge(jfwId: number) {
    setAcknowledging(true);
    try {
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof rawApi.acknowledgeJfw !== "function") {
        toast.error("Acknowledgement feature not available yet");
        return;
      }
      const result = await rawApi.acknowledgeJfw(token, jfwId);
      const res = result as { __kind__: string; err?: string };
      if (res.__kind__ === "err") {
        toast.error(res.err ?? "Acknowledgement failed");
        return;
      }
      toast.success("Field visit report acknowledged");
      setJfwList((prev) =>
        prev.map((j) =>
          j.id === jfwId
            ? {
                ...j,
                acknowledged: true,
                acknowledgedAt: new Date().toISOString().slice(0, 10),
              }
            : j,
        ),
      );
    } catch {
      toast.error("Failed to acknowledge report");
    } finally {
      setAcknowledging(false);
      setConfirmId(null);
    }
  }

  const totalCount = jfwList.length;
  const acknowledgedCount = jfwList.filter((j) => j.acknowledged).length;
  const pendingCount = totalCount - acknowledgedCount;

  return (
    <PortalLayout portalRole={Role.MR}>
      <PageHeader
        title="Field Visit Reports"
        subtitle="Joint Field Work reports submitted by your manager"
      />
      <PageContent>
        {/* Summary */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-foreground">
              {acknowledgedCount} of {totalCount} reports acknowledged
            </span>
          </div>
          {pendingCount > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-center gap-2">
              <span className="text-sm font-medium text-amber-700">
                {pendingCount} pending acknowledgement
              </span>
            </div>
          )}
        </div>

        {/* JFW List */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <ScrollableTable>
            <table className="w-full text-sm font-body min-w-[580px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {["Date", "Manager", "Station", "Rating", "Status", ""].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-2.5 text-xs uppercase tracking-wider font-display text-muted-foreground text-left whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [0, 1, 2].map((i) => (
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
                ) : jfwList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center"
                      data-ocid="jfw-ack.empty_state"
                    >
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <ClipboardList className="w-10 h-10 opacity-30" />
                        <p className="text-sm font-medium">
                          No field visit reports yet
                        </p>
                        <p className="text-xs max-w-xs text-center">
                          Joint Field Work reports submitted by your manager
                          will appear here for acknowledgement.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  jfwList.map((jfw, index) => (
                    <>
                      <tr
                        key={jfw.id}
                        className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer ${
                          !jfw.acknowledged
                            ? "bg-amber-50/40 hover:bg-amber-50/60"
                            : ""
                        }`}
                        data-ocid={`jfw-ack.item.${index + 1}`}
                        onClick={() =>
                          setExpandedId(expandedId === jfw.id ? null : jfw.id)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            setExpandedId(
                              expandedId === jfw.id ? null : jfw.id,
                            );
                        }}
                        tabIndex={0}
                      >
                        <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                          {formatDate(jfw.date)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {jfw.managerName ?? "Manager"}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {jfw.stationVisited}
                        </td>
                        <td className="px-4 py-3">
                          <RatingBadge rating={jfw.rating} />
                        </td>
                        <td className="px-4 py-3">
                          {jfw.acknowledged ? (
                            <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-300 border">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Acknowledged
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-amber-600 border-amber-400 bg-amber-50 font-semibold"
                            >
                              Pending
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {expandedId === jfw.id ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {expandedId === jfw.id && (
                        <tr
                          key={`${jfw.id}-expanded`}
                          className="border-b border-border bg-muted/10"
                        >
                          <td colSpan={6} className="px-6 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                  Area Visited
                                </p>
                                <p className="text-foreground">
                                  {jfw.areaVisited}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                  Doctors Jointly Visited
                                </p>
                                {jfw.doctorsJointlyVisited.length > 0 ? (
                                  <ul className="space-y-0.5">
                                    {jfw.doctorsJointlyVisited.map((d, i) => (
                                      <li key={i} className="text-foreground">
                                        {d.name}
                                        {d.station ? (
                                          <span className="text-muted-foreground text-xs ml-1">
                                            ({d.station})
                                          </span>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </div>
                              <div className="sm:col-span-2">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                  Observations
                                </p>
                                <p className="text-foreground whitespace-pre-line">
                                  {jfw.observations || "—"}
                                </p>
                              </div>
                              {jfw.acknowledged && jfw.acknowledgedAt && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                    Acknowledged On
                                  </p>
                                  <p className="text-foreground flex items-center gap-1">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                    {formatDate(jfw.acknowledgedAt)}
                                  </p>
                                </div>
                              )}
                            </div>
                            {!jfw.acknowledged && (
                              <Button
                                size="sm"
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmId(jfw.id);
                                }}
                                data-ocid={`jfw-ack.acknowledge_button.${index + 1}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-1.5" />
                                Acknowledge This Report
                              </Button>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </PageContent>

      {/* Confirmation dialog */}
      <AlertDialog
        open={confirmId !== null}
        onOpenChange={(open) => !open && setConfirmId(null)}
      >
        <AlertDialogContent data-ocid="jfw-ack.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Acknowledge Field Visit Report</AlertDialogTitle>
            <AlertDialogDescription>
              By acknowledging, you confirm you have reviewed this field visit
              report submitted by your manager. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-ocid="jfw-ack.cancel_button"
              disabled={acknowledging}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmId !== null && handleAcknowledge(confirmId)}
              data-ocid="jfw-ack.confirm_button"
              disabled={acknowledging}
            >
              {acknowledging ? "Acknowledging…" : "Confirm Acknowledgement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
}
