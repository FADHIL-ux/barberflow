// IndexedDB client storage layer using standard browser indexedDB API

export interface PendingOfflineTransaction {
  id?: number;
  tempReceiptRef: string;
  idempotencyKey: string;
  barberId?: string | null;
  customerId?: string | null;
  items: Array<{
    kind: "service" | "product";
    refId: string;
    quantity: number;
    name: string;
    unitPriceIdr: number;
  }>;
  discountType: "none" | "percent" | "fixed";
  discountValue: number;
  paymentMethod: "cash" | "qris" | "transfer";
  occurredAt: string;
  subtotalIdr: number;
  discountIdr: number;
  totalIdr: number;
  status: "pending" | "synced";
  createdAt: number;
}

const DB_NAME = "BarberFlowOfflineDB";
const DB_VERSION = 1;
const STORE_NAME = "pending_transactions";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("idempotencyKey", "idempotencyKey", { unique: true });
        store.createIndex("status", "status", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Simpan transaksi lokal saat offline */
export async function saveOfflineTransaction(
  tx: Omit<PendingOfflineTransaction, "id" | "status" | "createdAt">,
): Promise<PendingOfflineTransaction> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const trans = db.transaction(STORE_NAME, "readwrite");
    const store = trans.objectStore(STORE_NAME);
    const record: PendingOfflineTransaction = {
      ...tx,
      status: "pending",
      createdAt: Date.now(),
    };
    const req = store.add(record);
    req.onsuccess = () => {
      resolve({ ...record, id: req.result as number });
    };
    req.onerror = () => reject(req.error);
  });
}

/** Ambil seluruh transaksi pending untuk disinkronkan */
export async function getPendingOfflineTransactions(): Promise<PendingOfflineTransaction[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const trans = db.transaction(STORE_NAME, "readonly");
    const store = trans.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result as PendingOfflineTransaction[];
      resolve(records.filter((r) => r.status === "pending"));
    };
    req.onerror = () => reject(req.error);
  });
}

/** Tandai transaksi sudah berhasil disinkronkan ke server */
export async function markOfflineTransactionsSynced(ids: number[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const trans = db.transaction(STORE_NAME, "readwrite");
    const store = trans.objectStore(STORE_NAME);
    for (const id of ids) {
      store.delete(id);
    }
    trans.oncomplete = () => resolve();
    trans.onerror = () => reject(trans.error);
  });
}

/** Generate nomor struk sementara yang unik per perangkat (misal: OFFLINE-DEV1-0001) */
export function generateTempReceiptRef(): string {
  let devId = localStorage.getItem("bf_device_id");
  if (!devId) {
    devId = Math.random().toString(36).substring(2, 6).toUpperCase();
    localStorage.setItem("bf_device_id", devId);
  }
  const seq = (parseInt(localStorage.getItem("bf_offline_seq") || "0", 10) + 1);
  localStorage.setItem("bf_offline_seq", String(seq));
  const padSeq = String(seq).padStart(4, "0");
  return `OFFLINE-${devId}-${padSeq}`;
}

