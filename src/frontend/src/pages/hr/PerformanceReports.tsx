import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import {
  DollarSign,
  Phone,
  ShoppingCart,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { PerformanceRecord, UserInfo } from "../../types";

const MONTH_NAMES = [
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

export default function PerformanceReports() {
  const { session } = useAuthStore();
  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const now = new Date();
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [record, setRecord] = useState<PerformanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    calls: "0",
    doctors: "0",
    orders: "0",
    sales: "0",
    remarks: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    api
      .listAllUsers(session.token)
      .then(setEmployees)
      .catch(() => {});
  }, [session]);

  const fetchRecord = async () => {
    if (!session || !selectedEmpId) return;
    setLoading(true);
    try {
      const rec = await api.getEmployeePerformance(
        session.token,
        BigInt(selectedEmpId),
        BigInt(month),
        BigInt(year),
      );
      setRecord(rec);
      if (rec) {
        setForm({
          calls: String(rec.callsMade),
          doctors: String(rec.doctorsVisited),
          orders: String(rec.chemistOrders),
          sales: String(rec.totalSales),
          remarks: rec.remarks,
        });
      }
    } catch {
      toast.error("Failed to load performance");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!session || !selectedEmpId) return;
    setSaving(true);
    try {
      const res = await api.upsertPerformance(
        session.token,
        BigInt(selectedEmpId),
        BigInt(month),
        BigInt(year),
        BigInt(form.calls || "0"),
        BigInt(form.doctors || "0"),
        BigInt(form.orders || "0"),
        BigInt(form.sales || "0"),
        form.remarks,
      );
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      toast.success("Performance record saved");
      setEditOpen(false);
      await fetchRecord();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const emp = employees.find((e) => String(e.id) === selectedEmpId);
  const fmt = (n: bigint) => `₹${Number(n).toLocaleString("en-IN")}`;

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="Performance Reports"
        subtitle="View and record employee performance metrics"
        actions={
          selectedEmpId ? (
            <Button
              size="sm"
              onClick={() => {
                setEditOpen(true);
                setForm({
                  calls: "0",
                  doctors: "0",
                  orders: "0",
                  sales: "0",
                  remarks: "",
                });
              }}
              data-ocid="add-performance-btn"
            >
              {record ? "Update Record" : "Add Record"}
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-6 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground mb-1 block">
              Employee
            </Label>
            <Select
              value={selectedEmpId}
              onValueChange={(v) => {
                setSelectedEmpId(v);
                setRecord(null);
              }}
            >
              <SelectTrigger data-ocid="perf-emp-select">
                <SelectValue placeholder="Select employee…" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={String(e.id)} value={String(e.id)}>
                    {e.name} ({e.employeeId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Month
            </Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[140px]" data-ocid="perf-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Year
            </Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="h-9 w-[90px]"
              data-ocid="perf-year"
            />
          </div>
          <Button
            variant="outline"
            onClick={fetchRecord}
            disabled={!selectedEmpId || loading}
            data-ocid="fetch-perf-btn"
          >
            {loading ? "Loading…" : "Fetch"}
          </Button>
        </div>

        {selectedEmpId && !record && !loading && (
          <div
            className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm"
            data-ocid="no-perf-record"
          >
            No performance record for {emp?.name} in{" "}
            {MONTH_NAMES[Number(month) - 1]} {year}.
            <br />
            <Button
              variant="link"
              className="text-primary mt-2"
              onClick={() => setEditOpen(true)}
              data-ocid="add-first-record"
            >
              Add performance record
            </Button>
          </div>
        )}

        {record && emp && (
          <>
            {/* Employee info banner */}
            <div className="bg-card border border-border rounded-lg px-5 py-4 mb-5 flex items-center justify-between">
              <div>
                <p className="font-display font-semibold text-foreground">
                  {emp.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {emp.designation} · {emp.territory} ·{" "}
                  {MONTH_NAMES[Number(month) - 1]} {year}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setForm({
                    calls: String(record.callsMade),
                    doctors: String(record.doctorsVisited),
                    orders: String(record.chemistOrders),
                    sales: String(record.totalSales),
                    remarks: record.remarks,
                  });
                  setEditOpen(true);
                }}
                data-ocid="edit-perf-btn"
              >
                Edit
              </Button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              {[
                {
                  label: "Calls Made",
                  value: String(record.callsMade),
                  icon: Phone,
                  color: "text-primary",
                },
                {
                  label: "Doctors Visited",
                  value: String(record.doctorsVisited),
                  icon: UserCheck,
                  color: "text-accent",
                },
                {
                  label: "Chemist Orders",
                  value: String(record.chemistOrders),
                  icon: ShoppingCart,
                  color: "text-primary",
                },
                {
                  label: "Total Sales",
                  value: fmt(record.totalSales),
                  icon: DollarSign,
                  color: "text-accent",
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="bg-card border border-border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                      {kpi.label}
                    </span>
                    <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                  <p className={`font-display font-bold text-2xl ${kpi.color}`}>
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>

            {record.remarks && (
              <div className="bg-card border border-border rounded-lg px-5 py-4">
                <p className="text-xs uppercase tracking-wider font-display text-muted-foreground mb-2">
                  Remarks
                </p>
                <p className="text-sm text-foreground font-body">
                  {record.remarks}
                </p>
              </div>
            )}
          </>
        )}

        {!selectedEmpId && (
          <div
            className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm"
            data-ocid="perf-empty"
          >
            Select an employee and month to view performance records
          </div>
        )}

        {/* Edit dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display">
                Performance Record
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              {[
                { key: "calls", label: "Calls Made" },
                { key: "doctors", label: "Doctors Visited" },
                { key: "orders", label: "Chemist Orders" },
                { key: "sales", label: "Total Sales (₹)" },
              ].map((f) => (
                <div key={f.key}>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    {f.label}
                  </Label>
                  <Input
                    type="number"
                    value={form[f.key as keyof typeof form]}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, [f.key]: e.target.value }))
                    }
                    className="h-9"
                    data-ocid={`perf-${f.key}`}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Remarks
                </Label>
                <Input
                  value={form.remarks}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, remarks: e.target.value }))
                  }
                  placeholder="Optional remarks…"
                  data-ocid="perf-remarks"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                data-ocid="save-perf-btn"
              >
                {saving ? "Saving…" : "Save Record"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
    </PortalLayout>
  );
}
