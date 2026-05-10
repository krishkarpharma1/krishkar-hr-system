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
}: {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
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
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            Deactivate
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

  const levelColors = {
    Zone: "bg-primary/10 text-primary border-primary/20",
    Region: "bg-accent/10 text-accent border-accent/20",
    Area: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Station: "bg-muted/50 text-muted-foreground border-border",
  };

  const roleLabels: Record<string, string> = {
    Zone: "RSM HQ",
    Region: "ASM HQ",
    Area: "MR HQ (Station)",
    Station: "Territory (MR)",
  };

  // Display labels — backend keys unchanged
  const displayLabels: Record<string, string> = {
    Zone: "Region",
    Region: "Area",
    Area: "Station",
    Station: "Territory",
  };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-2 p-3 bg-primary/5 border border-primary/15 rounded-lg">
        {(["Zone", "Region", "Area", "Station"] as const).map((level) => (
          <span
            key={level}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${levelColors[level]}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {displayLabels[level]} — {roleLabels[level]}
          </span>
        ))}
        <span className="text-xs text-muted-foreground ml-auto self-center">
          {zones.length} Regions · {regionItems.length} Areas ·{" "}
          {areaItems.length} Stations · {stationItems.length} Territories
        </span>
      </div>

      {/* Visual flow */}
      <div className="flex items-center gap-2 text-sm font-display font-medium text-foreground px-2">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Regions",
            count: zones.length,
            level: "Zone",
            role: "RSM HQ",
            colorClass: "border-primary/20 bg-primary/5",
          },
          {
            label: "Areas",
            count: regionItems.length,
            level: "Region",
            role: "ASM HQ",
            colorClass: "border-accent/20 bg-accent/5",
          },
          {
            label: "Stations",
            count: areaItems.length,
            level: "Area",
            role: "MR HQ",
            colorClass: "border-yellow-200 bg-yellow-50",
          },
          {
            label: "Territories",
            count: stationItems.length,
            level: "Station",
            role: "MR Scope",
            colorClass: "border-border bg-muted/30",
          },
        ].map((item) => (
          <div
            key={item.level}
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

      {/* Region list */}
      {zones.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider font-display text-muted-foreground">
            Region Overview
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {zones.map((z) => (
              <div
                key={String(z.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border"
              >
                <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setZones(await api.listZones(token));
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
      toast.error("Name and Code are required");
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
        toast.success("Zone added");
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
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: LocationId) => {
    const r = await api.deactivateZone(token, id);
    if (r.__kind__ === "err") {
      toast.error(r.err);
      return;
    }
    toast.success("Zone deactivated");
    setConfirmId(null);
    load();
  };

  const cols = [
    { key: "name", label: "Region Name" },
    { key: "code", label: "Code" },
    { key: "role", label: "Role Level" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground font-body">
          Regions are the top-level geography — each Region is the HQ for an{" "}
          <strong>RSM</strong>
        </p>
        <Button size="sm" onClick={openAdd} data-ocid="zone-add-btn">
          <PlusCircle className="w-4 h-4 mr-1.5" /> Add Region
        </Button>
      </div>
      <DataTable
        columns={cols}
        data={zones}
        getKey={(z) => String(z.id)}
        loading={loading}
        emptyMessage="No regions found. Add a Region to start building your territory hierarchy."
        renderRow={(z) => (
          <>
            <td className="px-4 py-3 font-body text-foreground font-medium">
              {z.name}
            </td>
            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
              {z.code}
            </td>
            <td className="px-4 py-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-display">
                RSM HQ
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
              data-ocid="zone-name-input"
            />
          </div>
          <div>
            <Label>Code *</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="e.g. NR"
              data-ocid="zone-code-input"
            />
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
            data-ocid="zone-save-btn"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </Modal>
      <ConfirmModal
        open={confirmId !== null}
        message="Deactivate this region? Areas under it will no longer be accessible."
        onConfirm={() => confirmId && handleDeactivate(confirmId)}
        onClose={() => setConfirmId(null)}
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const allZones = await api.listZones(token);
      setZones(allZones);
      const nested = await Promise.all(
        allZones.map((z) => api.listStatesByZone(token, z.id)),
      );
      setStates(nested.flat());
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadActiveZones = useCallback(async () => {
    setZones(await api.listActiveZones(token));
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
      toast.error("Name and Parent Zone are required");
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
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: LocationId) => {
    const r = await api.deactivateState(token, id);
    if (r.__kind__ === "err") {
      toast.error(r.err);
      return;
    }
    toast.success("Region deactivated");
    setConfirmId(null);
    load();
  };

  const zoneMap = Object.fromEntries(zones.map((z) => [String(z.id), z.name]));
  const cols = [
    { key: "name", label: "Area Name" },
    { key: "zone", label: "Parent Region" },
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
        <Button size="sm" onClick={openAdd} data-ocid="region-add-btn">
          <PlusCircle className="w-4 h-4 mr-1.5" /> Add Area
        </Button>
      </div>
      <DataTable
        columns={cols}
        data={states}
        getKey={(s) => String(s.id)}
        loading={loading}
        emptyMessage="No regions found"
        renderRow={(s) => (
          <>
            <td className="px-4 py-3 font-body text-foreground font-medium">
              {s.name}
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground">
              {zoneMap[String(s.zoneId)] ?? "—"}
            </td>
            <td className="px-4 py-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-display">
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
              placeholder="e.g. Maharashtra Area"
              data-ocid="region-name-input"
            />
          </div>
          <div>
            <Label>Parent Region *</Label>
            <Select
              value={form.zoneId}
              onValueChange={(v) => setForm((f) => ({ ...f, zoneId: v }))}
            >
              <SelectTrigger data-ocid="region-zone-select">
                <SelectValue placeholder="Select Region" />
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
            data-ocid="region-save-btn"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </Modal>
      <ConfirmModal
        open={confirmId !== null}
        message="Deactivate this area? Stations linked to it may be affected."
        onConfirm={() => confirmId && handleDeactivate(confirmId)}
        onClose={() => setConfirmId(null)}
      />
    </>
  );
}

// ─── Area Tab (ASM HQ level — maps to "Territory" in old structure) ───────────
function AreasAsmTab({ token }: { token: string }) {
  const [territories, setTerritories] = useState<TerritoryRecord[]>([]);
  const [states, setStates] = useState<StateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<TerritoryRecord | null>(null);
  const [form, setForm] = useState({ name: "", stateId: "" });
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<LocationId | null>(null);

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
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadActiveStates = useCallback(async () => {
    const zoneList = await api.listActiveZones(token);
    const nested = await Promise.all(
      zoneList.map((z) => api.listActiveStatesByZone(token, z.id)),
    );
    setStates(nested.flat());
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
      toast.error("Name and Parent Region are required");
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
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: LocationId) => {
    const r = await api.deactivateTerritory(token, id);
    if (r.__kind__ === "err") {
      toast.error(r.err);
      return;
    }
    toast.success("Area deactivated");
    setConfirmId(null);
    load();
  };

  const stateMap = Object.fromEntries(
    states.map((s) => [String(s.id), s.name]),
  );
  const cols = [
    { key: "name", label: "Station Name" },
    { key: "region", label: "Parent Area" },
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
        <Button size="sm" onClick={openAdd} data-ocid="area-asm-add-btn">
          <PlusCircle className="w-4 h-4 mr-1.5" /> Add Station
        </Button>
      </div>
      <DataTable
        columns={cols}
        data={territories}
        getKey={(t) => String(t.id)}
        loading={loading}
        emptyMessage="No areas found"
        renderRow={(t) => (
          <>
            <td className="px-4 py-3 font-body text-foreground font-medium">
              {t.name}
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground">
              {stateMap[String(t.stateId)] ?? "—"}
            </td>
            <td className="px-4 py-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 font-display">
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
                  data-ocid={`area-asm-edit-${t.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {t.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmId(t.id)}
                    data-ocid={`area-asm-deactivate-${t.id}`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
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
              data-ocid="area-asm-name-input"
            />
          </div>
          <div>
            <Label>Parent Area *</Label>
            <Select
              value={form.stateId}
              onValueChange={(v) => setForm((f) => ({ ...f, stateId: v }))}
            >
              <SelectTrigger data-ocid="area-asm-region-select">
                <SelectValue placeholder="Select Area" />
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
            data-ocid="area-asm-save-btn"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </Modal>
      <ConfirmModal
        open={confirmId !== null}
        message="Deactivate this station? MRs assigned to it may need reassignment."
        onConfirm={() => confirmId && handleDeactivate(confirmId)}
        onClose={() => setConfirmId(null)}
      />
    </>
  );
}

// ─── Station Tab (MR HQ level — HQ records from the old "HQ" table) ───────────
function StationsMrTab({ token }: { token: string }) {
  const [hqs, setHqs] = useState<HQRecord[]>([]);
  const [territories, setTerritories] = useState<TerritoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<HQRecord | null>(null);
  const [form, setForm] = useState({ name: "", territoryId: "" });
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<LocationId | null>(null);

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
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadActiveTerritories = useCallback(async () => {
    const zoneList = await api.listActiveZones(token);
    const statesNested = await Promise.all(
      zoneList.map((z) => api.listActiveStatesByZone(token, z.id)),
    );
    const flatStates = statesNested.flat();
    const terrsNested = await Promise.all(
      flatStates.map((s) => api.listActiveTerritories(token, s.id)),
    );
    setTerritories(terrsNested.flat());
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setForm({ name: "", territoryId: "" });
    setEditing(null);
    setModal("add");
    loadActiveTerritories();
  };
  const openEdit = (h: HQRecord) => {
    setForm({ name: h.name, territoryId: String(h.territoryId) });
    setEditing(h);
    setModal("edit");
    loadActiveTerritories();
  };
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!form.name.trim() || !form.territoryId) {
      toast.error("Name and Parent Area are required");
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
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: LocationId) => {
    const r = await api.deactivateHQ(token, id);
    if (r.__kind__ === "err") {
      toast.error(r.err);
      return;
    }
    toast.success("Station deactivated");
    setConfirmId(null);
    load();
  };

  const territoryMap = Object.fromEntries(
    territories.map((t) => [String(t.id), t.name]),
  );
  const cols = [
    { key: "name", label: "Territory Name" },
    { key: "area", label: "Parent Station" },
    { key: "hierarchy", label: "Full Path" },
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
        <Button size="sm" onClick={openAdd} data-ocid="station-mr-add-btn">
          <PlusCircle className="w-4 h-4 mr-1.5" /> Add Territory
        </Button>
      </div>
      <DataTable
        columns={cols}
        data={hqs}
        getKey={(h) => String(h.id)}
        loading={loading}
        emptyMessage="No stations found"
        renderRow={(h) => (
          <>
            <td className="px-4 py-3 font-body text-foreground font-medium">
              {h.name}
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground">
              {territoryMap[String(h.territoryId)] ?? "—"}
            </td>
            <td className="px-4 py-3">
              <HierarchyCell token={token} locationId={h.id} />
            </td>
            <td className="px-4 py-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border font-display">
                MR Territory
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
                  data-ocid={`station-mr-edit-${h.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {h.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmId(h.id)}
                    data-ocid={`station-mr-deactivate-${h.id}`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
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
              data-ocid="station-mr-name-input"
            />
          </div>
          <div>
            <Label>Parent Station *</Label>
            <Select
              value={form.territoryId}
              onValueChange={(v) => setForm((f) => ({ ...f, territoryId: v }))}
            >
              <SelectTrigger data-ocid="station-mr-area-select">
                <SelectValue placeholder="Select Station" />
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
          <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded px-3 py-2">
            This Territory is the smallest unit. It covers a specific set of
            doctors, chemists, and hospitals managed by an <strong>MR</strong>.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-ocid="station-mr-save-btn"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </Modal>
      <ConfirmModal
        open={confirmId !== null}
        message="Deactivate this territory? MRs assigned to it will need reassignment."
        onConfirm={() => confirmId && handleDeactivate(confirmId)}
        onClose={() => setConfirmId(null)}
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
        subtitle="Define the 4-level SFA territory hierarchy: Region → Area → Station → Territory"
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
            Each role's HQ is assigned at the correct level. Two employees at
            the same level may share an HQ (combined HQ is allowed).
          </p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" data-ocid="tab-hierarchy-overview">
              Hierarchy Overview
            </TabsTrigger>
            <TabsTrigger value="zones" data-ocid="tab-zones">
              Region <span className="ml-1 text-[10px] opacity-60">(RSM)</span>
            </TabsTrigger>
            <TabsTrigger value="regions" data-ocid="tab-regions">
              Area <span className="ml-1 text-[10px] opacity-60">(ASM)</span>
            </TabsTrigger>
            <TabsTrigger value="areas" data-ocid="tab-areas-asm">
              Station{" "}
              <span className="ml-1 text-[10px] opacity-60">(MR HQ)</span>
            </TabsTrigger>
            <TabsTrigger value="stations" data-ocid="tab-stations-mr">
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
            <AreasAsmTab token={token} />
          </TabsContent>
          <TabsContent value="stations">
            <StationsMrTab token={token} />
          </TabsContent>
        </Tabs>
      </PageContent>
    </PortalLayout>
  );
}
