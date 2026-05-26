import { Badge } from "@/components/ui/badge";
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
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCopy,
  Edit2,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role, UserStatus } from "../../backend";
import type { HqAssignment, ReactivationLogEntry } from "../../backend.d";
import { ExportButton } from "../../components/ExportButton";
import LocationAllotment, {
  type LocationAllotmentData,
} from "../../components/LocationAllotment";
import {
  EMPTY_ALLOTMENT,
  type LocationAllotment as LocationAllotmentLegacy,
  allotmentSummary,
} from "../../components/MultiSelectLocationAllotment";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import type { RoleLocationState } from "../../components/RoleBasedLocationAllotment";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import { exportToExcel, logExportToAuditTrail } from "../../lib/exportUtils";
import { useAuthStore } from "../../store/authStore";
import type { CreateUserInput, UpdateUserInput, UserInfo } from "../../types";
import { ROLE_LABELS } from "../../types";
class UserManagementErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message };
  }
  componentDidCatch(error: Error) {
    console.error("UserManagement render error:", error);
  }
  render() {
    if (this.state.hasError)
      return (
        <div className="flex flex-col items-center justify-center min-h-64 p-8 text-center">
          <div className="text-red-500 text-4xl mb-4">⚠</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Page failed to load
          </h2>
          <p className="text-gray-500 mb-4 text-sm">
            {this.state.errorMsg ||
              "An error occurred while loading this page."}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, errorMsg: "" })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Retry
          </button>
        </div>
      );
    return this.props.children;
  }
}

const ALL_ROLES = Object.values(Role);

// ─── Password Reset Modal ──────────────────────────────────────────────────

