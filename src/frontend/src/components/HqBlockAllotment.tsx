/**
 * HqBlockAllotment
 *
 * Per-HQ block allotment UI for MR role.
 * Each block shows one HQ with multi-select Areas, Stations, and Ex-Stations.
 * Supports adding/removing HQ blocks.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  CheckSquare,
  Loader2,
  MapPin,
  Plus,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AreaRecord, HQRecord, StationRecord } from "../backend.d";
import type { HqAssignment } from "../types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface HqBlockAllotmentProps {
  /** List of all available HQs to choose from */
  hqOptions: HQRecord[];
  /** Map from hqId → areas under that HQ */
  areaOptionsByHq: Map<number, AreaRecord[]>;
  /** Map from hqId → stations under that HQ */
  stationOptionsByHq: Map<number, StationRecord[]>;
  /** Current allotment value */
  value: HqAssignment[];
  /** Called when the allotment changes */
  onChange: (blocks: HqAssignment[]) => void;
  /** Loading state for areas/stations (triggers spinner) */
  loadingHqData?: Set<number>;
  /** Called when a new HQ block is added and data needs to be fetched */
  onHqAdded?: (hqId: number) => void;
  /** Whether to show the Ex-Stations input */
  showExStations?: boolean;
  /** Whether the initial data is still loading (suppresses "no blocks" empty state) */
  loadingInitial?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function itemName<T extends { name?: string; stationName?: string }>(
  item: T,
): string {
  return (
    (item as { name?: string }).name ??
    (item as { stationName?: string }).stationName ??
    ""
  );
}

// ── Mini MultiCheck ─────────────────────────────────────────────────────────

