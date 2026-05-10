import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CrmStatus } from "../../backend";
import { DataTable } from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  BusinessReportInfo,
  CrmRequestInfo,
  DoctorInfo,
} from "../../types";

export default function BusinessReporting() {
  const { session } = useAuthStore();
  const token = session?.token ?? "";

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [doctors, setDoctors] = useState<DoctorInfo[]>([]);
  const [crmRequests, setCrmRequests] = useState<CrmRequestInfo[]>([]);
  const [reports, setReports] = useState<BusinessReportInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [doctorId, setDoctorId] = useState("");
  const [linkedCrmId, setLinkedCrmId] = useState("none");
  const [actualSales, setActualSales] = useState("");
  const [prescriptionCount, setPrescriptionCount] = useState("");
  const [reportNotes, setReportNotes] = useState("");

  useEffect(() => {
    if (!token) return;
    api.listDoctors().then(setDoctors);
    api
      .listMyCrmRequests(token)
      .then((reqs) =>
        setCrmRequests(reqs.filter((r) => r.status === CrmStatus.Approved)),
      );
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .listMyBusinessReports(token, BigInt(month), BigInt(year))
      .then(setReports)
      .finally(() => setLoading(false));
  }, [token, month, year]);

  const linkedCrm = crmRequests.find((r) => String(r.id) === linkedCrmId);
  const doctorCrmOptions = crmRequests.filter(
    (r) => !doctorId || String(r.doctorId) === doctorId,
  );

  const currentMonthData =
    today.getMonth() + 1 === month && today.getFullYear() === year;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!doctorId) {
      toast.error("Select a doctor");
      return;
    }
    const sales = Number.parseFloat(actualSales);
    const scripts = Number.parseInt(prescriptionCount, 10);
    if (!Number.isFinite(sales) || sales < 0) {
      toast.error("Enter valid actual sales amount");
      return;
    }
    if (!Number.isFinite(scripts) || scripts < 0) {
      toast.error("Enter valid prescription count");
      return;
    }

    // Warn if sales >10% above committed quantity
    if (linkedCrm) {
      const totalCommitted = linkedCrm.productCommitments.reduce(
        (sum, pc) => sum + Number(pc.expectedQuantity),
        0,
      );
      if (totalCommitted > 0 && sales > totalCommitted * 1.1) {
        toast.warning(
          "Actual sales exceeds committed quantities by more than 10% — submitting anyway",
        );
      }
    }

    const doctor = doctors.find((d) => String(d.id) === doctorId);
    if (!doctor) return;

    setSubmitting(true);
    const result = await api.createBusinessReport(token, {
      doctorId: BigInt(doctorId),
      doctorName: doctor.name,
      month: BigInt(month),
      year: BigInt(year),
      actualSales: sales,
      prescriptionCount: BigInt(scripts),
      linkedCrmRequestId:
        linkedCrmId !== "none" ? BigInt(linkedCrmId) : undefined,
      reportNotes: reportNotes || undefined,
    });

    if (result.__kind__ === "ok") {
      toast.success("Business report submitted");
      const updated = await api.listMyBusinessReports(
        token,
        BigInt(month),
        BigInt(year),
      );
      setReports(updated);
      setDoctorId("");
      setLinkedCrmId("none");
      setActualSales("");
      setPrescriptionCount("");
      setReportNotes("");
    } else {
      toast.error(result.err);
    }
    setSubmitting(false);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground">
          Business Reporting
        </h2>
        <p className="text-sm text-muted-foreground">
          Report actual business generated per doctor each month
        </p>
      </div>

      {/* Submit form — current month only */}
      {currentMonthData && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" /> Submit Report — {MONTHS[month - 1]}{" "}
            {year}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="br-doctor">Doctor *</Label>
                <Select
                  value={doctorId}
                  onValueChange={(v) => {
                    setDoctorId(v);
                    setLinkedCrmId("none");
                  }}
                >
                  <SelectTrigger id="br-doctor" data-ocid="select-br-doctor">
                    <SelectValue placeholder="Select doctor" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {doctors.map((d) => (
                      <SelectItem key={String(d.id)} value={String(d.id)}>
                        {d.name} — {d.area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="br-crm">Linked CRM Request</Label>
                <Select value={linkedCrmId} onValueChange={setLinkedCrmId}>
                  <SelectTrigger id="br-crm" data-ocid="select-br-crm">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {doctorCrmOptions.map((r) => (
                      <SelectItem key={String(r.id)} value={String(r.id)}>
                        ₹{r.crmAmount.toLocaleString("en-IN")} — {r.doctorName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* CRM reference panel */}
            {linkedCrm && (
              <div className="bg-muted/30 border border-border rounded-md p-3 text-xs space-y-1.5">
                <p className="font-medium text-foreground">
                  CRM Request Reference
                </p>
                <p className="text-muted-foreground">
                  Amount: ₹{linkedCrm.crmAmount.toLocaleString("en-IN")}
                </p>
                {linkedCrm.productCommitments.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground">
                      Committed Products:
                    </p>
                    {linkedCrm.productCommitments.map((pc) => (
                      <p
                        key={String(pc.productId)}
                        className="text-muted-foreground ml-2"
                      >
                        • {pc.productName}: {String(pc.expectedQuantity)} units
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="br-sales">Actual Sales (₹) *</Label>
                <Input
                  id="br-sales"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={actualSales}
                  onChange={(e) => setActualSales(e.target.value)}
                  data-ocid="input-br-sales"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="br-scripts">Prescription Count *</Label>
                <Input
                  id="br-scripts"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={prescriptionCount}
                  onChange={(e) => setPrescriptionCount(e.target.value)}
                  data-ocid="input-br-scripts"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="br-notes">Notes</Label>
              <Textarea
                id="br-notes"
                rows={2}
                placeholder="Optional notes…"
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={submitting}
                data-ocid="btn-submit-business-report"
              >
                {submitting ? "Submitting…" : "Submit Report"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {!currentMonthData && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Past months are read-only. Switch to the current month to submit a new
          report.
        </div>
      )}

      {/* History with month/year filter */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Report History
          </h3>
          <div className="flex items-center gap-2">
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
            >
              <SelectTrigger
                className="w-36 h-8 text-xs"
                data-ocid="select-history-month"
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
            <Input
              type="number"
              className="w-24 h-8 text-xs"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              min={2020}
              max={2099}
              data-ocid="input-history-year"
            />
          </div>
        </div>
        <DataTable<BusinessReportInfo>
          columns={[
            { key: "doctor", label: "Doctor" },
            { key: "month", label: "Month/Year" },
            {
              key: "sales",
              label: "Actual Sales (₹)",
              className: "text-right",
            },
            { key: "scripts", label: "Prescriptions", className: "text-right" },
            { key: "crm", label: "Linked CRM" },
            { key: "submitted", label: "Submitted" },
          ]}
          data={reports}
          getKey={(item) => String(item.id)}
          loading={loading}
          emptyMessage={`No business reports for ${MONTHS[month - 1]} ${year}`}
          renderRow={(r) => {
            const crm = crmRequests.find(
              (c) => String(c.id) === String(r.linkedCrmRequestId),
            );
            return (
              <>
                <td className="px-4 py-3 text-sm font-medium text-foreground">
                  {r.doctorName}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {MONTHS[Number(r.month) - 1]} {String(r.year)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-foreground">
                  ₹{r.actualSales.toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono text-foreground">
                  {String(r.prescriptionCount)}
                </td>
                <td className="px-4 py-3">
                  {crm ? (
                    <Badge variant="outline" className="text-xs">
                      ₹{crm.crmAmount.toLocaleString("en-IN")}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(Number(r.createdAt) / 1_000_000).toLocaleDateString(
                    "en-IN",
                  )}
                </td>
              </>
            );
          }}
        />
      </div>
    </div>
  );
}
