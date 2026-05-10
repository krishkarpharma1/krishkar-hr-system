import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "../backend.d";

export interface AuthSession {
  token: string;
  userId: bigint;
  role: Role;
  employeeId: string;
  name: string;
}

interface AuthStore {
  session: AuthSession | null;
  /** Additional roles the logged-in user holds via Additional Charge assignments. */
  effectiveRoles: string[];
  setSession: (session: AuthSession) => void;
  setEffectiveRoles: (roles: string[]) => void;
  /**
   * Clears the in-memory session AND removes the persisted key from
   * localStorage so the next page load also starts unauthenticated.
   */
  clearSession: () => void;
  isAuthenticated: () => boolean;
}

const STORAGE_KEY = "krishkar-auth";

/** Validate that a restored session has all required fields in correct types. */
function isValidRestoredSession(s: unknown): s is AuthSession {
  if (!s || typeof s !== "object") return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.token === "string" &&
    obj.token.length > 0 &&
    (typeof obj.userId === "bigint" || typeof obj.userId === "string") &&
    typeof obj.role === "string" &&
    obj.role.length > 0 &&
    typeof obj.name === "string"
  );
}

// Custom storage adapter to handle BigInt serialisation
const authStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Ignore storage quota errors
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore
    }
  },
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      session: null,
      effectiveRoles: [],
      setSession: (session) => set({ session }),
      setEffectiveRoles: (roles) => set({ effectiveRoles: roles }),
      clearSession: () => {
        // Remove the persisted entry so it does not survive a page reload
        authStorage.removeItem(STORAGE_KEY);
        set({ session: null, effectiveRoles: [] });
      },
      isAuthenticated: () => !!get().session?.token,
    }),
    {
      name: STORAGE_KEY,
      storage: {
        getItem: (name) => {
          const str = authStorage.getItem(name);
          if (!str) return null;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parsed: any = JSON.parse(str);
            const sessionRaw = parsed?.state?.session;

            if (sessionRaw && typeof sessionRaw === "object") {
              // Revive BigInt userId — stored as string
              if (
                typeof sessionRaw.userId === "string" &&
                sessionRaw.userId.length > 0
              ) {
                try {
                  sessionRaw.userId = BigInt(sessionRaw.userId);
                } catch {
                  // Malformed userId — clear the whole session to force re-login
                  parsed.state.session = null;
                  authStorage.removeItem(name);
                  return parsed;
                }
              }

              // Validate the restored session has all required fields
              if (!isValidRestoredSession(sessionRaw)) {
                // Corrupt or incomplete session — clear so user is sent to login
                parsed.state.session = null;
                authStorage.removeItem(name);
              }
            }

            return parsed;
          } catch {
            // JSON parse failed — clear corrupt entry
            authStorage.removeItem(name);
            return null;
          }
        },
        setItem: (name, value) => {
          // Serialize BigInt fields as strings
          const str = JSON.stringify(value, (_key, val) =>
            typeof val === "bigint" ? val.toString() : val,
          );
          authStorage.setItem(name, str);
        },
        removeItem: authStorage.removeItem,
      },
    },
  ),
);
