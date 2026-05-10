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
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { OrderStatus, Role } from "../../backend";
import type { AreaRecord, BulkImportChemistInput } from "../../backend.d";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useGps } from "../../hooks/useGps";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { ChemistInfo, ChemistOrderInfo, ProductInfo } from "../../types";

type TabId = "chemists" | "add-chemist" | "orders" | "new-order" | "bulk";

const ORDER_STATUS_COLORS: Record<string, string> = {
  [OrderStatus.Pending]: "text-muted-foreground bg-muted/40",
  [OrderStatus.Confirmed]: "text-primary bg-primary/10",
  [OrderStatus.Dispatched]: "text-accent bg-accent/10",
  [OrderStatus.Delivered]: "text-accent bg-accent/20",
  [OrderStatus.Cancelled]: "text-destructive bg-destructive/10",
};

const BLANK_FORM = {
  name: "",
  shopName: "",
  address: "",
  area: "",
  territory: "",
  contactPhone: "",
};

interface OrderLine {
  productId: string;
  quantity: string;
  scheme: string;
}

interface ParsedChemistRow {
  name: string;
  shopName: string;
  address: string;
  area: string;
  contactPhone: string;
  errors: string[];
  rowIndex: number;
}

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const val = row[k];
    if (val !== undefined && val !== "") return val.trim();
  }
  return "";
}

function parseRowsFromSheet(
  rawRows: Record<string, string>[],
): ParsedChemistRow[] {
  return rawRows.map((row, idx) => {
    const name = getField(
      row,
      "Name",
      "name",
      "Contact Name",
      "CONTACT NAME",
      "CHEMIST NAME",
    );
    const shopName = getField(
      row,
      "Shop Name",
      "ShopName",
      "shop_name",
      "SHOP NAME",
      "Shop",
    );
    const address = getField(row, "Address", "address", "ADDRESS");
    const area = getField(row, "Area", "area", "AREA");
    const contactPhone = getField(
      row,
      "Contact Phone",
      "ContactPhone",
      "contact_phone",
      "Phone",
      "phone",
    );

    const errors: string[] = [];
    if (!name) errors.push("Missing required field: Name");
    if (!shopName) errors.push("Missing required field: Shop Name");

    return {
      name,
      shopName,
      address,
      area,
      contactPhone,
      errors,
      rowIndex: idx + 2,
    };
  });
}

function parseFile(file: File): Promise<ParsedChemistRow[]> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "csv") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string;
          const wb = XLSX.read(text, { type: "string" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
            defval: "",
          });
          resolve(parseRowsFromSheet(rows));
        } catch {
          reject(new Error("Failed to parse CSV file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = ev.target?.result;
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
            defval: "",
          });
          resolve(parseRowsFromSheet(rows));
        } catch {
          reject(new Error("Failed to parse Excel file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    }
  });
}

