/**
 * MRLocationAllotment
 * Simplified Location Allotment for MR role: Station (single-select) + Territory (multi-select chips)
 */
import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { HQRecord } from "../backend.d";
import { api } from "../lib/api";

interface StationOption {
  stationId: string;
  stationName: string;
  hqId: string;
  hqName: string;
  label: string;
}

interface TerritoryOption {
  id: string;
  name: string;
}

export interface MRLocationAllotmentProps {
  stationId: string;
  territoryIds: string[];
  onStationChange: (stationId: string, hqId: string) => void;
  onTerritoriesChange: (territoryIds: string[]) => void;
  token: string;
  refreshKey?: number;
  initialZone?: string;
  initialRegion?: string;
  initialArea?: string;
}

export function MRLocationAllotment({
  stationId,
  territoryIds,
  onStationChange,
  onTerritoriesChange,
  token,
  refreshKey = 0,
  initialZone,
  initialRegion,
  initialArea,
}: MRLocationAllotmentProps) {
  const [stations, setStations] = useState<StationOption[]>([]);
  const [territories, setTerritories] = useState<TerritoryOption[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [loadingTerritories, setLoadingTerritories] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>(initialZone ?? "");
  const [loadingZones, setLoadingZones] = useState(false);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>(
    initialRegion ?? "",
  );
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>(initialArea ?? "");
  const [loadingAreas, setLoadingAreas] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    if (refreshKey !== undefined) {
      setSelectedZone("");
      setSelectedRegion("");
      setSelectedArea("");
    }
    setLoadingZones(true);
    setZones([]);
    async function loadZones() {
      try {
        // listActiveZones returns ZoneRecord[] (raw array)
        const res = await api.listActiveZones(token);
        if (cancelled) return;
        const list = Array.isArray(res)
          ? (res as Array<{ id: unknown; name: string }>)
          : res && "ok" in res
            ? (res as { ok: Array<{ id: unknown; name: string }> }).ok
            : [];
        setZones(list.map((z) => ({ id: String(z.id), name: z.name })));
      } catch (err) {
        console.error("[MRLocationAllotment] Zone fetch failed:", err);
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
        console.error("[MRLocationAllotment] Region fetch failed:", err);
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
        console.error("[MRLocationAllotment] Area fetch failed:", err);
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
        // listActiveHQsByTerritory returns HQRecord[] where HQRecord has { id, name, territoryId, isActive }
        const res = await api.listActiveHQsByTerritory(
          token,
          BigInt(selectedArea),
        );
        if (cancelled) return;
        const rawList = Array.isArray(res)
          ? (res as Array<{ id: unknown; name: string; isActive?: boolean }>)
          : res && "ok" in res
            ? (
                res as {
                  ok: Array<{ id: unknown; name: string; isActive?: boolean }>;
                }
              ).ok
            : [];
        const areaName =
          areas.find((a) => a.id === selectedArea)?.name ?? "Unknown Area";
        const opts: StationOption[] = rawList
          .filter((s) => s.isActive !== false)
          .map((s) => ({
            stationId: String(s.id ?? ""),
            stationName: String(s.name ?? ""),
            hqId: selectedArea,
            hqName: areaName,
            label: `${areaName} — ${s.name ?? ""}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
        if (!cancelled) setStations(opts);
      } catch (err) {
        console.error("[MRLocationAllotment] Station fetch failed:", err);
      } finally {
        if (!cancelled) setLoadingStations(false);
      }
    }
    loadStations();
    return () => {
      cancelled = true;
    };
  }, [token, selectedArea, areas]);

  // Track the previous stationId to detect re-selection of the same station
  const prevStationIdRef = useRef<string>(stationId);

  // ── Fetch territories whenever stationId or token changes, OR on every
  //    component mount (refreshKey change) so stale data is never displayed
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey forces re-fetch on remount
  useEffect(() => {
    // Always clear first — never show data from a previous station selection
    setTerritories([]);
    prevStationIdRef.current = stationId;

    if (!stationId || !token) {
      return;
    }
    let cancelled = false;
    setLoadingTerritories(true);
    (async () => {
      try {
        // getTerritoriesByStation returns AreaRecord[] (the actual SFA Territories under a Station)
        const recs = await api.getTerritoriesByStation(token, stationId);
        if (cancelled) return;
        const rawList = Array.isArray(recs)
          ? (recs as Array<{ id: unknown; name: string; isActive?: boolean }>)
          : [];
        const terrs: TerritoryOption[] = rawList
          .filter((r) => r.isActive !== false)
          .map((r) => ({
            id: String(r.id ?? ""),
            name: String(r.name ?? ""),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) setTerritories(terrs);
      } catch (err) {
        console.error("[MRLocationAllotment] Territory fetch failed:", err);
        if (!cancelled) setTerritories([]);
      } finally {
        if (!cancelled) setLoadingTerritories(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // refreshKey included so that parent can force a re-fetch by incrementing it
  }, [stationId, token, refreshKey]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleTerritory(id: string) {
    if (territoryIds.includes(id)) {
      onTerritoriesChange(territoryIds.filter((t) => t !== id));
    } else {
      onTerritoriesChange([...territoryIds, id]);
    }
  }

  function removeTerritory(id: string) {
    onTerritoriesChange(territoryIds.filter((t) => t !== id));
  }

  const selectedStation = stations.find((s) => s.stationId === stationId);
  const selectedTerritories = territories.filter((t) =>
    territoryIds.includes(t.id),
  );
  const isDisabled = !stationId;

  return (
    <div className="space-y-4 col-span-2">
      {/* Zone */}
      <div>
        <label
          htmlFor="mr-zone-select"
          className="block text-xs font-display uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5"
        >
          <MapPin className="w-3 h-3" /> Zone{" "}
          <span className="text-destructive">*</span>
        </label>
        {loadingZones ? (
          <p className="text-sm text-muted-foreground py-2">Loading zones…</p>
        ) : zones.length === 0 ? (
          <p className="text-sm text-amber-700 border border-amber-200 rounded-md px-3 py-2 bg-amber-50">
            No zones available. Please add zones in Territory Master first.
          </p>
        ) : (
          <select
            id="mr-zone-select"
            value={selectedZone}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedZone(newId);
              setSelectedRegion("");
              setSelectedArea("");
              onStationChange("", "");
              onTerritoriesChange([]);
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
        <label
          htmlFor="mr-region-select"
          className="block text-xs font-display uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5"
        >
          <MapPin className="w-3 h-3" /> Region{" "}
          <span className="text-destructive">*</span>
        </label>
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
            id="mr-region-select"
            value={selectedRegion}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedRegion(newId);
              setSelectedArea("");
              onStationChange("", "");
              onTerritoriesChange([]);
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
        <label
          htmlFor="mr-area-select"
          className="block text-xs font-display uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5"
        >
          <MapPin className="w-3 h-3" /> Area{" "}
          <span className="text-destructive">*</span>
        </label>
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
            id="mr-area-select"
            value={selectedArea}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedArea(newId);
              onStationChange("", "");
              onTerritoriesChange([]);
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

      <div>
        <label
          htmlFor="mr-station-select"
          className="block text-xs font-display uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5"
        >
          <MapPin className="w-3 h-3" /> Station{" "}
          <span className="text-destructive">*</span>
        </label>
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
            id="mr-station-select"
            value={stationId}
            onChange={(e) => {
              const newId = e.target.value;
              const st = stations.find((s) => s.stationId === newId);
              onStationChange(newId, st?.hqId ?? selectedArea);
              onTerritoriesChange([]);
            }}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
          >
            <option value="">Select Station</option>
            {stations.map((s) => (
              <option key={s.stationId} value={s.stationId}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        {selectedStation && (
          <p className="text-xs text-muted-foreground mt-1">
            Area: {selectedStation.hqName}
          </p>
        )}
      </div>

      <div>
        <div className="block text-xs font-display uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <MapPin className="w-3 h-3" /> Territory{" "}
          <span className="text-destructive">*</span>
        </div>
        {selectedTerritories.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {selectedTerritories.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full"
              >
                {t.name}
                <button
                  type="button"
                  onClick={() => removeTerritory(t.id)}
                  className="text-primary/70 hover:text-primary ml-0.5 leading-none"
                  aria-label={`Remove ${t.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => !isDisabled && setDropdownOpen((o) => !o)}
            className={`w-full border rounded-md px-3 py-2 text-sm text-left flex justify-between items-center transition-colors ${
              isDisabled
                ? "bg-muted border-input text-muted-foreground cursor-not-allowed"
                : "border-input bg-background hover:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
            }`}
          >
            <span>
              {isDisabled
                ? "Select a Station first"
                : selectedTerritories.length > 0
                  ? `${selectedTerritories.length} territory selected`
                  : "Select Territories"}
            </span>
            <svg
              aria-hidden="true"
              className="w-4 h-4 text-muted-foreground flex-shrink-0"
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
          </button>
          {dropdownOpen && !isDisabled && (
            <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {loadingTerritories ? (
                <p className="text-sm text-muted-foreground px-3 py-2">
                  Loading territories…
                </p>
              ) : territories.length === 0 ? (
                <p className="text-sm text-amber-700 px-3 py-2">
                  No territories found under this station. Please add
                  territories in Territory Master first.
                </p>
              ) : (
                territories.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={territoryIds.includes(t.id)}
                      onChange={() => toggleTerritory(t.id)}
                      className="rounded border-input text-primary focus:ring-ring"
                    />
                    <span>{t.name}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MRLocationAllotment;
