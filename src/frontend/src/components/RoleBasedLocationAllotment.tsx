import { MapPin, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AreaRecord,
  HQRecord,
  StateRecord,
  TerritoryRecord,
  UserInfo,
  ZoneRecord,
} from "../backend.d";
import { api } from "../lib/api";

export interface RoleLocationState {
  zoneId?: bigint;
  zoneName?: string;
  regionId?: bigint;
  regionName?: string;
  areaId?: bigint;
  areaName?: string;
  stationId?: bigint;
  stationName?: string;
  territoryIds: bigint[];
  isValid: boolean;
}

interface Props {
  role: string;
  reportingManagerId?: string;
  token: string;
  refreshKey: number;
  onChange: (state: RoleLocationState) => void;
  initialValues?: Partial<RoleLocationState>;
}

const ROLES_NO_ALLOTMENT = ["Admin", "HR", "HRManager"];

function AutoBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white">
      <MapPin className="h-3 w-3" />
      {label}: {value}
      <span className="ml-1 text-blue-200 text-[10px]">
        (auto-assigned from Reporting Manager)
      </span>
    </span>
  );
}

function TerritoryChip({
  name,
  onRemove,
}: {
  name: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
      {name}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 transition-colors"
        aria-label={`Remove territory ${name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function RoleBasedLocationAllotment({
  role,
  reportingManagerId,
  token,
  refreshKey,
  onChange,
  initialValues,
}: Props) {
  // Skip rendering for Admin / HR roles
  if (ROLES_NO_ALLOTMENT.includes(role)) return null;

  return (
    <LocationAllotmentInner
      role={role}
      reportingManagerId={reportingManagerId}
      token={token}
      refreshKey={refreshKey}
      onChange={onChange}
      initialValues={initialValues}
    />
  );
}

// Inner component — always mounted so hooks run unconditionally
function LocationAllotmentInner({
  role,
  reportingManagerId,
  token,
  refreshKey,
  onChange,
  initialValues,
}: Props) {
  // ── Separate state variables for each level ──────────────────────────────
  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [regions, setRegions] = useState<StateRecord[]>([]);
  const [areas, setAreas] = useState<TerritoryRecord[]>([]);
  const [stations, setStations] = useState<HQRecord[]>([]);
  const [territories, setTerritories] = useState<AreaRecord[]>([]);

  // ── Auto-populated parent IDs (from reporting manager) ───────────────────
  const [autoZoneId, setAutoZoneId] = useState<bigint | undefined>();
  const [autoZoneName, setAutoZoneName] = useState<string>("");
  const [autoRegionId, setAutoRegionId] = useState<bigint | undefined>();
  const [autoRegionName, setAutoRegionName] = useState<string>("");
  const [autoAreaId, setAutoAreaId] = useState<bigint | undefined>();
  const [autoAreaName, setAutoAreaName] = useState<string>("");

  // ── Selected values ───────────────────────────────────────────────────────
  const [selectedZoneId, setSelectedZoneId] = useState<bigint | undefined>(
    initialValues?.zoneId,
  );
  const [selectedRegionId, setSelectedRegionId] = useState<bigint | undefined>(
    initialValues?.regionId,
  );
  const [selectedAreaId, setSelectedAreaId] = useState<bigint | undefined>(
    initialValues?.areaId,
  );
  const [selectedStationId, setSelectedStationId] = useState<
    bigint | undefined
  >(initialValues?.stationId);
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState<bigint[]>(
    initialValues?.territoryIds ?? [],
  );

  // ── Loading flags ─────────────────────────────────────────────────────────
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingStations, setLoadingStations] = useState(false);
  const [loadingTerritories, setLoadingTerritories] = useState(false);
  const [loadingManager, setLoadingManager] = useState(false);

  const prevRole = useRef(role);
  const prevManagerId = useRef(reportingManagerId);

  // ── Reset all selections and lists ───────────────────────────────────────
  const resetAll = useCallback(() => {
    setZones([]);
    setRegions([]);
    setAreas([]);
    setStations([]);
    setTerritories([]);
    setAutoZoneId(undefined);
    setAutoZoneName("");
    setAutoRegionId(undefined);
    setAutoRegionName("");
    setAutoAreaId(undefined);
    setAutoAreaName("");
    setSelectedZoneId(undefined);
    setSelectedRegionId(undefined);
    setSelectedAreaId(undefined);
    setSelectedStationId(undefined);
    setSelectedTerritoryIds([]);
  }, []);

  // ── Helper: find name from a list ─────────────────────────────────────────
  const findZoneName = (id: bigint, list: ZoneRecord[]) =>
    list.find((z) => z.id === id)?.name ?? "";
  const findRegionName = (id: bigint, list: StateRecord[]) =>
    list.find((r) => r.id === id)?.name ?? "";
  const findAreaName = (id: bigint, list: TerritoryRecord[]) =>
    list.find((a) => a.id === id)?.name ?? "";
  const findStationName = (id: bigint, list: HQRecord[]) =>
    list.find((s) => s.id === id)?.name ?? "";
  const findTerritoryName = (id: bigint, list: AreaRecord[]) =>
    list.find((t) => t.id === id)?.name ?? "";

  // ── Fetch zones (ZSM) ────────────────────────────────────────────────────
  const fetchZones = useCallback(async () => {
    setLoadingZones(true);
    try {
      const result = await api.listActiveZones(token);
      setZones(result);
      // Pre-populate if initialValues provided
      if (initialValues?.zoneId) {
        setSelectedZoneId(initialValues.zoneId);
      }
    } catch {
      setZones([]);
    } finally {
      setLoadingZones(false);
    }
  }, [token, initialValues?.zoneId]);

  // ── Fetch manager and derive parent ids ──────────────────────────────────
  const fetchManager = useCallback(
    async (managerId: string): Promise<UserInfo | null> => {
      setLoadingManager(true);
      try {
        const result = await api.getUserByEmployeeId(token, managerId);
        return result ?? null;
      } catch {
        return null;
      } finally {
        setLoadingManager(false);
      }
    },
    [token],
  );

  // ── RSM: fetch zone from manager, load regions ────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable helper fns
  const setupRSM = useCallback(
    async (managerId: string) => {
      const manager = await fetchManager(managerId);
      if (!manager) return;
      const zId = manager.zoneIds?.[0];
      if (!zId) return;
      setAutoZoneId(zId);
      // Get zone name — fetch all zones
      setLoadingZones(true);
      try {
        const zoneList = await api.listActiveZones(token);
        setZones(zoneList);
        setAutoZoneName(findZoneName(zId, zoneList));
      } finally {
        setLoadingZones(false);
      }
      // Load regions under this zone
      setLoadingRegions(true);
      try {
        const regionList = await api.listActiveStatesByZone(token, zId);
        setRegions(regionList);
        if (initialValues?.regionId) {
          setSelectedRegionId(initialValues.regionId);
        }
      } catch {
        setRegions([]);
      } finally {
        setLoadingRegions(false);
      }
    },
    [fetchManager, token, initialValues?.regionId],
  );

  // ── ASM: fetch region (StateRecord) from manager, load stations (TerritoryRecord) ───
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable helper fns
  const setupASM = useCallback(
    async (managerId: string) => {
      const manager = await fetchManager(managerId);
      if (!manager) return;
      // Manager is RSM whose region is a StateRecord — stored in stateIds
      const rId = manager.stateIds?.[0];
      if (!rId) return;
      setAutoRegionId(rId);
      setLoadingRegions(true);
      try {
        const allRegions = await api.listActiveStatesByZone(
          token,
          manager.zoneIds?.[0] ?? BigInt(0),
        );
        setAutoRegionName(findRegionName(rId, allRegions));
      } catch {
        /* ignore */
      } finally {
        setLoadingRegions(false);
      }
      // ASM selects Station (HQ) — TerritoryRecord — under their parent Area (StateRecord)
      setLoadingAreas(true);
      try {
        const res = await api.listActiveTerritories(token, rId);
        const stationList = Array.isArray(res)
          ? res
          : ((res as unknown as { ok: TerritoryRecord[] })?.ok ?? []);
        setAreas(stationList);
        if (initialValues?.areaId) {
          setSelectedAreaId(initialValues.areaId);
        }
      } catch {
        setAreas([]);
      } finally {
        setLoadingAreas(false);
      }
    },
    [fetchManager, token, initialValues?.areaId],
  );

  // ── MR: fetch area (TerritoryRecord) from ASM manager, load HQ stations (HQRecord) ──
  const fetchTerritoriesForStation = useCallback(
    async (sId: bigint) => {
      // Always clear and re-fetch fresh from backend — never use stale state
      setTerritories([]);
      setLoadingTerritories(true);
      try {
        const terrRes = await api.getTerritoriesByStation(token, sId);
        const terrList: AreaRecord[] = Array.isArray(terrRes)
          ? terrRes
          : ((terrRes as unknown as { ok: AreaRecord[] })?.ok ?? []);
        setTerritories(terrList);
        return terrList;
      } catch {
        setTerritories([]);
        return [];
      } finally {
        setLoadingTerritories(false);
      }
    },
    [token],
  );

  const setupMR = useCallback(
    async (managerId: string) => {
      const manager = await fetchManager(managerId);
      if (!manager) return;
      // Manager is ASM whose HQ is a TerritoryRecord — stored in hqIds
      const aId = manager.hqIds?.[0];
      if (!aId) return;
      setAutoAreaId(aId);
      // Get area name from TerritoryRecord list under parent State
      setLoadingAreas(true);
      try {
        const res = await api.listActiveTerritories(
          token,
          manager.stateIds?.[0] ?? BigInt(0),
        );
        const areaList = Array.isArray(res)
          ? res
          : ((res as unknown as { ok: TerritoryRecord[] })?.ok ?? []);
        const areaRec = areaList.find((t) => t.id === aId);
        setAutoAreaName(areaRec?.name ?? "");
      } catch {
        /* ignore */
      } finally {
        setLoadingAreas(false);
      }
      // Load HQ stations under this area using listActiveHQsByTerritory
      setLoadingStations(true);
      try {
        const res = await api.listActiveHQsByTerritory(token, aId);
        const hqList: HQRecord[] = Array.isArray(res)
          ? res
          : ((res as unknown as { ok: HQRecord[] })?.ok ?? []);
        setStations(hqList);
        if (initialValues?.stationId) {
          setSelectedStationId(initialValues.stationId);
          // Always re-fetch territories fresh for the pre-populated station
          await fetchTerritoriesForStation(initialValues.stationId);
          if (initialValues?.territoryIds?.length) {
            setSelectedTerritoryIds(initialValues.territoryIds);
          }
        }
      } catch {
        setStations([]);
      } finally {
        setLoadingStations(false);
      }
    },
    [
      fetchManager,
      fetchTerritoriesForStation,
      token,
      initialValues?.stationId,
      initialValues?.territoryIds,
    ],
  );

  // ── Effect: re-run when role, refreshKey, or managerId changes ───────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional refresh trigger
  useEffect(() => {
    const roleChanged = prevRole.current !== role;
    const managerChanged = prevManagerId.current !== reportingManagerId;
    prevRole.current = role;
    prevManagerId.current = reportingManagerId;

    if (roleChanged) resetAll();

    if (role === "ZSM") {
      fetchZones();
    } else if (role === "RSM" && reportingManagerId) {
      if (roleChanged || managerChanged) {
        setRegions([]);
        setSelectedRegionId(undefined);
      }
      setupRSM(reportingManagerId);
    } else if (role === "ASM" && reportingManagerId) {
      if (roleChanged || managerChanged) {
        setAreas([]);
        setSelectedAreaId(undefined);
      }
      setupASM(reportingManagerId);
    } else if (role === "MR" && reportingManagerId) {
      // Always clear territory list on every mount/refresh so stale data
      // from a previous form open is never shown
      setTerritories([]);
      if (roleChanged || managerChanged) {
        setStations([]);
        setSelectedStationId(undefined);
        setSelectedTerritoryIds([]);
      }
      setupMR(reportingManagerId);
    }
  }, [role, reportingManagerId, refreshKey]);

  // ── ZSM: handle zone selection ───────────────────────────────────────────
  const handleZoneChange = (zoneIdStr: string) => {
    const zId = zoneIdStr ? BigInt(zoneIdStr) : undefined;
    const zName = zId ? findZoneName(zId, zones) : "";
    setSelectedZoneId(zId);
    onChange({
      zoneId: zId,
      zoneName: zName,
      territoryIds: [],
      isValid: !!zId,
    });
  };

  // ── RSM: handle region selection ─────────────────────────────────────────
  const handleRegionChange = (regionIdStr: string) => {
    const rId = regionIdStr ? BigInt(regionIdStr) : undefined;
    const rName = rId ? findRegionName(rId, regions) : "";
    setSelectedRegionId(rId);
    onChange({
      zoneId: autoZoneId,
      zoneName: autoZoneName,
      regionId: rId,
      regionName: rName,
      territoryIds: [],
      isValid: !!rId,
    });
  };

  // ── ASM: handle area selection ───────────────────────────────────────────
  const handleAreaChange = (areaIdStr: string) => {
    const aId = areaIdStr ? BigInt(areaIdStr) : undefined;
    const aName = aId ? findAreaName(aId, areas) : "";
    setSelectedAreaId(aId);
    onChange({
      regionId: autoRegionId,
      regionName: autoRegionName,
      areaId: aId,
      areaName: aName,
      territoryIds: [],
      isValid: !!aId,
    });
  };

  // ── MR: handle station selection ─────────────────────────────────────────
  // Always re-fetch territories from backend, even if the same station is re-selected
  const handleStationChange = async (stationIdStr: string) => {
    const sId = stationIdStr ? BigInt(stationIdStr) : undefined;
    const sName = sId ? findStationName(sId, stations) : "";
    setSelectedStationId(sId);
    setSelectedTerritoryIds([]);
    // Always clear and re-fetch fresh — do not rely on previously cached territories
    if (sId) {
      await fetchTerritoriesForStation(sId);
    } else {
      setTerritories([]);
    }
    onChange({
      areaId: autoAreaId,
      areaName: autoAreaName,
      stationId: sId,
      stationName: sName,
      territoryIds: [],
      isValid: false, // need territories too
    });
  };

  // ── MR: handle territory multi-select ────────────────────────────────────
  const handleTerritoryAdd = (terrIdStr: string) => {
    if (!terrIdStr) return;
    const tId = BigInt(terrIdStr);
    if (selectedTerritoryIds.includes(tId)) return;
    const newIds = [...selectedTerritoryIds, tId];
    setSelectedTerritoryIds(newIds);
    emitMRChange(newIds);
  };

  const handleTerritoryRemove = (tId: bigint) => {
    const newIds = selectedTerritoryIds.filter((id) => id !== tId);
    setSelectedTerritoryIds(newIds);
    emitMRChange(newIds);
  };

  const emitMRChange = (tIds: bigint[]) => {
    onChange({
      areaId: autoAreaId,
      areaName: autoAreaName,
      stationId: selectedStationId,
      stationName: selectedStationId
        ? findStationName(selectedStationId, stations)
        : undefined,
      territoryIds: tIds,
      isValid: !!selectedStationId && tIds.length > 0,
    });
  };

  // ── Shared select classes ─────────────────────────────────────────────────
  const selectCls =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50";

  // ── ZSM render ───────────────────────────────────────────────────────────
  const renderZSM = () => (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="zone-select"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Zone (HQ) <span className="text-red-500">*</span>
        </label>
        <select
          id="zone-select"
          className={selectCls}
          value={selectedZoneId?.toString() ?? ""}
          onChange={(e) => handleZoneChange(e.target.value)}
          data-ocid="location_allotment.zone_select"
          disabled={loadingZones}
        >
          <option value="">
            {loadingZones
              ? "Loading..."
              : zones.length === 0
                ? "No Zones available. Please add in Location Master."
                : "Select Zone (HQ)"}
          </option>
          {zones.map((z) => (
            <option key={z.id.toString()} value={z.id.toString()}>
              {z.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  // ── RSM render ───────────────────────────────────────────────────────────
  const renderRSM = () => (
    <div className="space-y-3">
      {(autoZoneId || loadingManager) && (
        <div>
          {loadingManager ? (
            <span className="text-sm text-muted-foreground">
              Loading manager hierarchy...
            </span>
          ) : (
            <AutoBadge
              label="Zone (auto-from manager)"
              value={autoZoneName || autoZoneId?.toString() || ""}
            />
          )}
        </div>
      )}
      <div>
        <label
          htmlFor="region-select"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Region (HQ) <span className="text-red-500">*</span>
        </label>
        <select
          id="region-select"
          className={selectCls}
          value={selectedRegionId?.toString() ?? ""}
          onChange={(e) => handleRegionChange(e.target.value)}
          data-ocid="location_allotment.region_select"
          disabled={loadingRegions || !autoZoneId}
        >
          <option value="">
            {loadingRegions
              ? "Loading..."
              : !autoZoneId
                ? "Select a Zone first"
                : regions.length === 0
                  ? "No Regions available. Please add in Location Master."
                  : "Select Region (HQ)"}
          </option>
          {regions.map((r) => (
            <option key={r.id.toString()} value={r.id.toString()}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  // ── ASM render ───────────────────────────────────────────────────────────
  const renderASM = () => (
    <div className="space-y-3">
      {(autoRegionId || loadingManager) && (
        <div>
          {loadingManager ? (
            <span className="text-sm text-muted-foreground">
              Loading manager hierarchy...
            </span>
          ) : (
            <AutoBadge
              label="Region (auto-from manager)"
              value={autoRegionName || autoRegionId?.toString() || ""}
            />
          )}
        </div>
      )}
      <div>
        <label
          htmlFor="area-select"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Area (HQ) <span className="text-red-500">*</span>
        </label>
        <select
          id="area-select"
          className={selectCls}
          value={selectedAreaId?.toString() ?? ""}
          onChange={(e) => handleAreaChange(e.target.value)}
          data-ocid="location_allotment.area_select"
          disabled={loadingAreas || !autoRegionId}
        >
          <option value="">
            {loadingAreas
              ? "Loading..."
              : !autoRegionId
                ? "Select a Region first"
                : areas.length === 0
                  ? "No Areas available. Please add in Location Master."
                  : "Select Area (HQ)"}
          </option>
          {areas.map((a) => (
            <option key={a.id.toString()} value={a.id.toString()}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  // ── MR render ────────────────────────────────────────────────────────────
  const unselectedTerritories = territories.filter(
    (t) => !selectedTerritoryIds.includes(t.id),
  );

  const renderMR = () => (
    <div className="space-y-3">
      {(autoAreaId || loadingManager) && (
        <div>
          {loadingManager ? (
            <span className="text-sm text-muted-foreground">
              Loading manager hierarchy...
            </span>
          ) : (
            <AutoBadge
              label="Station (HQ)"
              value={autoAreaName || autoAreaId?.toString() || ""}
            />
          )}
        </div>
      )}
      {/* HQ / Station (HQRecord under the assigned TerritoryRecord) */}
      <div>
        <label
          htmlFor="station-select"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          HQ / Station <span className="text-red-500">*</span>
        </label>
        <select
          id="station-select"
          className={selectCls}
          value={selectedStationId?.toString() ?? ""}
          onChange={(e) => handleStationChange(e.target.value)}
          data-ocid="location_allotment.station_select"
          disabled={loadingStations || !autoAreaId}
        >
          <option value="">
            {loadingStations
              ? "Loading..."
              : !autoAreaId
                ? "Select a Station first"
                : stations.length === 0
                  ? "No HQ/stations available. Please add in Location Master."
                  : "Select HQ / Station"}
          </option>
          {stations.map((s) => (
            <option key={s.id.toString()} value={s.id.toString()}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {/* Territory multi-select */}
      <div>
        <label
          htmlFor="territory-select"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Territory <span className="text-red-500">*</span>
        </label>
        {/* Selected chips */}
        {selectedTerritoryIds.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {selectedTerritoryIds.map((tId) => (
              <TerritoryChip
                key={tId.toString()}
                name={findTerritoryName(tId, territories) || tId.toString()}
                onRemove={() => handleTerritoryRemove(tId)}
              />
            ))}
          </div>
        )}
        <select
          id="territory-select"
          className={selectCls}
          value=""
          onChange={(e) => handleTerritoryAdd(e.target.value)}
          data-ocid="location_allotment.territory_select"
          disabled={loadingTerritories || !selectedStationId}
        >
          <option value="">
            {loadingTerritories
              ? "Loading..."
              : !selectedStationId
                ? "Select a Station first"
                : unselectedTerritories.length === 0 && territories.length === 0
                  ? "No territories found under this station. Please add in Location Master."
                  : unselectedTerritories.length === 0
                    ? "All territories selected"
                    : "Add Territory"}
          </option>
          {unselectedTerritories.map((t) => (
            <option key={t.id.toString()} value={t.id.toString()}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (role) {
      case "ZSM":
        return renderZSM();
      case "RSM":
        return renderRSM();
      case "ASM":
        return renderASM();
      case "MR":
        return renderMR();
      default:
        return null;
    }
  };

  const content = renderContent();
  if (!content) return null;

  return (
    <div
      className="rounded-lg border border-border bg-card p-4"
      data-ocid="location_allotment.section"
    >
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Location Allotment
        </h3>
      </div>
      <div className="mb-3 border-t border-border" />
      {content}
    </div>
  );
}
