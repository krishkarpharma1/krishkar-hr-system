import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  FileDown,
  RefreshCw,
  Wrench,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Role } from "../../backend";
import type {
  CompanyProfile,
  HealthAnomaly,
  HealthCheckReport,
} from "../../backend.d";
import type { RepairLog } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import type { RepairResult } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtTs(ns: bigint): string {
  const ms = Number(ns) / 1_000_000;
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

// ─── Confirmation Modal ───────────────────────────────────────────────────────

function RepairConfirmModal({
  anomalyTypes,
  onConfirm,
  onCancel,
  repairing,
}: {
  anomalyTypes: string[];
  onConfirm: () => void;
  onCancel: () => void;
  repairing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={repairing ? undefined : onCancel}
        onKeyDown={(e) => !repairing && e.key === "Escape" && onCancel()}
        role="presentation"
      />
      {/* Panel */}
      <dialog
        open
        className="relative bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-6 m-0"
        aria-labelledby="repair-modal-title"
        data-ocid="repair.dialog"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Wrench className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2
              id="repair-modal-title"
              className="text-base font-display font-bold text-foreground"
            >
              Confirm Auto-Repair
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Auto-Repair will attempt to fix the following anomalies. This
              action cannot be undone.
            </p>
          </div>
        </div>

        {/* Anomaly type list */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">
            Anomalies to repair
          </p>
          <ul className="space-y-1">
            {anomalyTypes.map((t) => (
              <li
                key={t}
                className="flex items-center gap-2 text-sm text-amber-900"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="font-mono text-xs">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={repairing}
            data-ocid="repair.cancel_button"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={repairing}
            data-ocid="repair.confirm_button"
            className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0 font-bold"
          >
            {repairing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Wrench className="w-4 h-4" />
            )}
            {repairing ? "Repairing…" : "Repair Now"}
          </Button>
        </div>
      </dialog>
    </div>
  );
}

// ─── Anomaly Table (with optional Fix This column) ───────────────────────────

function AnomalyTable({
  anomalies,
  onFixThis,
  repairingType,
}: {
  anomalies: HealthAnomaly[];
  onFixThis?: (anomalyType: string) => void;
  repairingType?: string | null;
}) {
  if (anomalies.length === 0) return null;
  const showFixCol = !!onFixThis;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm font-body min-w-[520px]">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider font-display text-muted-foreground whitespace-nowrap">
              Anomaly Type
            </th>
            <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider font-display text-muted-foreground">
              Description
            </th>
            <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider font-display text-muted-foreground">
              Affected Records
            </th>
            {showFixCol && (
              <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider font-display text-muted-foreground whitespace-nowrap">
                Action
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {anomalies.map((a, i) => (
            <tr
              key={`${a.anomalyType}-${i}`}
              className={`border-b border-border last:border-0 ${i % 2 === 0 ? "bg-card" : "bg-muted/20"}`}
              data-ocid={`anomaly-row.${i + 1}`}
            >
              <td className="px-4 py-3 font-mono text-xs text-foreground font-semibold whitespace-nowrap">
                {a.anomalyType}
              </td>
              <td className="px-4 py-3 text-foreground">{a.description}</td>
              <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                {a.affectedIds.length === 0
                  ? "—"
                  : a.affectedIds.slice(0, 10).join(", ") +
                    (a.affectedIds.length > 10
                      ? ` … +${a.affectedIds.length - 10} more`
                      : "")}
              </td>
              {showFixCol && (
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onFixThis?.(a.anomalyType)}
                    disabled={!!repairingType}
                    data-ocid={`anomaly-fix-button.${i + 1}`}
                    className="h-7 px-2.5 text-xs border-amber-400 text-amber-700 hover:bg-amber-50 font-semibold gap-1"
                  >
                    {repairingType === a.anomalyType ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Wrench className="w-3 h-3" />
                    )}
                    {repairingType === a.anomalyType ? "Fixing…" : "Fix This"}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryRow({ report }: { report: HealthCheckReport }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr
        className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
        onClick={() => setExpanded((p) => !p)}
        onKeyDown={(e) => e.key === "Enter" && setExpanded((p) => !p)}
        tabIndex={0}
        data-ocid="health-history.row"
      >
        <td className="px-4 py-3 text-sm text-foreground font-mono whitespace-nowrap">
          {fmtTs(report.timestamp)}
        </td>
        <td className="px-4 py-3">
          {report.passed ? (
            <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
              Passed
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">
              Failed
            </Badge>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-foreground text-right font-mono">
          {String(report.anomalyCount)}
        </td>
        <td className="px-4 py-3 text-right">
          {report.anomalies.length > 0 &&
            (expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            ))}
        </td>
      </tr>
      {expanded && report.anomalies.length > 0 && (
        <tr className="border-b border-border last:border-0 bg-muted/10">
          <td colSpan={4} className="px-4 py-3">
            <AnomalyTable anomalies={report.anomalies} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Repair History Row ───────────────────────────────────────────────────────

function RepairHistoryRow({ record }: { record: RepairLog }) {
  return (
    <tr
      className="border-b border-border last:border-0 hover:bg-muted/20"
      data-ocid="repair-history.row"
    >
      <td className="px-4 py-3 text-sm text-foreground font-mono whitespace-nowrap">
        {fmtTs(record.timestamp)}
      </td>
      <td className="px-4 py-3 text-sm text-foreground">
        {record.repairType || "—"}
      </td>
      <td className="px-4 py-3 text-sm text-foreground text-right font-mono">
        {String(record.fixedCount)}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
        {record.details || "—"}
      </td>
    </tr>
  );
}

// ─── PDF print helper ─────────────────────────────────────────────────────────

function printHealthReport(
  report: HealthCheckReport | null,
  company: CompanyProfile | null,
) {
  if (!report) return;
  const companyName = company?.companyName ?? "Krishkar Pharmaceuticals";
  const companyAddress = company?.address ?? "";
  const logoUrl = company?.logoUrl ?? "";
  const ts = fmtTs(report.timestamp);
  const status = report.passed ? "All Clear" : "Anomalies Detected";
  const statusColor = report.passed ? "#16a34a" : "#dc2626";

  const anomalyRows =
    report.anomalies.length === 0
      ? '<tr><td colspan="3" style="padding:12px 16px;text-align:center;color:#6b7280;">No anomalies found</td></tr>'
      : report.anomalies
          .map(
            (a, i) => `
          <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"};">
            <td style="padding:10px 16px;font-family:monospace;font-size:12px;font-weight:600;white-space:nowrap;border-bottom:1px solid #e5e7eb;">${a.anomalyType}</td>
            <td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #e5e7eb;">${a.description}</td>
            <td style="padding:10px 16px;font-family:monospace;font-size:11px;color:#6b7280;border-bottom:1px solid #e5e7eb;">${
              a.affectedIds.length === 0
                ? "—"
                : a.affectedIds.slice(0, 8).join(", ") +
                  (
                    a.affectedIds.length > 8
                      ? ` +${a.affectedIds.length - 8} more`
                      : ""
                  )
            }</td>
          </tr>`,
          )
          .join("");

  const html = `<!DOCTYPE html><html><head><title>System Health Report</title>
<style>
  @page { size: A4; margin: 0.5cm 2cm 0cm 2cm; }
  body { font-family: Arial, sans-serif; font-size: 14px; margin: 0; padding: 0; }
  .header { display: flex; align-items: center; gap: 16px; padding: 16px 0 12px; border-bottom: 2px solid #00bcd4; margin-bottom: 20px; }
  .logo { width: 60px; height: 60px; object-fit: contain; }
  .company-name { font-size: 20px; font-weight: 700; color: #0e1726; }
  .company-addr { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .report-title { font-size: 18px; font-weight: 700; color: #0e1726; margin-bottom: 4px; }
  .report-subtitle { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
  .status-box { padding: 12px 20px; border-radius: 8px; display: inline-flex; align-items: center; gap: 10px; font-weight: 700; font-size: 15px; color: #fff; background: ${statusColor}; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead tr { background: #f3f4f6; }
  th { padding: 10px 16px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
  .branded-footer { position: fixed; bottom: 0; left: 0; right: 0; background: #00bcd4 !important; color: #fff !important; font-weight: 700 !important; text-align: center !important; padding: 9px 16px !important; font-size: 12px !important; print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
</style>
</head><body>
<div class="header">
  ${logoUrl ? `<img class="logo" src="${logoUrl}" alt="Logo" />` : ""}
  <div>
    <div class="company-name">${companyName}</div>
    ${companyAddress ? `<div class="company-addr">${companyAddress}</div>` : ""}
  </div>
</div>
<div class="report-title">System Health Report</div>
<div class="report-subtitle">Generated: ${ts} &nbsp;|&nbsp; Anomalies: ${String(report.anomalyCount)}</div>
<div class="status-box">${report.passed ? "✓" : "✗"} ${status}</div>
<table>
  <thead><tr><th>Anomaly Type</th><th>Description</th><th>Affected Records</th></tr></thead>
  <tbody>${anomalyRows}</tbody>
</table>
<div class="branded-footer">Krishkar Pharmaceuticals : Empowering Health</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const { session } = useAuthStore();
  const navigate = useNavigate();

  const [latest, setLatest] = useState<HealthCheckReport | null>(null);
  const [history, setHistory] = useState<HealthCheckReport[]>([]);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [repairHistory, setRepairHistory] = useState<RepairLog[]>([]);
  const [repairHistoryOpen, setRepairHistoryOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [runningCheck, setRunningCheck] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Repair state
  const [repairModal, setRepairModal] = useState<{
    types: string[];
  } | null>(null);
  const [repairing, setRepairing] = useState(false);
  // For per-row "Fix This" inline repairing
  const [repairingType, setRepairingType] = useState<string | null>(null);
  const [repairSuccess, setRepairSuccess] = useState<string | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);

  // Admin-only guard
  useEffect(() => {
    if (session && session.role !== "Admin") {
      navigate({ to: "/" });
    }
  }, [session, navigate]);

  const loadDataRef = useRef<((token: string) => Promise<void>) | null>(null);

  loadDataRef.current = async (token: string) => {
    setError(null);
    try {
      const [latestResult, historyResult, companyResult, repairHistResult] =
        await Promise.all([
          api.getLatestHealthCheck(token).catch(() => null),
          api
            .getHealthCheckHistory(token, BigInt(10))
            .catch(() => [] as HealthCheckReport[]),
          api.getCompanyProfile(token).catch(() => null),
          api.getRepairHistory(token, 10).catch(() => [] as RepairLog[]),
        ]);
      setLatest(latestResult ?? null);
      setHistory(Array.isArray(historyResult) ? historyResult : []);
      setCompany(companyResult ?? null);
      setRepairHistory(Array.isArray(repairHistResult) ? repairHistResult : []);
    } catch {
      setError("Failed to load health check data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  function loadData(token: string) {
    loadDataRef.current?.(token);
  }

  useEffect(() => {
    if (!session?.token) return;
    loadDataRef.current?.(session.token);
  }, [session?.token]);

  async function handleRunCheck() {
    if (!session?.token) return;
    setRunningCheck(true);
    try {
      const result = await api.runHealthCheckNow(session.token);
      setLatest(result);
      setHistory((prev) => [result, ...prev].slice(0, 10));
    } catch {
      setError("Health check failed to run. Please try again.");
    } finally {
      setRunningCheck(false);
    }
  }

  // Opens the confirmation modal for all anomalies
  function handleAutoRepairClick() {
    if (!latest || latest.passed) return;
    const types = latest.anomalies.map((a) => a.anomalyType);
    setRepairModal({ types });
  }

  // Opens the confirmation modal for a single anomaly row
  function handleFixThis(anomalyType: string) {
    setRepairModal({ types: [anomalyType] });
  }

  async function handleRepairConfirm() {
    if (!session?.token || !repairModal) return;

    const isSingleType = repairModal.types.length === 1;
    if (isSingleType) {
      setRepairingType(repairModal.types[0]);
    } else {
      setRepairing(true);
    }

    setRepairError(null);
    setRepairSuccess(null);

    try {
      const repairResult: RepairResult = await api.runAutoRepair(
        session.token,
        repairModal.types,
      );

      setRepairModal(null);

      // Build success summary
      const lines = repairResult.fixedCounts
        .map(([type, count]) => `${String(count)} fix(es) for ${type}`)
        .join(", ");
      setRepairSuccess(
        lines
          ? `Repair complete — ${lines}.`
          : "Repair complete — no changes needed.",
      );

      // Update displayed health status directly from updatedReport
      setLatest(repairResult.updatedReport);
      setHistory((prev) => [repairResult.updatedReport, ...prev].slice(0, 10));

      // Refresh repair history
      api
        .getRepairHistory(session.token, 10)
        .then((h) => setRepairHistory(h))
        .catch(() => undefined);
    } catch (e) {
      setRepairModal(null);
      setRepairError(
        `Auto-repair failed: ${String(e)}. Please try again or contact support.`,
      );
    } finally {
      setRepairing(false);
      setRepairingType(null);
    }
  }

  function handleRepairCancel() {
    if (!repairing) setRepairModal(null);
  }

  if (!session || session.role !== "Admin") return null;

  const hasAnomalies = !!latest && !latest.passed;

  return (
    <PortalLayout portalRole={Role.Admin}>
      {/* Repair confirmation modal */}
      {repairModal && (
        <RepairConfirmModal
          anomalyTypes={repairModal.types}
          onConfirm={handleRepairConfirm}
          onCancel={handleRepairCancel}
          repairing={repairing}
        />
      )}

      <PageHeader
        title="System Health"
        subtitle="Startup anomaly detection and data integrity monitoring"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => printHealthReport(latest, company)}
              disabled={!latest}
              data-ocid="health.export-pdf-button"
              className="gap-1.5"
            >
              <FileDown className="w-4 h-4" />
              Export PDF
            </Button>
            <Button
              size="sm"
              onClick={handleRunCheck}
              disabled={runningCheck || repairing}
              data-ocid="health.run-check-button"
              className="gap-1.5 bg-cyan-500 hover:bg-cyan-600 text-white border-0"
            >
              {runningCheck ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {runningCheck ? "Running…" : "Run Health Check Now"}
            </Button>
            {hasAnomalies && (
              <Button
                size="sm"
                onClick={handleAutoRepairClick}
                disabled={repairing || runningCheck || !!repairingType}
                data-ocid="health.auto-repair-button"
                className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0 font-bold"
              >
                {repairing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Wrench className="w-4 h-4" />
                )}
                {repairing ? "Repairing…" : "Auto-Repair"}
              </Button>
            )}
          </div>
        }
      />

      <PageContent>
        {/* General error */}
        {error && (
          <div
            className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
            data-ocid="health.error_state"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => session?.token && loadData(session.token)}
              className="ml-auto text-red-600 underline text-xs hover:text-red-800"
            >
              Retry
            </button>
          </div>
        )}

        {/* Repair error */}
        {repairError && (
          <div
            className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
            data-ocid="health.repair-error_state"
          >
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span>{repairError}</span>
            <button
              type="button"
              onClick={() => setRepairError(null)}
              className="ml-auto text-red-500 hover:text-red-700 text-lg leading-none"
              aria-label="Dismiss repair error"
            >
              ×
            </button>
          </div>
        )}

        {/* Repair success */}
        {repairSuccess && (
          <div
            className="mb-4 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm"
            data-ocid="health.repair-success_state"
          >
            <CheckCircle className="w-4 h-4 flex-shrink-0 text-green-600" />
            <span>{repairSuccess}</span>
            <button
              type="button"
              onClick={() => setRepairSuccess(null)}
              className="ml-auto text-green-600 hover:text-green-800 text-lg leading-none"
              aria-label="Dismiss repair success"
            >
              ×
            </button>
          </div>
        )}

        {/* Status Banner */}
        {loading ? (
          <Skeleton
            className="h-16 w-full rounded-xl mb-6"
            data-ocid="health.loading_state"
          />
        ) : latest ? (
          <div
            className={`mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 px-5 py-4 rounded-xl text-white font-semibold text-sm shadow-sm ${latest.passed ? "bg-green-600" : "bg-red-600"}`}
            data-ocid="health.status-banner"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {latest.passed ? (
                <CheckCircle className="w-6 h-6 flex-shrink-0" />
              ) : (
                <XCircle className="w-6 h-6 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-base font-bold leading-tight">
                  {latest.passed
                    ? "All Clear — No anomalies detected"
                    : "Anomalies Detected — review the list below"}
                </p>
                <p className="text-white/80 text-xs mt-0.5 font-normal">
                  Last checked: {fmtTs(latest.timestamp)}
                </p>
              </div>
            </div>
            {!latest.passed && (
              <span className="flex-shrink-0 bg-white/20 px-3 py-1 rounded-full text-xs font-bold">
                {String(latest.anomalyCount)} anomal
                {Number(latest.anomalyCount) === 1 ? "y" : "ies"}
              </span>
            )}
          </div>
        ) : (
          <div
            className="mb-6 flex items-center gap-3 px-5 py-4 bg-muted/40 border border-border rounded-xl text-muted-foreground text-sm"
            data-ocid="health.empty_state"
          >
            <RefreshCw className="w-5 h-5 flex-shrink-0" />
            <span>
              No health checks have been run yet. Click{" "}
              <strong>"Run Health Check Now"</strong> to run the first check.
            </span>
          </div>
        )}

        {/* Anomaly Table */}
        {latest && !latest.passed && latest.anomalies.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-display font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Current Anomalies ({String(latest.anomalyCount)})
            </h2>
            <AnomalyTable
              anomalies={latest.anomalies}
              onFixThis={handleFixThis}
              repairingType={repairingType}
            />
          </div>
        )}

        {/* Health Check History */}
        <div className="mb-6">
          <h2 className="text-sm font-display font-semibold text-foreground mb-3 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
            Health Check History (Last 10 Runs)
          </h2>

          {loading ? (
            <div className="space-y-2" data-ocid="health.history-loading_state">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div
              className="bg-card border border-border rounded-lg px-6 py-10 text-center"
              data-ocid="health.history-empty_state"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <RefreshCw className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No history yet. Run a health check to see results here.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm font-body min-w-[480px]">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider font-display text-muted-foreground">
                        Date / Time
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider font-display text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider font-display text-muted-foreground">
                        Anomaly Count
                      </th>
                      <th className="px-4 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r) => (
                      <HistoryRow key={String(r.timestamp)} report={r} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Repair History (collapsible) */}
        <div>
          <button
            type="button"
            className="w-full flex items-center justify-between text-sm font-display font-semibold text-foreground mb-3 group"
            onClick={() => setRepairHistoryOpen((p) => !p)}
            data-ocid="repair-history.toggle"
            aria-expanded={repairHistoryOpen}
          >
            <span className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-500" />
              Repair History (Last 10 Repairs)
            </span>
            {repairHistoryOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform" />
            )}
          </button>

          {repairHistoryOpen && (
            <div>
              {loading ? (
                <div
                  className="space-y-2"
                  data-ocid="repair-history.loading_state"
                >
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : repairHistory.length === 0 ? (
                <div
                  className="bg-card border border-border rounded-lg px-6 py-8 text-center"
                  data-ocid="repair-history.empty_state"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <Wrench className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No repairs have been run yet. Use Auto-Repair to fix
                    anomalies.
                  </p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-sm font-body min-w-[580px]">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider font-display text-muted-foreground whitespace-nowrap">
                            Date / Time
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider font-display text-muted-foreground">
                            Repaired Types
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider font-display text-muted-foreground whitespace-nowrap">
                            Items Fixed
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider font-display text-muted-foreground">
                            Details
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {repairHistory.map((r) => (
                          <RepairHistoryRow
                            key={String(r.timestamp)}
                            record={r}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </PageContent>
    </PortalLayout>
  );
}
