import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Building2,
  CheckSquare,
  Edit2,
  History,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Square,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import type {
  AbsenceInactivationLogView,
  HqAssignment,
  LocationLevel,
  PrimaryHqInfo,
} from "../../backend.d";
import {
  EMPTY_ALLOTMENT,
  type LocationAllotment,
  MultiSelectLocationAllotment,
  allotmentSummary,
} from "../../components/MultiSelectLocationAllotment";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import ScrollToBottom from "../../components/ScrollToBottom";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { CreateUserInput, UpdateUserInput, UserInfo } from "../../types";
import { UserStatus } from "../../types";

// Valid SFA roles only
const ROLES = ["MR", "ASM", "RSM", "ZSM", "HRManager", "Admin"] as const;

// Role → expected HQ level mapping
const ROLE_HQ_LEVEL: Record<string, string> = {
  ZSM: "Zone",
  RSM: "Region",
  ASM: "Area",
  MR: "Station",
};

// Roles that support Location Allotment
const MANAGER_ROLES_WITH_ALLOTMENT = ["ASM", "RSM", "ZSM"] as const;

const EMPTY_FORM: CreateUserInput = {
  name: "",
  username: "",
  password: "",
  email: "",
  phone: "",
  employeeId: "",
  designation: "",
  department: "",
  territory: "",
  joinDate: new Date().toISOString().split("T")[0],
  role: "MR" as import("../../backend.d").Role,
  salary: {
    basic: 0n,
    hra: 0n,
    ta: 0,
    pfPercent: 12n,
    esiPercent: 75n,
  },
};

type TabView = "active" | "inactive";

