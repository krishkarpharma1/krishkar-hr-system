import { CheckSquare, Loader2, MapPin, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AreaRecord,
  StateRecord,
  StationRecord,
  TerritoryRecord,
  UserInfo,
  ZoneRecord,
} from "../backend.d";
import { api } from "../lib/api";

export interface LocationAllotmentData {
  // Multi-value fields (new multi-select)
  zoneIds?: string[];
  zoneNames?: string[];
  regionIds?: string[];
  regionNames?: string[];
  areaIds?: string[];
  areaNames?: string[];
  stationIds?: string[];
  stationNames?: string[];
  territoryIds?: string[];
  territoryNames?: string[];
  // Single-value legacy fields (kept for backward compat)
  zoneId?: string;
  zoneName?: string;
  regionId?: string;
  regionName?: string;
  areaId?: string;
  areaName?: string;
  hqId?: string;
  hqName?: string;
  stationId?: string;
  stationName?: string;
  workingAreaLabel?: string;
  /** backward-compat bigint fields */
  zoneIdBI?: bigint;
  regionIdBI?: bigint;
  areaIdBI?: bigint;
  stationIdBI?: bigint;
  territoryIdsBI?: bigint[];
  isValid?: boolean;
  _raw?: unknown;
}

interface Props {
  role: string;
  reportingManagerId: string | null;
  token: string;
  onChange: (data: LocationAllotmentData) => void;
  existingData?: LocationAllotmentData;
  mode: "create" | "edit";
  refreshKey?: number;
}

const ROLES_NO_ALLOTMENT = ["Admin", "HR", "HRManager"];

function roleKey(role: string): string {
  return role;
}

// ── Shared sub-components ───────────────────────────────────────────────────

function AutoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2 mb-2">
      <MapPin className="h-3.5 w-3.5 shrink-0" />
      <span className="font-medium">{label}:</span>
      <span>{value || "—"}</span>
      <span className="ml-auto text-xs text-blue-400 italic">
        (auto from manager)
      </span>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <p className="text-xs text-red-600 mt-1">{msg}</p>;
}

