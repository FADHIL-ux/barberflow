import { useEffect, useState } from "react";
import { api } from "./api.ts";
import { getPendingOfflineTransactions, markOfflineTransactionsSynced } from "./offline.ts";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const checkPending = async () => {
    try {
      const items = await getPendingOfflineTransactions();
      setPendingCount(items.length);
    } catch {
      // IndexedDB mungkin belum tersedia
    }
  };

  const syncNow = async () => {
    if (!navigator.onLine || isSyncing) return;
    try {
      const pending = await getPendingOfflineTransactions();
      if (pending.length === 0) return;

      setIsSyncing(true);
      const payload = {
        transactions: pending.map((p) => ({
          tempReceiptRef: p.tempReceiptRef,
          idempotencyKey: p.idempotencyKey,
          barberId: p.barberId ?? undefined,
          customerId: p.customerId ?? undefined,
          items: p.items.map((i) => ({
            kind: i.kind,
            refId: i.refId,
            quantity: i.quantity,
          })),
          discountType: p.discountType,
          discountValue: p.discountValue,
          paymentMethod: p.paymentMethod,
          occurredAt: p.occurredAt,
        })),
      };

      await api.post("/api/sync", payload);
      const ids = pending.map((p) => p.id!).filter(Boolean);
      await markOfflineTransactionsSynced(ids);
      await checkPending();
    } catch (err) {
      console.error("Gagal melakukan sinkronisasi offline:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncNow();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void checkPending();

    const interval = setInterval(() => {
      void checkPending();
      if (navigator.onLine) void syncNow();
    }, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  return { isOnline, pendingCount, isSyncing, syncNow };
}

