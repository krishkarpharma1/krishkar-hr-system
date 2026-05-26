// Offline DCR Queue — IndexedDB + Zustand store
import { create } from "zustand";
const DB_NAME = "krishkar-offline";
const DB_VERSION = 1;
const STORE_NAME = "dcrQueue";
export interface OfflineDcrRecord {
  id: string;
  mrId: string;
  mrName: string;
  timestamp: string;
  doctorName: string;
  specialty: string;
  clinicHospital: string;
  visitOutcome: string;
  productsDetailed: string[];
  samplesGiven: string[];
  nextAction: string;
  followUpDate: string;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracy: number | null;
  territory: string;
  station: string;
  syncStatus: "pending" | "syncing" | "synced" | "failed" | "already-synced";
  retryCount: number;
  createdAt: number;
  rawFormData: unknown;
}
let dbPromise: Promise<IDBDatabase> | null = null;
export function openOfflineDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => {
      dbPromise = null;
      reject((e.target as IDBOpenDBRequest).error);
    };
  });
  return dbPromise;
}
export async function addOfflineDcrRecord(
  record: Omit<
    OfflineDcrRecord,
    "id" | "createdAt" | "syncStatus" | "retryCount"
  >,
): Promise<string> {
  const db = await openOfflineDb();
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `dcr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const full: OfflineDcrRecord = {
    ...record,
    id,
    syncStatus: "pending",
    retryCount: 0,
    createdAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .add(full);
    req.onsuccess = () => resolve(id);
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}
export async function getAllPendingRecords(): Promise<OfflineDcrRecord[]> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .getAll();
    req.onsuccess = (e) => {
      const all: OfflineDcrRecord[] = (e.target as IDBRequest).result || [];
      resolve(
        all
          .filter(
            (r) => r.syncStatus === "pending" || r.syncStatus === "syncing",
          )
          .sort((a, b) => a.createdAt - b.createdAt),
      );
    };
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}
export async function updateRecordStatus(
  id: string,
  status: OfflineDcrRecord["syncStatus"],
): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const store = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = (e) => {
      const rec = (e.target as IDBRequest).result as OfflineDcrRecord;
      if (!rec) {
        resolve();
        return;
      }
      rec.syncStatus = status;
      const putReq = store.put(rec);
      putReq.onsuccess = () => resolve();
      putReq.onerror = (e2) => reject((e2.target as IDBRequest).error);
    };
    getReq.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}
export async function incrementRetryCount(id: string): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const store = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = (e) => {
      const rec = (e.target as IDBRequest).result as OfflineDcrRecord;
      if (!rec) {
        resolve();
        return;
      }
      rec.retryCount = (rec.retryCount || 0) + 1;
      const putReq = store.put(rec);
      putReq.onsuccess = () => resolve();
      putReq.onerror = (e2) => reject((e2.target as IDBRequest).error);
    };
    getReq.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}
export async function getPendingCount(): Promise<number> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .getAll();
    req.onsuccess = (e) => {
      const all: OfflineDcrRecord[] = (e.target as IDBRequest).result || [];
      resolve(
        all.filter(
          (r) => r.syncStatus === "pending" || r.syncStatus === "syncing",
        ).length,
      );
    };
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}
interface OfflineDcrQueueState {
  pendingCount: number;
  refreshPendingCount: () => Promise<void>;
}
export const useOfflineDcrQueue = create<OfflineDcrQueueState>((set) => ({
  pendingCount: 0,
  refreshPendingCount: async () => {
    try {
      const count = await getPendingCount();
      set({ pendingCount: count });
    } catch {}
  },
}));
if (typeof window !== "undefined") {
  getPendingCount()
    .then((count) => useOfflineDcrQueue.setState({ pendingCount: count }))
    .catch(() => {});
}