export default function ChemistManagement() {
  const session = useAuthStore((s) => s.session);
  const userRole = (session?.role as string) ?? "";
  const canBulkUpload = userRole === "Admin" || userRole === "HRManager";
  const { coords: gpsCoords } = useGps();
  const [tab, setTab] = useState<TabId>("chemists");
  const [chemists, setChemists] = useState<ChemistInfo[]>([]);
  const [orders, setOrders] = useState<ChemistOrderInfo[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [filterArea, setFilterArea] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });

  // New order state
  const [orderChemist, setOrderChemist] = useState("");
  const [orderLines, setOrderLines] = useState<OrderLine[]>([
    { productId: "", quantity: "", scheme: "" },
  ]);
  const [orderRemarks, setOrderRemarks] = useState("");
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  // Bulk upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [bulkRows, setBulkRows] = useState<ParsedChemistRow[]>([]);
  const [bulkArea, setBulkArea] = useState<string>("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    succeeded: number;
    failed: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    if (!session) return;
    Promise.all([
      api.listMyChemists(session.userId),
      api.listMyOrders(session.userId),
      api.listProducts(),
      api.listAllActiveAreas(session.token),
    ]).then(([c, o, p, a]) => {
      setChemists(c);
      setOrders(o);
      setProducts(p.filter((x) => x.isActive));
      setAreas(a);
      setLoading(false);
      setOrdersLoading(false);
    });
  }, [session]);

  const filteredChemists =
    filterArea === "all"
      ? chemists
      : chemists.filter((c) => c.area === filterArea);

  async function handleAddChemist() {
    if (!session) return;
    if (!form.name.trim() || !form.shopName.trim()) {
      toast.error("Name and shop name are required");
      return;
    }
    setSubmitting(true);
    try {
      await api.addChemist(session.userId, {
        name: form.name.trim(),
        shopName: form.shopName.trim(),
        address: form.address.trim(),
        area: form.area.trim(),
        territory: form.territory.trim(),
        contactPhone: form.contactPhone.trim(),
      });
      toast.success("Chemist added successfully");
      const updated = await api.listMyChemists(session.userId);
      setChemists(updated);
      setForm({ ...BLANK_FORM });
      setTab("chemists");
    } catch {
      toast.error("Failed to add chemist");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitOrder() {
    if (!session) return;
    if (!orderChemist) {
      toast.error("Select a chemist");
      return;
    }
    const validLines = orderLines.filter((l) => l.productId && l.quantity);
    if (validLines.length === 0) {
      toast.error("Add at least one order line");
      return;
    }
    const items = validLines.map((l) => {
      const prod = products.find((p) => p.id.toString() === l.productId);
      return {
        productId: BigInt(l.productId),
        productName: prod?.name ?? "",
        quantity: BigInt(l.quantity),
        scheme: l.scheme,
        unitPrice: 0n,
      };
    });
    const gpsLocation = gpsCoords
      ? { lat: gpsCoords.lat, lng: gpsCoords.lng }
      : undefined;

    setSubmitting(true);
    try {
      await api.submitChemistOrder(
        session.userId,
        {
          chemistId: BigInt(orderChemist),
          date: orderDate,
          items,
          totalValue: 0n,
          remarks: orderRemarks,
        },
        gpsLocation,
      );
      toast.success("Order submitted successfully");
      const updated = await api.listMyOrders(session.userId);
      setOrders(updated);
      setOrderChemist("");
      setOrderLines([{ productId: "", quantity: "", scheme: "" }]);
      setOrderRemarks("");
      setTab("orders");
    } catch {
      toast.error("Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkResult(null);
    setBulkRows([]);
    parseFile(file)
      .then((rows) => setBulkRows(rows))
      .catch((err: Error) => toast.error(err.message));
  }

  async function handleBulkImport() {
    if (!session || bulkRows.length === 0) return;
    if (!bulkArea) {
      toast.error("Select an area for bulk import");
      return;
    }
    const validRows = bulkRows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) {
      toast.error("No valid rows to import. Fix errors first.");
      return;
    }
    const items: BulkImportChemistInput[] = validRows.map((r) => ({
      name: r.name,
      shopName: r.shopName,
      address: r.address,
      area: r.area || bulkArea,
      contactPhone: r.contactPhone,
    }));
    setBulkImporting(true);
    try {
      const result = await api.bulkImportChemists(
        session.token,
        session.userId,
        items,
        bulkArea,
      );
      setBulkResult({
        succeeded: Number(result.succeeded),
        failed: Number(result.failed),
        errors: result.errors,
      });
      if (Number(result.succeeded) > 0) {
        toast.success(`Imported ${result.succeeded} chemist(s) successfully`);
        const updated = await api.listMyChemists(session.userId);
        setChemists(updated);
      }
    } catch {
      toast.error("Bulk import failed");
    } finally {
      setBulkImporting(false);
    }
  }

  const chemistCols = [
    { key: "name", label: "Name" },
    { key: "shop", label: "Shop" },
    { key: "area", label: "Area" },
    { key: "territory", label: "Territory" },
    { key: "phone", label: "Phone" },
  ];

  const orderCols = [
    { key: "date", label: "Date" },
    { key: "chemist", label: "Chemist" },
    { key: "items", label: "Items" },
    { key: "value", label: "Total Value" },
    { key: "status", label: "Status" },
  ];

  const navTabs: { id: TabId; label: string }[] = [
    { id: "chemists", label: "My Chemists" },
    { id: "orders", label: "My Orders" },
  ];

  return (
    <PortalLayout portalRole={Role.MR}>
      <PageHeader
        title="Chemist Management"
        subtitle="Manage chemists and submit orders"
        actions={
          <div className="flex gap-2 flex-wrap">
            {navTabs.map((t) => (
              <Button
                key={t.id}
                variant={tab === t.id ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(t.id)}
                data-ocid={`tab-${t.id}`}
              >
                {t.label}
              </Button>
            ))}
            <Button
              variant={tab === "add-chemist" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setTab(tab === "add-chemist" ? "chemists" : "add-chemist")
              }
              data-ocid="add-chemist-btn"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Chemist
            </Button>
            {canBulkUpload && (
              <Button
                variant={tab === "bulk" ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(tab === "bulk" ? "chemists" : "bulk")}
                data-ocid="bulk-chemist-btn"
              >
                <Upload className="w-3.5 h-3.5 mr-1" /> Bulk Upload
              </Button>
            )}
            <Button
              size="sm"
              onClick={() =>
                setTab(tab === "new-order" ? "orders" : "new-order")
              }
              data-ocid="new-order-btn"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New Order
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* CHEMISTS TAB */}
        {tab === "chemists" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Label className="text-xs shrink-0">Filter by Area:</Label>
              <Select value={filterArea} onValueChange={setFilterArea}>
                <SelectTrigger
                  className="w-52 h-8 text-xs"
                  data-ocid="filter-chemist-area"
                >
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id.toString()} value={a.name}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DataTable
              columns={chemistCols}
              data={filteredChemists}
              getKey={(c) => c.id.toString()}
              loading={loading}
              emptyMessage="No chemists found. Add a chemist or adjust the area filter."
              renderRow={(c) => (
                <>
                  <td className="px-4 py-3 font-body text-sm font-medium">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-xs">{c.shopName}</td>
                  <td className="px-4 py-3 text-xs">{c.area}</td>
                  <td className="px-4 py-3 text-xs">{c.territory}</td>
                  <td className="px-4 py-3 text-xs font-mono">
                    {c.contactPhone}
                  </td>
                </>
              )}
            />
          </div>
        )}

        {/* ORDERS TAB */}
        {tab === "orders" && (
          <DataTable
            columns={orderCols}
            data={orders}
            getKey={(o) => o.id.toString()}
            loading={ordersLoading}
            emptyMessage="No orders submitted yet."
            renderRow={(o) => {
              const chemist = chemists.find((c) => c.id === o.chemistId);
              return (
                <>
                  <td className="px-4 py-3 font-mono text-xs">{o.date}</td>
                  <td className="px-4 py-3 text-xs">
                    {chemist?.name ?? o.chemistId.toString()}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {o.items.length} item(s)
                  </td>
                  <td className="px-4 py-3 text-xs font-mono">
                    ₹{Number(o.totalValue).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-display uppercase tracking-wide ${ORDER_STATUS_COLORS[o.status] ?? ""}`}
                    >
                      {o.status}
                    </span>
                  </td>
                </>
              );
            }}
          />
        )}

        {/* ADD CHEMIST TAB */}
        {tab === "add-chemist" && (
          <div className="max-w-xl bg-card border border-border rounded-lg p-5 space-y-4">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Add New Chemist
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ch-name" className="text-xs mb-1 block">
                  Contact Name *
                </Label>
                <Input
                  id="ch-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ramesh Shah"
                  data-ocid="chemist-name"
                />
              </div>
              <div>
                <Label htmlFor="ch-shop" className="text-xs mb-1 block">
                  Shop Name *
                </Label>
                <Input
                  id="ch-shop"
                  value={form.shopName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, shopName: e.target.value }))
                  }
                  placeholder="Shah Medical Stores"
                  data-ocid="chemist-shop"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="ch-address" className="text-xs mb-1 block">
                  Address
                </Label>
                <Input
                  id="ch-address"
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                  placeholder="123, Main Road"
                  data-ocid="chemist-address"
                />
              </div>
              <div>
                <Label htmlFor="ch-area" className="text-xs mb-1 block">
                  Area
                </Label>
                <Select
                  value={form.area}
                  onValueChange={(v) => setForm((f) => ({ ...f, area: v }))}
                >
                  <SelectTrigger id="ch-area" data-ocid="chemist-area">
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id.toString()} value={a.name}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ch-territory" className="text-xs mb-1 block">
                  Territory
                </Label>
                <Input
                  id="ch-territory"
                  value={form.territory}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, territory: e.target.value }))
                  }
                  placeholder="West Zone"
                  data-ocid="chemist-territory"
                />
              </div>
              <div>
                <Label htmlFor="ch-phone" className="text-xs mb-1 block">
                  Phone
                </Label>
                <Input
                  id="ch-phone"
                  value={form.contactPhone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactPhone: e.target.value }))
                  }
                  placeholder="+91 98765 43210"
                  data-ocid="chemist-phone"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleAddChemist}
                disabled={submitting}
                data-ocid="submit-add-chemist"
              >
                {submitting && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                )}
                Add Chemist
              </Button>
              <Button variant="ghost" onClick={() => setTab("chemists")}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* BULK UPLOAD TAB — Admin/HR only */}
        {tab === "bulk" && canBulkUpload && (
          <div className="max-w-3xl space-y-5">
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Bulk Upload Chemists
              </h3>
              <p className="text-xs text-muted-foreground">
                Upload a CSV or Excel file (.xlsx, .xls, .csv) with columns:{" "}
                <span className="font-mono bg-muted/40 px-1 rounded">
                  Name, Shop Name, Address, Area, Contact Phone
                </span>{" "}
                (header row required). Bad rows will be flagged inline and
                skipped during import.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bulk-ch-area" className="text-xs mb-1 block">
                    Import into Area *
                  </Label>
                  <Select value={bulkArea} onValueChange={setBulkArea}>
                    <SelectTrigger
                      id="bulk-ch-area"
                      data-ocid="bulk-chemist-area"
                    >
                      <SelectValue placeholder="Select area" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map((a) => (
                        <SelectItem key={a.id.toString()} value={a.name}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bulk-ch-file" className="text-xs mb-1 block">
                    File (.xlsx, .xls, .csv) *
                  </Label>
                  <input
                    ref={fileRef}
                    id="bulk-ch-file"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="block w-full text-xs text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-muted file:text-foreground hover:file:bg-muted/80 cursor-pointer"
                    onChange={handleFileChange}
                    data-ocid="bulk-chemist-file-input"
                  />
                </div>
              </div>
            </div>

            {bulkRows.length > 0 && (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Preview — {bulkRows.length} row(s)
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {bulkRows.filter((r) => r.errors.length === 0).length}{" "}
                    valid, {bulkRows.filter((r) => r.errors.length > 0).length}{" "}
                    with errors
                  </span>
                </div>
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          #
                        </th>
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          Name
                        </th>
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          Shop Name
                        </th>
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          Address
                        </th>
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          Area
                        </th>
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          Phone
                        </th>
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row) => (
                        <tr
                          key={`ch-row-${row.rowIndex}`}
                          className={`border-b border-border/50 ${row.errors.length > 0 ? "bg-destructive/5" : ""}`}
                        >
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.rowIndex}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {row.name || (
                              <span className="text-destructive">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {row.shopName || (
                              <span className="text-destructive">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{row.address}</td>
                          <td className="px-3 py-2">{row.area}</td>
                          <td className="px-3 py-2 font-mono">
                            {row.contactPhone}
                          </td>
                          <td className="px-3 py-2">
                            {row.errors.length > 0 ? (
                              <span className="flex items-center gap-1 text-destructive">
                                <AlertCircle className="w-3 h-3" />
                                {row.errors.join("; ")}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-accent">
                                <CheckCircle2 className="w-3 h-3" /> Valid
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {bulkResult && (
              <div
                className={`rounded-lg p-4 border text-sm space-y-1 ${bulkResult.failed === 0 ? "border-accent/30 bg-accent/5" : "border-destructive/30 bg-destructive/5"}`}
              >
                <p className="font-semibold">
                  Import complete: {bulkResult.succeeded} succeeded,{" "}
                  {bulkResult.failed} failed
                </p>
                {bulkResult.errors.map((e, i) => (
                  <p
                    key={`ch-err-${e.slice(0, 20)}-${i}`}
                    className="text-xs text-destructive"
                  >
                    {e}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleBulkImport}
                disabled={bulkImporting || bulkRows.length === 0 || !bulkArea}
                data-ocid="submit-bulk-import-chemists"
              >
                {bulkImporting && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                )}
                <Upload className="w-4 h-4 mr-1" />
                Import {bulkRows.filter((r) => r.errors.length === 0).length}{" "}
                Chemist(s)
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setBulkRows([]);
                  setBulkResult(null);
                  setBulkArea("");
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* NEW ORDER TAB */}
        {tab === "new-order" && (
          <div className="max-w-2xl space-y-5">
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  New Chemist Order
                </h3>
                {gpsCoords ? (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent"
                    data-ocid="gps-status-order"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border border-orange-400/30 bg-orange-400/10 text-orange-500"
                    data-ocid="gps-status-order"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    GPS not available
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ord-chemist" className="text-xs mb-1 block">
                    Chemist *
                  </Label>
                  <Select value={orderChemist} onValueChange={setOrderChemist}>
                    <SelectTrigger id="ord-chemist" data-ocid="order-chemist">
                      <SelectValue placeholder="Select chemist" />
                    </SelectTrigger>
                    <SelectContent>
                      {chemists.map((c) => (
                        <SelectItem
                          key={c.id.toString()}
                          value={c.id.toString()}
                        >
                          {c.name} — {c.shopName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ord-date" className="text-xs mb-1 block">
                    Date
                  </Label>
                  <Input
                    id="ord-date"
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    data-ocid="order-date"
                  />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Order Lines
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setOrderLines((l) => [
                      ...l,
                      { productId: "", quantity: "", scheme: "" },
                    ])
                  }
                  data-ocid="add-order-line"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Line
                </Button>
              </div>
              <div className="grid grid-cols-[2fr_1fr_2fr_auto] gap-2 text-xs font-display uppercase tracking-wider text-muted-foreground pb-1">
                <span>Product</span>
                <span>Qty</span>
                <span>Scheme</span>
                <span />
              </div>
              {orderLines.map((line, i) => (
                <div
                  key={`order-line-${line.productId}-${i}`}
                  className="grid grid-cols-[2fr_1fr_2fr_auto] gap-2 items-center"
                >
                  <Select
                    value={line.productId}
                    onValueChange={(v) =>
                      setOrderLines((ls) =>
                        ls.map((l, idx) =>
                          idx === i ? { ...l, productId: v } : l,
                        ),
                      )
                    }
                  >
                    <SelectTrigger data-ocid={`order-product-${i}`}>
                      <SelectValue placeholder="Product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem
                          key={p.id.toString()}
                          value={p.id.toString()}
                        >
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) =>
                      setOrderLines((ls) =>
                        ls.map((l, idx) =>
                          idx === i ? { ...l, quantity: e.target.value } : l,
                        ),
                      )
                    }
                    data-ocid={`order-qty-${i}`}
                  />
                  <Input
                    placeholder="Scheme (e.g. 10+1)"
                    value={line.scheme}
                    onChange={(e) =>
                      setOrderLines((ls) =>
                        ls.map((l, idx) =>
                          idx === i ? { ...l, scheme: e.target.value } : l,
                        ),
                      )
                    }
                    data-ocid={`order-scheme-${i}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setOrderLines((ls) => ls.filter((_, idx) => idx !== i))
                    }
                    disabled={orderLines.length === 1}
                    className="h-9 w-9"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <Label htmlFor="ord-remarks" className="text-xs mb-1 block">
                Remarks
              </Label>
              <textarea
                id="ord-remarks"
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-body resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
                value={orderRemarks}
                onChange={(e) => setOrderRemarks(e.target.value)}
                data-ocid="order-remarks"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSubmitOrder}
                disabled={submitting}
                data-ocid="submit-order"
              >
                {submitting && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                )}
                Submit Order
              </Button>
              <Button variant="ghost" onClick={() => setTab("orders")}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
