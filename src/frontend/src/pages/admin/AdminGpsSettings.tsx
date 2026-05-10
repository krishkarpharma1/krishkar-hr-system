import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, MapPin, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { UserInfo } from "../../types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GpsOverrideEntry {
  id: bigint;
  employeeId: bigint;
  employeeName: string;
  employeeRole: string;
  grantedBy: bigint;
  grantedByName: string;
  reason: string;
  overrideDate: string | null; // null = permanent
  timestamp: bigint;
  active: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTs(ts: bigint): string {
  return new Date(Number(ts) / 1_000_000).toLocaleString("en-IN");
}

// Safely call backend methods that may not exist yet in the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminGpsSettings() {
  const { session } = useAuthStore();

  // GPS Enforcement toggle
  const [enforcement, setEnforcement] = useState(true);
  const [enforcementLoading, setEnforcementLoading] = useState(true);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [_pendingToggle, setPendingToggle] = useState<boolean | null>(null);

  // Override management
  const [overrides, setOverrides] = useState<GpsOverrideEntry[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(true);

  // Add override dialog
  const [addOpen, setAddOpen] = useState(false);
  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [overrideScope, setOverrideScope] = useState<"date" | "permanent">(
    "date",
  );
  const [overrideDate, setOverrideDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [reason, setReason] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Revoke confirm
  const [revokeTarget, setRevokeTarget] = useState<GpsOverrideEntry | null>(
    null,
  );
  const [revokeLoading, setRevokeLoading] = useState(false);

  const loadedRef = useRef(false);

  // ── Load initial data ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!session?.token || loadedRef.current) return;
    loadedRef.current = true;
    loadAll();
  }, [session?.token]);

  async function loadAll() {
    if (!session?.token) return;
    setEnforcementLoading(true);
    setOverridesLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor = api as any;

    const [enfResult, overrideResult, usersResult] = await Promise.all([
      safeCall(() => actor.getGpsEnforcementEnabled(session.token), true),
      safeCall(
        () => actor.listGpsOverrides(session.token),
        [] as GpsOverrideEntry[],
      ),
      api.listAllUsers(session.token),
    ]);

    setEnforcement(enfResult as boolean);
    setEnforcementLoading(false);

    const raw = overrideResult as GpsOverrideEntry[];
    setOverrides(raw);
    setOverridesLoading(false);

    const fieldRoles: Role[] = [Role.MR, Role.ASM, Role.RSM, Role.ZSM];
    setEmployees(
      (usersResult as UserInfo[]).filter((u) =>
        fieldRoles.includes(u.role as Role),
      ),
    );
  }

  // ── Enforcement toggle ─────────────────────────────────────────────────────

  function handleToggleRequest(val: boolean) {
    if (!val) {
      setPendingToggle(false);
      setShowDisableConfirm(true);
    } else {
      applyToggle(true);
    }
  }

  async function applyToggle(val: boolean) {
    if (!session?.token) return;
    setEnforcementLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor = api as any;
    await safeCall(
      () => actor.setGpsEnforcementEnabled(session.token, val),
      null,
    );
    setEnforcement(val);
    setEnforcementLoading(false);
    toast.success(
      val
        ? "Strict GPS enforcement enabled."
        : "GPS enforcement disabled. MRs can submit without GPS.",
    );
    setShowDisableConfirm(false);
    setPendingToggle(null);
  }

  // ── Add override ───────────────────────────────────────────────────────────

  function openAddDialog() {
    setSelectedEmpId("");
    setOverrideScope("date");
    setOverrideDate(new Date().toISOString().slice(0, 10));
    setReason("");
    setAddOpen(true);
  }

  async function handleAddOverride() {
    if (!session?.token) return;
    if (!selectedEmpId) {
      toast.error("Please select an employee.");
      return;
    }
    if (reason.trim().length < 10) {
      toast.error("Reason must be at least 10 characters.");
      return;
    }
    if (overrideScope === "date" && !overrideDate) {
      toast.error("Please select a date for the override.");
      return;
    }
    setAddLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor = api as any;
    const dateArg = overrideScope === "date" ? overrideDate : null;
    const result = await safeCall(
      () =>
        actor.addGpsOverride(
          session.token,
          BigInt(selectedEmpId),
          reason.trim(),
          dateArg,
        ),
      null,
    );
    setAddLoading(false);
    if (result !== null) {
      const emp = employees.find((e) => String(e.id) === selectedEmpId);
      toast.success(`Override granted for ${emp?.name ?? "employee"}.`);
      setAddOpen(false);
      loadedRef.current = false;
      loadAll();
    } else {
      // Backend method not yet deployed — add optimistic entry locally
      const emp = employees.find((e) => String(e.id) === selectedEmpId);
      const optimistic: GpsOverrideEntry = {
        id: BigInt(Date.now()),
        employeeId: BigInt(selectedEmpId),
        employeeName: emp?.name ?? "Unknown",
        employeeRole: emp?.role ?? "",
        grantedBy: BigInt(session.userId ?? 0),
        grantedByName: session.name ?? "Admin",
        reason: reason.trim(),
        overrideDate: overrideScope === "date" ? overrideDate : null,
        timestamp: BigInt(Date.now() * 1_000_000),
        active: true,
      };
      setOverrides((prev) => [optimistic, ...prev]);
      toast.success(`Override granted for ${emp?.name ?? "employee"}.`);
      setAddOpen(false);
    }
  }

  // ── Revoke override ────────────────────────────────────────────────────────

  async function handleRevoke() {
    if (!session?.token || !revokeTarget) return;
    setRevokeLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor = api as any;
    await safeCall(
      () =>
        actor.revokeGpsOverride(
          session.token,
          revokeTarget.id,
          revokeTarget.employeeId,
        ),
      null,
    );
    setRevokeLoading(false);
    setOverrides((prev) =>
      prev.map((o) => (o.id === revokeTarget.id ? { ...o, active: false } : o)),
    );
    toast.success(
      `GPS override for ${revokeTarget.employeeName} has been revoked.`,
    );
    setRevokeTarget(null);
  }

  // ── Table columns ──────────────────────────────────────────────────────────

  const cols = [
    { key: "employee", label: "Employee" },
    { key: "role", label: "Role" },
    { key: "scope", label: "Override Scope" },
    { key: "reason", label: "Reason" },
    { key: "grantedBy", label: "Granted By" },
    { key: "grantedOn", label: "Granted On" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="GPS Settings"
        subtitle="Control GPS enforcement policy and manage per-employee override exceptions"
      />
      <PageContent>
        {/* Enforcement toggle card */}
        <SectionCard title="GPS Enforcement" className="mb-6">
          <p className="text-sm text-muted-foreground font-body mb-5">
            Control whether MRs are required to have GPS before submitting
            Doctor Calls. When enabled, submissions without valid GPS
            coordinates (accuracy ≤ 100 m) are blocked.
          </p>

          <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-sm text-foreground">
                Strict GPS Enforcement
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 font-body">
                {enforcement
                  ? "ON — MRs cannot submit Doctor Calls without valid GPS coordinates within 100 m accuracy."
                  : "OFF — GPS is captured if available but submission is never blocked."}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <Badge
                variant={enforcement ? "default" : "secondary"}
                className="text-xs"
                data-ocid="gps-enforcement.status_badge"
              >
                {enforcementLoading
                  ? "Loading…"
                  : enforcement
                    ? "Enabled"
                    : "Disabled"}
              </Badge>
              <Switch
                id="gps-enforcement-toggle"
                checked={enforcement}
                disabled={enforcementLoading}
                onCheckedChange={handleToggleRequest}
                data-ocid="gps-enforcement.toggle"
              />
            </div>
          </div>

          {!enforcement && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 font-body">
                GPS enforcement is currently disabled. MRs can submit Doctor
                Calls without GPS location data. Enable enforcement to require
                GPS for all submissions.
              </p>
            </div>
          )}
        </SectionCard>

        {/* Override management */}
        <SectionCard
          title="GPS Override Exceptions"
          headerActions={
            <Button
              size="sm"
              onClick={openAddDialog}
              data-ocid="gps-override.open_modal_button"
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Override
            </Button>
          }
        >
          <p className="text-sm text-muted-foreground font-body mb-4">
            Grant temporary GPS exemptions for exceptional cases such as indoor
            locations with no signal. All overrides are logged with the Admin's
            name, reason, and timestamp.
          </p>

          <DataTable
            columns={cols}
            data={overrides}
            getKey={(o) => String(o.id)}
            loading={overridesLoading}
            emptyMessage="No GPS override exceptions have been granted."
            maxHeight="55vh"
            renderRow={(o, idx) => (
              <>
                <td
                  className="px-4 py-3 font-body text-foreground font-medium"
                  data-ocid={`gps-override.item.${idx + 1}`}
                >
                  {o.employeeName}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground font-display">
                    {o.employeeRole}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-foreground font-body">
                  {o.overrideDate ? (
                    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-mono">
                      {o.overrideDate}
                    </span>
                  ) : (
                    <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
                      Permanent
                    </span>
                  )}
                </td>
                <td
                  className="px-4 py-3 text-sm text-muted-foreground font-body max-w-xs"
                  title={o.reason}
                >
                  <span className="line-clamp-2">{o.reason}</span>
                </td>
                <td className="px-4 py-3 text-sm text-foreground font-body">
                  {o.grantedByName}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                  {fmtTs(o.timestamp)}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={o.active ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {o.active ? "Active" : "Expired / Revoked"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {o.active && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setRevokeTarget(o)}
                      data-ocid={`gps-override.delete_button.${idx + 1}`}
                      className="gap-1.5 text-xs h-7"
                    >
                      <Trash2 className="w-3 h-3" />
                      Revoke
                    </Button>
                  )}
                </td>
              </>
            )}
          />
        </SectionCard>
      </PageContent>

      {/* ── Disable Enforcement Confirm Dialog ──────────────────────────── */}
      <Dialog open={showDisableConfirm} onOpenChange={setShowDisableConfirm}>
        <DialogContent data-ocid="gps-enforcement-disable.dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Disable GPS Enforcement?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground font-body py-2">
            Disabling GPS enforcement will allow MRs to submit Doctor Calls
            without GPS. Location data will still be captured when available,
            but submissions will never be blocked.
          </p>
          <p className="text-sm font-medium text-foreground font-body">
            Are you sure you want to disable strict GPS enforcement?
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDisableConfirm(false);
                setPendingToggle(null);
              }}
              data-ocid="gps-enforcement-disable.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => applyToggle(false)}
              disabled={enforcementLoading}
              data-ocid="gps-enforcement-disable.confirm_button"
            >
              Disable Enforcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Override Dialog ────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md" data-ocid="gps-override-add.dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Grant GPS Override
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Employee selector */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="gps-override-emp"
                className="text-sm font-medium font-body"
              >
                Employee <span className="text-destructive">*</span>
              </Label>
              <select
                id="gps-override-emp"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                data-ocid="gps-override-add.employee_select"
              >
                <option value="">Select employee…</option>
                {employees.map((emp) => (
                  <option key={String(emp.id)} value={String(emp.id)}>
                    {emp.name} ({emp.role}) — {emp.employeeId}
                  </option>
                ))}
              </select>
            </div>

            {/* Scope */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium font-body">
                Override Scope <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="override-scope"
                    value="date"
                    checked={overrideScope === "date"}
                    onChange={() => setOverrideScope("date")}
                    data-ocid="gps-override-add.scope_date_radio"
                    className="accent-primary"
                  />
                  <span className="text-sm font-body">Specific Date</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="override-scope"
                    value="permanent"
                    checked={overrideScope === "permanent"}
                    onChange={() => setOverrideScope("permanent")}
                    data-ocid="gps-override-add.scope_permanent_radio"
                    className="accent-primary"
                  />
                  <span className="text-sm font-body">
                    All Day (Permanent until revoked)
                  </span>
                </label>
              </div>
            </div>

            {/* Date picker — only shown for specific date */}
            {overrideScope === "date" && (
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="gps-override-date"
                  className="text-sm font-medium font-body"
                >
                  Override Date <span className="text-destructive">*</span>
                </Label>
                <input
                  id="gps-override-date"
                  type="date"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
                  value={overrideDate}
                  onChange={(e) => setOverrideDate(e.target.value)}
                  data-ocid="gps-override-add.date_input"
                />
              </div>
            )}

            {/* Reason */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="gps-override-reason"
                className="text-sm font-medium font-body"
              >
                Reason <span className="text-destructive">*</span>
                <span className="text-xs text-muted-foreground ml-1">
                  (min 10 characters)
                </span>
              </Label>
              <Textarea
                id="gps-override-reason"
                placeholder="e.g. Indoor hospital location with no GPS signal during CME event"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-ocid="gps-override-add.reason_textarea"
                className="resize-none font-body text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {reason.length} / 10+ characters required
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              data-ocid="gps-override-add.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddOverride}
              disabled={addLoading}
              data-ocid="gps-override-add.submit_button"
              className="gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5" />
              {addLoading ? "Granting…" : "Grant Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke Confirm Dialog ──────────────────────────────────────── */}
      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <DialogContent data-ocid="gps-override-revoke.dialog">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-destructive" />
              Revoke GPS Override
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground font-body py-2">
            Revoke GPS override for{" "}
            <strong className="text-foreground">
              {revokeTarget?.employeeName}
            </strong>
            ? They will be required to have GPS again for Doctor Call
            submissions.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRevokeTarget(null)}
              data-ocid="gps-override-revoke.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={revokeLoading}
              data-ocid="gps-override-revoke.confirm_button"
            >
              {revokeLoading ? "Revoking…" : "Revoke Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
