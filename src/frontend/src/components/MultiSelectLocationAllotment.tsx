/**
 * MultiSelectLocationAllotment
 *
 * Role-aware location allotment component:
 * - HR / Admin / HRManager → multi-select ALL Zones
 * - ZSM       → pick one Zone → multi-select all States in it
 * - RSM       → pick Zone→State→Territory (single) → multi-select all HQs
 * - ASM       → pick Zone→State→Territory→HQ (single) → multi-select all Areas
 * - MR        → HqBlockAllotment (per-HQ blocks with Areas, Stations, Ex-Stations)
 */

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckSquare, Loader2, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Role } from "../backend";
import type {
  AreaRecord,
  HQRecord,
  HqAssignment,
  StateRecord,
  TerritoryRecord,
  ZoneRecord,
} from "../backend.d";
import { api } from "../lib/api";
import {
  HqAssignedSummary,
  HqBlockAllotment,
  useHqBlockData,
} from "./HqBlockAllotment";

export interface LocationAllotment {
  zoneIds: string[];
  stateIds: string[];
  territoryIds: string[];
  hqIds: string[];
  areaIds: string[];
  // single-select parents used to scope multi-select
  parentZoneId: string;
  parentStateId: string;
  parentTerritoryId: string;
  parentHqId: string;
  // MR-specific: per-HQ blocks with Areas, Stations, Ex-Stations
  hqAssignments: HqAssignment[];
}

export const EMPTY_ALLOTMENT: LocationAllotment = {
  zoneIds: [],
  stateIds: [],
  territoryIds: [],
  hqIds: [],
  areaIds: [],
  parentZoneId: "",
  parentStateId: "",
  parentTerritoryId: "",
  parentHqId: "",
  hqAssignments: [],
};

const ZONE_MULTI_ROLES: string[] = [Role.HRManager, Role.Admin];

// ── MultiCheckList ──────────────────────────────────────────────────────────

