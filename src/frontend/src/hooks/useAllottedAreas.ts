/**
 * useAllottedAreas – shared hook for Travel Plan & Working Style
 *
 * Returns the full list of areas allotted to the logged-in employee,
 * combining primary hqAssignments from UserInfo with any active
 * Additional Charge HQ assignments.  Each AreaOption carries a
 * `isAdditionalHq` flag so callers can render an "Additional HQ" badge.
 */

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export interface AreaOption {
  areaId: bigint;
  areaName: string;
  hqName: string;
  hqId: bigint;
  isAdditionalHq: boolean;
}

interface UseAllottedAreasResult {
  areas: AreaOption[];
  loading: boolean;
}

export function useAllottedAreas(): UseAllottedAreasResult {
  const session = useAuthStore((s) => s.session);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;

    const load = async () => {
      setLoading(true);
      try {
        const [userInfo, allHqs] = await Promise.all([
          api.getUser(session.token, session.userId),
          api
            .getAllHQs(session.token)
            .catch(() => [] as { id: bigint; name: string }[]),
        ]);

        if (!userInfo) {
          setAreas([]);
          return;
        }

        const hqNameMap = new Map<string, string>(
          (Array.isArray(allHqs) ? allHqs : []).map(
            (hq: { id: bigint; name: string }) => [hq.id.toString(), hq.name],
          ),
        );

        // ── Primary HQ assignments ──────────────────────────────────────────
        const primaryAssignments = userInfo.hqAssignments ?? [];

        // ── Additional Charge HQ assignments (active only) ─────────────────
        let additionalAssignments: { hqId: bigint; areaIds: bigint[] }[] = [];
        try {
          const activeCharges = await api.getActiveChargesForEmployee(
            session.token,
            session.userId,
          );
          additionalAssignments = (activeCharges ?? []).flatMap(
            (charge) => charge.additionalHqAssignments ?? [],
          );
        } catch {
          // Additional charges are optional — continue without them
        }

        // ── Fetch areas for all HQs mentioned in either source ─────────────
        const allHqIds = new Set<string>();
        for (const a of primaryAssignments) allHqIds.add(a.hqId.toString());
        for (const a of additionalAssignments) allHqIds.add(a.hqId.toString());

        const uniqueHqIdArr = Array.from(allHqIds);
        const hqAreaResults = await Promise.all(
          uniqueHqIdArr.map(async (hqIdStr) => {
            const hqIdBig = BigInt(hqIdStr);
            const hqAreas = await api
              .listActiveAreasByHQ(session.token, hqIdBig)
              .catch(() => [] as { id: bigint; name: string }[]);
            return { hqId: hqIdBig, hqAreas };
          }),
        );

        const hqAreasMap = new Map(
          hqAreaResults.map(({ hqId, hqAreas }) => [hqId.toString(), hqAreas]),
        );

        // ── Build primary area options ──────────────────────────────────────
        const primaryOptions: AreaOption[] = primaryAssignments.flatMap(
          (hqAssign) => {
            const hqAreas = hqAreasMap.get(hqAssign.hqId.toString()) ?? [];
            const assignedAreaIds = new Set(
              hqAssign.areaIds.map((id) => id.toString()),
            );
            const filtered = hqAreas.filter((a) =>
              assignedAreaIds.has(a.id.toString()),
            );
            const hqName =
              hqNameMap.get(hqAssign.hqId.toString()) ?? `HQ ${hqAssign.hqId}`;
            return filtered.map((a) => ({
              areaId: a.id,
              areaName: a.name,
              hqName,
              hqId: hqAssign.hqId,
              isAdditionalHq: false,
            }));
          },
        );

        // ── Build additional charge area options ────────────────────────────
        // Collect hqIds already represented in primary to detect truly-new HQs
        const primaryHqIds = new Set(
          primaryAssignments.map((a) => a.hqId.toString()),
        );

        const additionalOptions: AreaOption[] = additionalAssignments.flatMap(
          (hqAssign) => {
            const hqAreas = hqAreasMap.get(hqAssign.hqId.toString()) ?? [];
            const assignedAreaIds = new Set(
              hqAssign.areaIds.map((id) => id.toString()),
            );
            const filtered = hqAreas.filter((a) =>
              assignedAreaIds.has(a.id.toString()),
            );
            const hqName =
              hqNameMap.get(hqAssign.hqId.toString()) ?? `HQ ${hqAssign.hqId}`;
            const isAdditionalHq = !primaryHqIds.has(hqAssign.hqId.toString());
            return filtered.map((a) => ({
              areaId: a.id,
              areaName: a.name,
              hqName,
              hqId: hqAssign.hqId,
              isAdditionalHq,
            }));
          },
        );

        // ── Merge, deduplicate by areaName (prefer primary entry) ──────────
        const seen = new Set<string>();
        const merged: AreaOption[] = [];
        for (const opt of [...primaryOptions, ...additionalOptions]) {
          if (!seen.has(opt.areaName)) {
            seen.add(opt.areaName);
            merged.push(opt);
          }
        }

        setAreas(merged);
      } catch {
        setAreas([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [session]);

  return { areas, loading };
}

/**
 * Group AreaOption[] by HQ name, preserving isAdditionalHq flag per group.
 */
export function groupAreasByHq(areas: AreaOption[]): {
  hqName: string;
  isAdditionalHq: boolean;
  areas: AreaOption[];
}[] {
  const map = new Map<
    string,
    { hqName: string; isAdditionalHq: boolean; areas: AreaOption[] }
  >();
  for (const area of areas) {
    const existing = map.get(area.hqName);
    if (existing) {
      existing.areas.push(area);
      // If any entry for this HQ is additional, mark the group as additional
      if (area.isAdditionalHq) existing.isAdditionalHq = true;
    } else {
      map.set(area.hqName, {
        hqName: area.hqName,
        isAdditionalHq: area.isAdditionalHq,
        areas: [area],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.hqName.localeCompare(b.hqName),
  );
}
