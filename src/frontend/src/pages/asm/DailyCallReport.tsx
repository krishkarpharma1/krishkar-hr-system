/**
 * ASM Daily Call Report page.
 * Shows the Doctor Call tab when the ASM has an active "Additional Role: MR" charge.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  ClipboardList,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { AdditionalCharge } from "../../types";
import ASMReports from "./ASMReports";

function isActiveMRCharge(charge: AdditionalCharge): boolean {
  const now = Date.now() * 1_000_000;
  const from = Number(charge.effectiveFrom);
  const to = Number(charge.effectiveTo);
  // chargeType is a Motoko variant; check for Role variant and MR additionalRole
  const ct = charge.chargeType as unknown as Record<string, unknown>;
  const isRole = "Role" in ct;
  const isMRRole = charge.additionalRole === "MR";
  return isRole && isMRRole && from <= now && to >= now;
}

// Lazy-import the full MR Doctor Call component from DailyCallReport
import { Suspense, lazy } from "react";
const MRDailyCallReport = lazy(() => import("../mr/DailyCallReport"));

type DailyTab = "reports" | "doctor-call";

export default function ASMDailyCallReport() {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const userId = session?.userId ?? BigInt(0);
  const [charges, setCharges] = useState<AdditionalCharge[]>([]);
  const [loadingCharges, setLoadingCharges] = useState(true);
  const [activeTab, setActiveTab] = useState<DailyTab>("reports");

  useEffect(() => {
    if (!token) return;
    api
      .getActiveChargesForEmployee(token, userId)
      .then(setCharges)
      .finally(() => setLoadingCharges(false));
  }, [token, userId]);

  const hasMRCharge = !loadingCharges && charges.some(isActiveMRCharge);

  if (loadingCharges) {
    return (
      <PortalLayout portalRole={Role.ASM}>
        <PageHeader title="Daily Reports" subtitle="Loading…" />
        <PageContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Loading…
          </div>
        </PageContent>
      </PortalLayout>
    );
  }

  if (!hasMRCharge) {
    // No active MR charge — just show the standard ASM Reports
    return <ASMReports />;
  }

  // Has active MR charge — show tabbed view with Doctor Call
  return (
    <PortalLayout portalRole={Role.ASM}>
      <PageHeader
        title="Daily Reports"
        subtitle="Report submissions and doctor visits"
        actions={
          <Badge className="gap-1.5 bg-primary/15 text-primary border border-primary/30">
            <Stethoscope className="w-3 h-3" /> Acting MR Charge Active
          </Badge>
        }
      />
      <PageContent>
        {/* Notice banner */}
        <div className="flex items-start gap-2 p-3 mb-4 rounded-lg border border-primary/30 bg-primary/5 text-sm text-primary">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Additional MR Charge Active</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You have an active "Additional Role: MR" charge. The Doctor Call
              tab below lets you submit doctor visit entries just like an MR.
            </p>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as DailyTab)}
        >
          <TabsList className="mb-4">
            <TabsTrigger
              value="reports"
              className="gap-1.5"
              data-ocid="tab-asm-reports"
            >
              <ClipboardList className="w-3.5 h-3.5" /> Call Reports
            </TabsTrigger>
            <TabsTrigger
              value="doctor-call"
              className="gap-1.5"
              data-ocid="tab-doctor-call"
            >
              <Stethoscope className="w-3.5 h-3.5" /> Doctor Call{" "}
              <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-primary/20 text-primary border border-primary/30">
                MR
              </Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="reports">
            {/* Embed ASM Reports inline (without double PortalLayout) */}
            <div data-ocid="asm-reports-section">
              <ASMReportsInline />
            </div>
          </TabsContent>
          <TabsContent value="doctor-call">
            {/* Render MR's full Daily Call Report — includes station/doctor/product UI */}
            <Suspense
              fallback={
                <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                  Loading Doctor Call form…
                </div>
              }
            >
              <MRDoctorCallOnly />
            </Suspense>
          </TabsContent>
        </Tabs>
      </PageContent>
    </PortalLayout>
  );
}

/**
 * A lightweight wrapper that shows only the MR daily call report page content
 * without its own PortalLayout (we're already inside one).
 * We render MRDailyCallReport inside a detached subtree so layout doesn't nest.
 */
function MRDoctorCallOnly() {
  return (
    <div className="rounded-lg border border-border bg-muted/10 p-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
        <Stethoscope className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">
          Doctor Call Entry (as acting MR)
        </span>
        <Badge variant="outline" className="ml-auto text-xs">
          MR Charge
        </Badge>
      </div>
      <Suspense fallback={null}>
        <MRDailyCallReport />
      </Suspense>
    </div>
  );
}

/**
 * Shows the ASM's own submitted reports list inline (without PortalLayout).
 */
function ASMReportsInline() {
  const [reports, setReports] = useState<
    import("../../types").CallReportInfo[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listSubmittedReports()
      .then(setReports)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        <TrendingUp className="w-4 h-4" /> Submitted Call Reports
      </div>
      {loading ? (
        <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
          Loading…
        </div>
      ) : reports.length === 0 ? (
        <div
          className="h-24 flex items-center justify-center text-muted-foreground text-sm"
          data-ocid="asm-reports-empty"
        >
          No submitted call reports found.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    "Date",
                    "Station Type",
                    "Doctors Visited",
                    "DA (₹)",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-left"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.slice(0, 30).map((r) => (
                  <tr
                    key={r.id.toString()}
                    className="border-b border-border/50 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{r.date}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {r.stationType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.doctorsVisited.length}
                    </td>
                    <td className="px-4 py-3 font-mono text-accent font-semibold">
                      ₹{r.daAmount?.toString() ?? "0"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
