import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  CheckCircle2,
  IdCard,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import type { EmpIdConfig } from "../../types";

const FIELD_ROLES = [
  Role.MR,
  Role.ASM,
  Role.RSM,
  Role.ZSM,
  Role.HRManager,
  Role.Admin,
];

const CURRENT_YEAR = new Date().getFullYear();

export default function EmployeeIdConfig() {
  const { session } = useAuthStore();
  const token = session?.token ?? "";

  // ── Company UID Settings ─────────────────────────────────────────────────
  const [companyPrefix, setCompanyPrefix] = useState("KP");
  const [savedPrefix, setSavedPrefix] = useState("KP");
  const [prefixLoading, setPrefixLoading] = useState(true);
  const [prefixSaving, setPrefixSaving] = useState(false);

  // ── Migrate to UID ────────────────────────────────────────────────────────
  const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);
  const [migratePhrase, setMigratePhrase] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<number | null>(null);

  // ── Legacy per-role config ────────────────────────────────────────────────
  const [configs, setConfigs] = useState<EmpIdConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<
    Record<string, { prefix: string; start: string }>
  >({});
  const [saving, setSaving] = useState<string | null>(null);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkResult, setBulkResult] = useState<number | null>(null);

  // Load company prefix
  const loadPrefix = useCallback(async () => {
    if (!token) return;
    setPrefixLoading(true);
    try {
      const p = await api.getUidCompanyPrefix(token);
      setCompanyPrefix(p);
      setSavedPrefix(p);
    } catch {
      // fallback — not yet deployed
    } finally {
      setPrefixLoading(false);
    }
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.listEmpIdConfigs(token);
      setConfigs(data);
      const initial: Record<string, { prefix: string; start: string }> = {};
      for (const c of data) {
        initial[c.roleKey] = {
          prefix: c.prefix,
          start: String(c.startingNumber),
        };
      }
      for (const r of FIELD_ROLES) {
        if (!initial[r]) {
          initial[r] = { prefix: r, start: "1" };
        }
      }
      setEdits(initial);
    } catch {
      toast.error("Failed to load Employee ID configurations");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPrefix();
    load();
  }, [loadPrefix, load]);

  // Prefix is valid if 1-5 alphanumeric chars
  const prefixValid = /^[A-Z0-9]{1,5}$/.test(companyPrefix);
  const uidPreview = `${companyPrefix}-${CURRENT_YEAR}-001`;

  async function handleSavePrefix() {
    if (!prefixValid) {
      toast.error("Prefix must be 1–5 uppercase alphanumeric characters");
      return;
    }
    setPrefixSaving(true);
    try {
      const res = await api.setUidCompanyPrefix(token, companyPrefix);
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      setSavedPrefix(companyPrefix);
      toast.success(`Company prefix saved as "${companyPrefix}"`);
    } catch {
      toast.error("Failed to save company prefix");
    } finally {
      setPrefixSaving(false);
    }
  }

  async function handleMigrateUids() {
    if (migratePhrase !== "MIGRATE UIDS") return;
    setMigrating(true);
    try {
      const res = await api.bulkMigrateUids(token);
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      const n = Number(res.ok);
      setMigrateResult(n);
      toast.success(`${n} employees migrated to new UID format.`);
      setShowMigrateConfirm(false);
      setMigratePhrase("");
    } catch {
      toast.error("Migration failed — please try again");
    } finally {
      setMigrating(false);
    }
  }

  async function handleSave(roleKey: string) {
    const edit = edits[roleKey];
    if (!edit) return;
    setSaving(roleKey);
    try {
      const existingConfig = configs.find((c) => c.roleKey === roleKey);
      const result = await api.saveEmpIdConfig(token, {
        roleKey,
        prefix: edit.prefix,
        startingNumber: BigInt(edit.start || "1"),
        padWidth: existingConfig?.padWidth ?? 3n,
      });
      if (result.__kind__ === "err") {
        toast.error(result.err);
        return;
      }
      toast.success(`Config saved for ${roleKey}`);
      await load();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function handleBulkAssign() {
    if (
      !confirm(
        "Assign IDs to all employees who don't have one yet? This cannot be undone.",
      )
    )
      return;
    setBulkAssigning(true);
    try {
      const result = await api.bulkAssignEmployeeIds(token);
      if (result.__kind__ === "err") {
        toast.error(result.err);
        return;
      }
      setBulkResult(Number(result.ok));
      toast.success(`Assigned IDs to ${Number(result.ok)} employees`);
      await load();
    } catch {
      toast.error("Bulk assignment failed");
    } finally {
      setBulkAssigning(false);
    }
  }

  const configMap = new Map(configs.map((c) => [c.roleKey, c]));

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Employee ID Configuration"
        subtitle="Configure the auto-generated UID format and legacy per-role Employee ID settings"
      />
      <PageContent>
        {/* ── Company UID Settings ────────────────────────────────────────── */}
        <SectionCard title="Company UID Settings">
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-sm">
              <IdCard className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="font-body text-foreground">
                <p className="font-medium">New UID Format</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  New employees are assigned IDs in the format{" "}
                  <code className="font-mono bg-muted px-1 rounded">
                    [Company Prefix]-[Year]-[Sequence]
                  </code>
                  . The sequence resets to 001 each new year.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="uid-prefix" className="text-sm font-display">
                  Company Prefix
                </Label>
                <Input
                  id="uid-prefix"
                  value={companyPrefix}
                  onChange={(e) =>
                    setCompanyPrefix(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 5),
                    )
                  }
                  className="font-mono h-9 w-28"
                  placeholder="KP"
                  data-ocid="input-uid-company-prefix"
                  disabled={prefixLoading}
                />
                <p className="text-xs text-muted-foreground">
                  1–5 uppercase alphanumeric characters
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-display">UID Preview</Label>
                <div className="flex items-center h-9 px-3 bg-muted/50 border border-border rounded-md">
                  <span className="font-mono text-sm font-bold text-primary">
                    {uidPreview}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Updates live as you type
                </p>
              </div>

              <div className="flex gap-2 items-end pb-5">
                <Button
                  size="sm"
                  onClick={handleSavePrefix}
                  disabled={
                    prefixSaving ||
                    !prefixValid ||
                    companyPrefix === savedPrefix
                  }
                  data-ocid="btn-save-uid-prefix"
                  className="h-9"
                >
                  {prefixSaving ? "Saving…" : "Save Prefix"}
                </Button>
              </div>
            </div>

            {savedPrefix !== "KP" && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Current prefix:{" "}
                  <code className="font-mono font-bold">{savedPrefix}</code>
                </span>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Migrate to New UID Format ───────────────────────────────────── */}
        <div className="mt-4">
          <SectionCard title="Migrate Existing Employees to New UID Format">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground font-body">
                Use this one-time action to assign new UIDs (e.g.{" "}
                <code className="font-mono bg-muted px-1 rounded">
                  {savedPrefix}-2026-001
                </code>
                ) to all existing employees. Employees who already have a UID in
                the new format will be skipped.
              </p>

              {migrateResult !== null && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{migrateResult} employees migrated successfully.</span>
                </div>
              )}

              {!showMigrateConfirm ? (
                <Button
                  variant="outline"
                  onClick={() => setShowMigrateConfirm(true)}
                  data-ocid="btn-open-migrate-uids"
                  className="gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Migrate to New UID Format…
                </Button>
              ) : (
                <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/10">
                  <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-xs font-body">
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <span className="text-yellow-800">
                      This will reassign UIDs to all existing employees in
                      creation order. Employees already on the new format will
                      be skipped.
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-display">
                      Type{" "}
                      <code className="font-mono bg-muted px-1 rounded text-primary">
                        MIGRATE UIDS
                      </code>{" "}
                      to confirm
                    </Label>
                    <Input
                      value={migratePhrase}
                      onChange={(e) => setMigratePhrase(e.target.value)}
                      placeholder="MIGRATE UIDS"
                      className="font-mono h-9 max-w-[200px]"
                      data-ocid="input-migrate-uids-confirm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleMigrateUids}
                      disabled={migratePhrase !== "MIGRATE UIDS" || migrating}
                      data-ocid="btn-confirm-migrate-uids"
                    >
                      {migrating ? "Migrating…" : "Confirm Migration"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowMigrateConfirm(false);
                        setMigratePhrase("");
                      }}
                      disabled={migrating}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* ── Legacy per-role config ──────────────────────────────────────── */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider font-display text-muted-foreground font-semibold">
              Legacy Employee ID Configuration
            </span>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-body">
              Used before UID format was introduced
            </span>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-4 text-sm">
            <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-yellow-800 font-body">
              <p className="font-medium">Legacy Format</p>
              <p className="text-xs mt-0.5">
                This section configures the old prefix+number format (e.g.
                MR001). New employees get UIDs in the new{" "}
                <code className="font-mono">{savedPrefix}-[Year]-[Seq]</code>{" "}
                format instead. These settings apply only to employees who have
                not been migrated.
              </p>
            </div>
          </div>

          <div className="flex justify-end mb-3">
            <Button
              onClick={handleBulkAssign}
              disabled={bulkAssigning}
              data-ocid="btn-bulk-assign"
              variant="outline"
              size="sm"
            >
              <RefreshCw
                className={`w-4 h-4 mr-1.5 ${bulkAssigning ? "animate-spin" : ""}`}
              />
              {bulkAssigning ? "Assigning…" : "Bulk Assign Legacy IDs"}
            </Button>
          </div>

          {bulkResult !== null && (
            <div className="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-lg px-4 py-2.5 mb-4 text-sm">
              <RefreshCw className="w-4 h-4 text-accent" />
              <span className="text-accent font-medium">
                Bulk assignment complete — {bulkResult} IDs assigned
              </span>
            </div>
          )}

          <SectionCard title="Per-Role ID Configuration">
            {loading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 bg-muted rounded animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-body min-w-[500px]">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      {[
                        "Role",
                        "Prefix",
                        "Starting Number",
                        "Current Sequence",
                        "Preview",
                        "",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-xs uppercase tracking-wider font-display text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {FIELD_ROLES.map((r) => {
                      const existing = configMap.get(r);
                      const edit = edits[r] ?? { prefix: r, start: "1" };
                      const padWidth = Number(existing?.padWidth ?? 3);
                      const seqNum = Number(existing?.startingNumber ?? 1);
                      const preview = `${edit.prefix}${String(seqNum).padStart(padWidth, "0")}`;
                      return (
                        <tr
                          key={r}
                          className="hover:bg-muted/20 transition-colors"
                          data-ocid={`config-row-${r}`}
                        >
                          <td className="px-4 py-3">
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono font-semibold">
                              {r}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              value={edit.prefix}
                              onChange={(e) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [r]: { ...edit, prefix: e.target.value },
                                }))
                              }
                              className="h-8 w-24 font-mono"
                              placeholder={r}
                              data-ocid={`input-prefix-${r}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min="1"
                              value={edit.start}
                              onChange={(e) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [r]: { ...edit, start: e.target.value },
                                }))
                              }
                              className="h-8 w-24"
                              data-ocid={`input-start-${r}`}
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground text-sm">
                            {existing
                              ? String(existing.startingNumber)
                              : "Not set"}
                          </td>
                          <td className="px-4 py-3 font-mono text-primary font-semibold text-sm">
                            {preview}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleSave(r)}
                              disabled={saving === r}
                              data-ocid={`btn-save-config-${r}`}
                            >
                              {saving === r ? "Saving…" : "Save"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Info note */}
        <div className="mt-4">
          <SectionCard title="How Employee UIDs Work">
            <ul className="text-sm text-muted-foreground font-body space-y-1.5 list-disc list-inside">
              <li>
                New employees get UIDs in the format{" "}
                <code className="font-mono bg-muted px-1 rounded">
                  {savedPrefix}-{CURRENT_YEAR}-001
                </code>{" "}
                — auto-assigned at creation.
              </li>
              <li>
                The sequential number resets to 001 each new calendar year.
                Example: first employee in 2027 gets{" "}
                <code className="font-mono bg-muted px-1 rounded">
                  {savedPrefix}-2027-001
                </code>
                .
              </li>
              <li>
                UIDs are never reused — deleted employee IDs remain reserved.
              </li>
              <li>
                Use "Migrate to New UID Format" to assign UIDs to all existing
                employees in creation order.
              </li>
              <li>
                Employee UIDs appear on salary slips, leave applications, daily
                reports, and all exported Excel files.
              </li>
            </ul>
          </SectionCard>
        </div>
      </PageContent>
    </PortalLayout>
  );
}
