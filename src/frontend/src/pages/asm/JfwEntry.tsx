import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import React from "react";
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
import { formatDate } from "../../utils/dateFormatter";

// ── Types ────────────────────────────────────────────────────────────────────

interface DoctorRow {
  name: string;
  station: string;
}

interface JfwInfo {
  id: number;
  mrId: bigint;
  mrName?: string;
  date: string;
  areaVisited: string;
  stationVisited: string;
  doctorsJointlyVisited: DoctorRow[];
  observations: string;
  rating: "Excellent" | "Good" | "Average" | "Poor";
  acknowledged: boolean;
  acknowledgedAt?: string;
  createdAt?: string;
}

type Rating = "Excellent" | "Good" | "Average" | "Poor";

interface JfwEntryPageProps {
  portalRole?: Role;
}

// ── Rating config ─────────────────────────────────────────────────────────────

const RATINGS: {
  value: Rating;
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
  {
    value: "Excellent",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-400",
  },
  {
    value: "Good",
    color: "text-sky-700",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-400",
  },
  {
    value: "Average",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-400",
  },
  {
    value: "Poor",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-400",
  },
];

function getRatingStyle(rating: Rating) {
  return RATINGS.find((r) => r.value === rating) ?? RATINGS[1];
}

// ── Rating Badge ──────────────────────────────────────────────────────────────

