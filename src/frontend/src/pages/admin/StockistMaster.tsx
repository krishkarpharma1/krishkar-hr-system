import { Badge } from "@/components/ui/badge";
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
import { Download, Edit2, Plus, Search, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Role } from "../../backend";
import type { AreaRecord, HQRecord, StockistRecord } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import { buildBrandingExcelRows } from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";

interface FormState {
  name: string;
  proprietorName: string;
  mobileNumber: string;
  emailId: string;
  address: string;
  areaId: string;
  drugLicenseNumber: string;
  gstNumber: string;
  remarks: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  proprietorName: "",
  mobileNumber: "",
  emailId: "",
  address: "",
  areaId: "none",
  drugLicenseNumber: "",
  gstNumber: "",
  remarks: "",
};

export default function StockistMaster({ portalRole }: { portalRole?: Role }) {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const token = session?.token ?? "";
  const effectiveRole = portalRole ?? session?.role ?? Role.Admin;

  const [stockists, setStockists] = useState<StockistRecord[]>([]);
  const [hqs, setHqs] = useState<HQRecord[]>([]);
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editStockist, setEditStockist] = useState<StockistRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Deactivate confirm
  const [deactivateTarget, setDeactivateTarget] =
    useState<StockistRecord | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [stockistList, hqList, areaList] = await Promise.all([
        api.listStockists(token, {}),
        api.getAllHQs(token),
        api.listAllActiveAreas(token),
      ]);
      setStockists(stockistList);
      setHqs(hqList);
      setAreas(areaList);
    } catch {
      toast.error("Failed to load stockist data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hqMap = useMemo(
    () => new Map(hqs.map((h) => [String(h.id), h.name])),
    [hqs],
  );
  const areaMap = useMemo(
    () => new Map(areas.map((a) => [String(a.id), a])),
    [areas],
  );

  // HQ auto-fill when area is selected
  const selectedArea =
    form.areaId !== "none" ? areaMap.get(form.areaId) : undefined;
  const autoHqName = selectedArea
    ? (hqMap.get(String(selectedArea.hqId)) ?? "—")
    : "—";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return stockists.filter((s) => {
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (areaMap.get(String(s.areaId))?.name ?? "").toLowerCase().includes(q) ||
        (hqMap.get(String(s.hqId)) ?? "").toLowerCase().includes(q);
      const matchActive =
        filterActive === "all" ||
        (filterActive === "active" && s.isActive) ||
        (filterActive === "inactive" && !s.isActive);
      return matchSearch && matchActive;
    });
  }, [stockists, search, filterActive, areaMap, hqMap]);

  function openAdd() {
    setEditStockist(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(s: StockistRecord) {
    setEditStockist(s);
    setForm({
      name: s.name,
      proprietorName: s.proprietorName,
      mobileNumber: s.mobileNumber,
      emailId: s.emailId ?? "",
      address: s.address,
      areaId: String(s.areaId),
      drugLicenseNumber: s.drugLicenseNumber ?? "",
      gstNumber: s.gstNumber ?? "",
      remarks: s.remarks ?? "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Stockist name is required");
      return;
    }
    if (!form.proprietorName.trim()) {
      toast.error("Proprietor name is required");
      return;
    }
    if (!form.mobileNumber.trim()) {
      toast.error("Mobile number is required");
      return;
    }
    if (!form.address.trim()) {
      toast.error("Address is required");
      return;
    }
    if (form.areaId === "none") {
      toast.error("Please select an area");
      return;
    }

    setSaving(true);
    try {
      if (editStockist) {
        const res = await api.updateStockist(token, {
          id: editStockist.id,
          name: form.name || undefined,
          proprietorName: form.proprietorName || undefined,
          mobileNumber: form.mobileNumber || undefined,
          emailId: form.emailId || undefined,
          address: form.address || undefined,
          areaId: BigInt(form.areaId),
          drugLicenseNumber: form.drugLicenseNumber || undefined,
          gstNumber: form.gstNumber || undefined,
          remarks: form.remarks || undefined,
        });
        if (res.__kind__ === "err") {
          toast.error(res.err);
          return;
        }
        toast.success("Stockist updated");
      } else {
        const res = await api.createStockist(token, {
          name: form.name,
          proprietorName: form.proprietorName,
          mobileNumber: form.mobileNumber,
          emailId: form.emailId || undefined,
          address: form.address,
          areaId: BigInt(form.areaId),
          drugLicenseNumber: form.drugLicenseNumber || undefined,
          gstNumber: form.gstNumber || undefined,
          remarks: form.remarks || undefined,
        });
        if (res.__kind__ === "err") {
          toast.error(res.err);
          return;
        }
        toast.success("Stockist created");
      }
      setShowModal(false);
      await loadData();
    } catch (e) {
      toast.error(String(e) || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      const res = await api.deactivateStockist(token, deactivateTarget.id);
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      toast.success("Stockist deactivated");
      setDeactivateTarget(null);
      await loadData();
    } catch (e) {
      toast.error(String(e) || "Deactivation failed");
    } finally {
      setDeactivating(false);
    }
  }

  async function handleExport() {
    const data = filtered.map((s, i) => ({
      "Sr No": i + 1,
      "Stockist Name": s.name,
      "Proprietor/Contact": s.proprietorName,
      Mobile: s.mobileNumber,
      Email: s.emailId ?? "",
      Address: s.address,
      Area: areaMap.get(String(s.areaId))?.name ?? String(s.areaId),
      HQ: hqMap.get(String(s.hqId)) ?? String(s.hqId),
      "Drug License No": s.drugLicenseNumber ?? "",
      "GST No": s.gstNumber ?? "",
      Remarks: s.remarks ?? "",
      Status: s.isActive ? "Active" : "Inactive",
    }));
    const brandingRows = buildBrandingExcelRows(companyProfile ?? null);
    const allRows = [...brandingRows, ...data] as Record<string, unknown>[];
    const ws = XLSX.utils.json_to_sheet(allRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stockists");
    XLSX.writeFile(
      wb,
      `Stockist_Master_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    toast.success(`Exported ${data.length} stockists`);
  }

  const fieldF = (
    key: keyof FormState,
    label: string,
    required = false,
    type = "text",
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        data-ocid={`stockist-field-${key}`}
      />
    </div>
  );

  return (
    <PortalLayout portalRole={effectiveRole}>
      <PageHeader
        title="Stockist Master"
        subtitle="Manage stockists and their territory assignments"
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={filtered.length === 0}
              data-ocid="btn-export-stockists"
            >
              <Download className="w-4 h-4 mr-1.5" /> Export Excel
            </Button>
            <Button size="sm" onClick={openAdd} data-ocid="btn-add-stockist">
              <Plus className="w-4 h-4 mr-1.5" /> Add New Stockist
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* Search + Filter */}
        <SectionCard>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs mb-1 block">
                Search (Name, Area, HQ)
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  data-ocid="stockist-search"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Status</Label>
              <Select
                value={filterActive}
                onValueChange={(v) => setFilterActive(v as typeof filterActive)}
              >
                <SelectTrigger
                  className="w-[130px]"
                  data-ocid="stockist-filter-active"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        {/* Table */}
        <SectionCard title={`Stockists (${filtered.length})`}>
          {loading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center" data-ocid="stockist-empty">
              <p className="text-muted-foreground text-sm">
                No stockists found. Add your first stockist.
              </p>
              <Button size="sm" className="mt-3" onClick={openAdd}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Stockist
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    {[
                      "Sr",
                      "Stockist Name",
                      "Proprietor",
                      "Mobile",
                      "Area",
                      "HQ",
                      "Drug Lic.",
                      "GST",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((s, i) => (
                    <tr
                      key={String(s.id)}
                      className={`hover:bg-muted/20 ${!s.isActive ? "opacity-60" : ""}`}
                      data-ocid={`stockist-row-${s.id}`}
                    >
                      <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2 font-body font-medium text-foreground">
                        {s.name}
                      </td>
                      <td className="px-3 py-2 text-sm">{s.proprietorName}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {s.mobileNumber}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {areaMap.get(String(s.areaId))?.name ??
                          String(s.areaId)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {hqMap.get(String(s.hqId)) ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono">
                        {s.drugLicenseNumber ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono">
                        {s.gstNumber ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          className={`text-xs ${s.isActive ? "bg-green-100 text-green-700 border-green-300" : "bg-muted text-muted-foreground border-border"}`}
                        >
                          {s.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            className="text-primary hover:text-primary/80"
                            title="Edit"
                            data-ocid={`btn-edit-stockist-${s.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {s.isActive && (
                            <button
                              type="button"
                              onClick={() => setDeactivateTarget(s)}
                              className="text-destructive hover:text-destructive/80"
                              title="Deactivate"
                              data-ocid={`btn-deactivate-stockist-${s.id}`}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Add/Edit Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editStockist ? "Edit Stockist" : "Add New Stockist"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {fieldF("name", "Stockist Name", true)}
              {fieldF("proprietorName", "Proprietor / Contact Person", true)}
              {fieldF("mobileNumber", "Mobile Number", true, "tel")}
              {fieldF("emailId", "Email ID")}
              {fieldF("address", "Address", true)}
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Area / Territory <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.areaId}
                  onValueChange={(v) => setForm((p) => ({ ...p, areaId: v }))}
                >
                  <SelectTrigger data-ocid="stockist-select-area">
                    <SelectValue placeholder="Select area…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Select Area —</SelectItem>
                    {areas
                      .filter((a) => a.isActive)
                      .map((a) => (
                        <SelectItem key={String(a.id)} value={String(a.id)}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Headquarters (auto-filled)</Label>
                <Input
                  value={autoHqName}
                  readOnly
                  className="bg-muted/30 text-muted-foreground cursor-not-allowed"
                />
              </div>
              {fieldF("drugLicenseNumber", "Drug License Number")}
              {fieldF("gstNumber", "GST Number")}
              {fieldF("remarks", "Remarks")}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                data-ocid="btn-confirm-stockist-save"
              >
                {saving
                  ? "Saving…"
                  : editStockist
                    ? "Update Stockist"
                    : "Create Stockist"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Deactivate Confirm */}
        <Dialog
          open={!!deactivateTarget}
          onOpenChange={() => setDeactivateTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deactivate Stockist</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              Are you sure you want to deactivate{" "}
              <strong>{deactivateTarget?.name}</strong>? Deactivated stockists
              will not appear in field staff dropdowns.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeactivateTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeactivate}
                disabled={deactivating}
                data-ocid="btn-confirm-deactivate-stockist"
              >
                {deactivating ? "Deactivating…" : "Deactivate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
    </PortalLayout>
  );
}
