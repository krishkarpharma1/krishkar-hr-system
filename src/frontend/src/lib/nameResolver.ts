/**
 * nameResolver — shared employee name resolution utilities.
 *
 * useEmployeeNames() fetches all users once per session and returns
 * two lookup helpers:
 *   - getEmployeeName(id: bigint): string  — by numeric user ID
 *   - getEmployeeNameByUid(uid: string): string  — by UID string (KP-2026-001)
 *
 * Both helpers return the employee's full name or "Unknown" if not found.
 * The fetch is cached in module scope so it is shared across all components
 * that call this hook — no duplicate network calls.
 */

import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import type { UserInfo } from "../types";
import { api } from "./api";

// ── Module-level cache ──────────────────────────────────────────────────────

let cachedUsers: UserInfo[] | null = null;
let fetchPromise: Promise<UserInfo[]> | null = null;

function clearCache() {
  cachedUsers = null;
  fetchPromise = null;
}

// Exported so tests / token-change listeners can invalidate the cache
export { clearCache as clearEmployeeNameCache };

// ── Non-hook resolver (for contexts that already have a user list) ──────────

export function resolveEmployeeName(employees: UserInfo[], id: bigint): string {
  return employees.find((u) => u.id === id)?.name ?? "Unknown";
}

export function resolveEmployeeNameByUid(
  employees: UserInfo[],
  uid: string,
): string {
  return employees.find((u) => u.employeeId === uid)?.name ?? uid;
}

// ── Hook ────────────────────────────────────────────────────────────────────

interface UseEmployeeNamesResult {
  /** Resolve a numeric user ID → full name */
  getEmployeeName: (id: bigint) => string;
  /** Resolve a UID string (KP-2026-001) → full name */
  getEmployeeNameByUid: (uid: string) => string;
  /** Raw user list — use only when you need more than the name */
  users: UserInfo[];
  loading: boolean;
}

export function useEmployeeNames(): UseEmployeeNamesResult {
  const { session } = useAuthStore();
  const token = session?.token ?? "";

  const [users, setUsers] = useState<UserInfo[]>(cachedUsers ?? []);
  const [loading, setLoading] = useState(!cachedUsers);

  useEffect(() => {
    if (!token) return;
    if (cachedUsers) {
      setUsers(cachedUsers);
      setLoading(false);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = api.listAllUsers(token).catch(() => []);
    }

    let cancelled = false;
    fetchPromise.then((result) => {
      if (cancelled) return;
      cachedUsers = result;
      setUsers(result);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  function getEmployeeName(id: bigint): string {
    return users.find((u) => u.id === id)?.name ?? "Unknown";
  }

  function getEmployeeNameByUid(uid: string): string {
    // uid is the UID string like KP-2026-001
    return users.find((u) => u.employeeId === uid)?.name ?? uid;
  }

  return { getEmployeeName, getEmployeeNameByUid, users, loading };
}
