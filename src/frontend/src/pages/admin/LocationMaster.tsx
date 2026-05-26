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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronRight,
  GitBranch,
  Layers,
  Pencil,
  PlusCircle,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import type {
  AreaRecord,
  HQRecord,
  LocationHierarchyPath,
  LocationId,
  PrimaryHqInfo,
  StateRecord,
  TerritoryRecord,
  ZoneRecord,
} from "../../backend.d";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

// ─── Modal helper ─────────────────────────────────────────────────────────────
function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display font-semibold text-foreground">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto scrollbar-thin space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  open,
  message,
  onConfirm,
  onClose,
  confirmLabel = "Deactivate",
  danger = false,
}: {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  confirmLabel?: string;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <p className="font-body text-foreground">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            className={danger ? "bg-red-600 hover:bg-red-700" : ""}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Hierarchy Breadcrumb for a location ─────────────────────────────────────
function HierarchyBreadcrumb({ path }: { path: LocationHierarchyPath }) {
  const parts: string[] = [];
  if (path.zoneName) parts.push(path.zoneName);
  if (path.regionName) parts.push(path.regionName);
  if (path.areaName) parts.push(path.areaName);
  if (path.stationName) parts.push(path.stationName);
  if (!parts.includes(path.locationName)) parts.push(path.locationName);

  return (
    <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground">
      {parts.map((part, idx) => (
        <span key={part} className="flex items-center gap-1">
          {idx > 0 && (
            <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
          )}
          <span
            className={
              idx === parts.length - 1
                ? "text-primary font-medium"
                : "text-muted-foreground"
            }
          >
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}

// ─── HQ Path Fetcher for table rows ──────────────────────────────────────────
function HierarchyCell({
  token,
  locationId,
}: {
  token: string;
  locationId: LocationId;
}) {
  const [path, setPath] = useState<LocationHierarchyPath | null>(null);

  useEffect(() => {
    api
      .getLocationHierarchy(token, locationId)
      .then(setPath)
      .catch(() => {});
  }, [token, locationId]);

  if (!path) return <span className="text-xs text-muted-foreground">—</span>;
  return <HierarchyBreadcrumb path={path} />;
}

// ─── Hierarchy Tree Overview ──────────────────────────────────────────────────
function HierarchyTreeTab({ token }: { token: string }) {
  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [regionItems, setRegionItems] = useState<PrimaryHqInfo[]>([]);
  const [areaItems, setAreaItems] = useState<PrimaryHqInfo[]>([]);
  const [stationItems, setStationItems] = useState<PrimaryHqInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [zoneList, regions, areas, stations] = await Promise.all([
          api.listZones(token),
          api.getLocationsByLevel(
            token,
            "Region" as import("../../backend.d").LocationLevel,
          ),
          api.getLocationsByLevel(
            token,
            "Area" as import("../../backend.d").LocationLevel,
          ),
          api.getLocationsByLevel(
            token,
            "Station" as import("../../backend.d").LocationLevel,
          ),
        ]);
        setZones(zoneList);
        setRegionItems(regions);
        setAreaItems(areas);
        setStationItems(stations);
      } catch {
        toast.error("Failed to load hierarchy");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Loading hierarchy…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-2 p-3 bg-primary/5 border border-primary/15 rounded-lg">
        {(
          [
            {
              label: "Zone",
              role: "ZSM HQ",
              color: "bg-violet-50 text-violet-700 border-violet-200",
            },
            {
              label: "Region",
              role: "RSM HQ",
              color: "bg-primary/10 text-primary border-primary/20",
            },
            {
              label: "Area",
              role: "ASM HQ",
              color: "bg-accent/10 text-accent border-accent/20",
            },
            {
              label: "Station",
              role: "MR HQ",
              color: "bg-yellow-50 text-yellow-700 border-yellow-200",
            },
            {
              label: "Territory",
              role: "MR Scope",
              color: "bg-muted/50 text-muted-foreground border-border",
            },
          ] as const
        ).map((item) => (
          <span
            key={item.label}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${item.color}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {item.label} — {item.role}
          </span>
        ))}
        <span className="text-xs text-muted-foreground ml-auto self-center">
          {zones.length} Zones · {regionItems.length} Regions ·{" "}
          {areaItems.length} Areas · {stationItems.length} Stations
        </span>
      </div>

      {/* Visual flow */}
      <div className="flex items-center gap-2 text-sm font-display font-medium text-foreground px-2 flex-wrap">
        <span className="px-3 py-1.5 rounded-lg bg-muted/60 text-muted-foreground border border-border text-xs">
          HO (Company)
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <span className="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 text-xs">
          Zone (ZSM)
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs">
          Region (RSM)
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <span className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent border border-accent/20 text-xs">
          Area (ASM)
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <span className="px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs">
          Station (MR HQ)
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <span className="px-3 py-1.5 rounded-lg bg-muted/50 text-muted-foreground border border-border text-xs">
          Territory (MR)
        </span>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {
            label: "Zones",
            count: zones.length,
            role: "ZSM HQ",
            colorClass: "border-violet-200 bg-violet-50",
          },
          {
            label: "Regions",
            count: regionItems.length,
            role: "RSM HQ",
            colorClass: "border-primary/20 bg-primary/5",
          },
          {
            label: "Areas",
            count: areaItems.length,
            role: "ASM HQ",
            colorClass: "border-accent/20 bg-accent/5",
          },
          {
            label: "Stations",
            count: stationItems.length,
            role: "MR HQ",
            colorClass: "border-yellow-200 bg-yellow-50",
          },
          {
            label: "Territories",
            count: 0,
            role: "MR Scope",
            colorClass: "border-border bg-muted/30",
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-lg border p-3 ${item.colorClass}`}
          >
            <p className="text-2xl font-display font-bold text-foreground">
              {item.count}
            </p>
            <p className="text-xs font-display font-medium text-foreground mt-0.5">
              {item.label}
            </p>
            <p className="text-xs text-muted-foreground">{item.role}</p>
          </div>
        ))}
      </div>

      {/* Zone list */}
      {zones.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider font-display text-muted-foreground">
            Zone Overview
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {zones.map((z) => (
              <div
                key={String(z.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border"
              >
                <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                <span className="text-sm font-body font-medium text-foreground flex-1 min-w-0 truncate">
                  {z.name}
                </span>
                <span className="font-mono text-xs text-muted-foreground shrink-0">
                  {z.code}
                </span>
                <Badge
                  variant={z.isActive ? "default" : "secondary"}
                  className="text-xs shrink-0"
                >
                  {z.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Zone Tab (ZSM HQ level) ──────────────────────────────────────────────────
function ZonesTab({ token }: { token: string }) {
  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<ZoneRecord | null>(null);
  const [form, setForm] = useState({ name: "", code: "" });
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<LocationId | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<LocationId | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setZones(await api.listZones(token));
    } catch {
      toast.error("Failed to load zones");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setForm({ name: "", code: "" });
    setEditing(null);
    setModal("add");
  };
  const openEdit = (z: ZoneRecord) => {
    setForm({ name: z.name, code: z.code });
    setEditing(z);
    setModal("edit");
  };
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Zone Name and Code are required");
      return;
    }
    setSaving(true);
    try {
      if (modal === "add") {
        const r = await api.addZone(token, {
          name: form.name.trim(),
          code: form.code.trim(),
        });
        if (r.__kind__ === "err") {
          toast.error(r.err);
          return;
        }
        toast.success("Zone added successfully");
      } else if (editing) {
        const r = await api.updateZone(token, editing.id, {
          name: form.name.trim(),
          code: form.code.trim(),
        });
        if (r.__kind__ === "err") {
          toast.error(r.err);
          return;
        }
        toast.success("Zone updated");
      }
      closeModal();
      load();
    } catch {
      toast.error("Operation failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: LocationId) => {
    try {
      const r = await api.deactivateZone(token, id);
      if (r.__kind__ === "err") {
        toast.error(r.err);
        return;
      }
      toast.success("Zone deactivated");
      setConfirmId(null);
      load();
    } catch {
      toast.error("Failed to deactivate zone");
    }
  };

  const handleDelete = async (id: LocationId) => {
    try {
      const r = await api.deactivateZone(token, id);
      if (r.__kind__ === "err") {
        toast.error(
          r.err ??
            "Cannot delete — this zone may have active regions under it.",
        );
        setDeleteConfirmId(null);
        return;
      }
      toast.success("Zone deleted");
      setDeleteConfirmId(null);
      load();
    } catch {
      toast.error("Failed to delete zone");
    }
  };

  const cols = [
    { key: "name", label: "Zone Name" },
    { key: "code", label: "Code" },
    { key: "role", label: "Role Level" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground font-body">
          Zones are the top-level geography — each Zone is the HQ for a{" "}
          <strong>ZSM</strong>
        </p>
        <Button size="sm" onClick={openAdd} data-ocid="zone-add-btn">
          <PlusCircle className="w-4 h-4 mr-1.5" /> Add Zone
        </Button>
      </div>
      <DataTable
        columns={cols}
        data={zones}
        getKey={(z) => String(z.id)}
        loading={loading}
        emptyMessage="No zones found. Add a Zone to start building your territory hierarchy."
        renderRow={(z) => (
          <>
            <td className="px-4 py-3 font-body text-foreground font-medium">
              {z.name}
            </td>
            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
              {z.code}
            </td>
            <td className="px-4 py-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-display">
                ZSM HQ
              </span>
            </td>
            <td className="px-4 py-3">
              <Badge variant={z.isActive ? "default" : "secondary"}>
                {z.isActive ? "Active" : "Inactive"}
              </Badge>
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(z)}
                  data-ocid={`zone-edit-${z.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {z.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmId(z.id)}
                    data-ocid={`zone-deactivate-${z.id}`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteConfirmId(z.id)}
                  data-ocid={`zone-delete-${z.id}`}
                  title="Permanently delete this zone"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </td>
          </>
        )}
      />
      <Modal
        open={modal !== null}
        title={modal === "add" ? "Add Zone" : "Edit Zone"}
        onClose={closeModal}
      >
        <div className="space-y-3">
          <div>
            <Label>Zone Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. North Zone"
              data-ocid="zone-name-input"
            />
          </div>
          <div>
            <Label>Zone Code *</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="e.g. NZ"
              data-ocid="zone-code-input"
            />
          </div>
          <p className="text-xs text-muted-foreground bg-violet-50 border border-violet-200 rounded px-3 py-2 text-violet-700">
            This Zone will appear as a <strong>ZSM HQ</strong> option when
            assigning headquarters to ZSM employees.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-ocid="zone-save-btn"
          >
            {saving ? "Saving…" : "Save Zone"}
          </Button>
        </div>
      </Modal>
      <ConfirmModal
        open={confirmId !== null}
        message="Deactivate this zone? Regions under it will no longer be accessible."
        onConfirm={() => confirmId && handleDeactivate(confirmId)}
        onClose={() => setConfirmId(null)}
      />
      <ConfirmModal
        open={deleteConfirmId !== null}
        message="Permanently delete this Zone? If it has active regions under it, deletion will be blocked. This action cannot be undone."
        confirmLabel="Delete Zone"
        danger
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
      />
    </>
  );
}

// ─── Region Tab (RSM HQ level — maps to "State" in old structure) ─────────────
function RegionsTab({ token }: { token: string }) {
  const [states, setStates] = useState<StateRecord[]>([]);
  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<StateRecord | null>(null);
  const [form, setForm] = useState({ name: "", zoneId: "" });
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<LocationId | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<LocationId | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const allZones = await api.listZones(token);
      setZones(allZones);
      const nested = await Promise.all(
        allZones.map((z) => api.listStatesByZone(token, z.id)),
      );
      setStates(nested.flat());
    } catch {
      toast.error("Failed to load regions");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadActiveZones = useCallback(async () => {
    try {
      setZones(await api.listActiveZones(token));
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setForm({ name: "", zoneId: "" });
    setEditing(null);
    setModal("add");
    loadActiveZones();
  };
  const openEdit = (s: StateRecord) => {
    setForm({ name: s.name, zoneId: String(s.zoneId) });
    setEditing(s);
    setModal("edit");
    loadActiveZones();
  };
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!form.name.trim() || !form.zoneId) {
      toast.error("Region Name and Parent Zone are required");
      return;
    }
    setSaving(true);
    try {
      if (modal === "add") {
        const r = await api.addState(token, {
          name: form.name.trim(),
          zoneId: BigInt(form.zoneId),
        });
        if (r.__kind__ === "err") {
          toast.error(r.err);
          return;
        }
        toast.success("Region added");
      } else if (editing) {
        const r = await api.updateState(token, editing.id, {
          name: form.name.trim(),
          zoneId: BigInt(form.zoneId),
        });
        if (r.__kind__ === "err") {
          toast.error(r.err);
          return;
        }
        toast.success("Region updated");
      }
      closeModal();
      load();
    } catch {
      toast.error("Operation failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: LocationId) => {
    try {
      const r = await api.deactivateState(token, id);
      if (r.__kind__ === "err") {
        toast.error(r.err);
        return;
      }
      toast.success("Region deactivated");
      setConfirmId(null);
      load();
    } catch {
      toast.error("Failed to deactivate region");
    }
  };

  const handleDelete = async (id: LocationId) => {
    try {
      const r = await api.deactivateState(token, id);
      if (r.__kind__ === "err") {
        toast.error(
          r.err ??
            "Cannot delete — this region may have active areas under it.",
        );
        setDeleteConfirmId(null);
        return;
      }
      toast.success("Region deleted");
      setDeleteConfirmId(null);
      load();
    } catch {
      toast.error("Failed to delete region");
    }
  };

  const zoneMap = Object.fromEntries(zones.map((z) => [String(z.id), z.name]));
  const cols = [
    { key: "name", label: "Region Name" },
    { key: "zone", label: "Parent Zone" },
    { key: "role", label: "Role Level" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground font-body">
          Regions belong to a Zone — each Region is the HQ for an{" "}
          <strong>RSM</strong>
        </p>
        <Button size="sm" onClick={openAdd} data-ocid="region-add-btn">
          <PlusCircle className="w-4 h-4 mr-1.5" /> Add Region
        </Button>
      </div>
      <DataTable
        columns={cols}
        data={states}
        getKey={(s) => String(s.id)}
        loading={loading}
        emptyMessage="No regions found. Add a Region under a Zone to continue."
        renderRow={(s) => (
          <>
            <td className="px-4 py-3 font-body text-foreground font-medium">
              {s.name}
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground">
              {zoneMap[String(s.zoneId)] ?? "—"}
            </td>
            <td className="px-4 py-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-display">
                RSM HQ
              </span>
            </td>
            <td className="px-4 py-3">
              <Badge variant={s.isActive ? "default" : "secondary"}>
                {s.isActive ? "Active" : "Inactive"}
              </Badge>
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(s)}
                  data-ocid={`region-edit-${s.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {s.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmId(s.id)}
                    data-ocid={`region-deactivate-${s.id}`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteConfirmId(s.id)}
                  data-ocid={`region-delete-${s.id}`}
                  title="Permanently delete this region"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </td>
          </>
        )}
      />
      <Modal
        open={modal !== null}
        title={modal === "add" ? "Add Region" : "Edit Region"}
        onClose={closeModal}
      >
        <div className="space-y-3">
          <div>
            <Label>Region Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. North Region"
              data-ocid="region-name-input"
            />
          </div>
          <div>
            <Label>Parent Zone *</Label>
            <Select
              value={form.zoneId}
              onValueChange={(v) => setForm((f) => ({ ...f, zoneId: v }))}
            >
              <SelectTrigger data-ocid="region-zone-select">
                <SelectValue placeholder="Select Zone" />
              </SelectTrigger>
              <SelectContent className="max-h-48 overflow-y-auto scrollbar-thin">
                {zones.map((z) => (
                  <SelectItem key={String(z.id)} value={String(z.id)}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground bg-primary/5 border border-primary/15 rounded px-3 py-2">
            This Region will appear as an <strong>RSM HQ</strong> option when
            assigning headquarters to RSM employees.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-ocid="region-save-btn"
          >
            {saving ? "Saving…" : "Save Region"}
          </Button>
        </div>
      </Modal>
      <ConfirmModal
        open={confirmId !== null}
        message="Deactivate this region? Areas under it will no longer be accessible."
        onConfirm={() => confirmId && handleDeactivate(confirmId)}
        onClose={() => setConfirmId(null)}
      />
      <ConfirmModal
        open={deleteConfirmId !== null}
        message="Permanently delete this Region? If it has active areas under it, deletion will be blocked. This action cannot be undone."
        confirmLabel="Delete Region"
        danger
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
      />
    </>
  );
}

// ─── Area Tab (ASM HQ level — maps to "Territory" in old structure) ───────────
function AreasTab({ token }: { token: string }) {
  const [territories, setTerritories] = useState<TerritoryRecord[]>([]);
  const [states, setStates] = useState<StateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<TerritoryRecord | null>(null);
  const [form, setForm] = useState({ name: "", stateId: "" });
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<LocationId | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<LocationId | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const zoneList = await api.listZones(token);
      const statesNested = await Promise.all(
        zoneList.map((z) => api.listStatesByZone(token, z.id)),
      );
      const flatStates = statesNested.flat();
      const terrsNested = await Promise.all(
        flatStates.map((s) => api.listTerritoriesByState(token, s.id)),
      );
      setTerritories(terrsNested.flat());
    } catch {
      toast.error("Failed to load areas");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadActiveStates = useCallback(async () => {
    try {
      const zoneList = await api.listActiveZones(token);
      const nested = await Promise.all(
        zoneList.map((z) => api.listActiveStatesByZone(token, z.id)),
      );
      setStates(nested.flat());
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setForm({ name: "", stateId: "" });
    setEditing(null);
    setModal("add");
    loadActiveStates();
  };
  const openEdit = (t: TerritoryRecord) => {
    setForm({ name: t.name, stateId: String(t.stateId) });
    setEditing(t);
    setModal("edit");
    loadActiveStates();
  };
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!form.name.trim() || !form.stateId) {
      toast.error("Area Name and Parent Region are required");
      return;
    }
    setSaving(true);
    try {
      if (modal === "add") {
        const r = await api.addTerritory(token, {
          name: form.name.trim(),
          stateId: BigInt(form.stateId),
        });
        if (r.__kind__ === "err") {
          toast.error(r.err);
          return;
        }
        toast.success("Area added");
      } else if (editing) {
        const r = await api.updateTerritory(token, editing.id, {
          name: form.name.trim(),
          stateId: BigInt(form.stateId),
        });
        if (r.__kind__ === "err") {
          toast.error(r.err);
          return;
        }
        toast.success("Area updated");
      }
      closeModal();
      load();
    } catch {
      toast.error("Operation failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: LocationId) => {
    try {
      const r = await api.deactivateTerritory(token, id);
      if (r.__kind__ === "err") {
        toast.error(r.err);
        return;
      }
      toast.success("Area deactivated");
      setConfirmId(null);
      load();
    } catch {
      toast.error("Failed to deactivate area");
    }
  };

  const handleDelete = async (id: LocationId) => {
    try {
      const r = await api.deactivateTerritory(token, id);
      if (r.__kind__ === "err") {
        toast.error(
          r.err ??
            "Cannot delete — this area may have active stations under it.",
        );
        setDeleteConfirmId(null);
        return;
      }
      toast.success("Area deleted");
      setDeleteConfirmId(null);
      load();
    } catch {
      toast.error("Failed to delete area");
    }
  };

  const stateMap = Object.fromEntries(
    states.map((s) => [String(s.id), s.name]),
  );
  const cols = [
    { key: "name", label: "Area Name" },
    { key: "region", label: "Parent Region" },
    { key: "role", label: "Role Level" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground font-body">
          Areas belong to a Region — each Area is the HQ for an{" "}
          <strong>ASM</strong>
        </p>
        <Button size="sm" onClick={openAdd} data-ocid="area-add-btn">
          <PlusCircle className="w-4 h-4 mr-1.5" /> Add Area
        </Button>
      </div>
      <DataTable
        columns={cols}
        data={territories}
        getKey={(t) => String(t.id)}
        loading={loading}
        emptyMessage="No areas found. Add an Area under a Region."
        renderRow={(t) => (
          <>
            <td className="px-4 py-3 font-body text-foreground font-medium">
              {t.name}
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground">
              {stateMap[String(t.stateId)] ?? "—"}
            </td>
            <td className="px-4 py-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-display">
                ASM HQ
              </span>
            </td>
            <td className="px-4 py-3">
              <Badge variant={t.isActive ? "default" : "secondary"}>
                {t.isActive ? "Active" : "Inactive"}
              </Badge>
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(t)}
                  data-ocid={`area-edit-${t.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {t.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmId(t.id)}
                    data-ocid={`area-deactivate-${t.id}`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteConfirmId(t.id)}
                  data-ocid={`area-delete-${t.id}`}
                  title="Permanently delete this area"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </td>
          </>
        )}
      />
      <Modal
        open={modal !== null}
        title={modal === "add" ? "Add Area" : "Edit Area"}
        onClose={closeModal}
      >
        <div className="space-y-3">
          <div>
            <Label>Area Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Pune Area"
              data-ocid="area-name-input"
            />
          </div>
          <div>
            <Label>Parent Region *</Label>
            <Select
              value={form.stateId}
              onValueChange={(v) => setForm((f) => ({ ...f, stateId: v }))}
            >
              <SelectTrigger data-ocid="area-region-select">
                <SelectValue placeholder="Select Region" />
              </SelectTrigger>
              <SelectContent className="max-h-48 overflow-y-auto scrollbar-thin">
                {states.map((s) => (
                  <SelectItem key={String(s.id)} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground bg-accent/5 border border-accent/15 rounded px-3 py-2">
            This Area will appear as an <strong>ASM HQ</strong> option for ASM
            employees in the selected region.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-ocid="area-save-btn"
          >
            {saving ? "Saving…" : "Save Area"}
          </Button>
        </div>
      </Modal>
      <ConfirmModal
        open={confirmId !== null}
        message="Deactivate this area? Stations linked to it may be affected."
        onConfirm={() => confirmId && handleDeactivate(confirmId)}
        onClose={() => setConfirmId(null)}
      />
      <ConfirmModal
        open={deleteConfirmId !== null}
        message="Permanently delete this Area? If it has active stations under it, deletion will be blocked. This action cannot be undone."
        confirmLabel="Delete Area"
        danger
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
      />
    </>
  );
}

// ─── Station Tab (MR HQ level — HQ records from the old "HQ" table) ───────────
function StationsTab({ token }: { token: string }) {
  const [hqs, setHqs] = useState<HQRecord[]>([]);
  const [territories, setTerritories] = useState<TerritoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<HQRecord | null>(null);
  const [form, setForm] = useState({ name: "", territoryId: "" });
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<LocationId | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<LocationId | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const zoneList = await api.listZones(token);
      const statesNested = await Promise.all(
        zoneList.map((z) => api.listStatesByZone(token, z.id)),
      );
      const flatStates = statesNested.flat();
      const terrsNested = await Promise.all(
        flatStates.map((s) => api.listTerritoriesByState(token, s.id)),
      );
      const flatTerrs = terrsNested.flat();
      const hqsNested = await Promise.all(
        flatTerrs.map((t) => api.listHQsByTerritory(token, t.id)),
      );
      setHqs(hqsNested.flat());
    } catch {
      toast.error("Failed to load stations");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadActiveAreas = useCallback(async () => {
    try {
      const zoneList = await api.listActiveZones(token);
      const statesNested = await Promise.all(
        zoneList.map((z) => api.listActiveStatesByZone(token, z.id)),
      );
      const flatStates = statesNested.flat();
      const terrsNested = await Promise.all(
        flatStates.map((s) => api.listActiveTerritories(token, s.id)),
      );
      setTerritories(terrsNested.flat());
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setForm({ name: "", territoryId: "" });
    setEditing(null);
    setModal("add");
    loadActiveAreas();
  };
  const openEdit = (h: HQRecord) => {
    setForm({ name: h.name, territoryId: String(h.territoryId) });
    setEditing(h);
    setModal("edit");
    loadActiveAreas();
  };
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!form.name.trim() || !form.territoryId) {
      toast.error("Station Name and Parent Area are required");
      return;
    }
    setSaving(true);
    try {
      if (modal === "add") {
        const r = await api.addHQ(token, {
          name: form.name.trim(),
          territoryId: BigInt(form.territoryId),
        });
        if (r.__kind__ === "err") {
          toast.error(r.err);
          return;
        }
        toast.success("Station added");
      } else if (editing) {
        const r = await api.updateHQ(token, editing.id, {
          name: form.name.trim(),
          territoryId: BigInt(form.territoryId),
        });
        if (r.__kind__ === "err") {
          toast.error(r.err);
          return;
        }
        toast.success("Station updated");
      }
      closeModal();
      load();
    } catch {
      toast.error("Operation failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: LocationId) => {
    try {
      const r = await api.deactivateHQ(token, id);
      if (r.__kind__ === "err") {
        toast.error(r.err);
        return;
      }
      toast.success("Station deactivated");
      setConfirmId(null);
      load();
    } catch {
      toast.error("Failed to deactivate station");
    }
  };

  const handleDelete = async (id: LocationId) => {
    try {
      const r = await api.deactivateHQ(token, id);
      if (r.__kind__ === "err") {
        toast.error(
          r.err ??
            "Cannot delete — this station may have territories under it.",
        );
        setDeleteConfirmId(null);
        return;
      }
      toast.success("Station deleted");
      setDeleteConfirmId(null);
      load();
    } catch {
      toast.error("Failed to delete station");
    }
  };

  const areaMap = Object.fromEntries(
    territories.map((t) => [String(t.id), t.name]),
  );
  const cols = [
    { key: "name", label: "Station Name" },
    { key: "area", label: "Parent Area" },
    { key: "hierarchy", label: "Full Path" },
    { key: "role", label: "Role Level" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground font-body">
          Stations belong to an Area — each Station is the HQ city for an{" "}
          <strong>MR</strong>. Multiple MRs may share a station.
        </p>
        <Button size="sm" onClick={openAdd} data-ocid="station-add-btn">
          <PlusCircle className="w-4 h-4 mr-1.5" /> Add Station
        </Button>
      </div>
      <DataTable
        columns={cols}
        data={hqs}
        getKey={(h) => String(h.id)}
        loading={loading}
        emptyMessage="No stations found. Add a Station under an Area."
        renderRow={(h) => (
          <>
            <td className="px-4 py-3 font-body text-foreground font-medium">
              {h.name}
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground">
              {areaMap[String(h.territoryId)] ?? "—"}
            </td>
            <td className="px-4 py-3">
              <HierarchyCell token={token} locationId={h.id} />
            </td>
            <td className="px-4 py-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 font-display">
                MR HQ
              </span>
            </td>
            <td className="px-4 py-3">
              <Badge variant={h.isActive ? "default" : "secondary"}>
                {h.isActive ? "Active" : "Inactive"}
              </Badge>
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(h)}
                  data-ocid={`station-edit-${h.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {h.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmId(h.id)}
                    data-ocid={`station-deactivate-${h.id}`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteConfirmId(h.id)}
                  data-ocid={`station-delete-${h.id}`}
                  title="Permanently delete this station"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </td>
          </>
        )}
      />
      <Modal
        open={modal !== null}
        title={modal === "add" ? "Add Station" : "Edit Station"}
        onClose={closeModal}
      >
        <div className="space-y-3">
          <div>
            <Label>Station Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Pune North Station"
              data-ocid="station-name-input"
            />
          </div>
          <div>
            <Label>Parent Area *</Label>
            <Select
              value={form.territoryId}
              onValueChange={(v) => setForm((f) => ({ ...f, territoryId: v }))}
            >
              <SelectTrigger data-ocid="station-area-select">
                <SelectValue placeholder="Select Area" />
              </SelectTrigger>
              <SelectContent className="max-h-48 overflow-y-auto scrollbar-thin">
                {territories.map((t) => (
                  <SelectItem key={String(t.id)} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-yellow-700">
            This Station will appear as an <strong>MR HQ</strong> option for MR
            employees in the selected area.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-ocid="station-save-btn"
          >
            {saving ? "Saving…" : "Save Station"}
          </Button>
        </div>
      </Modal>
      <ConfirmModal
        open={confirmId !== null}
        message="Deactivate this station? MRs assigned to it may need reassignment."
        onConfirm={() => confirmId && handleDeactivate(confirmId)}
        onClose={() => setConfirmId(null)}
      />
      <ConfirmModal
        open={deleteConfirmId !== null}
        message="Permanently delete this Station? If it has active territories under it, deletion will be blocked. This action cannot be undone."
        confirmLabel="Delete Station"
        danger
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
      />
    </>
  );
}

// ─── Territory Tab (MR scope level — backend: Area) ─────────────────────────────
function TerritoriesTab({ token }: { token: string }) {
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [hqs, setHqs] = useState<HQRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<AreaRecord | null>(null);
  const [form, setForm] = useState({ name: "", hqId: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<LocationId | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<LocationId | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const allAreas = await api.listAllAreas(token);
      setAreas(allAreas);
    } catch {
      toast.error("Failed to load territories");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadActiveHqs = useCallback(async () => {
    try {
      const zoneList = await api.listActiveZones(token);
      const statesNested = await Promise.all(
        zoneList.map((z) => api.listActiveStatesByZone(token, z.id)),
      );
      const flatStates = statesNested.flat();
      const terrsNested = await Promise.all(
        flatStates.map((s) => api.listActiveTerritories(token, s.id)),
      );
      const flatTerrs = terrsNested.flat();
      const hqsNested = await Promise.all(
        flatTerrs.map((t) => api.listActiveHQsByTerritory(token, t.id)),
      );
      setHqs(hqsNested.flat());
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setForm({ name: "", hqId: "" });
    setEditing(null);
    setSaveError(null);
    setModal("add");
    loadActiveHqs();
  };
  const openEdit = (a: AreaRecord) => {
    setForm({ name: a.name, hqId: String(a.hqId) });
    setEditing(a);
    setSaveError(null);
    setModal("edit");
    loadActiveHqs();
  };
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!form.name.trim() || !form.hqId) {
      toast.error("Territory Name and Parent Station are required");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (modal === "add") {
        const r = await api.addTerritoryToStation(
          token,
          form.name.trim(),
          BigInt(form.hqId),
        );
        if (r.__kind__ === "err") {
          setSaveError(r.err ?? "Failed to save territory. Please try again.");
          toast.error(r.err);
          return;
        }
        toast.success("Territory added");
      } else if (editing) {
        const r = await api.updateTerritoryUnderStation(
          token,
          editing.id,
          form.name.trim(),
        );
        if (r.__kind__ === "err") {
          setSaveError(r.err ?? "Failed to save territory. Please try again.");
          toast.error(r.err);
          return;
        }
        toast.success("Territory updated");
      }
      setSaveError(null);
      closeModal();
      load();
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "Failed to save territory. Please try again.";
      setSaveError(msg);
      toast.error("Operation failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: LocationId) => {
    try {
      const r = await api.deactivateArea(token, id);
      if (r.__kind__ === "err") {
        toast.error(r.err);
        return;
      }
      toast.success("Territory deactivated");
      setConfirmId(null);
      load();
    } catch {
      toast.error("Failed to deactivate territory");
    }
  };

  const handleDelete = async (id: LocationId) => {
    try {
      const r = await api.deleteTerritoryUnderStation(token, id);
      if (r.__kind__ === "err") {
        toast.error(
          r.err ?? "Cannot delete — this territory may have assigned MRs.",
        );
        setDeleteConfirmId(null);
        return;
      }
      toast.success("Territory deleted");
      setDeleteConfirmId(null);
      load();
    } catch {
      toast.error("Failed to delete territory");
    }
  };

  const hqMap = Object.fromEntries(hqs.map((h) => [String(h.id), h.name]));
  const cols = [
    { key: "name", label: "Territory Name" },
    { key: "station", label: "Parent Station" },
    { key: "role", label: "Role Level" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground font-body">
          Territories are the smallest unit — each MR covers a set of{" "}
          <strong>doctors, chemists, and hospitals</strong> within their
          territory.
        </p>
        <Button size="sm" onClick={openAdd} data-ocid="territory-add-btn">
          <PlusCircle className="w-4 h-4 mr-1.5" /> Add Territory
        </Button>
      </div>
      <DataTable
        columns={cols}
        data={areas}
        getKey={(a) => String(a.id)}
        loading={loading}
        emptyMessage="No territories found. Add a Territory under a Station."
        renderRow={(a) => (
          <>
            <td className="px-4 py-3 font-body text-foreground font-medium">
              {a.name}
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground">
              {hqMap[String(a.hqId)] ?? "—"}
            </td>
            <td className="px-4 py-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border font-display">
                MR Territory
              </span>
            </td>
            <td className="px-4 py-3">
              <Badge variant={a.isActive ? "default" : "secondary"}>
                {a.isActive ? "Active" : "Inactive"}
              </Badge>
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(a)}
                  data-ocid={`territory-edit-${a.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {a.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmId(a.id)}
                    data-ocid={`territory-deactivate-${a.id}`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteConfirmId(a.id)}
                  data-ocid={`territory-delete-${a.id}`}
                  title="Permanently delete this territory"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </td>
          </>
        )}
      />
      <Modal
        open={modal !== null}
        title={modal === "add" ? "Add Territory" : "Edit Territory"}
        onClose={closeModal}
      >
        <div className="space-y-3">
          <div>
            <Label>Territory Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Shivaji Nagar Territory"
              data-ocid="territory-name-input"
            />
          </div>
          <div>
            <Label>Parent Station *</Label>
            <Select
              value={form.hqId}
              onValueChange={(v) => setForm((f) => ({ ...f, hqId: v }))}
            >
              <SelectTrigger data-ocid="territory-station-select">
                <SelectValue placeholder="Select Station" />
              </SelectTrigger>
              <SelectContent className="max-h-48 overflow-y-auto scrollbar-thin">
                {hqs.map((h) => (
                  <SelectItem key={String(h.id)} value={String(h.id)}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded px-3 py-2">
            This Territory is the smallest unit. It covers a specific set of
            doctors, chemists, and hospitals managed by an <strong>MR</strong>.
          </p>
        </div>
        {saveError && (
          <div role="alert" className="text-red-600 text-sm mt-2">
            {saveError}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-ocid="territory-save-btn"
          >
            {saving ? "Saving…" : "Save Territory"}
          </Button>
        </div>
      </Modal>
      <ConfirmModal
        open={confirmId !== null}
        message="Deactivate this territory? MRs assigned to it will need reassignment."
        onConfirm={() => confirmId && handleDeactivate(confirmId)}
        onClose={() => setConfirmId(null)}
      />
      <ConfirmModal
        open={deleteConfirmId !== null}
        message="Permanently delete this Territory? MRs assigned to it will need reassignment. This action cannot be undone."
        confirmLabel="Delete Territory"
        danger
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
      />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LocationMaster() {
  const { session } = useAuthStore();
  const token = session?.token ?? "";

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Location Master"
        subtitle="Define the 6-level SFA territory hierarchy: HO → Zone → Region → Area → Station → Territory"
      />
      <PageContent>
        {/* SFA Hierarchy Info Banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Layers className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-sm font-display font-semibold text-foreground">
              SFA Role-Level HQ Hierarchy
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            {[
              {
                label: "HO",
                role: "Company HQ",
                color: "bg-muted/60 text-muted-foreground border-border",
              },
              {
                label: "Zone",
                role: "ZSM HQ",
                color: "bg-violet-50 text-violet-700 border-violet-200",
              },
              {
                label: "Region",
                role: "RSM HQ",
                color: "bg-primary/10 text-primary border-primary/20",
              },
              {
                label: "Area",
                role: "ASM HQ",
                color: "bg-accent/10 text-accent border-accent/20",
              },
              {
                label: "Station",
                role: "MR HQ City",
                color: "bg-yellow-50 text-yellow-700 border-yellow-200",
              },
              {
                label: "Territory",
                role: "MR Scope",
                color: "bg-muted/60 text-muted-foreground border-border",
              },
            ].map((item, i) => (
              <span key={item.label} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-display ${item.color}`}
                >
                  <GitBranch className="w-3 h-3" />
                  {item.label}
                  <span className="opacity-60">({item.role})</span>
                </span>
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Each role’s HQ is assigned at the correct level. HO is fixed —
            manage Zone through Territory using the tabs below.
          </p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" data-ocid="tab-hierarchy-overview">
              Overview
            </TabsTrigger>
            <TabsTrigger value="zones" data-ocid="tab-zones">
              Zone <span className="ml-1 text-[10px] opacity-60">(ZSM)</span>
            </TabsTrigger>
            <TabsTrigger value="regions" data-ocid="tab-regions">
              Region <span className="ml-1 text-[10px] opacity-60">(RSM)</span>
            </TabsTrigger>
            <TabsTrigger value="areas" data-ocid="tab-areas">
              Area <span className="ml-1 text-[10px] opacity-60">(ASM)</span>
            </TabsTrigger>
            <TabsTrigger value="stations" data-ocid="tab-stations">
              Station{" "}
              <span className="ml-1 text-[10px] opacity-60">(MR HQ)</span>
            </TabsTrigger>
            <TabsTrigger value="territories" data-ocid="tab-territories">
              Territory{" "}
              <span className="ml-1 text-[10px] opacity-60">(MR)</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <HierarchyTreeTab token={token} />
          </TabsContent>
          <TabsContent value="zones">
            <ZonesTab token={token} />
          </TabsContent>
          <TabsContent value="regions">
            <RegionsTab token={token} />
          </TabsContent>
          <TabsContent value="areas">
            <AreasTab token={token} />
          </TabsContent>
          <TabsContent value="stations">
            <StationsTab token={token} />
          </TabsContent>
          <TabsContent value="territories">
            <TerritoriesTab token={token} />
          </TabsContent>
        </Tabs>
      </PageContent>
    </PortalLayout>
  );
}