function RatingBadge({ rating }: { rating: Rating }) {
  const s = getRatingStyle(rating);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.bgColor} ${s.color} ${s.borderColor}`}
    >
      <Star className="w-3 h-3 fill-current" />
      {rating}
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function JfwEntry({ portalRole }: JfwEntryPageProps) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const userId = session?.userId ?? BigInt(0);
  const effectiveRole = portalRole ?? Role.ASM;

  // Form state
  const [mrList, setMrList] = useState<UserInfo[]>([]);
  const [loadingMrs, setLoadingMrs] = useState(true);
  const [formDate, setFormDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [selectedMr, setSelectedMr] = useState<string>("");
  const [areaVisited, setAreaVisited] = useState("");
  const [stationVisited, setStationVisited] = useState("");
  const [doctors, setDoctors] = useState<DoctorRow[]>([
    { name: "", station: "" },
  ]);
  const [observations, setObservations] = useState("");
  const [rating, setRating] = useState<Rating>("Good");
  const [submitting, setSubmitting] = useState(false);

  // History state
  const [history, setHistory] = useState<JfwInfo[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Load MRs
  useEffect(() => {
    if (!token) return;
    setLoadingMrs(true);
    api
      .listReportees(token, userId)
      .then((reps) => {
        // Show all reportees (MRs and others); downstream filter by the manager
        setMrList(reps);
      })
      .catch(() => toast.error("Failed to load MR list"))
      .finally(() => setLoadingMrs(false));
  }, [token, userId]);

  // Load JFW history
  useEffect(() => {
    if (!token) return;
    setLoadingHistory(true);
    const rawApi = api as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    if (typeof rawApi.listMyJfws !== "function") {
      setLoadingHistory(false);
      return;
    }
    rawApi
      .listMyJfws(token, fromDate, toDate)
      .then((res) => setHistory((res as JfwInfo[]) ?? []))
      .catch(() => toast.error("Failed to load JFW history"))
      .finally(() => setLoadingHistory(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, fromDate, toDate]);

  function loadHistory() {
    setLoadingHistory(true);
    const rawApi = api as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    if (typeof rawApi.listMyJfws !== "function") {
      setLoadingHistory(false);
      return;
    }
    rawApi
      .listMyJfws(token, fromDate, toDate)
      .then((res) => setHistory((res as JfwInfo[]) ?? []))
      .catch(() => toast.error("Failed to load JFW history"))
      .finally(() => setLoadingHistory(false));
  }

  function addDoctor() {
    setDoctors((prev) => [...prev, { name: "", station: "" }]);
  }

  function removeDoctor(idx: number) {
    setDoctors((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateDoctor(idx: number, field: keyof DoctorRow, value: string) {
    setDoctors((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMr) {
      toast.error("Please select an MR");
      return;
    }
    if (!areaVisited.trim() || !stationVisited.trim()) {
      toast.error("Please fill in area and station visited");
      return;
    }
    const validDoctors = doctors.filter((d) => d.name.trim());
    setSubmitting(true);
    try {
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof rawApi.submitJfw !== "function") {
        toast.error("JFW submission is not available yet");
        return;
      }
      const result = await rawApi.submitJfw(token, {
        mrId: BigInt(selectedMr),
        date: formDate,
        areaVisited: areaVisited.trim(),
        stationVisited: stationVisited.trim(),
        doctorsJointlyVisited: validDoctors,
        observations: observations.trim(),
        rating,
      });
      const res = result as { __kind__: string; err?: string };
      if (res.__kind__ === "err") {
        toast.error(res.err ?? "Submission failed");
        return;
      }
      toast.success("Joint Field Work entry submitted successfully");
      // Reset form
      setFormDate(new Date().toISOString().slice(0, 10));
      setSelectedMr("");
      setAreaVisited("");
      setStationVisited("");
      setDoctors([{ name: "", station: "" }]);
      setObservations("");
      setRating("Good");
      loadHistory();
    } catch (err) {
      toast.error("Failed to submit JFW entry");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalLayout portalRole={effectiveRole}>
      <PageHeader
        title="Joint Field Work Entry"
        subtitle="Record field visits conducted jointly with your MRs"
      />
      <PageContent>
        {/* ── Submission Form ── */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
            New JFW Entry
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Date + MR */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="jfw-date">Date</Label>
                <Input
                  id="jfw-date"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  data-ocid="jfw.date_input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jfw-mr">MR Name</Label>
                {loadingMrs ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <select
                    id="jfw-mr"
                    value={selectedMr}
                    onChange={(e) => setSelectedMr(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    data-ocid="jfw.mr_select"
                  >
                    <option value="">Select MR…</option>
                    {mrList.map((mr) => (
                      <option key={String(mr.id)} value={String(mr.id)}>
                        {mr.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Row 2: Area + Station */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="jfw-area">Area Visited</Label>
                <Input
                  id="jfw-area"
                  placeholder="e.g. North Mumbai"
                  value={areaVisited}
                  onChange={(e) => setAreaVisited(e.target.value)}
                  data-ocid="jfw.area_input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jfw-station">Station Visited</Label>
                <Input
                  id="jfw-station"
                  placeholder="e.g. Andheri"
                  value={stationVisited}
                  onChange={(e) => setStationVisited(e.target.value)}
                  data-ocid="jfw.station_input"
                />
              </div>
            </div>

            {/* Doctors Jointly Visited */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Doctors Jointly Visited</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addDoctor}
                  data-ocid="jfw.add_doctor_button"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Doctor
                </Button>
              </div>
              <div className="space-y-2">
                {doctors.map((doc, idx) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: form rows keyed by position
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      placeholder="Doctor Name"
                      value={doc.name}
                      onChange={(e) =>
                        updateDoctor(idx, "name", e.target.value)
                      }
                      className="flex-1"
                      data-ocid={`jfw.doctor_name.${idx + 1}`}
                    />
                    <Input
                      placeholder="Station"
                      value={doc.station}
                      onChange={(e) =>
                        updateDoctor(idx, "station", e.target.value)
                      }
                      className="flex-1"
                      data-ocid={`jfw.doctor_station.${idx + 1}`}
                    />
                    {doctors.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeDoctor(idx)}
                        className="text-destructive hover:bg-destructive/10 shrink-0"
                        data-ocid={`jfw.remove_doctor.${idx + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Observations */}
            <div className="space-y-1.5">
              <Label htmlFor="jfw-observations">Observations</Label>
              <Textarea
                id="jfw-observations"
                placeholder="Describe field observations, MR's communication style, product detailing, doctor interactions…"
                rows={3}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                data-ocid="jfw.observations_textarea"
              />
            </div>

            {/* Rating */}
            <div className="space-y-2">
              <Label>Overall Rating</Label>
              <div className="flex flex-wrap gap-3">
                {RATINGS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRating(r.value)}
                    data-ocid={`jfw.rating_${r.value.toLowerCase()}`}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 font-semibold text-sm transition-all
                      ${
                        rating === r.value
                          ? `${r.bgColor} ${r.color} ${r.borderColor} shadow-sm`
                          : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                      }`}
                  >
                    <Star
                      className={`w-4 h-4 ${rating === r.value ? "fill-current" : ""}`}
                    />
                    {r.value}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto"
              data-ocid="jfw.submit_button"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit JFW Entry"
              )}
            </Button>
          </form>
        </div>

        {/* ── JFW History ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex flex-wrap gap-3 items-center justify-between">
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              My JFW History
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-36 h-8 text-sm"
                data-ocid="jfw-history.from_date"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-36 h-8 text-sm"
                data-ocid="jfw-history.to_date"
              />
            </div>
          </div>

          <ScrollableTable>
            <table className="w-full text-sm font-body min-w-[600px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {[
                    "Date",
                    "MR Name",
                    "Station",
                    "Rating",
                    "Acknowledged",
                    "",
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-xs uppercase tracking-wider font-display text-muted-foreground text-left whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
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
                ) : history.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-muted-foreground text-sm"
                      data-ocid="jfw-history.empty_state"
                    >
                      No JFW entries found for the selected date range.
                    </td>
                  </tr>
                ) : (
                  history.map((jfw, index) => (
                    <React.Fragment key={jfw.id}>
                      <tr
                        key={jfw.id}
                        className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                        data-ocid={`jfw-history.item.${index + 1}`}
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
                          {jfw.mrName ?? `MR #${jfw.mrId}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {jfw.stationVisited}
                        </td>
                        <td className="px-4 py-3">
                          <RatingBadge rating={jfw.rating} />
                        </td>
                        <td className="px-4 py-3">
                          {jfw.acknowledged ? (
                            <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-300">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Acknowledged
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-amber-600 border-amber-300"
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
                      {expandedId === jfw.id && (
                        <tr
                          key={`${jfw.id}-expanded`}
                          className="bg-muted/20 border-b border-border"
                        >
                          <td colSpan={6} className="px-6 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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
                                      // biome-ignore lint/suspicious/noArrayIndexKey: static list keyed by position
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
                                  <p className="text-foreground">
                                    {formatDate(jfw.acknowledgedAt)}
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </PageContent>
    </PortalLayout>
  );
}
