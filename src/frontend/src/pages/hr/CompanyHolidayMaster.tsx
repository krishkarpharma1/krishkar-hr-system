// HR portal version — same functionality as Admin but wrapped in HRManager portal
// Re-uses the same implementation, only the portalRole differs.
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  CompanyHoliday,
  CreateHolidayInput,
  HolidayApplicableTo,
} from "../../types";
import { HolidayType } from "../../types";

const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  [HolidayType.NationalHoliday]: "National Holiday",
  [HolidayType.FestivalHoliday]: "Festival Holiday",
  [HolidayType.RegionalHoliday]: "Regional Holiday",
  [HolidayType.OptionalHoliday]: "Optional Holiday",
};

const HOLIDAY_TYPE_COLORS: Record<
  HolidayType,
  "default" | "secondary" | "destructive" | "outline"
> = {
  [HolidayType.NationalHoliday]: "destructive",
  [HolidayType.FestivalHoliday]: "default",
  [HolidayType.RegionalHoliday]: "secondary",
  [HolidayType.OptionalHoliday]: "outline",
};

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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function tsToDate(ts: bigint): Date {
  return new Date(Number(ts));
}

function formatDate(ts: bigint): string {
  const d = tsToDate(ts);
  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTH_NAMES[d.getMonth()].slice(0, 3);
  return `${day} ${month} ${d.getFullYear()}`;
}

function formatApplicableTo(applicableTo: HolidayApplicableTo): string {
  if (applicableTo.__kind__ === "AllEmployees") return "All Employees";
  if (applicableTo.__kind__ === "SpecificRoles") {
    return applicableTo.SpecificRoles.join(", ");
  }
  if (applicableTo.__kind__ === "SpecificTerritories") {
    return applicableTo.SpecificTerritories.join(", ");
  }
  return "All";
}

function isUpcoming(ts: bigint): boolean {
  const d = tsToDate(ts);
  const today = new Date();
  const in30 = new Date();
  in30.setDate(today.getDate() + 30);
  return d >= today && d <= in30;
}

interface HolidayFormState {
  name: string;
  date: string;
  holidayType: HolidayType;
  applicableTo: "all" | "roles";
  selectedRoles: string[];
  remarks: string;
}

const defaultForm: HolidayFormState = {
  name: "",
  date: "",
  holidayType: HolidayType.NationalHoliday,
  applicableTo: "all",
  selectedRoles: [],
  remarks: "",
};

const FIELD_ROLES = ["MR", "ASM", "RSM", "ZSM"];

