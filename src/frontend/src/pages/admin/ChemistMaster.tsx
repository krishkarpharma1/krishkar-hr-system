import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import type { ChemistInfo } from "../../backend.d";
import { ExportButton } from "../../components/ExportButton";
import {
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import { exportToExcel, logExportToAuditTrail } from "../../lib/exportUtils";
import { useAuthStore } from "../../store/authStore";

export default function ChemistMaster({ portalRole }: { portalRole?: Role }) {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const effectiveRole = portalRole ?? session?.role ?? Role.Admin;

  const [chemists, setChemists] = useState<ChemistInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<
    "all" | "active" | "inactive"
  >("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listChemists();
      setChemists(list);
    } catch {
      toast.error("Failed to load chemist data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return chemists.filter((c) => {
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.territory ?? "").toLowerCase().includes(q);
      const matchActive =
        filterActive === "all" ||
        (filterActive === "active" && c.isActive) ||
        (filterActive === "inactive" && !c.isActive);
      return matchSearch && matchActive;
    });
  }, [chemists, search, filterActive]);

  function handleExport() {
    exportToExcel({
      reportName: "Chemist Master",
      columns: [
        { key: "chemistName", label: "Chemist Name", type: "text" },
        { key: "address", label: "Address", type: "text" },
        { key: "territory", label: "Territory", type: "text" },
        { key: "contactNumber", label: "Contact Number", type: "text" },
        {
          key: "outstandingBalance",
          label: "Outstanding Balance",
          type: "number",
        },
      ],
      data: filtered.map((c) => ({
        chemistName: c.name ?? "",
        address: c.address ?? "",
        territory: c.territory ?? "",
        contactNumber: c.contactPhone ?? "",
        outstandingBalance: 0,
      })),
      activeFilters: search ? `Name/Territory: ${search}` : "",
      companyName: companyProfile?.companyName ?? "Krishkar Pharmaceuticals",
    });
    logExportToAuditTrail(
      {
        userId: String(session?.userId ?? ""),
        userName: String(session?.name ?? ""),
        role: String(session?.role ?? ""),
      },
      "Chemist Master",
      search ? `Name/Territory: ${search}` : "",
      filtered.length,
    );
  }

  return (
    <PortalLayout portalRole={effectiveRole}>
      <PageHeader
        title="Chemist Master"
        subtitle="View and export chemist records"
        actions={
          <ExportButton
            onClick={handleExport}
            disabled={filtered.length === 0}
            tooltip={
              filtered.length === 0
                ? "No data to export"
                : search
                  ? "Exports currently filtered data"
                  : "Export all data"
            }
            data-ocid="chemist-master.export-button"
          />
        }
      />
      <PageContent>
        {/* Search + Filter */}
        <SectionCard>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs mb-1 block">
                Search (Name, Territory)
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  data-ocid="chemist-master.search-input"
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
                  data-ocid="chemist-master.filter-active"
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
        <SectionCard title={`Chemists (${filtered.length})`}>
          {loading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="py-12 text-center"
              data-ocid="chemist-master.empty_state"
            >
              <p className="text-muted-foreground text-sm">
                {search
                  ? "No chemists match your search."
                  : "No chemist records found."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    {[
                      "Sr",
                      "Chemist Name",
                      "Shop Name",
                      "Territory",
                      "Address",
                      "Contact",
                      "Status",
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
                  {filtered.map((c, i) => (
                    <tr
                      key={String(c.id)}
                      className={`hover:bg-muted/20 ${!c.isActive ? "opacity-60" : ""}`}
                      data-ocid={`chemist-master.item.${i + 1}`}
                    >
                      <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2 font-body font-medium text-foreground">
                        {c.name}
                      </td>
                      <td className="px-3 py-2 text-sm">{c.shopName ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {c.territory ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">
                        {c.address ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {c.contactPhone ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          className={`text-xs ${
                            c.isActive
                              ? "bg-green-100 text-green-700 border-green-300"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {c.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </PageContent>
    </PortalLayout>
  );
}