function MultiCheck<T extends { name?: string; stationName?: string }>({
  label,
  items,
  selectedIds,
  onChange,
  loading,
  ocidPrefix,
}: {
  label: string;
  items: T[];
  selectedIds: bigint[];
  onChange: (ids: bigint[]) => void;
  loading?: boolean;
  ocidPrefix: string;
}) {
  const selectedSet = new Set(selectedIds.map(String));
  const allSelected =
    items.length > 0 &&
    items.every((i) =>
      selectedSet.has(
        String(
          (i as { id?: bigint; stationId?: bigint }).id ??
            (i as { stationId?: bigint }).stationId,
        ),
      ),
    );

  function idOf(item: T): bigint {
    const rec = item as { id?: bigint; stationId?: bigint };
    return rec.id ?? rec.stationId ?? BigInt(0);
  }

  function toggleAll() {
    if (allSelected) onChange([]);
    else onChange(items.map(idOf));
  }

  function toggleOne(id: bigint) {
    const key = String(id);
    if (selectedSet.has(key))
      onChange(selectedIds.filter((x) => String(x) !== key));
    else onChange([...selectedIds, id]);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {items.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
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
        <p className="text-xs text-muted-foreground italic py-1.5">
          No {label.toLowerCase()} available
        </p>
      ) : (
        <div
          className="border border-border rounded-md divide-y divide-border max-h-36 overflow-y-auto"
          data-ocid={`${ocidPrefix}-list`}
        >
          {items.map((item) => {
            const id = idOf(item);
            const key = String(id);
            const checkId = `${ocidPrefix}-${key}`;
            const checked = selectedSet.has(key);
            return (
              <label
                key={key}
                htmlFor={checkId}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <Checkbox
                  id={checkId}
                  checked={checked}
                  onCheckedChange={() => toggleOne(id)}
                  data-ocid={checkId}
                />
                <span className="text-sm text-foreground flex-1 min-w-0 truncate">
                  {itemName(item)}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* Selected chips */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {selectedIds.map((id) => {
            const item = items.find((i) => String(idOf(i)) === String(id));
            if (!item) return null;
            return (
              <Badge
                key={String(id)}
                variant="outline"
                className="gap-1 bg-primary/10 text-primary border-primary/20 pl-2.5 pr-1.5 py-0.5 text-xs font-normal"
              >
                {itemName(item)}
                <button
                  type="button"
                  onClick={() => toggleOne(id)}
                  className="hover:text-destructive transition-colors ml-0.5"
                  aria-label={`Remove ${itemName(item)}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ExStations Tags Input ───────────────────────────────────────────────────

function ExStationsInput({
  value,
  onChange,
  stationOptions,
  loading,
  ocidPrefix,
}: {
  value: bigint[];
  onChange: (ids: bigint[]) => void;
  stationOptions: StationRecord[];
  loading?: boolean;
  ocidPrefix: string;
}) {
  return (
    <MultiCheck
      label="Ex-Stations"
      items={stationOptions}
      selectedIds={value}
      onChange={onChange}
      loading={loading}
      ocidPrefix={`${ocidPrefix}-exstation`}
    />
  );
}

// ── Single HQ Block ────────────────────────────────────────────────────────

function HqBlock({
  block,
  blockIndex,
  hqOptions,
  usedHqIds,
  areas,
  stations,
  loadingData,
  onChange,
  onRemove,
  onHqSelected,
  showExStations,
}: {
  block: HqAssignment;
  blockIndex: number;
  hqOptions: HQRecord[];
  usedHqIds: Set<string>;
  areas: AreaRecord[];
  stations: StationRecord[];
  loadingData: boolean;
  onChange: (updated: HqAssignment) => void;
  onRemove: () => void;
  onHqSelected: (hqId: number) => void;
  showExStations: boolean;
}) {
  const hqId = String(block.hqId);
  const hq = hqOptions.find((h) => String(h.id) === hqId);
  const prefix = `hqblock-${blockIndex}`;

  return (
    <div
      className="rounded-lg border border-border bg-card p-4 space-y-4"
      data-ocid={`${prefix}-card`}
    >
      {/* HQ Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Label className="text-xs font-display mb-1.5 block text-muted-foreground uppercase tracking-wider">
            Headquarters {blockIndex + 1}
          </Label>
          <Select
            value={hqId !== "0" ? hqId : ""}
            onValueChange={(v) => {
              const numId = Number(v);
              onChange({
                hqId: BigInt(numId),
                areaIds: [],
                stationIds: [],
                exStationIds: [],
              });
              onHqSelected(numId);
            }}
          >
            <SelectTrigger
              className="h-9 text-sm bg-background border-input"
              data-ocid={`${prefix}-hq-select`}
            >
              <SelectValue placeholder="Select HQ" />
            </SelectTrigger>
            <SelectContent>
              {hqOptions.map((h) => (
                <SelectItem
                  key={String(h.id)}
                  value={String(h.id)}
                  disabled={
                    usedHqIds.has(String(h.id)) && String(h.id) !== hqId
                  }
                >
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="mt-6 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label={`Remove HQ block ${hq?.name ?? blockIndex + 1}`}
          data-ocid={`${prefix}-remove`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Areas, Stations, Ex-Stations — only shown once HQ is chosen */}
      {hqId !== "0" && (
        <div className="space-y-4 pt-1">
          <MultiCheck
            label="Areas"
            items={areas}
            selectedIds={block.areaIds}
            onChange={(ids) => onChange({ ...block, areaIds: ids })}
            loading={loadingData}
            ocidPrefix={`${prefix}-area`}
          />

          <MultiCheck
            label="Stations"
            items={stations}
            selectedIds={block.stationIds}
            onChange={(ids) => onChange({ ...block, stationIds: ids })}
            loading={loadingData}
            ocidPrefix={`${prefix}-station`}
          />

          {showExStations && (
            <ExStationsInput
              value={block.exStationIds}
              onChange={(ids) => onChange({ ...block, exStationIds: ids })}
              stationOptions={stations}
              loading={loadingData}
              ocidPrefix={prefix}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Assigned HQ–Area Summary (read-only) ──────────────────────────────────

export interface HqAssignedSummaryProps {
  /** The current HQ assignment blocks to summarise */
  blocks: HqAssignment[];
  /** All HQ options (for resolving hqId → name) */
  hqOptions: HQRecord[];
  /** Areas cached per HQ (for resolving areaIds → names) */
  areaOptionsByHq: Map<number, AreaRecord[]>;
  /** Stations cached per HQ (for resolving stationIds / exStationIds → names) */
  stationOptionsByHq: Map<number, StationRecord[]>;
  /** HQ IDs still loading — shows inline spinner for that row */
  loadingHqData?: Set<number>;
}

/**
 * Read-only summary list of per-HQ blocks already assigned to an MR.
 * Renders above the HqBlockAllotment edit controls so Admin/HR can see
 * what is already saved at a glance.
 */
export function HqAssignedSummary({
  blocks,
  hqOptions,
  areaOptionsByHq,
  stationOptionsByHq,
  loadingHqData,
}: HqAssignedSummaryProps) {
  const assigned = blocks.filter((b) => b.hqId !== BigInt(0));

  return (
    <div
      className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2"
      data-ocid="hq-assigned-summary"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-display font-semibold uppercase tracking-wider text-primary">
          Currently Assigned HQ – Areas
        </span>
      </div>

      {assigned.length === 0 ? (
        <p className="text-xs text-muted-foreground italic pl-0.5">
          No HQ-Area assignments yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {assigned.map((block) => {
            const hqId = Number(block.hqId);
            const hq = hqOptions.find((h) => Number(h.id) === hqId);
            const isLoading = loadingHqData?.has(hqId) ?? false;
            const areas = areaOptionsByHq.get(hqId) ?? [];
            const stations = stationOptionsByHq.get(hqId) ?? [];

            function resolveNames(
              ids: bigint[],
              list: {
                id?: bigint;
                stationId?: bigint;
                name?: string;
                stationName?: string;
              }[],
            ): string {
              if (ids.length === 0) return "None";
              return ids
                .map((id) => {
                  const found = list.find(
                    (item) =>
                      String(
                        (item as { id?: bigint }).id ??
                          (item as { stationId?: bigint }).stationId,
                      ) === String(id),
                  );
                  return (
                    (found as { name?: string })?.name ??
                    (found as { stationName?: string })?.stationName ??
                    String(id)
                  );
                })
                .join(", ");
            }

            return (
              <div
                key={String(block.hqId)}
                className="rounded-md border border-border bg-card px-3 py-2 text-xs"
                data-ocid={`hq-summary-row-${hqId}`}
              >
                {/* HQ Name */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display font-semibold text-foreground">
                    {hq?.name ?? `HQ ${hqId}`}
                  </span>
                  {isLoading && (
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  )}
                </div>

                {isLoading ? (
                  <p className="text-muted-foreground italic">Loading…</p>
                ) : (
                  <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-muted-foreground">
                    <span>
                      <span className="text-foreground/70 font-medium">
                        Areas:{" "}
                      </span>
                      {resolveNames(block.areaIds, areas)}
                    </span>
                    <span>
                      <span className="text-foreground/70 font-medium">
                        Stations:{" "}
                      </span>
                      {resolveNames(block.stationIds, stations)}
                    </span>
                    <span>
                      <span className="text-foreground/70 font-medium">
                        Ex-Stations:{" "}
                      </span>
                      {resolveNames(block.exStationIds, stations)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function HqBlockAllotment({
  hqOptions,
  areaOptionsByHq,
  stationOptionsByHq,
  value,
  onChange,
  loadingHqData,
  onHqAdded,
  showExStations = true,
  loadingInitial = false,
}: HqBlockAllotmentProps) {
  const usedHqIds = new Set(value.map((b) => String(b.hqId)));

  function addBlock() {
    onChange([
      ...value,
      { hqId: BigInt(0), areaIds: [], stationIds: [], exStationIds: [] },
    ]);
  }

  function removeBlock(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function updateBlock(index: number, updated: HqAssignment) {
    onChange(value.map((b, i) => (i === index ? updated : b)));
  }

  function handleHqSelected(_blockIndex: number, hqId: number) {
    onHqAdded?.(hqId);
  }

  return (
    <div className="space-y-3" data-ocid="hq-block-allotment">
      {/* Only show empty state when not loading AND genuinely no blocks */}
      {!loadingInitial && value.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No HQ blocks assigned. Click "Add HQ" to start.
        </p>
      )}
      {loadingInitial && value.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading HQ assignments…
        </div>
      )}

      {value.map((block, index) => (
        <HqBlock
          key={`${String(block.hqId)}-${index}`}
          block={block}
          blockIndex={index}
          hqOptions={hqOptions}
          usedHqIds={usedHqIds}
          areas={areaOptionsByHq.get(Number(block.hqId)) ?? []}
          stations={stationOptionsByHq.get(Number(block.hqId)) ?? []}
          loadingData={loadingHqData?.has(Number(block.hqId)) ?? false}
          onChange={(updated) => updateBlock(index, updated)}
          onRemove={() => removeBlock(index)}
          onHqSelected={(hqId) => handleHqSelected(index, hqId)}
          showExStations={showExStations}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addBlock}
        className="w-full border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:border-primary/60 transition-colors"
        data-ocid="hq-block-add"
      >
        <Plus className="w-4 h-4 mr-1.5" />
        Add HQ
      </Button>

      {/* Summary chips */}
      {value.length > 0 && (
        <div className="pt-1 flex flex-wrap gap-1.5">
          {value
            .filter((b) => b.hqId !== BigInt(0))
            .map((b) => {
              const hq = hqOptions.find((h) => String(h.id) === String(b.hqId));
              const areaCount = b.areaIds.length;
              const stationCount = b.stationIds.length;
              return (
                <Badge
                  key={String(b.hqId)}
                  variant="outline"
                  className="text-xs bg-secondary/30 border-border text-foreground"
                >
                  {hq?.name ?? `HQ ${String(b.hqId)}`}
                  {areaCount > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      · {areaCount}A
                    </span>
                  )}
                  {stationCount > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      · {stationCount}S
                    </span>
                  )}
                </Badge>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ── Hook: load HQ data lazily ──────────────────────────────────────────────

/**
 * useHqBlockData — manages lazy loading of areas + stations per HQ.
 * Call `ensureLoaded(hqId)` whenever a new HQ is selected.
 */
export function useHqBlockData(
  token: string,
  fetchAreas: (hqId: bigint) => Promise<AreaRecord[]>,
  fetchStations: (hqId: bigint) => Promise<StationRecord[]>,
) {
  const [areasByHq, setAreasByHq] = useState<Map<number, AreaRecord[]>>(
    new Map(),
  );
  const [stationsByHq, setStationsByHq] = useState<
    Map<number, StationRecord[]>
  >(new Map());
  const [loadingHqData, setLoadingHqData] = useState<Set<number>>(new Set());
  const loadedRef = useRef<Set<number>>(new Set());

  // token as stable ref to avoid re-running effect
  const tokenRef = useRef(token);
  tokenRef.current = token;

  async function ensureLoaded(hqId: number) {
    if (loadedRef.current.has(hqId) || hqId === 0) return;
    loadedRef.current.add(hqId);

    setLoadingHqData((prev) => new Set([...prev, hqId]));
    try {
      const [areas, stations] = await Promise.all([
        fetchAreas(BigInt(hqId)),
        fetchStations(BigInt(hqId)),
      ]);
      setAreasByHq((prev) => new Map([...prev, [hqId, areas]]));
      setStationsByHq((prev) => new Map([...prev, [hqId, stations]]));
    } catch {
      // leave empty — MultiCheck shows "No items available"
    } finally {
      setLoadingHqData((prev) => {
        const next = new Set(prev);
        next.delete(hqId);
        return next;
      });
    }
  }

  /** Pre-load data for all HQ blocks currently in the value array */
  function ensureAllLoaded(blocks: HqAssignment[]) {
    for (const b of blocks) {
      if (b.hqId !== BigInt(0)) ensureLoaded(Number(b.hqId));
    }
  }

  return {
    areasByHq,
    stationsByHq,
    loadingHqData,
    ensureLoaded,
    ensureAllLoaded,
  };
}