function FieldLabel({
  label,
  required,
  htmlFor,
}: { label: string; required?: boolean; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold text-gray-600 mb-1"
    >
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function WorkingAreaLabel({ label }: { label: string }) {
  return (
    <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
      <span className="font-medium">Working Area:</span> {label}
    </div>
  );
}

// ── Multi-select with checkboxes + chips ─────────────────────────────────────

interface MultiSelectItem {
  id: string;
  name: string;
}

function MultiSelectField({
  id,
  label,
  required,
  items,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  loading,
  emptyMsg,
  disabled,
}: {
  id: string;
  label: string;
  required?: boolean;
  items: MultiSelectItem[];
  selected: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  loading: boolean;
  emptyMsg: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const allSelected =
    items.length > 0 && items.every((i) => selected.includes(i.id));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedItems = items.filter((i) => selected.includes(i.id));

  return (
    <div className="space-y-1.5">
      <FieldLabel label={label} required={required} htmlFor={id} />
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
            >
              {item.name}
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 transition-colors"
                aria-label={`Remove ${item.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-gray-400 hover:text-red-500 ml-1 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
      <div className="relative" ref={ref}>
        <button
          type="button"
          id={id}
          disabled={disabled || loading}
          onClick={() => !disabled && !loading && setOpen((o) => !o)}
          className={`w-full border rounded-md px-3 py-2 text-sm text-left flex justify-between items-center transition-colors ${
            disabled || loading
              ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-white border-gray-300 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          }`}
        >
          <span>
            {loading
              ? "Loading…"
              : selected.length === 0
                ? `Select ${label}`
                : `${selected.length} selected`}
          </span>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <svg
              aria-hidden="true"
              className="w-4 h-4 text-gray-400 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </button>
        {open && !disabled && !loading && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-52 overflow-hidden flex flex-col">
            {items.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50 sticky top-0">
                <button
                  type="button"
                  onClick={allSelected ? onClearAll : onSelectAll}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  {allSelected ? (
                    <>
                      <Square className="w-3 h-3" /> Deselect All
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3 h-3" /> Select All
                    </>
                  )}
                </button>
                <span className="text-xs text-gray-400">
                  {selected.length}/{items.length}
                </span>
              </div>
            )}
            <div className="overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-sm text-amber-700 px-3 py-2 bg-amber-50">
                  {emptyMsg}
                </p>
              ) : (
                items.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => onToggle(item.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span
                      className={
                        selected.includes(item.id)
                          ? "text-blue-800 font-medium"
                          : "text-gray-700"
                      }
                    >
                      {item.name}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toItems<T extends { id: bigint; name: string }>(
  list: T[],
): MultiSelectItem[] {
  return list.map((x) => ({ id: x.id.toString(), name: x.name }));
}

// ── Main export ──────────────────────────────────────────────────────────────

export default function LocationAllotment(props: Props) {
  const { role } = props;

  if (ROLES_NO_ALLOTMENT.includes(role)) {
    return <AdminHRView onChange={props.onChange} />;
  }

  const rk = roleKey(role);

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Location Allotment
      </h3>
      {rk === "ZSM" && <ZSMAllotment {...props} />}
      {rk === "RSM" && <RSMAllotment {...props} />}
      {rk === "ASM" && <ASMAllotment {...props} />}
      {rk === "MR" && <MRAllotment {...props} />}
    </div>
  );
}

// ── Admin / HR ───────────────────────────────────────────────────────────────

function AdminHRView({
  onChange,
}: { onChange: (d: LocationAllotmentData) => void }) {
  useEffect(() => {
    onChange({ workingAreaLabel: "All Locations", isValid: true });
  }, [onChange]);
  return (
    <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
      <span className="font-medium">HQ:</span> Head Office (HO) &nbsp;|&nbsp;
      <span className="font-medium">Working Area:</span> All Locations
    </div>
  );
}

// ── ZSM ──────────────────────────────────────────────────────────────────────

function ZSMAllotment({ token, onChange, existingData, refreshKey }: Props) {
  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(
    existingData?.zoneIds ??
      (existingData?.zoneId ? [existingData.zoneId] : []),
  );

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is intentional reload trigger
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .listActiveZones(token)
      .then((list) => {
        if (cancelled) return;
        setZones(list);
        if (existingData?.zoneIds?.length) setSelectedIds(existingData.zoneIds);
        else if (existingData?.zoneId) setSelectedIds([existingData.zoneId]);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load zones. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, refreshKey]);

  const fireChange = useCallback((ids: string[], zoneList: ZoneRecord[]) => {
    const names = ids.map(
      (id) => zoneList.find((z) => z.id.toString() === id)?.name ?? id,
    );
    const first = zoneList.find((z) => z.id.toString() === ids[0]);
    onChangeRef.current({
      zoneIds: ids,
      zoneNames: names,
      zoneId: ids[0],
      zoneIdBI: first?.id,
      zoneName: names[0],
      workingAreaLabel:
        ids.length === 0
          ? ""
          : ids.length === 1
            ? `All data under Zone: ${names[0]}`
            : `All data under ${ids.length} Zones`,
      isValid: ids.length > 0,
    });
  }, []);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      fireChange(next, zones);
      return next;
    });
  }
  function selectAll() {
    const ids = zones.map((z) => z.id.toString());
    setSelectedIds(ids);
    fireChange(ids, zones);
  }
  function clearAll() {
    setSelectedIds([]);
    fireChange([], zones);
  }

  const items = toItems(zones);
  return (
    <div className="space-y-3">
      <MultiSelectField
        id="la-zsm-zone"
        label="Zone (HQ)"
        required
        items={items}
        selected={selectedIds}
        onToggle={toggle}
        onSelectAll={selectAll}
        onClearAll={clearAll}
        loading={loading}
        emptyMsg="No Zones available. Please add them in Location Master first."
      />
      {error && <ErrorMsg msg={error} />}
      {selectedIds.length > 0 && (
        <WorkingAreaLabel
          label={
            selectedIds.length === 1
              ? `All data under Zone: ${zones.find((z) => z.id.toString() === selectedIds[0])?.name ?? selectedIds[0]}`
              : `All data under ${selectedIds.length} Zones`
          }
        />
      )}
    </div>
  );
}

// ── RSM ──────────────────────────────────────────────────────────────────────

function RSMAllotment({
  token,
  reportingManagerId,
  onChange,
  existingData,
  refreshKey,
}: Props) {
  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [autoZoneId, setAutoZoneId] = useState("");
  const [autoZoneName, setAutoZoneName] = useState("");
  const [regions, setRegions] = useState<StateRecord[]>([]);
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>(
    existingData?.regionIds ??
      (existingData?.regionId ? [existingData.regionId] : []),
  );
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [error, setError] = useState("");

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const zonesRef = useRef<ZoneRecord[]>([]);
  zonesRef.current = zones;

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey intentional reload
  useEffect(() => {
    let cancelled = false;
    setError("");
    setRegions([]);
    setZones([]);

    async function run() {
      if (reportingManagerId) {
        try {
          const manager: UserInfo | null = await api.getUserByEmployeeId(
            token,
            reportingManagerId,
          );
          if (cancelled) return;
          const zId = manager?.zoneIds?.[0];
          if (zId) {
            setLoadingZones(true);
            try {
              const [zoneList, regionList] = await Promise.all([
                api.listActiveZones(token),
                (async () => {
                  setLoadingRegions(true);
                  try {
                    return await api.listActiveStatesByZone(token, zId);
                  } finally {
                    if (!cancelled) setLoadingRegions(false);
                  }
                })(),
              ]);
              if (cancelled) return;
              const zName =
                zoneList.find((z) => z.id === zId)?.name ?? zId.toString();
              setAutoZoneId(zId.toString());
              setAutoZoneName(zName);
              setZones(zoneList);
              setRegions(regionList);
              if (existingData?.regionIds?.length)
                setSelectedRegionIds(existingData.regionIds);
              else if (existingData?.regionId)
                setSelectedRegionIds([existingData.regionId]);
            } finally {
              if (!cancelled) setLoadingZones(false);
            }
            return;
          }
        } catch {
          /* fall through */
        }
      }
      // No manager or manager has no zone: load all zones AND all regions as fallback
      if (cancelled) return;
      setAutoZoneId("");
      setAutoZoneName("");
      setLoadingZones(true);
      setLoadingRegions(true);
      try {
        const zoneList = await api.listActiveZones(token);
        if (cancelled) return;
        setZones(zoneList);

        // Fallback: load ALL regions by iterating all zones so dropdown is never empty
        let allRegions: StateRecord[] = [];
        try {
          const regionFetches = zoneList.map((z) =>
            api
              .listActiveStatesByZone(token, z.id)
              .catch(() => [] as StateRecord[]),
          );
          const results = await Promise.all(regionFetches);
          if (cancelled) return;
          allRegions = results.flat();
        } catch {
          /* non-blocking */
        }

        const initZone =
          existingData?.zoneId ??
          (zoneList.length === 1 ? zoneList[0].id.toString() : "");
        if (initZone) {
          setSelectedZoneId(initZone);
          // Filter regions to selected zone, or use all if no specific zone
          const zoneRegions = allRegions.filter(
            (r) =>
              (r as StateRecord & { zoneId?: bigint }).zoneId?.toString() ===
              initZone,
          );
          const regionsToShow =
            zoneRegions.length > 0 ? zoneRegions : allRegions;
          setRegions(regionsToShow);
          if (existingData?.regionIds?.length)
            setSelectedRegionIds(existingData.regionIds);
          else if (existingData?.regionId)
            setSelectedRegionIds([existingData.regionId]);
        } else {
          // No zone pre-selected: show all regions so dropdown is always populated
          setRegions(allRegions);
          if (existingData?.regionIds?.length)
            setSelectedRegionIds(existingData.regionIds);
          else if (existingData?.regionId)
            setSelectedRegionIds([existingData.regionId]);
        }
      } catch {
        if (!cancelled) setError("Failed to load zones.");
      } finally {
        if (!cancelled) {
          setLoadingZones(false);
          setLoadingRegions(false);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token, reportingManagerId, refreshKey]);

  async function handleZonePick(zId: string) {
    setSelectedZoneId(zId);
    setRegions([]);
    setSelectedRegionIds([]);
    if (!zId) return;
    setLoadingRegions(true);
    try {
      const rList = await api.listActiveStatesByZone(token, BigInt(zId));
      setRegions(rList);
    } catch {
      setError("Failed to load regions.");
    } finally {
      setLoadingRegions(false);
    }
  }

  const activeZoneId = autoZoneId || selectedZoneId;

  const fireChange = useCallback(
    (
      regionIds: string[],
      regionList: StateRecord[],
      zoneId: string,
      zoneList: ZoneRecord[],
    ) => {
      const regionNames = regionIds.map(
        (id) => regionList.find((r) => r.id.toString() === id)?.name ?? id,
      );
      const zone = zoneList.find((z) => z.id.toString() === zoneId);
      const first = regionList.find((r) => r.id.toString() === regionIds[0]);
      onChangeRef.current({
        zoneIds: zoneId ? [zoneId] : [],
        zoneId,
        zoneIdBI: zone?.id,
        zoneName: zone?.name,
        regionIds,
        regionNames,
        regionId: regionIds[0],
        regionIdBI: first?.id,
        regionName: regionNames[0],
        workingAreaLabel:
          regionIds.length === 0
            ? ""
            : regionIds.length === 1
              ? `All data under Region: ${regionNames[0]}`
              : `All data under ${regionIds.length} Regions`,
        isValid: regionIds.length > 0,
      });
    },
    [],
  );

  function toggleRegion(id: string) {
    setSelectedRegionIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      fireChange(next, regions, activeZoneId, zones);
      return next;
    });
  }
  function selectAllRegions() {
    const ids = regions.map((r) => r.id.toString());
    setSelectedRegionIds(ids);
    fireChange(ids, regions, activeZoneId, zones);
  }
  function clearRegions() {
    setSelectedRegionIds([]);
    fireChange([], regions, activeZoneId, zones);
  }

  const regionItems = toItems(regions);
  return (
    <div className="space-y-3">
      {autoZoneName && <AutoBadge label="Zone (auto)" value={autoZoneName} />}
      {!autoZoneId && !loadingZones && zones.length > 0 && (
        <div>
          <FieldLabel label="Zone" required htmlFor="la-rsm-zone" />
          <select
            id="la-rsm-zone"
            value={selectedZoneId}
            onChange={(e) => handleZonePick(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">Select Zone first</option>
            {zones.map((z) => (
              <option key={z.id.toString()} value={z.id.toString()}>
                {z.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {loadingZones && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-1">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading zones…
        </div>
      )}
      <MultiSelectField
        id="la-rsm-region"
        label="Region (HQ)"
        required
        items={regionItems}
        selected={selectedRegionIds}
        onToggle={toggleRegion}
        onSelectAll={selectAllRegions}
        onClearAll={clearRegions}
        loading={loadingRegions}
        emptyMsg="No Regions available. Please add them in Location Master first."
      />
      {error && <ErrorMsg msg={error} />}
      {selectedRegionIds.length > 0 && (
        <WorkingAreaLabel
          label={
            selectedRegionIds.length === 1
              ? `All data under Region: ${regions.find((r) => r.id.toString() === selectedRegionIds[0])?.name ?? selectedRegionIds[0]}`
              : `All data under ${selectedRegionIds.length} Regions`
          }
        />
      )}
    </div>
  );
}

// ── ASM ──────────────────────────────────────────────────────────────────────

function ASMAllotment({
  token,
  reportingManagerId,
  onChange,
  existingData,
  refreshKey,
}: Props) {
  const [autoRegionName, setAutoRegionName] = useState("");
  const [autoRegionId, setAutoRegionId] = useState("");
  const [autoZoneId, setAutoZoneId] = useState("");
  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [manualRegions, setManualRegions] = useState<StateRecord[]>([]);
  const [selectedManualZoneId, setSelectedManualZoneId] = useState("");
  const [selectedManualRegionId, setSelectedManualRegionId] = useState("");
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>(
    existingData?.areaIds ??
      (existingData?.areaId ? [existingData.areaId] : []),
  );
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [error, setError] = useState("");

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const activeRegionId = autoRegionId || selectedManualRegionId;
  const activeZoneId = autoZoneId || selectedManualZoneId;

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey intentional reload
  useEffect(() => {
    let cancelled = false;
    setError("");
    setAreas([]);

    async function run() {
      if (reportingManagerId) {
        try {
          const manager: UserInfo | null = await api.getUserByEmployeeId(
            token,
            reportingManagerId,
          );
          if (cancelled) return;
          const rId = manager?.stateIds?.[0];
          const zId = manager?.zoneIds?.[0];
          if (rId) {
            setAutoRegionId(rId.toString());
            setAutoZoneId(zId?.toString() ?? "");
            try {
              if (zId) {
                const rList = await api.listActiveStatesByZone(token, zId);
                if (!cancelled)
                  setAutoRegionName(
                    rList.find((r) => r.id === rId)?.name ?? rId.toString(),
                  );
              }
            } catch {
              /* non-blocking */
            }
            setLoadingAreas(true);
            try {
              const aList = await api.listActiveTerritories(token, rId);
              if (cancelled) return;
              setAreas(
                aList.map((a) => ({ id: a.id.toString(), name: a.name })),
              );
              if (existingData?.areaIds?.length)
                setSelectedAreaIds(existingData.areaIds);
              else if (existingData?.areaId)
                setSelectedAreaIds([existingData.areaId]);
            } finally {
              if (!cancelled) setLoadingAreas(false);
            }
            return;
          }
        } catch {
          /* fall through */
        }
      }
      // No manager path: load all zones + ALL areas as fallback so dropdown is never empty
      if (cancelled) return;
      setAutoRegionId("");
      setAutoRegionName("");
      setAutoZoneId("");
      setLoadingZones(true);
      setLoadingAreas(true);
      try {
        const [zList, allAreaList] = await Promise.all([
          api.listActiveZones(token),
          api
            .listAllAreas(token)
            .catch(() => [] as { id: bigint; name: string }[]),
        ]);
        if (cancelled) return;
        setZones(zList);
        // Always pre-populate areas from global list so field is never empty
        const globalAreas = allAreaList.map((a) => ({
          id: a.id.toString(),
          name: a.name,
        }));
        setAreas(globalAreas);
        if (existingData?.areaIds?.length)
          setSelectedAreaIds(existingData.areaIds);
        else if (existingData?.areaId)
          setSelectedAreaIds([existingData.areaId]);

        if (existingData?.zoneId) {
          setSelectedManualZoneId(existingData.zoneId);
          setLoadingRegions(true);
          try {
            const rList = await api.listActiveStatesByZone(
              token,
              BigInt(existingData.zoneId),
            );
            if (cancelled) return;
            setManualRegions(rList);
            if (existingData.regionId) {
              setSelectedManualRegionId(existingData.regionId);
              setLoadingAreas(true);
              try {
                const aList = await api.listActiveTerritories(
                  token,
                  BigInt(existingData.regionId),
                );
                if (cancelled) return;
                setAreas(
                  aList.map((a) => ({ id: a.id.toString(), name: a.name })),
                );
                if (existingData.areaIds?.length)
                  setSelectedAreaIds(existingData.areaIds);
                else if (existingData.areaId)
                  setSelectedAreaIds([existingData.areaId]);
              } finally {
                if (!cancelled) setLoadingAreas(false);
              }
            }
          } finally {
            if (!cancelled) setLoadingRegions(false);
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load location data.");
      } finally {
        if (!cancelled) {
          setLoadingZones(false);
          setLoadingAreas(false);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token, reportingManagerId, refreshKey]);

  async function handleManualZonePick(zId: string) {
    setSelectedManualZoneId(zId);
    setManualRegions([]);
    setSelectedManualRegionId("");
    setAreas([]);
    setSelectedAreaIds([]);
    if (!zId) return;
    setLoadingRegions(true);
    try {
      const rList = await api.listActiveStatesByZone(token, BigInt(zId));
      setManualRegions(rList);
    } catch {
      setError("Failed to load regions.");
    } finally {
      setLoadingRegions(false);
    }
  }

  async function handleManualRegionPick(rId: string) {
    setSelectedManualRegionId(rId);
    setAreas([]);
    setSelectedAreaIds([]);
    if (!rId) return;
    setLoadingAreas(true);
    try {
      const aList = await api.listActiveTerritories(token, BigInt(rId));
      setAreas(aList.map((a) => ({ id: a.id.toString(), name: a.name })));
    } catch {
      setError("Failed to load areas.");
    } finally {
      setLoadingAreas(false);
    }
  }

  const fireChange = useCallback(
    (areaIds: string[], areaList: { id: string; name: string }[]) => {
      const areaNames = areaIds.map(
        (id) => areaList.find((a) => a.id === id)?.name ?? id,
      );
      const firstId = areaIds[0];
      onChangeRef.current({
        areaIds,
        areaNames,
        areaId: firstId,
        areaIdBI: firstId ? BigInt(firstId) : undefined,
        areaName: areaNames[0],
        zoneId: activeZoneId,
        zoneIdBI: activeZoneId ? BigInt(activeZoneId) : undefined,
        regionId: activeRegionId,
        regionIdBI: activeRegionId ? BigInt(activeRegionId) : undefined,
        regionName: autoRegionName || selectedManualRegionId,
        workingAreaLabel:
          areaIds.length === 0
            ? ""
            : areaIds.length === 1
              ? `All data under Area: ${areaNames[0]}`
              : `All data under ${areaIds.length} Areas`,
        isValid: areaIds.length > 0,
      });
    },
    [activeZoneId, activeRegionId, autoRegionName, selectedManualRegionId],
  );

  function toggleArea(id: string) {
    setSelectedAreaIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      fireChange(next, areas);
      return next;
    });
  }
  function selectAllAreas() {
    const ids = areas.map((a) => a.id);
    setSelectedAreaIds(ids);
    fireChange(ids, areas);
  }
  function clearAreas() {
    setSelectedAreaIds([]);
    fireChange([], areas);
  }

  return (
    <div className="space-y-3">
      {autoRegionName && (
        <AutoBadge label="Region (auto)" value={autoRegionName} />
      )}
      {!autoRegionId && (
        <>
          {loadingZones ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading zones…
            </div>
          ) : zones.length > 0 ? (
            <div>
              <FieldLabel label="Zone" required htmlFor="la-asm-zone" />
              <select
                id="la-asm-zone"
                value={selectedManualZoneId}
                onChange={(e) => handleManualZonePick(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Select Zone first</option>
                {zones.map((z) => (
                  <option key={z.id.toString()} value={z.id.toString()}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {selectedManualZoneId &&
            (loadingRegions ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading regions…
              </div>
            ) : manualRegions.length > 0 ? (
              <div>
                <FieldLabel label="Region" required htmlFor="la-asm-region" />
                <select
                  id="la-asm-region"
                  value={selectedManualRegionId}
                  onChange={(e) => handleManualRegionPick(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select Region</option>
                  {manualRegions.map((r) => (
                    <option key={r.id.toString()} value={r.id.toString()}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null)}
        </>
      )}
      <MultiSelectField
        id="la-asm-area"
        label="Area (HQ)"
        required
        items={areas}
        selected={selectedAreaIds}
        onToggle={toggleArea}
        onSelectAll={selectAllAreas}
        onClearAll={clearAreas}
        loading={loadingAreas}
        emptyMsg="No Areas available. Please add them in Location Master first."
      />
      {error && <ErrorMsg msg={error} />}
      {selectedAreaIds.length > 0 && (
        <WorkingAreaLabel
          label={
            selectedAreaIds.length === 1
              ? `All data under Area: ${areas.find((a) => a.id === selectedAreaIds[0])?.name ?? selectedAreaIds[0]}`
              : `All data under ${selectedAreaIds.length} Areas`
          }
        />
      )}
    </div>
  );
}

// ── MR ───────────────────────────────────────────────────────────────────────

function MRAllotment({
  token,
  onChange,
  existingData,
  refreshKey,
  mode,
}: Props) {
  const _isEdit = mode === "edit";

  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>(
    existingData?.zoneId ?? "",
  );
  const [loadingZones, setLoadingZones] = useState(false);

  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>(
    existingData?.regionId ?? "",
  );
  const [loadingRegions, setLoadingRegions] = useState(false);

  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>(
    existingData?.areaId ?? "",
  );
  const [loadingAreas, setLoadingAreas] = useState(false);

  const [stations, setStations] = useState<
    { stationId: string; stationName: string; hqId: string; hqName: string }[]
  >([]);
  const [selectedStationId, setSelectedStationId] = useState<string>(
    existingData?.stationId ?? "",
  );
  const [loadingStations, setLoadingStations] = useState(false);

  const [territories, setTerritories] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState<string[]>(
    existingData?.territoryIds ?? [],
  );
  const [loadingTerritories, setLoadingTerritories] = useState(false);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is an intentional re-fetch trigger
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    // Reset data arrays
    setZones([]);
    setRegions([]);
    setAreas([]);
    setStations([]);
    setTerritories([]);

    // Reset selections from existingData (empty for create, pre-filled for edit)
    setSelectedZone(existingData?.zoneId ?? "");
    setSelectedRegion(existingData?.regionId ?? "");
    setSelectedArea(existingData?.areaId ?? "");
    setSelectedStationId(existingData?.stationId ?? "");
    setSelectedTerritoryIds(existingData?.territoryIds ?? []);

    setLoadingZones(true);
    async function loadZones() {
      try {
        const res = await api.listActiveZones(token);
        if (cancelled) return;
        if (Array.isArray(res)) {
          setZones(
            res.map((z: { id: unknown; name: string }) => ({
              id: String(z.id),
              name: z.name,
            })),
          );
        } else if (res && "ok" in res) {
          const list = (res as { ok: Array<{ id: unknown; name: string }> }).ok;
          setZones(list.map((z) => ({ id: String(z.id), name: z.name })));
        }
      } catch (err) {
        console.error("[LocationAllotment] Zone fetch failed:", err);
      } finally {
        if (!cancelled) setLoadingZones(false);
      }
    }
    loadZones();
    return () => {
      cancelled = true;
    };
  }, [token, refreshKey]);

  useEffect(() => {
    if (!token || !selectedZone) {
      setRegions([]);
      return;
    }
    let cancelled = false;
    setLoadingRegions(true);
    setRegions([]);
    async function loadRegions() {
      try {
        const res = await api.listActiveStatesByZone(
          token,
          BigInt(selectedZone),
        );
        if (cancelled) return;
        // backend returns plain StateRecord[] array directly
        const list = Array.isArray(res)
          ? (res as Array<{ id: unknown; name: string }>)
          : res && "ok" in res
            ? (res as { ok: Array<{ id: unknown; name: string }> }).ok
            : [];
        setRegions(list.map((r) => ({ id: String(r.id), name: r.name })));
      } catch (err) {
        console.error("[LocationAllotment] Region fetch failed:", err);
      } finally {
        if (!cancelled) setLoadingRegions(false);
      }
    }
    loadRegions();
    return () => {
      cancelled = true;
    };
  }, [token, selectedZone]);

  useEffect(() => {
    if (!token || !selectedRegion) {
      setAreas([]);
      return;
    }
    let cancelled = false;
    setLoadingAreas(true);
    setAreas([]);
    async function loadAreas() {
      try {
        const res = await api.listActiveTerritories(
          token,
          BigInt(selectedRegion),
        );
        if (cancelled) return;
        // backend returns plain TerritoryRecord[] array directly
        const list = Array.isArray(res)
          ? (res as Array<{ id: unknown; name: string }>)
          : res && "ok" in res
            ? (res as { ok: Array<{ id: unknown; name: string }> }).ok
            : [];
        setAreas(list.map((a) => ({ id: String(a.id), name: a.name })));
      } catch (err) {
        console.error("[LocationAllotment] Area fetch failed:", err);
      } finally {
        if (!cancelled) setLoadingAreas(false);
      }
    }
    loadAreas();
    return () => {
      cancelled = true;
    };
  }, [token, selectedRegion]);

  useEffect(() => {
    if (!token || !selectedArea) {
      setStations([]);
      return;
    }
    let cancelled = false;
    setLoadingStations(true);
    setStations([]);
    async function loadStations() {
      try {
        const res = await api.listActiveHQsByTerritory(
          token,
          BigInt(selectedArea),
        );
        if (cancelled) return;
        const areaName =
          areas.find((a) => a.id === selectedArea)?.name ?? "Unknown Area";
        const rawList = Array.isArray(res)
          ? (res as Array<{ id: unknown; name: string; isActive?: boolean }>)
          : res && "ok" in res
            ? (
                res as {
                  ok: Array<{ id: unknown; name: string; isActive?: boolean }>;
                }
              ).ok
            : [];
        const opts = rawList
          .filter((s) => s.isActive !== false)
          .map((s) => ({
            stationId: String(s.id ?? ""),
            stationName: String(s.name ?? ""),
            hqId: selectedArea,
            hqName: areaName,
          }))
          .sort((a, b) => a.stationName.localeCompare(b.stationName));
        if (!cancelled) setStations(opts);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoadingStations(false);
      }
    }
    loadStations();
    return () => {
      cancelled = true;
    };
  }, [token, selectedArea, areas]);

  useEffect(() => {
    if (!token || !selectedStationId) {
      setTerritories([]);
      return;
    }
    let cancelled = false;
    setLoadingTerritories(true);
    setTerritories([]);
    async function loadTerritories() {
      try {
        const recs = await api.getTerritoriesByStation(
          token,
          selectedStationId,
        );
        if (cancelled) return;
        const rawRecs = Array.isArray(recs)
          ? (recs as Array<{ id: unknown; name: string; isActive?: boolean }>)
          : [];
        const list = rawRecs
          .filter((r) => r.isActive !== false)
          .map((r) => ({
            id: String(r.id ?? ""),
            name: String(r.name ?? ""),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) setTerritories(list);
      } catch {
        if (!cancelled) setTerritories([]);
      } finally {
        if (!cancelled) setLoadingTerritories(false);
      }
    }
    loadTerritories();
    return () => {
      cancelled = true;
    };
  }, [token, selectedStationId]);

  // Notify parent of changes
  useEffect(() => {
    const station = stations.find((s) => s.stationId === selectedStationId);
    onChangeRef.current({
      zoneId: selectedZone,
      zoneIdBI: selectedZone ? BigInt(selectedZone) : undefined,
      regionId: selectedRegion,
      regionIdBI: selectedRegion ? BigInt(selectedRegion) : undefined,
      areaId: selectedArea,
      areaIdBI: selectedArea ? BigInt(selectedArea) : undefined,
      stationIds: selectedStationId ? [selectedStationId] : [],
      stationId: selectedStationId,
      stationIdBI: station?.stationId ? BigInt(station.stationId) : undefined,
      stationName: station?.stationName ?? "",
      territoryIds: selectedTerritoryIds,
      territoryIdsBI: selectedTerritoryIds.map(BigInt),
      isValid: !!selectedStationId && selectedTerritoryIds.length > 0,
    });
  }, [
    selectedZone,
    selectedRegion,
    selectedArea,
    selectedStationId,
    selectedTerritoryIds,
    stations,
  ]);

  return (
    <div className="space-y-3">
      {/* Zone */}
      <div>
        <FieldLabel label="Zone" required />
        {loadingZones ? (
          <p className="text-sm text-muted-foreground py-2">Loading zones…</p>
        ) : zones.length === 0 ? (
          <p className="text-sm text-amber-700 border border-amber-200 rounded-md px-3 py-2 bg-amber-50">
            No zones available. Please add zones in Territory Master first.
          </p>
        ) : (
          <select
            value={selectedZone}
            onChange={(e) => {
              setSelectedZone(e.target.value);
              setSelectedRegion("");
              setSelectedArea("");
              setSelectedStationId("");
              setSelectedTerritoryIds([]);
            }}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
          >
            <option value="">Select Zone</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Region */}
      <div>
        <FieldLabel label="Region" required />
        {loadingRegions ? (
          <p className="text-sm text-muted-foreground py-2">Loading regions…</p>
        ) : !selectedZone ? (
          <p className="text-sm text-muted-foreground border border-input rounded-md px-3 py-2 bg-muted">
            Select a Zone first
          </p>
        ) : regions.length === 0 ? (
          <p className="text-sm text-amber-700 border border-amber-200 rounded-md px-3 py-2 bg-amber-50">
            No regions available for this zone.
          </p>
        ) : (
          <select
            value={selectedRegion}
            onChange={(e) => {
              setSelectedRegion(e.target.value);
              setSelectedArea("");
              setSelectedStationId("");
              setSelectedTerritoryIds([]);
            }}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
          >
            <option value="">Select Region</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Area */}
      <div>
        <FieldLabel label="Area" required />
        {loadingAreas ? (
          <p className="text-sm text-muted-foreground py-2">Loading areas…</p>
        ) : !selectedRegion ? (
          <p className="text-sm text-muted-foreground border border-input rounded-md px-3 py-2 bg-muted">
            Select a Region first
          </p>
        ) : areas.length === 0 ? (
          <p className="text-sm text-amber-700 border border-amber-200 rounded-md px-3 py-2 bg-amber-50">
            No areas available for this region.
          </p>
        ) : (
          <select
            value={selectedArea}
            onChange={(e) => {
              setSelectedArea(e.target.value);
              setSelectedStationId("");
              setSelectedTerritoryIds([]);
            }}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
          >
            <option value="">Select Area</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Station */}
      <div>
        <FieldLabel label="Station (HQ)" required />
        {loadingStations ? (
          <p className="text-sm text-muted-foreground py-2">
            Loading stations…
          </p>
        ) : !selectedArea ? (
          <p className="text-sm text-muted-foreground border border-input rounded-md px-3 py-2 bg-muted">
            Select an Area first
          </p>
        ) : stations.length === 0 ? (
          <p className="text-sm text-amber-700 border border-amber-200 rounded-md px-3 py-2 bg-amber-50">
            No stations available for this area. Please add stations in
            Territory Master first.
          </p>
        ) : (
          <select
            value={selectedStationId}
            onChange={(e) => {
              setSelectedStationId(e.target.value);
              setSelectedTerritoryIds([]);
            }}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
          >
            <option value="">Select Station</option>
            {stations.map((s) => (
              <option key={s.stationId} value={s.stationId}>
                {s.stationName}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Territory */}
      <div>
        <FieldLabel label="Territory" required />
        {selectedTerritoryIds.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {selectedTerritoryIds.map((tid) => {
              const t = territories.find((t) => t.id === tid);
              return (
                <span
                  key={tid}
                  className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full"
                >
                  {t?.name ?? tid}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTerritoryIds((prev) =>
                        prev.filter((id) => id !== tid),
                      );
                    }}
                    className="text-primary/70 hover:text-primary ml-0.5 leading-none"
                    aria-label={`Remove ${t?.name}`}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
        {loadingTerritories ? (
          <p className="text-sm text-muted-foreground py-2">
            Loading territories…
          </p>
        ) : !selectedStationId ? (
          <p className="text-sm text-muted-foreground border border-input rounded-md px-3 py-2 bg-muted">
            Select a Station first
          </p>
        ) : territories.length === 0 ? (
          <p className="text-sm text-amber-700 border border-amber-200 rounded-md px-3 py-2 bg-amber-50">
            No territories found under this station. Please add territories in
            Territory Master first.
          </p>
        ) : (
          <div className="border border-input rounded-md bg-background max-h-32 overflow-y-auto p-1.5 space-y-0.5">
            {territories.map((t) => {
              const tid = t.id;
              const checked = selectedTerritoryIds.includes(tid);
              return (
                <label
                  key={tid}
                  className="flex items-center gap-2 text-sm cursor-pointer px-1 py-0.5 rounded hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedTerritoryIds((prev) =>
                        prev.includes(tid)
                          ? prev.filter((id) => id !== tid)
                          : [...prev, tid],
                      );
                    }}
                    className="rounded border-input text-primary focus:ring-ring"
                  />
                  <span
                    className={
                      checked ? "text-primary font-medium" : "text-foreground"
                    }
                  >
                    {t.name}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
