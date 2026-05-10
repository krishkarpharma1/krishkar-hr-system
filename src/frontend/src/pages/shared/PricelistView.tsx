import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileSpreadsheet, Printer, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { Role } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import {
  buildBrandingExcelRows,
  buildBrandingHtml,
} from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";
import type { PricelistProductInfo } from "../../types";

function fmt(n: number) {
  return n.toFixed(2);
}

interface PricelistViewProps {
  portalRole: Role;
}

export default function PricelistView({ portalRole }: PricelistViewProps) {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const [products, setProducts] = useState<PricelistProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"srNo" | "name">("srNo");

  const load = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    try {
      const data = await api.listPricelistProducts(session.token);
      setProducts(data);
    } catch {
      toast.error("Failed to load pricelist");
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.composition.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sortBy === "srNo"
        ? Number(a.srNo) - Number(b.srNo)
        : a.name.localeCompare(b.name),
    );

  function handlePrint() {
    const headerHtml = buildBrandingHtml(companyProfile ?? null);
    const rows = filtered
      .map(
        (p, i) =>
          `<tr style="border-bottom:1px solid #eee;">
            <td style="padding:6px 8px;text-align:center;">${i + 1}</td>
            <td style="padding:6px 8px;">${p.name}</td>
            <td style="padding:6px 8px;color:#555;">${p.composition}</td>
            <td style="padding:6px 8px;text-align:right;">₹${fmt(p.mrp)}</td>
            <td style="padding:6px 8px;text-align:right;">₹${fmt(p.pts)}</td>
            <td style="padding:6px 8px;text-align:right;">₹${fmt(p.ptr)}</td>
          </tr>`,
      )
      .join("");

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Products Pricelist</title>
      <style>
        @page { size: A4; margin: 0.5cm 2cm 1.5cm 2cm; }
        body { font-family: Arial, sans-serif; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #00BCD4; color: #fff; padding: 8px; text-align: left; font-size: 11px; }
        th:nth-child(1) { text-align: center; width: 48px; }
        th:nth-child(4), th:nth-child(5), th:nth-child(6) { text-align: right; }
        td:nth-child(1) { text-align: center; }
        td:nth-child(4), td:nth-child(5), td:nth-child(6) { text-align: right; }
        .footer-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #00BCD4; padding: 8px 0; text-align: center; }
        .footer-bar span { color: #fff; font-weight: bold; font-size: 12px; }
      </style>
    </head><body>
      ${headerHtml}
      <h3 style="margin-bottom:12px;font-family:Arial,sans-serif;">Products Pricelist</h3>
      <table>
        <thead><tr>
          <th>#</th><th>Product Name</th><th>Composition</th>
          <th>MRP (₹)</th><th>PTS (₹)</th><th>PTR (₹)</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer-bar"><span>Krishkar Pharmaceuticals : Empowering Health</span></div>
    </body></html>`);
    win.document.close();
    win.print();
  }

  function handleExportExcel() {
    if (filtered.length === 0) {
      toast.warning("No products to export");
      return;
    }
    const brandRows = buildBrandingExcelRows(companyProfile ?? null);
    const dataRows = filtered.map((p, i) => ({
      "Sr. No.": i + 1,
      "Product Name": p.name,
      Composition: p.composition,
      "MRP (₹)": p.mrp,
      "PTS (₹)": p.pts,
      "PTR (₹)": p.ptr,
    }));
    const allRows = [
      ...brandRows,
      { "": "Products Pricelist" },
      { "": "" },
      ...(dataRows as unknown as Record<string, unknown>[]),
    ];
    const ws = XLSX.utils.json_to_sheet(allRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pricelist");
    XLSX.writeFile(
      wb,
      `products-pricelist-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    toast.success(`Exported ${filtered.length} products`);
  }

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Products Pricelist"
        subtitle="Company product pricelist with MRP, PTS, and PTR"
      />
      <PageContent>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name or composition…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
              data-ocid="pricelist-view-search"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body ml-1">
            <span>Sort:</span>
            {(["srNo", "name"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSortBy(s)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  sortBy === s
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                {s === "srNo" ? "Sr. No." : "Name"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-9 gap-1.5"
              data-ocid="pricelist-view-print-btn"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="h-9 gap-1.5"
              data-ocid="pricelist-view-export-btn"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export Excel</span>
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {[
                    "Sr. No.",
                    "Product Name",
                    "Composition",
                    "MRP (₹)",
                    "PTS (₹)",
                    "PTR (₹)",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold font-display text-muted-foreground whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }, (_, i) => `skel-${i}`).map((k) => (
                    <tr key={k} className="border-b border-border/50">
                      {Array.from({ length: 6 }, (_, j) => `${k}-c${j}`).map(
                        (ck) => (
                          <td key={ck} className="px-4 py-3">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ),
                      )}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <FileSpreadsheet className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm font-body text-muted-foreground">
                        {search
                          ? "No products match your search"
                          : "No products in pricelist yet"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((p, idx) => (
                    <tr
                      key={String(p.id)}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      data-ocid={`pricelist-view-row-${String(p.id)}`}
                    >
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.composition}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        ₹{fmt(p.mrp)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        ₹{fmt(p.pts)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        ₹{fmt(p.ptr)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t border-border bg-muted/20">
              <span className="text-xs text-muted-foreground font-body">
                {filtered.length} product{filtered.length !== 1 ? "s" : ""}
                {search ? " (filtered)" : ""}
              </span>
            </div>
          )}
        </div>
      </PageContent>
    </PortalLayout>
  );
}
