/**
 * DoctorProductCoverageReport — Phase 2 SFA
 * Shows which products are detailed to which doctors and how often.
 * Accessible to ASM, RSM, ZSM, Admin.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  Filter,
  Printer,
  RefreshCw,
  Stethoscope,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Role } from "../../backend";
import { Role as RoleEnum } from "../../backend";
import type { CallReportDetail } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import ScrollableTable from "../../components/ScrollableTable";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import {
  buildBrandingExcelRows,
  buildBrandingHtml,
} from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";
import type { UserInfo } from "../../types";
import { formatDate } from "../../utils/dateFormatter";

interface DoctorRow {
  doctorId: string;
  doctorName: string;
  specialization: string;
  station: string;
  productsDetailed: string[];
  visitCount: number;
  lastVisited: string;
  isCore: boolean;
}

interface ProductCoverageRow {
  productName: string;
  doctorCount: number;
  totalDetailings: number;
}

interface DoctorProductCoverageReportProps {
  portalRole?: Role;
}

export default function DoctorProductCoverageReport({
  portalRole = RoleEnum.ASM,
}: DoctorProductCoverageReportProps) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const userId = session?.userId ?? BigInt(0);
  const { companyProfile } = useCompanyProfile();

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today.toISOString().slice(0, 10));
  const [selectedMrId, setSelectedMrId] = useState<string>("");
  const [mrList, setMrList] = useState<UserInfo[]>([]);
  const [mrLoading, setMrLoading] = useState(false);
  const [doctorRows, setDoctorRows] = useState<DoctorRow[]>([]);
  const [productRows, setProductRows] = useState<ProductCoverageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"doctor" | "product">("doctor");

  const isAdminHR =
    portalRole === RoleEnum.Admin || portalRole === RoleEnum.HRManager;

  useEffect(() => {
    if (!token) return;
    setMrLoading(true);
    const fetchMrs = async () => {
      try {
        let mrs: UserInfo[] = [];
        if (isAdminHR) {
          const all = await api.listAllUsers(token);
          mrs = all.filter((u) => u.role === "MR");
        } else {
          const reportees = await api.listReportees(token, userId);
          mrs = reportees.filter((u) => u.role === "MR");
        }
        setMrList(mrs);
      } catch {
        // silent
      } finally {
        setMrLoading(false);
      }
    };
    fetchMrs();
  }, [token, userId, isAdminHR]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const fromTs = BigInt(new Date(fromDate).getTime()) * BigInt(1_000_000);
      const toTs =
        BigInt(new Date(`${toDate}T23:59:59`).getTime()) * BigInt(1_000_000);

      let reports: CallReportDetail[] = [];
      if (selectedMrId) {
        reports = await api.listCallReportsByMr(
          token,
          BigInt(selectedMrId),
          fromTs,
          toTs,
        );
      } else {
        // All team MRs
        const mrIds = mrList.map((m) => m.id);
        const allReports = await Promise.all(
          mrIds.map((id) =>
            api
              .listCallReportsByMr(token, id, fromTs, toTs)
              .catch(() => [] as CallReportDetail[]),
          ),
        );
        reports = allReports.flat();
      }

      // Build doctor-level rows from CallReportDetail.doctorVisits
      const doctorMap = new Map<string, DoctorRow>();
      for (const r of reports) {
        for (const dv of r.doctorVisits) {
          const did = String(dv.doctorId);
          const existing = doctorMap.get(did) ?? {
            doctorId: did,
            doctorName: dv.doctorName,
            specialization: dv.specialization,
            station: dv.station,
            productsDetailed: [],
            visitCount: 0,
            lastVisited: r.date ?? "",
            isCore: dv.category === "Core",
          };
          existing.visitCount += 1;
          if (r.date && r.date > existing.lastVisited)
            existing.lastVisited = r.date;
          for (const p of dv.products) {
            const pName =
              (p as unknown as Record<string, string>).productName ?? String(p);
            if (!existing.productsDetailed.includes(pName)) {
              existing.productsDetailed.push(pName);
            }
          }
          doctorMap.set(did, existing);
        }
      }
      const dRows = Array.from(doctorMap.values()).sort(
        (a, b) => b.visitCount - a.visitCount,
      );
      setDoctorRows(dRows);

      // Build product-level rows
      const productMap = new Map<
        string,
        { doctorSet: Set<string>; total: number }
      >();
      for (const r of reports) {
        for (const dv of r.doctorVisits) {
          const did = String(dv.doctorId);
          for (const p of dv.products) {
            const pName =
              (p as unknown as Record<string, string>).productName ?? String(p);
            const entry = productMap.get(pName) ?? {
              doctorSet: new Set(),
              total: 0,
            };
            entry.doctorSet.add(did);
            entry.total += 1;
            productMap.set(pName, entry);
          }
        }
      }
      const pRows: ProductCoverageRow[] = Array.from(productMap.entries())
        .map(([name, v]) => ({
          productName: name,
          doctorCount: v.doctorSet.size,
          totalDetailings: v.total,
        }))
        .sort((a, b) => b.totalDetailings - a.totalDetailings);
      setProductRows(pRows);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }, [token, fromDate, toDate, selectedMrId, mrList]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const uncoveredDoctors = doctorRows.filter((d) => d.visitCount === 0);
  const coveredDoctors = doctorRows.filter((d) => d.visitCount > 0);

  const exportPdf = () => {
    const brandingHtml = buildBrandingHtml(companyProfile ?? null);
    const rows = coveredDoctors
      .map(
        (d) => `<tr>
          <td>${d.doctorName}</td>
          <td>${d.specialization || "—"}</td>
          <td>${d.station}</td>
          <td>${d.productsDetailed.join(", ") || "—"}</td>
          <td style="text-align:center">${d.visitCount}</td>
          <td>${formatDate(d.lastVisited)}</td>
          <td>${d.isCore ? "Core" : "—"}</td>
        </tr>`,
      )
      .join("");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Doctor-Product Coverage</title>${brandingHtml}
      <style>
        h3{margin:10px 0 6px;font-size:14px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{background:#0284c7;color:#fff;padding:7px 8px;text-align:left}
        td{padding:6px 8px;border-bottom:1px solid #eee}
      </style></head><body>
      <h3>Doctor-Product Coverage Report — ${formatDate(fromDate)} to ${formatDate(toDate)}</h3>
      <table><thead><tr>
        <th>Doctor</th><th>Specialization</th><th>Station</th>
        <th>Products Detailed</th><th>Visits</th><th>Last Visited</th><th>Core</th>
      </tr></thead><tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  const exportExcel = () => {
    if (doctorRows.length === 0) {
      toast.info("No data to export.");
      return;
    }
    const brandingRows = buildBrandingExcelRows(companyProfile ?? null).map(
      (r) => {
        const val = Object.values(r)[0] ?? "";
        return [val, "", "", "", "", "", ""] as string[];
      },
    );
    const header = [
      "Doctor Name",
      "Specialization",
      "Station",
      "Products Detailed",
      "Visit Count",
      "Last Visited",
      "Core Doctor",
    ];
    const dataRows = coveredDoctors.map((d) => [
      d.doctorName,
      d.specialization,
      d.station,
      d.productsDetailed.join("; "),
      String(d.visitCount),
      formatDate(d.lastVisited),
      d.isCore ? "Yes" : "No",
    ]);
    const csv = [...brandingRows, header, ...dataRows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doctor-product-coverage-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully");
  };

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Doctor-Product Coverage Report"
        subtitle="Track which products have been detailed to each doctor and coverage frequency"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportPdf}
              className="gap-1.5"
              data-ocid="doc-product.print_button"
            >
              <Printer className="w-4 h-4" /> Print PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportExcel}
              className="gap-1.5"
              data-ocid="doc-product.export_button"
            >
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              Filters
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs mb-1 block text-muted-foreground">
                From Date
              </Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9"
                data-ocid="doc-product.from_date"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block text-muted-foreground">
                To Date
              </Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9"
                data-ocid="doc-product.to_date"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block text-muted-foreground">
                MR {mrLoading && "(loading…)"}
              </Label>
              {mrLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <select
                  className="w-full h-9 border border-input bg-background px-3 text-sm rounded-md"
                  value={selectedMrId}
                  onChange={(e) => setSelectedMrId(e.target.value)}
                  data-ocid="doc-product.mr_select"
                >
                  <option value="">— All MRs —</option>
                  {mrList.map((mr) => (
                    <option key={String(mr.id)} value={String(mr.id)}>
                      {mr.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              onClick={fetchData}
              className="gap-1.5"
              data-ocid="doc-product.apply_button"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Apply
            </Button>
          </div>
        </div>

        {/* Views */}
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as "doctor" | "product")}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="doctor" data-ocid="doc-product.doctor_tab">
              Doctor View
            </TabsTrigger>
            <TabsTrigger value="product" data-ocid="doc-product.product_tab">
              Product Coverage
            </TabsTrigger>
          </TabsList>

          <TabsContent value="doctor">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : coveredDoctors.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
                data-ocid="doc-product.empty_state"
              >
                <Stethoscope className="w-10 h-10 opacity-20" />
                <p className="text-sm">
                  No doctor visits found for the selected period.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-card border border-border rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between items-center">
                    <h3 className="font-display font-semibold text-sm text-foreground">
                      Covered Doctors ({coveredDoctors.length})
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(fromDate)} to {formatDate(toDate)}
                    </span>
                  </div>
                  <ScrollableTable>
                    <table
                      className="w-full text-sm"
                      data-ocid="doc-product.table"
                    >
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {[
                            "Doctor Name",
                            "Specialization",
                            "Station",
                            "Products Detailed",
                            "Visits",
                            "Last Visited",
                            "Type",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {coveredDoctors.map((d, i) => (
                          <tr
                            key={d.doctorId}
                            className="border-b border-border/50 hover:bg-muted/20"
                            data-ocid={`doc-product.item.${i + 1}`}
                          >
                            <td className="px-3 py-2.5 font-medium text-foreground">
                              {d.doctorName}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">
                              {d.specialization || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-sm">
                              {d.station || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-xs max-w-[200px]">
                              {d.productsDetailed.length > 0 ? (
                                d.productsDetailed.join(", ")
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center font-semibold text-primary">
                              {d.visitCount}
                            </td>
                            <td className="px-3 py-2.5 text-xs font-mono">
                              {formatDate(d.lastVisited)}
                            </td>
                            <td className="px-3 py-2.5">
                              {d.isCore ? (
                                <Badge className="text-xs bg-primary/20 text-primary border-primary/30">
                                  Core
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Non-Core
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollableTable>
                </div>
                {uncoveredDoctors.length > 0 && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-destructive mb-2">
                      Uncovered Doctors ({uncoveredDoctors.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {uncoveredDoctors.map((d) => (
                        <Badge
                          key={d.doctorId}
                          variant="outline"
                          className="text-xs border-destructive/30 text-destructive"
                        >
                          {d.doctorName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="product">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : productRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <Stethoscope className="w-10 h-10 opacity-20" />
                <p className="text-sm">
                  No product detailing data for the selected period.
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/20">
                  <h3 className="font-display font-semibold text-sm text-foreground">
                    Product-wise Coverage
                  </h3>
                </div>
                <ScrollableTable>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {[
                          "Product Name",
                          "Doctors Covered",
                          "Total Detailings",
                          "Coverage Bar",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.map((p, i) => {
                        const maxDetailings = Math.max(
                          ...productRows.map((r) => r.totalDetailings),
                        );
                        const pct =
                          maxDetailings > 0
                            ? (p.totalDetailings / maxDetailings) * 100
                            : 0;
                        return (
                          <tr
                            key={p.productName}
                            className="border-b border-border/50 hover:bg-muted/20"
                            data-ocid={`doc-product.product.${i + 1}`}
                          >
                            <td className="px-3 py-2.5 font-medium text-foreground">
                              {p.productName}
                            </td>
                            <td className="px-3 py-2.5 text-center font-semibold text-primary">
                              {p.doctorCount}
                            </td>
                            <td className="px-3 py-2.5 text-center font-semibold text-foreground">
                              {p.totalDetailings}
                            </td>
                            <td className="px-3 py-2.5 min-w-[120px]">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollableTable>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageContent>
    </PortalLayout>
  );
}