export default function CompanyHolidayMasterHR() {
  const { session } = useAuthStore();
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<bigint | null>(null);
  const [form, setForm] = useState<HolidayFormState>(defaultForm);
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<bigint | null>(null);
  const [deleting, setDeleting] = useState(false);

  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());

  const fetchHolidays = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await api.getCompanyHolidays(session.token);
      setHolidays(data);
    } catch {
      toast.error("Failed to load holidays");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...holidays]
      .filter(
        (h) =>
          h.isActive &&
          (h.name.toLowerCase().includes(q) ||
            formatDate(h.date).toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        if (sortBy === "date") return Number(a.date) - Number(b.date);
        return a.name.localeCompare(b.name);
      });
  }, [holidays, search, sortBy]);

  const upcoming = useMemo(
    () => filtered.filter((h) => isUpcoming(h.date)),
    [filtered],
  );

  const openAdd = () => {
    setEditId(null);
    setForm(defaultForm);
    setShowForm(true);
  };

  const openEdit = (h: CompanyHoliday) => {
    setEditId(h.id);
    const dateStr = tsToDate(h.date).toISOString().split("T")[0];
    const applicableTo = h.applicableTo;
    const isRoles = applicableTo.__kind__ === "SpecificRoles";
    const roles = isRoles ? applicableTo.SpecificRoles : [];
    setForm({
      name: h.name,
      date: dateStr,
      holidayType: h.holidayType,
      applicableTo: isRoles ? "roles" : "all",
      selectedRoles: roles,
      remarks: h.remarks ?? "",
    });
    setShowForm(true);
  };

  const buildApplicableTo = (f: HolidayFormState): HolidayApplicableTo => {
    if (f.applicableTo === "roles" && f.selectedRoles.length > 0) {
      return {
        __kind__: "SpecificRoles",
        SpecificRoles: f.selectedRoles as import("../../backend.d").Role[],
      };
    }
    return { __kind__: "AllEmployees", AllEmployees: null };
  };

  const handleSave = async () => {
    if (!session || !form.name || !form.date) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      const dateMs = BigInt(new Date(form.date).getTime());
      const applicableTo = buildApplicableTo(form);

      if (editId !== null) {
        const res = await api.updateCompanyHoliday(session.token, {
          id: editId,
          name: form.name,
          date: dateMs,
          holidayType: form.holidayType,
          applicableTo,
          remarks: form.remarks || undefined,
          isActive: undefined,
        });
        if (res.__kind__ === "err") {
          toast.error(res.err);
          return;
        }
        toast.success("Holiday updated");
      } else {
        const input: CreateHolidayInput = {
          name: form.name,
          date: dateMs,
          holidayType: form.holidayType,
          applicableTo,
          remarks: form.remarks || undefined,
        };
        const res = await api.addCompanyHoliday(session.token, input);
        if (res.__kind__ === "err") {
          toast.error(res.err);
          return;
        }
        toast.success("Holiday added");
      }
      setShowForm(false);
      await fetchHolidays();
    } catch {
      toast.error("Failed to save holiday");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!session || deleteId === null) return;
    setDeleting(true);
    try {
      const res = await api.deleteCompanyHoliday(session.token, deleteId);
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      toast.success("Holiday deleted");
      setDeleteId(null);
      await fetchHolidays();
    } catch {
      toast.error("Failed to delete holiday");
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!session) return;
    try {
      const rows = await api.getHolidaysForExport(session.token);
      const { utils, writeFile } = await import("xlsx");
      const data = rows.map((r, i) => ({
        "Sr. No.": i + 1,
        "Holiday Name": r.name,
        Date: formatDate(r.date),
        Day: r.dayOfWeek,
        Type: r.holidayType,
        "Applicable To": r.applicableTo,
      }));
      const ws = utils.json_to_sheet(data);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Company Holidays");
      writeFile(wb, "Company_Holidays.xlsx");
      toast.success("Excel exported");
    } catch {
      toast.error("Export failed");
    }
  };

  const handleExportPdf = async () => {
    if (!session) return;
    try {
      const rows = await api.getHolidaysForExport(session.token);
      const tableRows = rows
        .map(
          (r, i) =>
            `<tr><td>${i + 1}</td><td>${r.name}</td><td>${formatDate(r.date)}</td><td>${r.dayOfWeek}</td><td>${r.holidayType}</td><td>${r.applicableTo}</td></tr>`,
        )
        .join("");
      const html = `<!DOCTYPE html><html><head><title>Company Holidays</title>
        <style>body{font-family:Arial,sans-serif;margin:20px}h2{margin-bottom:10px}
        table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:12px}
        th{background:#4f46e5;color:#fff}
        .footer{position:fixed;bottom:0;left:0;right:0;background:#00acc1;color:#fff;font-weight:bold;text-align:center;padding:8px;font-size:13px}
        @media print{.footer{position:fixed}}</style></head>
        <body><h2>Company Holidays — Krishkar Pharmaceuticals</h2>
        <table><thead><tr><th>Sr.</th><th>Holiday Name</th><th>Date</th><th>Day</th><th>Type</th><th>Applicable To</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
        <div class="footer">Krishkar Pharmaceuticals : Empowering Health</div>
        </body></html>`;
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
      }
      toast.success("PDF print dialog opened");
    } catch {
      toast.error("PDF export failed");
    }
  };

  const calHolidayDates = useMemo(
    () =>
      holidays
        .filter((h) => h.isActive)
        .reduce<Record<number, CompanyHoliday>>((acc, h) => {
          const d = tsToDate(h.date);
          if (d.getMonth() === calMonth && d.getFullYear() === calYear) {
            acc[d.getDate()] = h;
          }
          return acc;
        }, {}),
    [holidays, calMonth, calYear],
  );

  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calFirstDay = new Date(calYear, calMonth, 1).getDay();
  const [calTooltip, setCalTooltip] = useState<{
    day: number;
    holiday: CompanyHoliday;
  } | null>(null);

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="Company Holidays"
        subtitle="Manage company holiday calendar and weekly offs"
        actions={
          <Button size="sm" onClick={openAdd} data-ocid="add-holiday-btn">
            <Plus className="w-4 h-4 mr-1" /> Add Holiday
          </Button>
        }
      />
      <PageContent>
        <Tabs defaultValue="manage">
          <TabsList className="mb-4">
            <TabsTrigger value="manage">Manage Holidays</TabsTrigger>
            <TabsTrigger value="calendar">
              <Calendar className="w-4 h-4 mr-1" />
              Calendar View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manage">
            {upcoming.length > 0 && (
              <div className="mb-5 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-display font-semibold text-amber-700 uppercase tracking-wide mb-2">
                  Upcoming Holidays (Next 30 Days)
                </p>
                <div className="flex flex-wrap gap-2">
                  {upcoming.map((h) => (
                    <span
                      key={String(h.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-xs font-medium text-amber-800"
                    >
                      {h.name}
                      <span className="text-amber-600">
                        — {formatDate(h.date)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-4 items-center justify-between">
              <div className="flex gap-2">
                <Input
                  placeholder="Search holidays…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-52"
                  data-ocid="holiday-search"
                />
                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as "date" | "name")}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Sort: Date</SelectItem>
                    <SelectItem value="name">Sort: Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  data-ocid="export-excel-btn"
                >
                  <Download className="w-4 h-4 mr-1" /> Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  data-ocid="export-pdf-btn"
                >
                  <Download className="w-4 h-4 mr-1" /> PDF
                </Button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      {[
                        "Sr.",
                        "Holiday Name",
                        "Date",
                        "Day",
                        "Type",
                        "Applicable To",
                        "Remarks",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-left text-xs uppercase tracking-wide font-display text-muted-foreground whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      [0, 1, 2].map((i) => (
                        <tr key={i} className="border-b border-border">
                          {[0, 1, 2, 3, 4, 5, 6, 7].map((j) => (
                            <td key={j} className="px-3 py-3">
                              <div className="h-4 bg-muted rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-12 text-center text-muted-foreground text-sm"
                        >
                          No holidays found. Add one to get started.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((h, i) => {
                        const d = tsToDate(h.date);
                        return (
                          <tr
                            key={String(h.id)}
                            className="border-b border-border last:border-0 hover:bg-muted/20"
                            data-ocid={`holiday-row-${h.id}`}
                          >
                            <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">
                              {i + 1}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-foreground">
                              {h.name}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-sm">
                              {formatDate(h.date)}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {DAY_NAMES[d.getDay()]}
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge
                                variant={HOLIDAY_TYPE_COLORS[h.holidayType]}
                                className="text-xs"
                              >
                                {HOLIDAY_TYPE_LABELS[h.holidayType]}
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5 text-sm text-muted-foreground max-w-[180px] truncate">
                              {formatApplicableTo(h.applicableTo)}
                            </td>
                            <td className="px-3 py-2.5 text-sm text-muted-foreground max-w-[160px] truncate">
                              {h.remarks ?? "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEdit(h)}
                                  data-ocid={`edit-holiday-${h.id}`}
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteId(h.id)}
                                  data-ocid={`delete-holiday-${h.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="calendar">
            <div className="bg-card border border-border rounded-lg overflow-hidden max-w-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (calMonth === 0) {
                      setCalMonth(11);
                      setCalYear((y) => y - 1);
                    } else setCalMonth((m) => m - 1);
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="font-display font-semibold text-sm">
                  {MONTH_NAMES[calMonth]} {calYear}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (calMonth === 11) {
                      setCalMonth(0);
                      setCalYear((y) => y + 1);
                    } else setCalMonth((m) => m + 1);
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAY_NAMES.map((d) => (
                    <div
                      key={d}
                      className={cn(
                        "text-center text-xs font-display text-muted-foreground py-1",
                        d === "Sun" && "text-blue-500",
                      )}
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: calFirstDay }, (_, i) => (
                    <div key={`spacer-cal-${i + 1}`} />
                  ))}
                  {Array.from({ length: calDaysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dayOfWeek = new Date(calYear, calMonth, day).getDay();
                    const isSunday = dayOfWeek === 0;
                    const holiday = calHolidayDates[day];
                    const isToday =
                      new Date().getDate() === day &&
                      new Date().getMonth() === calMonth &&
                      new Date().getFullYear() === calYear;
                    return (
                      <div
                        key={day}
                        className="relative"
                        onMouseEnter={() =>
                          holiday && setCalTooltip({ day, holiday })
                        }
                        onMouseLeave={() => setCalTooltip(null)}
                      >
                        <div
                          className={cn(
                            "aspect-square rounded flex flex-col items-center justify-center text-xs border transition-colors",
                            isSunday &&
                              !holiday &&
                              "bg-blue-50 border-blue-100",
                            holiday &&
                              "bg-red-100 border-red-300 cursor-pointer",
                            !isSunday && !holiday && "border-border",
                            isToday && "ring-1 ring-primary",
                          )}
                        >
                          <span
                            className={cn(
                              "font-mono text-sm",
                              isSunday && "text-blue-600",
                              holiday && "text-red-700 font-bold",
                            )}
                          >
                            {day}
                          </span>
                          {isSunday && !holiday && (
                            <span className="text-[8px] text-blue-400 font-display">
                              WO
                            </span>
                          )}
                          {holiday && (
                            <span className="text-[8px] text-red-600 font-display">
                              H
                            </span>
                          )}
                        </div>
                        {calTooltip?.day === day && holiday && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 bg-popover border border-border rounded shadow-lg px-2 py-1.5 text-xs whitespace-nowrap pointer-events-none">
                            <p className="font-semibold text-foreground">
                              {holiday.name}
                            </p>
                            <p className="text-muted-foreground">
                              {HOLIDAY_TYPE_LABELS[holiday.holidayType]}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="px-4 py-2 border-t border-border bg-muted/20 flex gap-4 text-xs text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-red-100 border border-red-300" />{" "}
                  Company Holiday
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-blue-50 border border-blue-100" />{" "}
                  Sunday (Weekly Off)
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </PageContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editId !== null ? "Edit Holiday" : "Add Company Holiday"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="h-name">
                Holiday Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="h-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Diwali"
                data-ocid="holiday-name-input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="h-date">
                Holiday Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="h-date"
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                data-ocid="holiday-date-input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Holiday Type</Label>
              <Select
                value={form.holidayType}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, holidayType: v as HolidayType }))
                }
              >
                <SelectTrigger data-ocid="holiday-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(HolidayType).map((t) => (
                    <SelectItem key={t} value={t}>
                      {HOLIDAY_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Applicable To</Label>
              <Select
                value={form.applicableTo}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    applicableTo: v as "all" | "roles",
                    selectedRoles: [],
                  }))
                }
              >
                <SelectTrigger data-ocid="holiday-applicable-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  <SelectItem value="roles">Specific Roles</SelectItem>
                </SelectContent>
              </Select>
              {form.applicableTo === "roles" && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {FIELD_ROLES.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          selectedRoles: f.selectedRoles.includes(r)
                            ? f.selectedRoles.filter((x) => x !== r)
                            : [...f.selectedRoles, r],
                        }))
                      }
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs border transition-colors",
                        form.selectedRoles.includes(r)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary",
                      )}
                      data-ocid={`role-toggle-${r}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="h-remarks">Remarks (optional)</Label>
              <Textarea
                id="h-remarks"
                value={form.remarks}
                onChange={(e) =>
                  setForm((f) => ({ ...f, remarks: e.target.value }))
                }
                placeholder="Optional note…"
                rows={2}
                data-ocid="holiday-remarks-input"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
                data-ocid="holiday-cancel-btn"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                data-ocid="holiday-save-btn"
              >
                {saving ? "Saving…" : "Save Holiday"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Holiday</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete this holiday? This action cannot be
            undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              data-ocid="delete-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              data-ocid="delete-confirm"
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