// ─── Invalid Roles Banner ─────────────────────────────────────────────────────
function InvalidRolesBanner({ token }: { token: string }) {
  const [invalidEmployees, setInvalidEmployees] = useState<
    { id: bigint; rawRole: string; name: string; employeeId: string }[]
  >([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .getInvalidRoleEmployees(token)
      .then(setInvalidEmployees)
      .catch(() => {});
  }, [token]);

  if (dismissed || invalidEmployees.length === 0) return null;

  return (
    <div
      className="mb-4 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg"
      data-ocid="invalid-roles-banner"
    >
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-display font-semibold text-amber-800">
          {invalidEmployees.length} employee
          {invalidEmployees.length !== 1 ? "s" : ""} with invalid roles
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          Some employees have roles that are no longer valid in the current
          hierarchy (Admin &gt; HR &gt; ZSM &gt; RSM &gt; ASM &gt; MR). Please
          review and update their role and reporting manager.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {invalidEmployees.slice(0, 5).map((e) => (
            <span
              key={String(e.id)}
              className="text-xs px-2 py-0.5 bg-amber-100 border border-amber-300 rounded text-amber-800 font-mono"
            >
              {e.name} ({e.rawRole})
            </span>
          ))}
          {invalidEmployees.length > 5 && (
            <span className="text-xs text-amber-600">
              +{invalidEmployees.length - 5} more
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-amber-500 hover:text-amber-700 transition-colors flex-shrink-0"
        aria-label="Dismiss"
        data-ocid="invalid-roles-dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Primary HQ Selector ──────────────────────────────────────────────────────
function PrimaryHqSelector({
  token,
  role,
  value,
  onChange,
  error,
}: {
  token: string;
  role: string;
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const [options, setOptions] = useState<PrimaryHqInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !role) return;
    setLoading(true);
    api
      .getLocationsForRole(token, role as import("../../backend.d").Role)
      .then(setOptions)
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [token, role]);

  const expectedLevel = ROLE_HQ_LEVEL[role];
  const levelLabels: Record<string, string> = {
    Zone: "Zone-level",
    Region: "Region-level",
    Area: "Area-level",
    Station: "Station-level",
  };

  return (
    <div className="col-span-2">
      <div className="border-t border-border pt-3">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs uppercase tracking-wider font-display text-muted-foreground">
            Primary HQ / Headquarters
          </p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">
            Headquarters
            {expectedLevel && (
              <span className="ml-1.5 text-primary/70 font-normal">
                ({levelLabels[expectedLevel]} for {role})
              </span>
            )}
          </Label>
          {loading ? (
            <div className="flex items-center gap-2 h-9 px-3 bg-muted/30 border border-border rounded-md">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Loading locations…
              </span>
            </div>
          ) : (
            <Select
              value={value || "_none"}
              onValueChange={(v) => {
                if (v === "_none") {
                  onChange("");
                } else {
                  onChange(v);
                }
              }}
            >
              <SelectTrigger
                className={error ? "border-destructive" : ""}
                data-ocid="emp-primary-hq-select"
              >
                <SelectValue placeholder="Select employee's headquarters" />
              </SelectTrigger>
              <SelectContent className="max-h-56 overflow-y-auto scrollbar-thin">
                <SelectItem value="_none">
                  <span className="text-muted-foreground italic">
                    No HQ assigned
                  </span>
                </SelectItem>
                {options.map((o) => (
                  <SelectItem key={String(o.id)} value={String(o.id)}>
                    <span className="flex items-center gap-2">
                      <span>{o.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({o.level})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {error && (
            <p
              className="text-xs text-destructive mt-1"
              data-ocid="emp-primary-hq-error"
            >
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Select the employee's designated headquarters location.
            {expectedLevel &&
              ` Must be a ${levelLabels[expectedLevel]} location.`}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeManagement() {
  const { session } = useAuthStore();
  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const [filtered, setFiltered] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [tabView, setTabView] = useState<TabView>("active");
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserInfo | null>(null);
  const [form, setForm] = useState<CreateUserInput>(EMPTY_FORM);
  const [allotment, setAllotment] =
    useState<LocationAllotment>(EMPTY_ALLOTMENT);
  const [saving, setSaving] = useState(false);
  const [allotmentLoading, setAllotmentLoading] = useState(false);

  // Primary HQ state
  const [primaryHqId, setPrimaryHqId] = useState("");
  const [hqError, setHqError] = useState("");

  // Inactive reactivation
  const [selectedIds, setSelectedIds] = useState<Set<bigint>>(new Set());
  const [confirmReactivate, setConfirmReactivate] = useState<UserInfo | null>(
    null,
  );
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  // Activity log
  const [activityLog, setActivityLog] = useState<AbsenceInactivationLogView[]>(
    [],
  );
  const [activityLogLoading, setActivityLogLoading] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);

  const isAdminOrHR =
    session?.role === "Admin" || session?.role === "HRManager";

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await api.listAllUsers(session.token);
      setEmployees(data);
    } catch {
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let list = employees;
    if (tabView === "active")
      list = list.filter((e) => e.status === UserStatus.Active);
    else list = list.filter((e) => e.status === UserStatus.Inactive);
    if (roleFilter !== "all") list = list.filter((e) => e.role === roleFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.username.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q),
      );
    }
    setFiltered(list);
    setSelectedIds(new Set());
  }, [employees, search, roleFilter, tabView]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setAllotment(EMPTY_ALLOTMENT);
    setPrimaryHqId("");
    setHqError("");
    setShowCreate(true);
  };

  const openEdit = (u: UserInfo) => {
    setEditUser(u);
    setPrimaryHqId(u.primaryHqId ? String(u.primaryHqId) : "");
    setHqError("");

    if (u.role === "MR") {
      const hqAssignments: HqAssignment[] =
        (u as UserInfo & { hqAssignments?: HqAssignment[] }).hqAssignments ??
        [];
      setAllotment({ ...EMPTY_ALLOTMENT, hqAssignments });
    } else if (
      session &&
      (MANAGER_ROLES_WITH_ALLOTMENT as readonly string[]).includes(u.role)
    ) {
      setAllotment(EMPTY_ALLOTMENT);
      setAllotmentLoading(true);
      api
        .getUserLocationAllotment(session.token, u.id)
        .then((data) => {
          if (data) {
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
        .catch(() => {})
        .finally(() => setAllotmentLoading(false));
    } else {
      setAllotment(EMPTY_ALLOTMENT);
    }
    setForm({
      ...EMPTY_FORM,
      name: u.name,
      username: u.username,
      password: "",
      email: u.email,
      phone: u.phone,
      employeeId: u.employeeId,
      designation: u.designation,
      department: u.department,
      territory: u.territory,
      joinDate: u.joinDate,
      role: u.role,
      salary: u.salary,
      dateOfBirth: u.dateOfBirth ?? "",
    });
    if (session) {
      setActivityLogLoading(true);
      setActivityLog([]);
      import("../../backend")
        .then(async (a) => {
          const { createActorWithConfig } = await import(
            "@caffeineai/core-infrastructure"
          );
          const actorInst = await createActorWithConfig(a.createActor);
          const log = await actorInst.getEmployeeInactivationHistory(
            session.token,
            String(u.id),
          );
          setActivityLog(log);
          setActivityLogLoading(false);
        })
        .catch(() => setActivityLogLoading(false));
    }
  };

  const handleSave = async () => {
    if (!session) return;
    setHqError("");

    // Validate HQ for role if set
    if (primaryHqId && ROLE_HQ_LEVEL[form.role]) {
      const validationResult = await api.validateHqForRole(
        session.token,
        form.role as import("../../backend.d").Role,
        BigInt(primaryHqId),
      );
      if (validationResult.__kind__ === "err") {
        const expectedLevel = ROLE_HQ_LEVEL[form.role];
        setHqError(
          `The selected HQ location does not match the required level for ${form.role}. Please select a ${expectedLevel}-level location.`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      const isMR = form.role === "MR";
      const isManagerWithAllotment = (
        MANAGER_ROLES_WITH_ALLOTMENT as readonly string[]
      ).includes(form.role);
      const hqAssignments =
        isMR && allotment.hqAssignments.length > 0
          ? allotment.hqAssignments.filter((b) => b.hqId !== BigInt(0))
          : undefined;

      const toBI = (ids: string[]): bigint[] =>
        ids.filter(Boolean).map((id) => BigInt(id));

      if (editUser) {
        const upd: UpdateUserInput = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          designation: form.designation,
          department: form.department,
          territory: form.territory,
          role: form.role,
          salary: form.salary,
          joinDate: form.joinDate,
          ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
          ...(form.password ? { newPassword: form.password } : {}),
          ...(isMR && hqAssignments !== undefined ? { hqAssignments } : {}),
          ...(isManagerWithAllotment
            ? {
                zoneIds: toBI(allotment.zoneIds),
                stateIds: toBI(allotment.stateIds),
                hqIds: toBI(allotment.hqIds),
                territoryIds: toBI(allotment.territoryIds),
                areaIds: toBI(allotment.areaIds),
              }
            : {}),
          ...(primaryHqId ? { primaryHqId: BigInt(primaryHqId) } : {}),
        };
        const res = await api.updateUser(session.token, editUser.id, upd);
        if (res.__kind__ === "err") {
          toast.error(res.err);
          return;
        }

        // Also call setPrimaryHq / clearPrimaryHq separately
        if (primaryHqId) {
          await api.setPrimaryHq(
            session.token,
            editUser.id,
            BigInt(primaryHqId),
          );
        } else if (editUser.primaryHqId) {
          await api.clearPrimaryHq(session.token, editUser.id);
        }

        toast.success("Employee updated");
        await load();
        if (isMR && hqAssignments) {
          setAllotment({ ...EMPTY_ALLOTMENT, hqAssignments });
        }
        setEditUser(null);
      } else {
        const createInput = {
          ...form,
          ...(isMR && hqAssignments !== undefined ? { hqAssignments } : {}),
          ...(isManagerWithAllotment
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
          ...(primaryHqId ? { primaryHqId: BigInt(primaryHqId) } : {}),
        };
        const res = await api.createUser(session.token, createInput);
        if (res.__kind__ === "err") {
          toast.error(res.err);
          return;
        }
        if (isMR) {
          toast.success(
            "MR created. Doctors from assigned HQ and Area will be automatically available.",
          );
        } else {
          toast.success("Employee created");
        }
        setShowCreate(false);
        await load();
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (u: UserInfo) => {
    if (!session || !confirm(`Deactivate ${u.name}?`)) return;
    const res = await api.deactivateUser(session.token, u.id);
    if (res.__kind__ === "err") toast.error(res.err);
    else {
      toast.success("User deactivated");
      await load();
    }
  };

  const doReactivate = async (userId: bigint, userName: string) => {
    if (!session) return;
    setReactivating(true);
    try {
      const res = await api.reactivateUser(session.token, userId);
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      const a = await import("../../backend");
      const { createActorWithConfig } = await import(
        "@caffeineai/core-infrastructure"
      );
      const actorInst = await createActorWithConfig(a.createActor);
      const logs = await actorInst.getEmployeeInactivationHistory(
        session.token,
        String(userId),
      );
      for (const log of logs.filter((l) => !l.isReactivated)) {
        await actorInst.markInactivationReactivated(
          session.token,
          log.id,
          session.name ?? "Admin",
        );
      }
      toast.success(`Employee ${userName} has been successfully reactivated.`);
      setConfirmReactivate(null);
      await load();
    } catch {
      toast.error("Reactivation failed");
    } finally {
      setReactivating(false);
    }
  };

  const doReactivateBulk = async () => {
    if (!session || selectedIds.size === 0) return;
    setReactivating(true);
    let success = 0;
    for (const userId of selectedIds) {
      try {
        const res = await api.reactivateUser(session.token, userId);
        if (res.__kind__ === "ok") {
          success++;
          const a = await import("../../backend");
          const { createActorWithConfig } = await import(
            "@caffeineai/core-infrastructure"
          );
          const actorInst = await createActorWithConfig(a.createActor);
          const logs = await actorInst.getEmployeeInactivationHistory(
            session.token,
            String(userId),
          );
          for (const log of logs.filter((l) => !l.isReactivated)) {
            await actorInst.markInactivationReactivated(
              session.token,
              log.id,
              session.name ?? "Admin",
            );
          }
        }
      } catch {
        /* continue */
      }
    }
    toast.success(
      `${success} employee${success !== 1 ? "s" : ""} reactivated.`,
    );
    setConfirmBulk(false);
    setSelectedIds(new Set());
    setReactivating(false);
    await load();
  };

  const toggleSelect = (id: bigint) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((u) => u.id)));
  };

  const f = (key: keyof CreateUserInput, val: string) =>
    setForm((p) => ({ ...p, [key]: val }));
  const fSal = (key: keyof typeof form.salary, val: string) => {
    if (key === "ta") {
      const parsed = Number.parseFloat(val) || 0;
      setForm((p) => ({
        ...p,
        salary: { ...p.salary, ta: Math.round(parsed * 100) / 100 },
      }));
    } else {
      setForm((p) => ({
        ...p,
        salary: { ...p.salary, [key]: BigInt(val || "0") },
      }));
    }
  };

  const cols = [
    ...(tabView === "inactive" && isAdminOrHR
      ? [{ key: "select", label: "", className: "w-8" }]
      : []),
    { key: "empId", label: "Employee UID" },
    { key: "name", label: "Name" },
    { key: "role", label: "Role" },
    { key: "dept", label: "Dept" },
    { key: "hq", label: "HQ" },
    { key: "location", label: "Location" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions", className: "text-right" },
  ];

  const isOpen = showCreate || !!editUser;
  const closeDialog = () => {
    setShowCreate(false);
    setEditUser(null);
    setAllotment(EMPTY_ALLOTMENT);
    setAllotmentLoading(false);
    setShowActivityLog(false);
    setPrimaryHqId("");
    setHqError("");
  };

  const summary = allotmentSummary(allotment);
  const hasAllotment =
    allotment.zoneIds.length > 0 ||
    allotment.stateIds.length > 0 ||
    allotment.hqIds.length > 0 ||
    allotment.areaIds.length > 0 ||
    allotment.hqAssignments.filter((b) => b.hqId !== BigInt(0)).length > 0;

  const inactiveCount = employees.filter(
    (e) => e.status === UserStatus.Inactive,
  ).length;

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="Employee Management"
        subtitle="Onboard and manage all staff"
        actions={
          <Button
            size="sm"
            onClick={openCreate}
            data-ocid="create-employee-btn"
          >
            <Plus className="w-4 h-4 mr-1" /> New Employee
          </Button>
        }
      />
      <PageContent>
        {/* Invalid Roles Banner */}
        {isAdminOrHR && session && <InvalidRolesBanner token={session.token} />}

        {/* Active / Inactive tab toggle */}
        <div className="flex items-center gap-1 mb-4 bg-muted/30 border border-border rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => setTabView("active")}
            className={`px-4 py-1.5 rounded text-sm font-display font-medium transition-colors ${tabView === "active" ? "bg-card text-primary shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
            data-ocid="emp-tab-active"
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setTabView("inactive")}
            className={`px-4 py-1.5 rounded text-sm font-display font-medium transition-colors flex items-center gap-1.5 ${tabView === "inactive" ? "bg-card text-destructive shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
            data-ocid="emp-tab-inactive"
          >
            Inactive
            {inactiveCount > 0 && (
              <span className="text-xs bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {inactiveCount}
              </span>
            )}
          </button>
        </div>

        {/* Bulk reactivate bar */}
        {tabView === "inactive" && isAdminOrHR && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-sm text-emerald-700 flex-1 font-body">
              <strong>{selectedIds.size}</strong> employee
              {selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setConfirmBulk(true)}
              data-ocid="emp-bulk-reactivate-btn"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Reactivate Selected ({selectedIds.size})
            </Button>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder="Search by name, username, UID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-ocid="employee-search"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 w-[160px]" data-ocid="role-filter">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={cols}
          data={filtered}
          getKey={(u) => String(u.id)}
          loading={loading}
          emptyMessage={
            tabView === "inactive"
              ? "No inactive employees found"
              : "No employees found"
          }
          renderRow={(u) => (
            <>
              {tabView === "inactive" && isAdminOrHR && (
                <td className="px-3 py-3">
                  <button
                    type="button"
                    aria-label={`Select ${u.name}`}
                    onClick={() => toggleSelect(u.id)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    data-ocid={`emp-select-${u.id}`}
                  >
                    {selectedIds.has(u.id) ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </td>
              )}
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {u.employeeId}
              </td>
              <td className="px-4 py-3 font-body">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-foreground font-medium text-sm">
                    {u.name}
                  </p>
                  {!u.primaryHqId && (
                    <span
                      className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 font-display"
                      title="Primary HQ not assigned"
                      data-ocid={`emp-no-hq-badge-${u.id}`}
                    >
                      No HQ
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {u.username} · {u.designation}
                </p>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">
                  {u.role}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground font-body">
                {u.department}
              </td>
              <td className="px-4 py-3">
                <HqCell user={u} />
              </td>
              <td className="px-4 py-3">
                <LocationCell role={u.role} territory={u.territory} />
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded font-mono ${u.status === UserStatus.Active ? "bg-accent/10 text-accent" : "bg-red-50 text-red-700 border border-red-200"}`}
                >
                  {u.status === UserStatus.Active ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(u)}
                    data-ocid={`edit-emp-${u.id}`}
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  {u.status === UserStatus.Active && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDeactivate(u)}
                      data-ocid={`deactivate-emp-${u.id}`}
                      title="Deactivate"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {u.status === UserStatus.Inactive && isAdminOrHR && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      onClick={() => setConfirmReactivate(u)}
                      data-ocid={`reactivate-emp-${u.id}`}
                      title="Reactivate"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </td>
            </>
          )}
        />

        {/* Select all helper */}
        {tabView === "inactive" && isAdminOrHR && filtered.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs text-primary hover:underline font-display flex items-center gap-1"
              data-ocid="emp-select-all-btn"
            >
              {selectedIds.size === filtered.length ? (
                <CheckSquare className="w-3.5 h-3.5" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              {selectedIds.size === filtered.length
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>
        )}

        {/* Single Reactivate Confirm */}
        <Dialog
          open={!!confirmReactivate}
          onOpenChange={() => setConfirmReactivate(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reactivate Employee</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-foreground py-2">
              Are you sure you want to reactivate{" "}
              <strong>{confirmReactivate?.name}</strong>? This will restore
              their portal access.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmReactivate(null)}
                data-ocid="reactivate-dialog.cancel_button"
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  confirmReactivate &&
                  doReactivate(confirmReactivate.id, confirmReactivate.name)
                }
                disabled={reactivating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                data-ocid="reactivate-dialog.confirm_button"
              >
                {reactivating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <UserCheck className="w-4 h-4 mr-1.5" />
                )}
                {reactivating ? "Reactivating…" : "Confirm Reactivate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Reactivate Confirm */}
        <Dialog open={confirmBulk} onOpenChange={setConfirmBulk}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Bulk Reactivate Employees</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-foreground py-2">
              You are about to reactivate{" "}
              <strong>
                {selectedIds.size} employee{selectedIds.size !== 1 ? "s" : ""}
              </strong>
              . Confirm?
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmBulk(false)}
                data-ocid="bulk-reactivate.cancel_button"
              >
                Cancel
              </Button>
              <Button
                onClick={doReactivateBulk}
                disabled={reactivating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                data-ocid="bulk-reactivate.confirm_button"
              >
                {reactivating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                )}
                {reactivating
                  ? "Reactivating…"
                  : `Reactivate ${selectedIds.size}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create/Edit Dialog */}
        <Dialog open={isOpen} onOpenChange={closeDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="font-display">
                  {editUser ? "Edit Employee" : "New Employee"}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  {editUser && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowActivityLog(!showActivityLog)}
                      data-ocid="emp-activity-log-btn"
                    >
                      <History className="w-3.5 h-3.5 mr-1" /> Activity Log
                    </Button>
                  )}
                  <ScrollToBottom label="Jump to bottom" />
                </div>
              </div>
            </DialogHeader>

            {/* Activity Log */}
            {showActivityLog && editUser && (
              <div className="mb-4 border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                    Inactivation / Reactivation History
                  </span>
                </div>
                {activityLogLoading ? (
                  <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading
                    history…
                  </div>
                ) : activityLog.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No inactivation history for this employee.
                  </div>
                ) : (
                  <div className="divide-y divide-border max-h-48 overflow-y-auto">
                    {activityLog.map((entry) => (
                      <div key={entry.id} className="px-4 py-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">
                            {new Date(
                              Number(entry.inactivatedAt) / 1_000_000,
                            ).toLocaleDateString("en-IN")}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded border ${entry.isReactivated ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}
                          >
                            {entry.isReactivated
                              ? "Reactivated"
                              : "Auto-Inactivated"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Absent dates: {entry.absentDates.join(", ")}
                        </p>
                        {entry.isReactivated && entry.reactivatedBy && (
                          <p className="text-xs text-muted-foreground">
                            Reactivated by:{" "}
                            <span className="text-foreground">
                              {entry.reactivatedBy}
                            </span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Current HQ display in edit mode */}
            {editUser?.primaryHqId && (
              <div className="mb-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <p className="text-xs font-body text-foreground">
                  <span className="text-muted-foreground">Headquarters: </span>
                  <span className="font-medium text-primary">
                    HQ #{String(editUser.primaryHqId)}
                  </span>
                  {ROLE_HQ_LEVEL[editUser.role] && (
                    <span className="text-muted-foreground ml-1">
                      ({ROLE_HQ_LEVEL[editUser.role]})
                    </span>
                  )}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 py-2">
              <Field
                label="Full Name"
                value={form.name}
                onChange={(v) => f("name", v)}
                ocid="emp-name"
              />
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Employee ID{editUser ? "" : " (auto-generated)"}
                </Label>
                {editUser ? (
                  <div className="flex items-center gap-2 h-9 px-3 bg-muted/50 border border-border rounded-md">
                    <span className="font-mono text-sm text-foreground">
                      {form.employeeId || "—"}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      Read-only
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center h-9 px-3 bg-muted/30 border border-dashed border-border rounded-md">
                    <span className="text-xs text-muted-foreground italic">
                      Auto-generated on save
                    </span>
                  </div>
                )}
              </div>
              <Field
                label="Username"
                value={form.username}
                onChange={(v) => f("username", v)}
                ocid="emp-user"
              />
              <Field
                label={
                  editUser ? "New Password (leave blank to keep)" : "Password"
                }
                value={form.password}
                onChange={(v) => f("password", v)}
                ocid="emp-pass"
                type="password"
              />
              <Field
                label="Email"
                value={form.email}
                onChange={(v) => f("email", v)}
                ocid="emp-email"
                type="email"
              />
              <Field
                label="Phone"
                value={form.phone}
                onChange={(v) => f("phone", v)}
                ocid="emp-phone"
              />
              <Field
                label="Designation"
                value={form.designation}
                onChange={(v) => f("designation", v)}
                ocid="emp-desig"
              />
              <Field
                label="Department"
                value={form.department}
                onChange={(v) => f("department", v)}
                ocid="emp-dept"
              />
              <Field
                label="Join Date"
                value={form.joinDate}
                onChange={(v) => f("joinDate", v)}
                ocid="emp-joindate"
                type="date"
              />
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Date of Birth{" "}
                  <span className="ml-1 text-muted-foreground/60 font-normal">
                    (HR/Admin only)
                  </span>
                </Label>
                <Input
                  type="date"
                  value={form.dateOfBirth ?? ""}
                  onChange={(e) => f("dateOfBirth", e.target.value)}
                  className="h-9"
                  data-ocid="emp-dob"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Role
                </Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => {
                    f("role", v as typeof form.role);
                    setAllotment(EMPTY_ALLOTMENT);
                    setPrimaryHqId("");
                    setHqError("");
                  }}
                >
                  <SelectTrigger data-ocid="emp-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Primary HQ Selector */}
              <PrimaryHqSelector
                token={session?.token ?? ""}
                role={form.role}
                value={primaryHqId}
                onChange={(id) => {
                  setPrimaryHqId(id);
                  setHqError("");
                }}
                error={hqError}
              />

              {/* Location Allotment */}
              <div className="col-span-2 border-t border-border pt-3">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <p className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                    Location Allotment
                  </p>
                </div>
                {allotmentLoading ? (
                  <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading
                    previously allotted locations…
                  </div>
                ) : (
                  <>
                    {editUser &&
                      hasAllotment &&
                      (
                        MANAGER_ROLES_WITH_ALLOTMENT as readonly string[]
                      ).includes(form.role) && (
                        <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 mb-3">
                          <p className="text-xs font-display font-medium text-foreground mb-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-primary" />{" "}
                            Previously Allotted Locations
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {summary}
                          </p>
                        </div>
                      )}
                    <div className="grid grid-cols-2 gap-3">
                      <MultiSelectLocationAllotment
                        token={session?.token ?? ""}
                        role={form.role}
                        value={allotment}
                        onChange={setAllotment}
                      />
                    </div>
                    {hasAllotment && (
                      <p className="mt-2 text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded px-3 py-1.5 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-primary shrink-0" />
                        <span>
                          <span className="font-display font-medium text-foreground">
                            Allotment:{" "}
                          </span>
                          {summary}
                        </span>
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Salary Components */}
              <div className="col-span-2 border-t border-border pt-3">
                <p className="text-xs uppercase tracking-wider font-display text-muted-foreground mb-3">
                  Salary Components (₹)
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <SalField
                    label="Basic Pay"
                    value={form.salary.basic}
                    onChange={(v) => fSal("basic", v)}
                    ocid="sal-basic"
                  />
                  <SalField
                    label="HRA"
                    value={form.salary.hra}
                    onChange={(v) => fSal("hra", v)}
                    ocid="sal-hra"
                  />
                  <SalField
                    label="TA (₹/month)"
                    value={form.salary.ta}
                    onChange={(v) => fSal("ta", v)}
                    ocid="sal-ta"
                    isFloat={true}
                  />
                  <SalField
                    label="PF %"
                    value={form.salary.pfPercent}
                    onChange={(v) => fSal("pfPercent", v)}
                    ocid="sal-pf"
                  />
                  <SalField
                    label="ESI % (×100)"
                    value={form.salary.esiPercent}
                    onChange={(v) => fSal("esiPercent", v)}
                    ocid="sal-esi"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || allotmentLoading}
                data-ocid="save-employee-btn"
              >
                {saving ? "Saving…" : "Save Employee"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
    </PortalLayout>
  );
}

// ── HQ Column cell ──────────────────────────────────────────────────────────
function HqCell({ user }: { user: UserInfo }) {
  if (!user.primaryHqId) {
    return (
      <span className="text-xs text-muted-foreground/60 italic">
        Not assigned
      </span>
    );
  }
  const levelLabel = ROLE_HQ_LEVEL[user.role];
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-body text-primary font-medium">
        HQ #{String(user.primaryHqId)}
      </span>
      {levelLabel && (
        <span className="text-[10px] text-muted-foreground">{levelLabel}</span>
      )}
    </div>
  );
}

// ── Location cell helper ────────────────────────────────────────────────────
function LocationCell({
  role,
  territory,
}: { role: string; territory: string }) {
  if (role === Role.HRManager || role === Role.Admin) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-display">
        All Zones
      </span>
    );
  }
  if (role === Role.ZSM)
    return (
      <span className="text-xs text-muted-foreground" title={territory}>
        Zone → Regions
      </span>
    );
  if (role === Role.RSM)
    return (
      <span className="text-xs text-muted-foreground" title={territory}>
        Region → Areas
      </span>
    );
  if (role === "ASM")
    return (
      <span className="text-xs text-muted-foreground" title={territory}>
        Area → Stations
      </span>
    );
  return (
    <span
      className="text-xs text-muted-foreground truncate block max-w-[120px]"
      title={territory}
    >
      {territory || "—"}
    </span>
  );
}

// ── Field helpers ───────────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  ocid,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  ocid: string;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
        data-ocid={ocid}
      />
    </div>
  );
}

function SalField({
  label,
  value,
  onChange,
  ocid,
  isFloat = false,
}: {
  label: string;
  value: bigint | number;
  onChange: (v: string) => void;
  ocid: string;
  isFloat?: boolean;
}) {
  if (isFloat) {
    const numVal =
      typeof value === "bigint" ? Number(value) : (value as number);
    return (
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">
          {label}
        </Label>
        <Input
          type="number"
          step="0.01"
          min={0}
          value={Number.isFinite(numVal) ? numVal.toFixed(2) : "0.00"}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onChange(e.target.value)}
          className="h-9"
          placeholder="0.00"
          data-ocid={ocid}
        />
        <p className="text-xs text-muted-foreground mt-0.5">e.g. 1250.50</p>
      </div>
    );
  }
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">
        {label}
      </Label>
      <Input
        type="number"
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
        data-ocid={ocid}
      />
    </div>
  );
}
