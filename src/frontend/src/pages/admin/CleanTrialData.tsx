import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

const CONFIRMATION_PHRASE = "CONFIRM DELETE";

const DATA_TO_DELETE = [
  "Doctor Call History / Daily Call Reports",
  "Travel Allowance (TA) records",
  "Daily Allowance (DA) records",
  "Travel Plans (TP) submitted during trial",
  "Attendance / Check-In records",
  "Leave Applications submitted during trial",
  "Booking Requests (Sample and Gift)",
  "CRM Requests and activity records",
  "Expense records",
  "Sales / Business reported data",
  "Target Achievement actuals (not the targets themselves)",
];

const DATA_TO_KEEP = [
  "Doctor Master List",
  "Chemist List",
  "Employee List & Role assignments",
  "Role & Hierarchy configuration",
  "Salary Structure",
  "Incentive Structure & slabs",
  "DA Rate configuration",
  "Leave Type & balance configuration",
  "Product & Gift Article master lists",
  "Territory & Area configuration",
  "Company Profile (logo, name, address, contact)",
  "Sales Targets assigned to employees",
  "All Admin & HR portal configurations",
];

interface CleanupLog {
  id: string;
  adminUsername: string;
  timestamp: string;
  reason: string;
  status: "success" | "failed";
  recordsDeleted: number;
}

function saveCleanupLog(log: CleanupLog) {
  const existing = JSON.parse(
    localStorage.getItem("cleanup_audit_log") ?? "[]",
  ) as CleanupLog[];
  existing.unshift(log);
  localStorage.setItem(
    "cleanup_audit_log",
    JSON.stringify(existing.slice(0, 50)),
  );
}