function MultiCheckList<T extends { id: bigint; name: string }>({
  label,
  items,
  selected,
  onChange,
  loading,
  ocidPrefix,
}: {
  label: string;
  items: T[];
  selected: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  ocidPrefix: string;
}) {
  const allSelected =
    items.length > 0 && items.every((i) => selected.includes(String(i.id)));

  function toggleAll() {
    if (allSelected) onChange([]);
    else onChange(items.map((i) => String(i.id)));
  }

  function toggleOne(id: string) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {items.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-display"
            data-ocid={`${ocidPrefix}-select-all`}
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
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">
          No {label.toLowerCase()} available
        </p>
      ) : (
        <div
          className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto"
          data-ocid={`${ocidPrefix}-list`}
        >
          {items.map((item) => {
            const id = String(item.id);
            const checkId = `${ocidPrefix}-item-${id}`;
            const checked = selected.includes(id);
            return (
              <label
                key={id}
                htmlFor={checkId}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <Checkbox
                  id={checkId}
                  checked={checked}
                  onCheckedChange={() => toggleOne(id)}
                  data-ocid={checkId}
                />
                <span className="text-sm text-foreground flex-1">
                  {item.name}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selected.map((id) => {
            const item = items.find((i) => String(i.id) === id);
            if (!item) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5"
              >
                {item.name}
                <button
                  type="button"
                  onClick={() => toggleOne(id)}
                  className="hover:text-destructive transition-colors"
                  aria-label={`Remove ${item.name}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

interface Props {
  token: string;
  role: string;
  value: LocationAllotment;
  onChange: (v: LocationAllotment) => void;
}

export function MultiSelectLocationAllotment({
  token,
  role,
  value,
  onChange,
}: Props) {
  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [states, setStates] = useState<StateRecord[]>([]);
  const [territories, setTerritories] = useState<TerritoryRecord[]>([]);
  const [hqs, setHqs] = useState<HQRecord[]>([]);
  const [areas, setAreas] = useState<AreaRecord[]>([]);

  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingTerritories, setLoadingTerritories] = useState(false);
  const [loadingHQs, setLoadingHQs] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);

  // Keep stable refs so effects don't re-fire on value/onChange identity changes
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const isZoneMulti = ZONE_MULTI_ROLES.includes(role);
  const isZSM = role === Role.ZSM;
  const isRSM = role === Role.RSM;
  const isASM = role === Role.ASM;
  const isMR = role === Role.MR;

  // ── MR: load all HQs once for block allotment ──────────────────────────
  const [allHqs, setAllHqs] = useState<HQRecord[]>([]);
  const [loadingAllHqs, setLoadingAllHqs] = useState(false);

  const {
    areasByHq,
    stationsByHq,
    loadingHqData,
    ensureLoaded,
    ensureAllLoaded,
  } = useHqBlockData(
    token,
    (hqId) => api.listActiveAreasByHQ(token, hqId),
    (hqId) => api.listStationsByHQ(token, hqId),
  );

  useEffect(() => {
    if (!isMR) return;
    setLoadingAllHqs(true);
    api
      .getAllActiveHQs(token)
      .then((h) => setAllHqs(h as HQRecord[]))
      .catch(() => setAllHqs([]))
      .finally(() => setLoadingAllHqs(false));
  }, [token, isMR]);

  // Pre-load data for existing HQ assignments whenever the hqAssignments value changes
  // (e.g., when a different employee is opened in the dialog)
  const ensureAllLoadedRef = useRef(ensureAllLoaded);
  ensureAllLoadedRef.current = ensureAllLoaded;
  useEffect(() => {
    if (!isMR || value.hqAssignments.length === 0) return;
    ensureAllLoadedRef.current(value.hqAssignments);
  }, [isMR, value.hqAssignments]);

  // ── Non-MR effects ─────────────────────────────────────────────────────

  // Load zones on mount (not needed for MR)
  useEffect(() => {
    if (isMR) return;
    setLoadingZones(true);
    api
      .listActiveZones(token)
      .then(setZones)
      .catch(() => setZones([]))
      .finally(() => setLoadingZones(false));
  }, [token, isMR]);

  // Auto-pre-select all zones for HR/NSM/Admin after zones load
  const autoSelectedZones = useRef(false);
  useEffect(() => {
    if (!isZoneMulti || zones.length === 0 || autoSelectedZones.current) return;
    if (valueRef.current.zoneIds.length === 0) {
      autoSelectedZones.current = true;
      onChangeRef.current({
        ...valueRef.current,
        zoneIds: zones.map((z) => String(z.id)),
      });
    }
  }, [isZoneMulti, zones]);

  // ZSM: load states when parent zone changes, auto-pre-select all states
  const prevZSMZone = useRef("");
  useEffect(() => {
    if (!isZSM || !value.parentZoneId) return;
    if (prevZSMZone.current === value.parentZoneId) return;
    prevZSMZone.current = value.parentZoneId;
    setLoadingStates(true);
    api
      .listActiveStatesByZone(token, BigInt(value.parentZoneId))
      .then((s) => {
        setStates(s);
        onChangeRef.current({
          ...valueRef.current,
          stateIds: s.map((x) => String(x.id)),
        });
      })
      .catch(() => setStates([]))
      .finally(() => setLoadingStates(false));
  }, [token, isZSM, value.parentZoneId]);

  // RSM: load states when parent zone changes
  const prevRSMZone = useRef("");
  useEffect(() => {
    if (!isRSM || !value.parentZoneId) return;
    if (prevRSMZone.current === value.parentZoneId) return;
    prevRSMZone.current = value.parentZoneId;
    setLoadingStates(true);
    api
      .listActiveStatesByZone(token, BigInt(value.parentZoneId))
      .then(setStates)
      .catch(() => setStates([]))
      .finally(() => setLoadingStates(false));
  }, [token, isRSM, value.parentZoneId]);

  // RSM: load territories when parent state changes
  const prevRSMState = useRef("");
  useEffect(() => {
    if (!isRSM || !value.parentStateId) return;
    if (prevRSMState.current === value.parentStateId) return;
    prevRSMState.current = value.parentStateId;
    setLoadingTerritories(true);
    api
      .listActiveTerritories(token, BigInt(value.parentStateId))
      .then(setTerritories)
      .catch(() => setTerritories([]))
      .finally(() => setLoadingTerritories(false));
  }, [token, isRSM, value.parentStateId]);

  // RSM: load HQs when parent territory changes, auto-pre-select all
  const prevRSMTerritory = useRef("");
  useEffect(() => {
    if (!isRSM || !value.parentTerritoryId) return;
    if (prevRSMTerritory.current === value.parentTerritoryId) return;
    prevRSMTerritory.current = value.parentTerritoryId;
    setLoadingHQs(true);
    api
      .listActiveHQsByTerritory(token, BigInt(value.parentTerritoryId))
      .then((h) => {
        setHqs(h);
        onChangeRef.current({
          ...valueRef.current,
          hqIds: h.map((x) => String(x.id)),
        });
      })
      .catch(() => setHqs([]))
      .finally(() => setLoadingHQs(false));
  }, [token, isRSM, value.parentTerritoryId]);

  // ASM: load states when parent zone changes
  const prevASMZone = useRef("");
  useEffect(() => {
    if (!isASM || !value.parentZoneId) return;
    if (prevASMZone.current === value.parentZoneId) return;
    prevASMZone.current = value.parentZoneId;
    setLoadingStates(true);
    api
      .listActiveStatesByZone(token, BigInt(value.parentZoneId))
      .then(setStates)
      .catch(() => setStates([]))
      .finally(() => setLoadingStates(false));
  }, [token, isASM, value.parentZoneId]);

  // ASM: load territories when parent state changes
  const prevASMState = useRef("");
  useEffect(() => {
    if (!isASM || !value.parentStateId) return;
    if (prevASMState.current === value.parentStateId) return;
    prevASMState.current = value.parentStateId;
    setLoadingTerritories(true);
    api
      .listActiveTerritories(token, BigInt(value.parentStateId))
      .then(setTerritories)
      .catch(() => setTerritories([]))
      .finally(() => setLoadingTerritories(false));
  }, [token, isASM, value.parentStateId]);

  // ASM: load HQs when parent territory changes
  const prevASMTerritory = useRef("");
  useEffect(() => {
    if (!isASM || !value.parentTerritoryId) return;
    if (prevASMTerritory.current === value.parentTerritoryId) return;
    prevASMTerritory.current = value.parentTerritoryId;
    setLoadingHQs(true);
    api
      .listActiveHQsByTerritory(token, BigInt(value.parentTerritoryId))
      .then(setHqs)
      .catch(() => setHqs([]))
      .finally(() => setLoadingHQs(false));
  }, [token, isASM, value.parentTerritoryId]);

  // ASM: load areas when parent HQ changes, auto-pre-select all
  const prevASMHQ = useRef("");
  useEffect(() => {
    if (!isASM || !value.parentHqId) return;
    if (prevASMHQ.current === value.parentHqId) return;
    prevASMHQ.current = value.parentHqId;
    setLoadingAreas(true);
    api
      .listActiveAreasByHQ(token, BigInt(value.parentHqId))
      .then((a) => {
        setAreas(a);
        onChangeRef.current({
          ...valueRef.current,
          areaIds: a.map((x) => String(x.id)),
        });
      })
      .catch(() => setAreas([]))
      .finally(() => setLoadingAreas(false));
  }, [token, isASM, value.parentHqId]);

  const selectClass = "h-9 text-sm bg-background border-input";

  // ── MR ── per-HQ block allotment ─────────────────────────────────────────
  if (isMR) {
    if (loadingAllHqs) {
      return (
        <div className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground py-3">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading headquarters…
        </div>
      );
    }
    return (
      <div className="col-span-2 space-y-4">
        {/* Read-only summary of already-assigned HQ blocks */}
        <HqAssignedSummary
          blocks={value.hqAssignments}
          hqOptions={allHqs}
          areaOptionsByHq={areasByHq}
          stationOptionsByHq={stationsByHq}
          loadingHqData={loadingHqData}
        />
        <HqBlockAllotment
          hqOptions={allHqs}
          areaOptionsByHq={areasByHq}
          stationOptionsByHq={stationsByHq}
          value={value.hqAssignments}
          onChange={(blocks) => onChange({ ...value, hqAssignments: blocks })}
          loadingHqData={loadingHqData}
          onHqAdded={ensureLoaded}
          showExStations={true}
          loadingInitial={
            loadingHqData.size > 0 && value.hqAssignments.length > 0
          }
        />
      </div>
    );
  }

  // ── HR / Admin ── multi-select zones ──────────────────────────
  if (isZoneMulti) {
    return (
      <div className="col-span-2 space-y-3">
        <MultiCheckList
          label="Zones Allotted"
          items={zones}
          selected={value.zoneIds}
          onChange={(ids) => onChange({ ...value, zoneIds: ids })}
          loading={loadingZones}
          ocidPrefix="allot-zone"
        />
      </div>
    );
  }

  // ── ZSM ── pick one Zone, multi-select States ───────────────────────────
  if (isZSM) {
    return (
      <div className="col-span-2 space-y-4">
        <div>
          <Label className="text-xs font-display mb-1.5 block text-muted-foreground">
            Zone (Parent)
          </Label>
          <Select
            value={value.parentZoneId}
            onValueChange={(z) => {
              prevZSMZone.current = "";
              setStates([]);
              onChange({ ...EMPTY_ALLOTMENT, parentZoneId: z });
            }}
            disabled={loadingZones}
          >
            <SelectTrigger
              className={selectClass}
              data-ocid="allot-parent-zone"
            >
              {loadingZones ? (
                <span className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </span>
              ) : (
                <SelectValue placeholder="Select Zone" />
              )}
            </SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={String(z.id)} value={String(z.id)}>
                  {z.name} ({z.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {value.parentZoneId && (
          <MultiCheckList
            label="States Allotted"
            items={states}
            selected={value.stateIds}
            onChange={(ids) => onChange({ ...value, stateIds: ids })}
            loading={loadingStates}
            ocidPrefix="allot-state"
          />
        )}
      </div>
    );
  }

  // ── RSM ── Zone→State→Territory (single), multi-select HQs ─────────────
  if (isRSM) {
    return (
      <div className="col-span-2 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs font-display mb-1 block text-muted-foreground">
              Zone
            </Label>
            <Select
              value={value.parentZoneId}
              onValueChange={(z) => {
                prevRSMZone.current = "";
                prevRSMState.current = "";
                prevRSMTerritory.current = "";
                setStates([]);
                setTerritories([]);
                setHqs([]);
                onChange({ ...EMPTY_ALLOTMENT, parentZoneId: z });
              }}
              disabled={loadingZones}
            >
              <SelectTrigger
                className={selectClass}
                data-ocid="allot-parent-zone"
              >
                {loadingZones ? (
                  <span className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                  </span>
                ) : (
                  <SelectValue placeholder="Select Zone" />
                )}
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={String(z.id)} value={String(z.id)}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-display mb-1 block text-muted-foreground">
              State
            </Label>
            <Select
              value={value.parentStateId}
              onValueChange={(s) => {
                prevRSMState.current = "";
                prevRSMTerritory.current = "";
                setTerritories([]);
                setHqs([]);
                onChange({
                  ...value,
                  parentStateId: s,
                  parentTerritoryId: "",
                  hqIds: [],
                });
              }}
              disabled={!value.parentZoneId || loadingStates}
            >
              <SelectTrigger
                className={selectClass}
                data-ocid="allot-parent-state"
              >
                {loadingStates ? (
                  <span className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                  </span>
                ) : (
                  <SelectValue
                    placeholder={
                      value.parentZoneId ? "Select State" : "Select Zone first"
                    }
                  />
                )}
              </SelectTrigger>
              <SelectContent>
                {states.map((s) => (
                  <SelectItem key={String(s.id)} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-display mb-1 block text-muted-foreground">
              Territory
            </Label>
            <Select
              value={value.parentTerritoryId}
              onValueChange={(t) => {
                prevRSMTerritory.current = "";
                setHqs([]);
                onChange({ ...value, parentTerritoryId: t, hqIds: [] });
              }}
              disabled={!value.parentStateId || loadingTerritories}
            >
              <SelectTrigger
                className={selectClass}
                data-ocid="allot-parent-territory"
              >
                {loadingTerritories ? (
                  <span className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                  </span>
                ) : (
                  <SelectValue
                    placeholder={
                      value.parentStateId
                        ? "Select Territory"
                        : "Select State first"
                    }
                  />
                )}
              </SelectTrigger>
              <SelectContent>
                {territories.map((t) => (
                  <SelectItem key={String(t.id)} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {value.parentTerritoryId && (
          <MultiCheckList
            label="HQs Allotted"
            items={hqs}
            selected={value.hqIds}
            onChange={(ids) => onChange({ ...value, hqIds: ids })}
            loading={loadingHQs}
            ocidPrefix="allot-hq"
          />
        )}
      </div>
    );
  }

  // ── ASM ── Zone→State→Territory→HQ (single), multi-select Areas ─────────
  return (
    <div className="col-span-2 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-display mb-1 block text-muted-foreground">
            Zone
          </Label>
          <Select
            value={value.parentZoneId}
            onValueChange={(z) => {
              prevASMZone.current = "";
              prevASMState.current = "";
              prevASMTerritory.current = "";
              prevASMHQ.current = "";
              setStates([]);
              setTerritories([]);
              setHqs([]);
              setAreas([]);
              onChange({ ...EMPTY_ALLOTMENT, parentZoneId: z });
            }}
            disabled={loadingZones}
          >
            <SelectTrigger
              className={selectClass}
              data-ocid="allot-parent-zone"
            >
              {loadingZones ? (
                <span className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </span>
              ) : (
                <SelectValue placeholder="Select Zone" />
              )}
            </SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={String(z.id)} value={String(z.id)}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs font-display mb-1 block text-muted-foreground">
            State
          </Label>
          <Select
            value={value.parentStateId}
            onValueChange={(s) => {
              prevASMState.current = "";
              prevASMTerritory.current = "";
              prevASMHQ.current = "";
              setTerritories([]);
              setHqs([]);
              setAreas([]);
              onChange({
                ...value,
                parentStateId: s,
                parentTerritoryId: "",
                parentHqId: "",
                areaIds: [],
              });
            }}
            disabled={!value.parentZoneId || loadingStates}
          >
            <SelectTrigger
              className={selectClass}
              data-ocid="allot-parent-state"
            >
              {loadingStates ? (
                <span className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </span>
              ) : (
                <SelectValue
                  placeholder={
                    value.parentZoneId ? "Select State" : "Select Zone first"
                  }
                />
              )}
            </SelectTrigger>
            <SelectContent>
              {states.map((s) => (
                <SelectItem key={String(s.id)} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs font-display mb-1 block text-muted-foreground">
            Territory
          </Label>
          <Select
            value={value.parentTerritoryId}
            onValueChange={(t) => {
              prevASMTerritory.current = "";
              prevASMHQ.current = "";
              setHqs([]);
              setAreas([]);
              onChange({
                ...value,
                parentTerritoryId: t,
                parentHqId: "",
                areaIds: [],
              });
            }}
            disabled={!value.parentStateId || loadingTerritories}
          >
            <SelectTrigger
              className={selectClass}
              data-ocid="allot-parent-territory"
            >
              {loadingTerritories ? (
                <span className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </span>
              ) : (
                <SelectValue
                  placeholder={
                    value.parentStateId
                      ? "Select Territory"
                      : "Select State first"
                  }
                />
              )}
            </SelectTrigger>
            <SelectContent>
              {territories.map((t) => (
                <SelectItem key={String(t.id)} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs font-display mb-1 block text-muted-foreground">
            HQ
          </Label>
          <Select
            value={value.parentHqId}
            onValueChange={(h) => {
              prevASMHQ.current = "";
              setAreas([]);
              onChange({ ...value, parentHqId: h, areaIds: [] });
            }}
            disabled={!value.parentTerritoryId || loadingHQs}
          >
            <SelectTrigger className={selectClass} data-ocid="allot-parent-hq">
              {loadingHQs ? (
                <span className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </span>
              ) : (
                <SelectValue
                  placeholder={
                    value.parentTerritoryId
                      ? "Select HQ"
                      : "Select Territory first"
                  }
                />
              )}
            </SelectTrigger>
            <SelectContent>
              {hqs.map((h) => (
                <SelectItem key={String(h.id)} value={String(h.id)}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {value.parentHqId && (
        <MultiCheckList
          label="Areas Allotted"
          items={areas}
          selected={value.areaIds}
          onChange={(ids) => onChange({ ...value, areaIds: ids })}
          loading={loadingAreas}
          ocidPrefix="allot-area"
        />
      )}
    </div>
  );
}

/** Convert a LocationAllotment to the arrays expected by API calls */
export function allotmentToApiArrays(allotment: LocationAllotment) {
  return {
    zoneIds: allotment.zoneIds.map(BigInt),
    stateIds: allotment.stateIds.map(BigInt),
    territoryIds: allotment.territoryIds.map(BigInt),
    hqIds: allotment.hqIds.map(BigInt),
    areaIds: allotment.areaIds.map(BigInt),
  };
}

/** Convert allotment to a human-readable summary string */
export function allotmentSummary(allotment: LocationAllotment): string {
  const parts: string[] = [];
  if (allotment.zoneIds.length)
    parts.push(
      `${allotment.zoneIds.length} Zone${allotment.zoneIds.length > 1 ? "s" : ""}`,
    );
  if (allotment.stateIds.length)
    parts.push(
      `${allotment.stateIds.length} State${allotment.stateIds.length > 1 ? "s" : ""}`,
    );
  if (allotment.hqIds.length)
    parts.push(
      `${allotment.hqIds.length} HQ${allotment.hqIds.length > 1 ? "s" : ""}`,
    );
  if (allotment.areaIds.length)
    parts.push(
      `${allotment.areaIds.length} Area${allotment.areaIds.length > 1 ? "s" : ""}`,
    );
  if (allotment.hqAssignments?.length)
    parts.push(
      `${allotment.hqAssignments.length} HQ Block${allotment.hqAssignments.length > 1 ? "s" : ""}`,
    );
  return parts.join(", ") || "—";
}