function PasswordResetModal({
  title,
  message,
  password,
  onClose,
}: {
  title: string;
  message: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      data-ocid="password-reset-modal"
    >
      <div className="bg-card border border-border rounded-lg w-full max-w-sm shadow-xl">
        <div className="bg-muted/40 border-b border-border px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground text-sm">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-md px-3 py-2.5">
            <code className="flex-1 font-mono text-sm text-foreground tracking-wide select-all">
              {password}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="text-muted-foreground hover:text-primary transition-colors shrink-0"
              aria-label="Copy password"
              data-ocid="btn-copy-password"
            >
              <ClipboardCopy className="w-4 h-4" />
            </button>
          </div>
          {copied && (
            <p className="text-xs text-primary font-display text-center">
              Copied to clipboard!
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            ⚠️ This password will not be shown again. Copy it now.
          </p>
          <div className="flex justify-end pt-1">
            <Button onClick={onClose} data-ocid="btn-password-reset-done">
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reactivation Confirm Dialog ───────────────────────────────────────────

function ReactivateConfirmDialog({
  employees,
  onConfirm,
  onCancel,
  loading,
}: {
  employees: UserInfo[];
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const isBulk = employees.length > 1;
  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      data-ocid="reactivate-dialog"
    >
      <div className="bg-card border border-border rounded-lg w-full max-w-sm shadow-xl">
        <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-4 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <h2 className="font-display font-semibold text-emerald-900 text-sm">
            {isBulk ? "Bulk Reactivation" : "Reactivate Employee"}
          </h2>
        </div>
        <div className="p-5 space-y-4">
          {isBulk ? (
            <p className="text-sm text-foreground">
              You are about to reactivate{" "}
              <strong>{employees.length} employees</strong>. This will restore
              their access to the portal. Confirm?
            </p>
          ) : (
            <p className="text-sm text-foreground">
              Are you sure you want to reactivate{" "}
              <strong>{employees[0]?.name}</strong>? This will restore their
              access to the portal.
            </p>
          )}
          {isBulk && (
            <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto bg-muted/30 rounded-md p-2">
              {employees.map((e) => (
                <li key={String(e.id)} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  {e.name} ({e.role})
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              data-ocid="reactivate-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-ocid="reactivate-confirm-button"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Reactivating…
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                  {isBulk
                    ? `Reactivate ${employees.length} Employees`
                    : "Reactivate"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reactivation Log Panel ────────────────────────────────────────────────

function ReactivationLogPanel({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<ReactivationLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  function loadLog() {
    if (!token) return;
    setLoading(true);
    api
      .getReactivationLog(token)
      .then((entries) => setLog(entries))
      .catch(() => setLog([]))
      .finally(() => setLoading(false));
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && log.length === 0) loadLog();
  }

  function formatTs(ts: bigint) {
    const ms = Number(ts / 1_000_000n);
    return new Date(ms).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div
      className="mt-6 bg-card border border-border rounded-lg overflow-hidden"
      data-ocid="reactivation-log-panel"
    >
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors"
        data-ocid="reactivation-log-toggle"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">
            Reactivation Log
          </span>
          {log.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {log.length}
            </Badge>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-5 py-2 bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {log.length} reactivation{log.length !== 1 ? "s" : ""} recorded
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={loadLog}
              disabled={loading}
              data-ocid="reactivation-log-refresh"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          {loading && log.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
              Loading log…
            </div>
          ) : log.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">
              No reactivations recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="px-4 py-2 text-left text-xs font-display text-muted-foreground">
                      Employee
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-display text-muted-foreground">
                      Code
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-display text-muted-foreground">
                      Reactivated At
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-display text-muted-foreground">
                      Reactivated By
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-display text-muted-foreground">
                      Review Needed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((entry, i) => (
                    <tr
                      key={`${String(entry.employeeId)}-${i}`}
                      className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors"
                      data-ocid={`reactivation-log.item.${i + 1}`}
                    >
                      <td className="px-4 py-2.5 font-body font-medium text-foreground">
                        {entry.employeeName}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {entry.employeeCode}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatTs(entry.reactivatedAt)}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-foreground">
                        {entry.reactivatedByName}
                      </td>
                      <td className="px-4 py-2.5">
                        {entry.needsReview ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-2 py-0.5 font-display">
                            <AlertTriangle className="w-3 h-3" /> Review
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── User Form Modal ───────────────────────────────────────────────────────
const EMPTY_CREATE: CreateUserInput = {
  username: "",
  password: "",
  role: Role.MR,
  employeeId: "",
  name: "",
  email: "",
  phone: "",
  designation: "",
  department: "",
  territory: "",
  joinDate: new Date().toISOString().split("T")[0],
  // ta is Float in backend — stored as number
  salary: {
    basic: 0n,
    hra: 0n,
    ta: 0,
    pfPercent: 12n,
    esiPercent: 1n,
  },
};

// Roles that support Location Allotment (non-MR manager roles)
const MANAGER_ROLES_WITH_ALLOTMENT: Role[] = [Role.ASM, Role.RSM, Role.ZSM];

function UserFormModal({
  mode,
  user,
  users,
  token,
  onClose,
  onSaved,
  refreshKey = 0,
}: {
  mode: "create" | "edit";
  user?: UserInfo;
  users: UserInfo[];
  token: string;
  onClose: () => void;
  onSaved: () => void;
  refreshKey?: number;
}) {
  const [form, setForm] = useState<CreateUserInput>(
    mode === "edit" && user
      ? {
          username: user.username,
          password: "",
          role: user.role,
          employeeId: user.employeeId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          designation: user.designation,
          department: user.department,
          territory: user.territory,
          joinDate: user.joinDate,
          salary: user.salary,
          reportsTo: user.reportsTo,
        }
      : { ...EMPTY_CREATE },
  );
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [allotmentLoading, setAllotmentLoading] = useState(false);
  const [mrStationId, setMrStationId] = useState<string>(() => {
    if (mode === "edit" && user?.role === Role.MR) {
      const firstAssignment = (
        user as UserInfo & { hqAssignments?: HqAssignment[] }
      ).hqAssignments?.[0];
      return firstAssignment?.stationIds?.[0]?.toString() ?? "";
    }
    return "";
  });
  const [mrStationHqId, setMrStationHqId] = useState<string>(() => {
    if (mode === "edit" && user?.role === Role.MR) {
      const firstAssignment = (
        user as UserInfo & { hqAssignments?: HqAssignment[] }
      ).hqAssignments?.[0];
      return firstAssignment?.hqId?.toString() ?? "";
    }
    return "";
  });
  const [mrTerritoryIds, setMrTerritoryIds] = useState<string[]>(() => {
    if (mode === "edit" && user?.role === Role.MR) {
      const firstAssignment = (
        user as UserInfo & { hqAssignments?: HqAssignment[] }
      ).hqAssignments?.[0];
      return (firstAssignment?.exStationIds ?? []).map((id) => id.toString());
    }
    return [];
  });
  const [locationState, setLocationState] = useState<RoleLocationState>({
    territoryIds: [],
    isValid: false,
  });
  const [locationData, setLocationData] = useState<LocationAllotmentData>({
    isValid: false,
  });
  const [managersForRole, setManagersForRole] = useState<UserInfo[]>([]);

  // Seed allotment from existing user data when editing an MR
  const [allotment, setAllotment] = useState<LocationAllotmentLegacy>(() => {
    if (mode === "edit" && user?.role === Role.MR) {
      const hqAssignments: HqAssignment[] =
        (user as UserInfo & { hqAssignments?: HqAssignment[] }).hqAssignments ??
        [];
      return { ...EMPTY_ALLOTMENT, hqAssignments };
    }
    return EMPTY_ALLOTMENT;
  });

  // For non-MR manager roles in edit mode, fetch allotment from backend
  useEffect(() => {
    if (
      mode !== "edit" ||
      !user ||
      !token ||
      user.role === Role.MR ||
      !MANAGER_ROLES_WITH_ALLOTMENT.includes(user.role as Role)
    )
      return;

    setAllotmentLoading(true);
    api
      .getUserLocationAllotment(token, user.id)
      .then((data) => {
        if (data) {
          // getUserLocationAllotment returns bigint[] — convert to string[] for LocationAllotment
          const toStr = (ids: bigint[]): string[] =>
            (ids ?? []).map((id) => String(id));
          setAllotment({
            zoneIds: toStr(data.zoneIds ?? []),
            stateIds: toStr(data.stateIds ?? []),
            hqIds: toStr(data.hqIds ?? []),
            territoryIds: toStr(data.territoryIds ?? []),
            areaIds: toStr(data.areaIds ?? []),
            hqAssignments: data.hqAssignments ?? [],
            parentZoneId: "",
            parentStateId: "",
            parentTerritoryId: "",
            parentHqId: "",
          });
        }
      })
      .catch(() => {
        // silently fall back to empty allotment
      })
      .finally(() => setAllotmentLoading(false));
  }, [mode, user, token]);

  function setField<K extends keyof CreateUserInput>(
    k: K,
    v: CreateUserInput[K],
  ) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const setSalaryField = (k: keyof CreateUserInput["salary"], v: bigint) =>
    setForm((f) => ({ ...f, salary: { ...f.salary, [k]: v } }));

  // TA is Float in backend — parse as number, round to 2 decimal places
  const setTaField = (raw: string) => {
    const parsed = Number.parseFloat(raw) || 0;
    // Round to max 2 decimal places
    const rounded = Math.round(parsed * 100) / 100;
    setForm((f) => ({
      ...f,
      salary: { ...f.salary, ta: rounded },
    }));
  };

  // Reset allotment when role changes (only during role change by admin)
  // Fetch managers filtered to only roles above the selected role (hierarchy-aware)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    if (!token || !form.role) return;
    (
      api as unknown as Record<
        string,
        (t: string, r: string) => Promise<UserInfo[]>
      >
    )
      .listUsersAboveRole(token, form.role)
      .then((result: UserInfo[]) => setManagersForRole(result))
      .catch(() =>
        setManagersForRole(
          users.filter((u) => u.role !== Role.MR && u.id !== user?.id),
        ),
      );
  }, [token, form.role]);

  function handleRoleChange(newRole: string) {
    setField("role", newRole as Role);
    setAllotment(EMPTY_ALLOTMENT);
    if (newRole !== Role.MR) {
      setMrStationId("");
      setMrStationHqId("");
      setMrTerritoryIds([]);
    }
    setLocationState({ territoryIds: [], isValid: false });
    setLocationData({ isValid: false });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let result: import("../../types").MutationResult;

      const isMR = form.role === Role.MR;
      const isManagerWithAllotment = MANAGER_ROLES_WITH_ALLOTMENT.includes(
        form.role as Role,
      );

      // Validate role-based location allotment
      if (
        ["ZSM", "RSM", "ASM", "MR"].includes(form.role) &&
        !locationState.isValid
      ) {
        if (form.role === "MR") {
          if (!locationState.stationId) {
            toast.error("Please select a Station for this MR.");
          } else {
            toast.error("Please select at least one Territory for this MR.");
          }
        } else if (form.role === "ZSM") {
          toast.error("Please select a Zone for this ZSM.");
        } else if (form.role === "RSM") {
          toast.error("Please select a Region for this RSM.");
        } else if (form.role === "ASM") {
          toast.error("Please select an Area for this ASM.");
        }
        setSaving(false);
        return;
      }

      // Build hqAssignments for MR using locationState
      // NOTE: hqId MUST be the AREA ID (parent of the station), not the station ID.
      // The backend getStationsByMRHqAssignments matches station.hqId (each station's
      // parent Area ID) against the stored hqAssignments[].hqId.
      const hqAssignments: HqAssignment[] | undefined =
        isMR && locationState.stationId
          ? [
              {
                hqId: locationState.areaId ?? BigInt(0), // Area ID = parent of the station
                stationIds: locationState.stationId
                  ? [locationState.stationId]
                  : [],
                areaIds: locationState.areaId ? [locationState.areaId] : [],
                exStationIds: locationState.territoryIds ?? [],
              },
            ]
          : isMR && mrStationId
            ? [
                {
                  hqId: BigInt(mrStationHqId), // reads previously stored area ID
                  stationIds: [BigInt(mrStationId)],
                  areaIds: mrStationHqId ? [BigInt(mrStationHqId)] : [],
                  exStationIds: mrTerritoryIds.map((id) => BigInt(id)),
                },
              ]
            : isMR && allotment.hqAssignments.length > 0
              ? allotment.hqAssignments.filter((b) => b.hqId !== BigInt(0))
              : undefined;

      // Helper: convert string[] IDs from LocationAllotment to bigint[]
      const toBI = (ids: string[]): bigint[] =>
        ids.filter(Boolean).map((id) => BigInt(id));

      // Build role-scoped location IDs from locationState
      const zoneIdsFromState: bigint[] = locationState.zoneId
        ? [locationState.zoneId]
        : [];
      const regionIdsFromState: bigint[] = locationState.regionId
        ? [locationState.regionId]
        : [];
      const areaIdsFromState: bigint[] = locationState.areaId
        ? [locationState.areaId]
        : [];

      const locationStateUsed =
        ["ZSM", "RSM", "ASM", "MR"].includes(form.role) &&
        locationState.isValid;

      if (mode === "create") {
        const createInput: CreateUserInput = {
          ...form,
          ...(isMR && hqAssignments !== undefined ? { hqAssignments } : {}),
          // hqIds for MR = area IDs (HQ is the Area level for MR)
          ...(locationStateUsed && form.role === "MR" && locationState.areaId
            ? { hqIds: [locationState.areaId], areaIds: [locationState.areaId] }
            : {}),
          ...(locationStateUsed && form.role === "MR"
            ? {
                ...(zoneIdsFromState.length > 0
                  ? { zoneIds: zoneIdsFromState }
                  : {}),
                ...(regionIdsFromState.length > 0
                  ? { stateIds: regionIdsFromState }
                  : {}),
                ...(areaIdsFromState.length > 0
                  ? { areaIds: areaIdsFromState }
                  : {}),
                ...(locationState.territoryIds?.length > 0
                  ? { territoryIds: locationState.territoryIds }
                  : {}),
              }
            : {}),
          ...(locationStateUsed && form.role === "ZSM"
            ? { zoneIds: zoneIdsFromState }
            : {}),
          ...(locationStateUsed && form.role === "RSM"
            ? { zoneIds: zoneIdsFromState, stateIds: regionIdsFromState }
            : {}),
          ...(locationStateUsed && form.role === "ASM"
            ? { stateIds: regionIdsFromState, hqIds: areaIdsFromState }
            : {}),
          ...(!locationStateUsed && isManagerWithAllotment
            ? {
                zoneIds:
                  allotment.zoneIds.length > 0
                    ? toBI(allotment.zoneIds)
                    : undefined,
                stateIds:
                  allotment.stateIds.length > 0
                    ? toBI(allotment.stateIds)
                    : undefined,
                hqIds:
                  allotment.hqIds.length > 0
                    ? toBI(allotment.hqIds)
                    : undefined,
                territoryIds:
                  allotment.territoryIds.length > 0
                    ? toBI(allotment.territoryIds)
                    : undefined,
                areaIds:
                  allotment.areaIds.length > 0
                    ? toBI(allotment.areaIds)
                    : undefined,
              }
            : {}),
        };
        result = await api.createUser(token, createInput);
      } else {
        const update: UpdateUserInput = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          designation: form.designation,
          department: form.department,
          territory: form.territory,
          joinDate: form.joinDate,
          role: form.role,
          salary: form.salary,
          reportsTo: form.reportsTo ?? null,
          ...(form.password ? { newPassword: form.password } : {}),
          // Always include allotment fields on save so a role-only edit does NOT wipe allotment
          ...(isMR && hqAssignments !== undefined ? { hqAssignments } : {}),
          // hqIds for MR = area IDs (HQ is the Area level for MR)
          ...(locationStateUsed && form.role === "MR" && locationState.areaId
            ? { hqIds: [locationState.areaId], areaIds: [locationState.areaId] }
            : {}),
          ...(locationStateUsed && form.role === "MR"
            ? {
                ...(zoneIdsFromState.length > 0
                  ? { zoneIds: zoneIdsFromState }
                  : {}),
                ...(regionIdsFromState.length > 0
                  ? { stateIds: regionIdsFromState }
                  : {}),
                ...(areaIdsFromState.length > 0
                  ? { areaIds: areaIdsFromState }
                  : {}),
                ...(locationState.territoryIds?.length > 0
                  ? { territoryIds: locationState.territoryIds }
                  : {}),
              }
            : {}),
          ...(locationStateUsed && form.role === "ZSM"
            ? { zoneIds: zoneIdsFromState }
            : {}),
          ...(locationStateUsed && form.role === "RSM"
            ? { zoneIds: zoneIdsFromState, stateIds: regionIdsFromState }
            : {}),
          ...(locationStateUsed && form.role === "ASM"
            ? { stateIds: regionIdsFromState, hqIds: areaIdsFromState }
            : {}),
          ...(!locationStateUsed && isManagerWithAllotment
            ? {
                zoneIds: toBI(allotment.zoneIds),
                stateIds: toBI(allotment.stateIds),
                hqIds: toBI(allotment.hqIds),
                territoryIds: toBI(allotment.territoryIds),
                areaIds: toBI(allotment.areaIds),
              }
            : {}),
        };
        result = await api.updateUser(token, user!.id, update);
      }
      if (result.__kind__ === "ok") {
        toast.success(
          mode === "create"
            ? "User created successfully"
            : "User updated successfully",
        );
        onSaved();
      } else {
        toast.error(result.err);
      }
    } catch {
      toast.error("Operation failed");
    } finally {
      setSaving(false);
    }
  }

  // managersForRole is populated by the useEffect above (role-aware, higher-rank only).
  // Falls back to filtering users client-side if the API call hasn't resolved yet.
  const managers =
    managersForRole.length > 0
      ? managersForRole
      : users.filter((u) => u.role !== Role.MR && u.id !== user?.id);

  // Build allotment summary for display
  const summary = allotmentSummary(allotment);
  const hasAllotment =
    allotment.zoneIds.length > 0 ||
    allotment.stateIds.length > 0 ||
    allotment.hqIds.length > 0 ||
    allotment.areaIds.length > 0 ||
    allotment.hqAssignments.filter((b) => b.hqId !== BigInt(0)).length > 0;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        data-ocid="user-form-modal"
      >
        <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
          <div className="bg-muted/40 border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-10">
            <h2 className="font-display font-semibold text-foreground">
              {mode === "create"
                ? "Create New Employee"
                : `Edit: ${user?.name}`}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Identity */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-3 border-b border-border pb-1 w-full">
                Identity
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 font-display">
                    Employee UID {mode === "create" ? "(auto-generated)" : ""}
                  </Label>
                  {mode === "edit" ? (
                    <div className="flex items-center gap-2 h-9 px-3 bg-muted/50 border border-border rounded-md">
                      <span className="font-mono text-sm text-foreground">
                        {form.employeeId || "—"}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        Auto-generated · read-only
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center h-9 px-3 bg-muted/30 border border-dashed border-border rounded-md">
                      <span className="text-xs text-muted-foreground italic">
                        Will be auto-generated on save
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1 font-display">
                    Full Name *
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    required
                    placeholder="Rajesh Kumar"
                    data-ocid="field-name"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 font-display">
                    Username *
                  </Label>
                  <Input
                    value={form.username}
                    onChange={(e) => setField("username", e.target.value)}
                    required
                    placeholder="rajesh.kumar"
                    disabled={mode === "edit"}
                    data-ocid="field-username"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 font-display">
                    {mode === "edit"
                      ? "New Password (leave blank to keep)"
                      : "Password *"}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPwd ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setField("password", e.target.value)}
                      required={mode === "create"}
                      placeholder={mode === "edit" ? "••••••••" : "Min 8 chars"}
                      data-ocid="field-password"
                      className="pr-9"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPwd((s) => !s)}
                      aria-label={showPwd ? "Hide password" : "Show password"}
                    >
                      {showPwd ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </fieldset>

            {/* Role & Reporting */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-3 border-b border-border pb-1 w-full">
                Role & Reporting
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 font-display">Role *</Label>
                  <Select value={form.role} onValueChange={handleRoleChange}>
                    <SelectTrigger data-ocid="field-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 font-display">
                    Reports To
                  </Label>
                  <Select
                    value={form.reportsTo ? String(form.reportsTo) : "none"}
                    onValueChange={(v) =>
                      setField(
                        "reportsTo",
                        v === "none" ? undefined : BigInt(v),
                      )
                    }
                  >
                    <SelectTrigger data-ocid="field-reportsTo">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={String(m.id)} value={String(m.id)}>
                          {m.name} ({m.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 font-display">
                    Designation *
                  </Label>
                  <Input
                    value={form.designation}
                    onChange={(e) => setField("designation", e.target.value)}
                    required
                    placeholder="Senior MR"
                    data-ocid="field-designation"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 font-display">
                    Department *
                  </Label>
                  <Input
                    value={form.department}
                    onChange={(e) => setField("department", e.target.value)}
                    required
                    placeholder="Field Sales"
                    data-ocid="field-department"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 font-display">
                    Join Date *
                  </Label>
                  <Input
                    type="date"
                    value={form.joinDate}
                    onChange={(e) => setField("joinDate", e.target.value)}
                    required
                    data-ocid="field-joinDate"
                  />
                </div>
              </div>
            </fieldset>

            {/* Location Allotment */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-3 border-b border-border pb-1 w-full flex items-center gap-2">
                <MapPin className="w-3 h-3" /> Location Allotment
              </legend>

              {/* Loading state while fetching existing allotment */}
              {allotmentLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading previously allotted locations…
                </div>
              ) : (
                <>
                  {/* Pre-populated HQ tags — visible block for each allotted HQ */}
                  {mode === "edit" &&
                    hasAllotment &&
                    MANAGER_ROLES_WITH_ALLOTMENT.includes(
                      form.role as Role,
                    ) && (
                      <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 mb-2">
                        <p className="text-xs font-display font-medium text-foreground mb-1.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary" /> Previously
                          Allotted Locations
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {summary}
                        </p>
                      </div>
                    )}

                  {form.role !== Role.Admin && form.role !== Role.HRManager && (
                    <LocationAllotment
                      role={form.role}
                      reportingManagerId={
                        form.reportsTo ? String(form.reportsTo) : null
                      }
                      token={token}
                      onChange={(data: LocationAllotmentData) => {
                        setLocationData(data);
                        setLocationState({
                          zoneId: data.zoneIdBI,
                          zoneName: data.zoneName,
                          regionId: data.regionIdBI,
                          regionName: data.regionName,
                          areaId: data.areaIdBI,
                          areaName: data.areaName,
                          stationId: data.stationIdBI,
                          stationName: data.stationName,
                          territoryIds: data.territoryIdsBI ?? [],
                          isValid: data.isValid ?? false,
                        });
                      }}
                      existingData={
                        mode === "edit" && user ? locationData : undefined
                      }
                      mode={mode}
                      refreshKey={refreshKey}
                    />
                  )}
                </>
              )}
            </fieldset>

            {/* Contact */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-3 border-b border-border pb-1 w-full">
                Contact
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 font-display">Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    required
                    placeholder="rajesh@krishkar.com"
                    data-ocid="field-email"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 font-display">Phone *</Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    required
                    placeholder="+91 98XXXXXXXX"
                    data-ocid="field-phone"
                  />
                </div>
              </div>
            </fieldset>

            {/* Salary */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-3 border-b border-border pb-1 w-full">
                Salary Components (₹)
              </legend>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { k: "basic", label: "Basic Pay" },
                    { k: "hra", label: "HRA" },
                  ] as { k: keyof CreateUserInput["salary"]; label: string }[]
                ).map(({ k, label }) => (
                  <div key={k}>
                    <Label className="text-xs mb-1 font-display">{label}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={String(form.salary[k])}
                      onChange={(e) =>
                        setSalaryField(k, BigInt(e.target.value || "0"))
                      }
                      data-ocid={`field-salary-${k}`}
                    />
                  </div>
                ))}
                {/* TA Allowance — Float in backend, supports 2 decimal places */}
                <div>
                  <Label className="text-xs mb-1 font-display">
                    TA Allowance
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={(form.salary.ta as number).toFixed(2)}
                    onChange={(e) => setTaField(e.target.value)}
                    onBlur={(e) => setTaField(e.target.value)}
                    placeholder="0.00"
                    data-ocid="field-salary-ta"
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">
                    e.g. 1250.50 — max 2 decimal places
                  </p>
                </div>
                <div>
                  <Label className="text-xs mb-1 font-display">
                    PF % (Employee)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={String(form.salary.pfPercent)}
                    onChange={(e) =>
                      setSalaryField("pfPercent", BigInt(e.target.value || "0"))
                    }
                    data-ocid="field-salary-pfPercent"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 font-display">
                    ESI % (Employee)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={String(form.salary.esiPercent)}
                    onChange={(e) =>
                      setSalaryField(
                        "esiPercent",
                        BigInt(e.target.value || "0"),
                      )
                    }
                    data-ocid="field-salary-esiPercent"
                  />
                </div>
              </div>
            </fieldset>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || allotmentLoading}
                data-ocid="btn-save-user"
              >
                {saving
                  ? "Saving…"
                  : mode === "create"
                    ? "Create Employee"
                    : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── Location summary display ──────────────────────────────────────────────

function LocationSummaryCell({
  user,
  zoneMap,
  stateMap,
  areaMap,
  stationMap,
}: {
  user: UserInfo;
  zoneMap: Record<string, string>;
  stateMap: Record<string, string>;
  areaMap: Record<string, string>;
  stationMap: Record<string, string>;
}) {
  const role = user.role;

  if (role === Role.HRManager || role === Role.Admin) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-display">
        All Zones
      </span>
    );
  }

  if (role === Role.ZSM) {
    const zoneId = user.zoneIds?.[0]?.toString();
    const name = zoneId ? zoneMap[zoneId] : undefined;
    if (name) return <span className="text-xs text-foreground">{name}</span>;
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (role === Role.RSM) {
    const stateId = user.stateIds?.[0]?.toString();
    const zoneId = user.zoneIds?.[0]?.toString();
    const stateName = stateId ? stateMap[stateId] : undefined;
    const zoneName = zoneId ? zoneMap[zoneId] : undefined;
    if (stateName || zoneName) {
      return (
        <span className="text-xs text-foreground">
          {stateName || "—"}
          {zoneName ? ` > ${zoneName}` : ""}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (role === Role.ASM) {
    const areaId = user.areaIds?.[0]?.toString();
    const stateId = user.stateIds?.[0]?.toString();
    const zoneId = user.zoneIds?.[0]?.toString();
    const areaName = areaId ? areaMap[areaId] : undefined;
    const stateName = stateId ? stateMap[stateId] : undefined;
    const zoneName = zoneId ? zoneMap[zoneId] : undefined;
    if (areaName || stateName || zoneName) {
      return (
        <span className="text-xs text-foreground">
          {areaName || "—"}
          {stateName ? ` > ${stateName}` : ""}
          {zoneName ? ` > ${zoneName}` : ""}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (role === Role.MR) {
    const territoryId = user.territoryIds?.[0]?.toString();
    const stationId = user.hqAssignments?.[0]?.stationIds?.[0]?.toString();
    const areaId = user.areaIds?.[0]?.toString();
    const stateId = user.stateIds?.[0]?.toString();
    const zoneId = user.zoneIds?.[0]?.toString();

    const territoryName = territoryId ? `Territory ${territoryId}` : undefined;
    const stationName = stationId ? stationMap[stationId] : undefined;
    const areaName = areaId ? areaMap[areaId] : undefined;
    const stateName = stateId ? stateMap[stateId] : undefined;
    const zoneName = zoneId ? zoneMap[zoneId] : undefined;

    const parts: string[] = [];
    if (territoryName) parts.push(territoryName);
    if (stationName) parts.push(stationName);
    if (areaName) parts.push(areaName);
    if (stateName) parts.push(stateName);
    if (zoneName) parts.push(zoneName);

    if (parts.length > 0) {
      return (
        <span
          className="text-xs text-foreground truncate block max-w-[200px]"
          title={parts.join(" > ")}
        >
          {parts.join(" > ")}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return <span className="text-xs text-muted-foreground">—</span>;
}

// ─── Table columns ─────────────────────────────────────────────────────────

const USER_COLS = [
  { key: "empId", label: "Employee UID" },
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "designation", label: "Designation" },
  { key: "department", label: "Dept" },
  { key: "location", label: "Hierarchy" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", className: "text-right" },
];

const ROLE_COLORS: Record<string, string> = {
  Admin: "bg-primary/20 text-primary border-primary/30",
  HRManager: "bg-accent/20 text-accent border-accent/30",
  ZSM: "text-chart-5 bg-chart-5/10 border-chart-5/30",
  RSM: "text-chart-4 bg-chart-4/10 border-chart-4/30",
  ASM: "text-chart-1 bg-chart-1/10 border-chart-1/30",
  MR: "bg-muted text-muted-foreground border-border",
};

// ─── Inactive Users Tab ─────────────────────────────────────────────────────

function InactiveUsersTab({
  token,
  canReactivate,
}: {
  token: string;
  canReactivate: boolean;
}) {
  const [inactiveUsers, setInactiveUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reactivatingIds, setReactivatingIds] = useState<Set<string>>(
    new Set(),
  );
  const [confirmTarget, setConfirmTarget] = useState<UserInfo[] | null>(null);
  const [reviewWarnings, setReviewWarnings] = useState<Set<string>>(new Set());

  const loadInactive = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .getInactiveUsers(token)
      .then((u) => setInactiveUsers(u))
      .catch(() => setInactiveUsers([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    loadInactive();
  }, [loadInactive]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === inactiveUsers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(inactiveUsers.map((u) => String(u.id))));
    }
  }

  async function executeReactivation(targets: UserInfo[]) {
    if (!token || targets.length === 0) return;
    const ids = targets.map((u) => String(u.id));
    setReactivatingIds((prev) => new Set([...prev, ...ids]));
    const newWarnings = new Set<string>();
    let successCount = 0;

    for (const u of targets) {
      try {
        const result = await api.reactivateUser(token, u.id);
        if (result.__kind__ === "ok") {
          successCount++;
          // Check reactivation log for this user's needsReview flag
          // We flag by checking if the employee had a needs_review entry
          // Since MutationResult returns null on ok, we check via log
          // We'll add to review warnings conservatively based on role
          if (u.territory === "" || u.designation === "") {
            newWarnings.add(String(u.id));
          }
        } else {
          toast.error(`Failed to reactivate ${u.name}: ${result.err}`);
        }
      } catch {
        toast.error(`Failed to reactivate ${u.name}`);
      }
    }

    setReactivatingIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });

    if (successCount > 0) {
      if (targets.length === 1) {
        toast.success(
          `Employee ${targets[0].name} has been successfully reactivated.`,
        );
      } else {
        toast.success(
          `${successCount} employee${successCount !== 1 ? "s" : ""} have been successfully reactivated.`,
        );
      }
    }

    if (newWarnings.size > 0) {
      setReviewWarnings((prev) => new Set([...prev, ...newWarnings]));
    }

    setSelected(new Set());
    setConfirmTarget(null);
    loadInactive();
  }

  const selectedUsers = inactiveUsers.filter((u) => selected.has(String(u.id)));
  const allSelected =
    inactiveUsers.length > 0 && selected.size === inactiveUsers.length;

  return (
    <div>
      {/* Toolbar */}
      {canReactivate && selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-display text-emerald-900 flex-1">
            {selected.size} employee{selected.size !== 1 ? "s" : ""} selected
          </span>
          <Button
            size="sm"
            onClick={() => setConfirmTarget(selectedUsers)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            data-ocid="reactivate-selected-button"
          >
            <UserCheck className="w-3.5 h-3.5 mr-1.5" />
            Reactivate Selected ({selected.size})
          </Button>
        </div>
      )}

      {/* Review warnings */}
      {reviewWarnings.size > 0 && (
        <div className="mb-4 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Please verify location and role allotment for recently reactivated
            employees before they resume work.
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading inactive employees…</span>
        </div>
      ) : inactiveUsers.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2"
          data-ocid="inactive-users.empty_state"
        >
          <UserCheck className="w-8 h-8 text-emerald-400" />
          <p className="text-sm font-display">No inactive employees found.</p>
          <p className="text-xs">All employees are currently active.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {canReactivate && (
                  <th className="px-4 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-border"
                      aria-label="Select all inactive employees"
                      data-ocid="inactive-users.select-all-checkbox"
                    />
                  </th>
                )}
                <th className="px-4 py-2.5 text-left text-xs font-display text-muted-foreground">
                  Employee UID
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-display text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-display text-muted-foreground">
                  Role
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-display text-muted-foreground">
                  HQ / Territory
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-display text-muted-foreground">
                  Status
                </th>
                {canReactivate && (
                  <th className="px-4 py-2.5 text-right text-xs font-display text-muted-foreground">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {inactiveUsers.map((u, i) => {
                const sid = String(u.id);
                const isReactivating = reactivatingIds.has(sid);
                const needsReview = reviewWarnings.has(sid);
                return (
                  <tr
                    key={sid}
                    className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors"
                    data-ocid={`inactive-users.item.${i + 1}`}
                  >
                    {canReactivate && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(sid)}
                          onChange={() => toggleSelect(sid)}
                          className="rounded border-border"
                          aria-label={`Select ${u.name}`}
                          data-ocid={`inactive-users.checkbox.${i + 1}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {u.employeeId || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-body font-medium text-foreground">
                        {u.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {u.username}
                      </div>
                      {needsReview && (
                        <div className="mt-1 inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-2 py-0.5">
                          <AlertTriangle className="w-3 h-3" /> Verify allotment
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded border font-display ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground border-border"}`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.territory || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className="text-xs bg-red-100 text-red-700 border-red-200"
                      >
                        Inactive
                      </Badge>
                    </td>
                    {canReactivate && (
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
                          onClick={() => setConfirmTarget([u])}
                          disabled={isReactivating}
                          data-ocid={`inactive-users.reactivate-button.${i + 1}`}
                          aria-label={`Reactivate ${u.name}`}
                        >
                          {isReactivating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                              Reactivate
                            </>
                          )}
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmTarget && (
        <ReactivateConfirmDialog
          employees={confirmTarget}
          onConfirm={() => executeReactivation(confirmTarget)}
          onCancel={() => setConfirmTarget(null)}
          loading={reactivatingIds.size > 0}
        />
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

function UserManagement() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active");
  const [modal, setModal] = useState<{
    mode: "create" | "edit";
    user?: UserInfo;
  } | null>(null);
  const [resetModal, setResetModal] = useState<{
    title: string;
    message: string;
    password: string;
  } | null>(null);
  const [resettingId, setResettingId] = useState<bigint | null>(null);
  const [zoneMap, setZoneMap] = useState<Record<string, string>>({});
  const [stateMap, _setStateMap] = useState<Record<string, string>>({});
  const [areaMap, setAreaMap] = useState<Record<string, string>>({});
  const [stationMap, setStationMap] = useState<Record<string, string>>({});

  const [modalOpenKey, setModalOpenKey] = useState(0);

  const canResetPasswords =
    session?.role === Role.Admin || session?.role === Role.HRManager;
  const canReactivate =
    session?.role === Role.Admin || session?.role === Role.HRManager;

  const loadUsers = useCallback(() => {
    if (!session?.token) return;
    setLoading(true);
    api
      .listAllUsers(session.token)
      .then((u) => {
        setUsers(u);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!session?.token) return;
    api.listActiveZones(session.token).then((zones) => {
      const map: Record<string, string> = {};
      for (const z of zones) {
        map[String(z.id)] = z.name;
      }
      setZoneMap(map);
    });
    api.listAllStations(session.token).then((stations) => {
      const map: Record<string, string> = {};
      for (const s of stations) {
        map[String(s.stationId)] = s.stationName;
      }
      setStationMap(map);
    });
    api.listAllAreas(session.token).then((areas) => {
      const map: Record<string, string> = {};
      for (const a of areas) {
        map[String(a.id)] = a.name || "";
      }
      setAreaMap(map);
    });
  }, [session?.token]);

  const activeUsers = users.filter((u) => u.status === UserStatus.Active);

  const filtered = activeUsers.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.employeeId.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.designation.toLowerCase().includes(q) ||
      u.territory.toLowerCase().includes(q)
    );
  });

  async function handleDeactivate(u: UserInfo) {
    if (!session?.token) return;
    if (!confirm(`Deactivate ${u.name}?`)) return;
    const result = await api.deactivateUser(session.token, u.id);
    if (result.__kind__ === "ok") {
      toast.success(`${u.name} deactivated`);
      loadUsers();
    } else {
      toast.error(result.err);
    }
  }

  async function handleDelete(u: UserInfo) {
    if (!session?.token) return;
    if (
      !window.confirm(
        `Are you sure you want to permanently delete ${u.name}? All their records will be archived. This cannot be undone.`,
      )
    )
      return;
    try {
      const res = await api.deleteEmployee(session.token, String(u.id));
      if (res.__kind__ === "ok") {
        toast.success("Employee deleted and all records archived.");
        loadUsers();
      } else {
        toast.error(res.err?.message ?? "Failed to delete employee.");
      }
    } catch {
      toast.error("An error occurred while deleting the employee.");
    }
  }

  async function handleResetPassword(u: UserInfo) {
    if (!session?.token) return;
    if (
      !confirm(
        `Reset password for ${u.name}? A new temporary password will be generated.`,
      )
    )
      return;
    setResettingId(u.id);
    try {
      const result = await api.resetUserPassword(session.token, u.id);
      if (result.__kind__ === "ok") {
        setResetModal({
          title: "Password Reset",
          message: `Temporary password for ${u.name}:`,
          password: result.ok,
        });
      } else {
        toast.error(`Reset failed: ${result.err}`);
      }
    } catch {
      toast.error("Password reset failed");
    } finally {
      setResettingId(null);
    }
  }

  async function handleSeedAdmin() {
    if (!session?.token) return;
    if (
      !confirm(
        "Reset Admin credentials to username: admin, password: Admin@1234? This will immediately replace the current Admin password.",
      )
    )
      return;
    setResettingId(-1n);
    try {
      const result = await api.seedAdminPassword(session.token);
      if (result.__kind__ === "ok") {
        setResetModal({
          title: "Admin Credentials Reset",
          message:
            "Admin credentials have been reset. Username: admin — Password:",
          password: "Admin@1234",
        });
      } else {
        toast.error(`Seed failed: ${result.err}`);
      }
    } catch {
      toast.error("Admin seed failed");
    } finally {
      setResettingId(null);
    }
  }

  const handleExportActive = () => {
    const data = (filtered as UserInfo[]).map((u) => ({
      employeeCode: u.employeeId || "",
      fullName: u.name || "",
      userId: u.username || "",
      role: String(u.role || ""),
      department: u.department || "",
      designation: u.designation || "",
      reportingManager: "",
      zone: "",
      region: "",
      area: "",
      station: "",
      territory: u.territory || "",
      mobile: u.phone || "",
      email: u.email || "",
      joiningDate: u.joinDate || "",
      status: String(u.status || ""),
    }));
    exportToExcel({
      reportName: "Employee Report",
      columns: [
        { key: "employeeCode", label: "Employee Code", type: "text" },
        { key: "fullName", label: "Full Name", type: "text" },
        { key: "userId", label: "User ID", type: "text" },
        { key: "role", label: "Role", type: "text" },
        { key: "department", label: "Department", type: "text" },
        { key: "designation", label: "Designation", type: "text" },
        { key: "reportingManager", label: "Reporting Manager", type: "text" },
        { key: "zone", label: "Zone", type: "text" },
        { key: "region", label: "Region", type: "text" },
        { key: "area", label: "Area", type: "text" },
        { key: "station", label: "Station", type: "text" },
        { key: "territory", label: "Territory", type: "text" },
        { key: "mobile", label: "Mobile", type: "text" },
        { key: "email", label: "Email", type: "text" },
        { key: "joiningDate", label: "Joining Date", type: "date" },
        { key: "status", label: "Status", type: "text" },
      ],
      data,
      activeFilters: search ? `Search: ${search}` : "",
      companyName:
        (companyProfile as { companyName?: string; name?: string } | null)
          ?.companyName ||
        (companyProfile as { companyName?: string; name?: string } | null)
          ?.name ||
        "Krishkar Pharmaceuticals",
    });
    logExportToAuditTrail(
      {
        userId: String(session?.userId ?? ""),
        userName: String(session?.name ?? ""),
        role: String(session?.role ?? ""),
      },
      "Employee Report",
      search ? `Search: ${search}` : "",
      data.length,
    );
  };

  const inactiveCount = users.filter(
    (u) => u.status === UserStatus.Inactive,
  ).length;

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="User Management"
        subtitle={`${activeUsers.length} active · ${inactiveCount} inactive`}
        actions={
          activeTab === "active" ? (
            <div className="flex items-center gap-2">
              <ExportButton
                onClick={handleExportActive}
                disabled={filtered.length === 0}
                tooltip={
                  filtered.length === 0
                    ? "No data to export"
                    : "Exports currently filtered data"
                }
                data-ocid="user_management.export_button"
              />
              <Button
                size="sm"
                onClick={() => {
                  setModalOpenKey((k) => k + 1);
                  setModal({ mode: "create" });
                }}
                data-ocid="btn-create-user"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add Employee
              </Button>
            </div>
          ) : undefined
        }
      />
      <PageContent>
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2.5 text-sm font-display font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "active"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-ocid="tab-active-users"
          >
            Active Users
            <Badge variant="secondary" className="ml-2 text-xs">
              {activeUsers.length}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("inactive")}
            className={`px-4 py-2.5 text-sm font-display font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "inactive"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-ocid="tab-inactive-users"
          >
            Inactive Users
            {inactiveCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 text-xs bg-red-100 text-red-700 border-red-200"
              >
                {inactiveCount}
              </Badge>
            )}
          </button>
        </div>

        {activeTab === "active" ? (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, UID (KP-2026-001), territory…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-ocid="filter-search"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-44" data-ocid="filter-role">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DataTable
              columns={USER_COLS}
              data={filtered}
              getKey={(u) => String(u.id)}
              loading={loading}
              emptyMessage="No active employees match the current filter"
              renderRow={(u) => (
                <>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {u.employeeId}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-body font-medium text-foreground text-sm">
                      {u.name}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {u.username}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded border font-display ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground border-border"}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {u.designation}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {u.department}
                  </td>
                  <td className="px-4 py-3">
                    <LocationSummaryCell
                      user={u}
                      zoneMap={zoneMap}
                      stateMap={stateMap}
                      areaMap={areaMap}
                      stationMap={stationMap}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="default" className="text-xs">
                      Active
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => {
                          setModalOpenKey((k) => k + 1);
                          setModal({ mode: "edit", user: u });
                        }}
                        data-ocid={`btn-edit-user-${String(u.id)}`}
                        aria-label={`Edit ${u.name}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      {session?.role === Role.Admin && u.role === Role.Admin ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-primary hover:text-primary"
                          onClick={handleSeedAdmin}
                          disabled={resettingId === -1n}
                          data-ocid="btn-seed-admin"
                          aria-label="Reset Admin credentials to fixed values"
                          title="Reset Admin credentials (admin / Admin@1234)"
                        >
                          {resettingId === -1n ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ShieldAlert className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      ) : canResetPasswords ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => handleResetPassword(u)}
                          disabled={resettingId === u.id}
                          data-ocid={`btn-reset-password-${String(u.id)}`}
                          aria-label={`Reset password for ${u.name}`}
                          title="Reset password"
                        >
                          {resettingId === u.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <KeyRound className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => handleDeactivate(u)}
                        data-ocid={`btn-deactivate-user-${String(u.id)}`}
                        aria-label={`Deactivate ${u.name}`}
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(u)}
                        data-ocid={`btn-delete-user-${String(u.id)}`}
                        aria-label={`Delete ${u.name}`}
                        title="Delete Employee"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </>
              )}
            />

            {/* Hierarchy summary */}
            <div className="mt-6">
              <h2 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <ChevronRight className="w-4 h-4" /> Reporting Hierarchy Summary
              </h2>
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                {ALL_ROLES.filter(
                  (r) => r !== Role.Admin && r !== Role.HRManager,
                ).map((r) => {
                  const roleUsers = activeUsers.filter((u) => u.role === r);
                  return (
                    <div
                      key={r}
                      className="flex items-center gap-4 px-5 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <span
                        className={`text-xs px-2 py-0.5 rounded border font-display ${ROLE_COLORS[r]}`}
                      >
                        {r}
                      </span>
                      <span className="text-sm text-foreground font-body flex-1">
                        {roleUsers.length}{" "}
                        {roleUsers.length === 1 ? "person" : "people"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <InactiveUsersTab
              token={session?.token ?? ""}
              canReactivate={canReactivate}
            />
            {/* Reactivation log — Admin/HR only */}
            {canReactivate && session?.token && (
              <ReactivationLogPanel token={session.token} />
            )}
          </>
        )}
      </PageContent>

      {modal && (
        <UserFormModal
          key={modalOpenKey}
          refreshKey={modalOpenKey}
          mode={modal.mode}
          user={modal.user}
          users={users}
          token={session?.token ?? ""}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            loadUsers();
          }}
        />
      )}

      {resetModal && (
        <PasswordResetModal
          title={resetModal.title}
          message={resetModal.message}
          password={resetModal.password}
          onClose={() => setResetModal(null)}
        />
      )}
    </PortalLayout>
  );
}
const WrappedUserManagement = () => (
  <UserManagementErrorBoundary>
    <UserManagement />
  </UserManagementErrorBoundary>
);
export default WrappedUserManagement;