export default function CleanTrialData() {
  const { session } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [reason, setReason] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const canConfirm = confirmPhrase === CONFIRMATION_PHRASE;

  function openModal() {
    setConfirmPhrase("");
    setReason("");
    setModalError(null);
    setShowModal(true);
  }

  function closeModal() {
    if (cleaning) return;
    setShowModal(false);
    setConfirmPhrase("");
    setReason("");
    setModalError(null);
  }

  async function handleCleanup() {
    if (!canConfirm || cleaning) return;
    setCleaning(true);
    setModalError(null);
    try {
      const res = await api.cleanTrialData(
        session?.token ?? "",
        CONFIRMATION_PHRASE,
        reason,
      );
      if (res.__kind__ === "err") {
        setModalError(res.err);
        saveCleanupLog({
          id: crypto.randomUUID(),
          adminUsername: session?.name ?? "Admin",
          timestamp: new Date().toISOString(),
          reason,
          status: "failed",
          recordsDeleted: 0,
        });
      } else {
        const count = Number(
          (res.ok as unknown as { totalDeleted?: bigint })?.totalDeleted ?? 0n,
        );
        saveCleanupLog({
          id: crypto.randomUUID(),
          adminUsername: session?.name ?? "Admin",
          timestamp: new Date().toISOString(),
          reason,
          status: "success",
          recordsDeleted: count,
        });
        toast.success(
          `Trial data cleaned successfully — ${count} records deleted.`,
        );
        setShowModal(false);
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Cleanup failed. Please try again.";
      setModalError(msg);
      saveCleanupLog({
        id: crypto.randomUUID(),
        adminUsername: session?.name ?? "Admin",
        timestamp: new Date().toISOString(),
        reason,
        status: "failed",
        recordsDeleted: 0,
      });
    } finally {
      setCleaning(false);
    }
  }

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Data Management"
        subtitle="Clean trial data before final launch — irreversible action"
      />
      <PageContent>
        {/* Danger Zone Card */}
        <SectionCard title="Clean Trial Data">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-display font-semibold text-destructive">
                  Danger Zone — Irreversible Action
                </p>
                <p className="text-sm text-muted-foreground mt-1 font-body">
                  This action will permanently erase all trial/test field data
                  generated during the pilot period. All master configuration
                  data (employees, doctors, products, targets, etc.) will be
                  preserved. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* What gets deleted */}
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 overflow-hidden">
                <div className="px-4 py-2.5 bg-destructive/10 border-b border-destructive/20">
                  <p className="text-xs font-display font-semibold text-destructive uppercase tracking-wider">
                    Will be PERMANENTLY DELETED
                  </p>
                </div>
                <ul className="p-4 space-y-1.5">
                  {DATA_TO_DELETE.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm font-body text-foreground"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* What is kept */}
              <div className="rounded-lg border border-green-200 bg-green-50/60 overflow-hidden">
                <div className="px-4 py-2.5 bg-green-100/50 border-b border-green-200">
                  <p className="text-xs font-display font-semibold text-green-800 uppercase tracking-wider">
                    Will be KEPT INTACT
                  </p>
                </div>
                <ul className="p-4 space-y-1.5">
                  {DATA_TO_KEEP.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm font-body text-foreground"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="destructive"
                onClick={openModal}
                data-ocid="btn-open-clean-trial-data"
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clean Trial Data…
              </Button>
            </div>
          </div>
        </SectionCard>
      </PageContent>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <dialog
            open
            className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto p-0 m-0"
            data-ocid="clean-trial-modal"
            aria-labelledby="clean-modal-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-destructive/5">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <h2
                  id="clean-modal-title"
                  className="font-display font-bold text-foreground"
                >
                  Clean Trial Data — Irreversible Action
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={cleaning}
                className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Warning banner */}
              <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                <ShieldAlert className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm font-display font-semibold text-destructive">
                  WARNING: This action is permanent and cannot be undone. All
                  trial/test data will be permanently deleted. There is no
                  recovery.
                </p>
              </div>

              {/* Summary lists */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-xs font-display font-semibold text-destructive uppercase tracking-wider mb-3">
                    Data to be PERMANENTLY DELETED
                  </p>
                  <ul className="space-y-1.5">
                    {DATA_TO_DELETE.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-1.5 text-xs font-body text-foreground"
                      >
                        <Trash2 className="w-3 h-3 text-destructive flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50/60 p-4">
                  <p className="text-xs font-display font-semibold text-green-800 uppercase tracking-wider mb-3">
                    Data to be KEPT INTACT
                  </p>
                  <ul className="space-y-1.5">
                    {DATA_TO_KEEP.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-1.5 text-xs font-body text-foreground"
                      >
                        <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Reason (optional) */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="cleanup-reason"
                  className="text-sm font-display"
                >
                  Reason for cleanup (optional)
                </Label>
                <textarea
                  id="cleanup-reason"
                  rows={2}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Pre-launch cleanup — removing all pilot test data"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-body resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  data-ocid="input-cleanup-reason"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {reason.length}/500
                </p>
              </div>

              {/* Confirmation phrase */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="confirm-phrase"
                  className="text-sm font-display font-semibold"
                >
                  Type{" "}
                  <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-destructive">
                    CONFIRM DELETE
                  </code>{" "}
                  to proceed
                </Label>
                <Input
                  id="confirm-phrase"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder="Type CONFIRM DELETE"
                  className="font-mono"
                  data-ocid="input-confirm-phrase"
                  autoComplete="off"
                />
                {confirmPhrase.length > 0 && !canConfirm && (
                  <p className="text-xs text-destructive">
                    Must match exactly:{" "}
                    <code className="font-mono">CONFIRM DELETE</code>{" "}
                    (case-sensitive)
                  </p>
                )}
              </div>

              {/* Error */}
              {modalError && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{modalError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
              <Button
                variant="outline"
                onClick={closeModal}
                disabled={cleaning}
                data-ocid="btn-cancel-cleanup"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleCleanup}
                disabled={!canConfirm || cleaning}
                data-ocid="btn-confirm-cleanup"
                className="gap-2"
              >
                {cleaning ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Confirm — Delete All Trial Data
                  </>
                )}
              </Button>
            </div>
          </dialog>
        </div>
      )}
    </PortalLayout>
  );
}
