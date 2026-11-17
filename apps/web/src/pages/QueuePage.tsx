import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { Badge } from "../components/ui/Badge.tsx";

interface QueueItem {
  id: string;
  queueDate: string;
  queueNumber: number;
  customerId: string | null;
  customerName: string;
  barberId: string | null;
  barberName: string | null;
  status: "waiting" | "in_service" | "done" | "cancelled";
  createdAt: string;
  services: Array<{ id: string; name: string; priceIdr: number }>;
}

interface ServiceOption {
  id: string;
  name: string;
  priceIdr: number;
}

interface BarberOption {
  id: string;
  displayName: string;
}

export default function QueuePage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal tambah antrean
  const [modalOpen, setModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [selectedBarberId, setSelectedBarberId] = useState<string>("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = async () => {
    try {
      const res = await api.get<{ items: QueueItem[] }>("/api/queue/today");
      setQueue(res.items);
    } catch (err) {
      console.error("Gagal memuat antrean:", err);
    }
  };

  const handleClearDoneQueue = async () => {
    if (!window.confirm("Bersihkan seluruh riwayat antrean selesai hari ini?")) return;
    try {
      await api.del("/api/queue/done");
      await fetchQueue();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal membersihkan antrean selesai.");
    }
  };

  const fetchMeta = async () => {
    try {
      const [svcRes, barRes] = await Promise.all([
        api.get<{ items: ServiceOption[] }>("/api/services"),
        api.get<{ items: BarberOption[] }>("/api/barbers"),
      ]);
      setServices(svcRes.items);
      setBarbers(barRes.items);
    } catch (err) {
      console.error("Gagal memuat metadata:", err);
    }
  };

  useEffect(() => {
    void Promise.all([fetchQueue(), fetchMeta()]).finally(() => setLoading(false));

    // Coba koneksi SSE untuk sinkronisasi real-time antrean
    let sse: EventSource | null = null;
    try {
      sse = new EventSource("/api/queue/stream", { withCredentials: true });
      sse.addEventListener("ping", () => {
        void fetchQueue();
      });
      sse.onerror = () => {
        sse?.close();
      };
    } catch {
      // Fallback polling
    }

    // Polling fallback antrean setiap 15 detik
    const timer = setInterval(() => {
      void fetchQueue();
    }, 15000);

    return () => {
      clearInterval(timer);
      sse?.close();
    };
  }, []);

  const handleAddQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServiceIds.length === 0) {
      setError("Pilih minimal satu layanan.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/queue", {
        customerName,
        barberId: selectedBarberId ? selectedBarberId : null,
        serviceIds: selectedServiceIds,
      });
      setCustomerName("");
      setSelectedBarberId("");
      setSelectedServiceIds([]);
      setModalOpen(false);
      await fetchQueue();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menambahkan antrean.");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, newStatus: "waiting" | "in_service" | "done" | "cancelled") => {
    try {
      await api.patch(`/api/queue/${id}/status`, { status: newStatus });
      await fetchQueue();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal mengubah status antrean.");
    }
  };

  const waitingList = queue.filter((q) => q.status === "waiting");
  const inServiceList = queue.filter((q) => q.status === "in_service");
  const doneList = queue.filter((q) => q.status === "done");

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f4f4f5]">Antrean Hari Ini</h1>
          <p className="text-sm text-[#71717a] mt-1">Papan kendali antrean pelanggan dan kapster</p>
        </div>
        <Button onClick={() => { setError(null); setModalOpen(true); }}>
          + Antrean Baru
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[#71717a]">Memuat papan antrean...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Kolom Menunggu */}
          <div className="bg-[#1a1a20] rounded-2xl border border-[#27272a] p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
              <span className="font-semibold text-sm text-[#f4f4f5] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
                Menunggu ({waitingList.length})
              </span>
            </div>
            <div className="flex-1 space-y-3 mt-4 overflow-y-auto max-h-[65dvh]">
              {waitingList.length === 0 ? (
                <p className="text-xs text-[#71717a] text-center py-8">Tidak ada antrean menunggu</p>
              ) : (
                waitingList.map((item) => (
                  <div key={item.id} className="p-4 bg-[#27272a]/50 rounded-xl border border-[#27272a] space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-2xl font-black text-[#C6FF3D]">#{item.queueNumber}</span>
                      <span className="text-xs text-[#71717a]">
                        {new Date(item.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="font-semibold text-[#f4f4f5]">{item.customerName}</div>
                    <div className="text-xs text-[#71717a]">
                      Kapster: <span className="text-[#f4f4f5]">{item.barberName ?? "Bebas"}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.services.map((s) => (
                        <span key={s.id} className="text-[10px] bg-[#101014] text-[#71717a] px-2 py-0.5 rounded">
                          {s.name}
                        </span>
                      ))}
                    </div>
                    <div className="pt-2 flex gap-2">
                      <Button size="sm" className="w-full" onClick={() => void updateStatus(item.id, "in_service")}>
                        Mulai Cukur
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => void updateStatus(item.id, "cancelled")}>
                        ✕
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Kolom Sedang Dilayani */}
          <div className="bg-[#1a1a20] rounded-2xl border border-[#27272a] p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
              <span className="font-semibold text-sm text-[#f4f4f5] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C6FF3D] animate-pulse"></span>
                Sedang Dilayani ({inServiceList.length})
              </span>
            </div>
            <div className="flex-1 space-y-3 mt-4 overflow-y-auto max-h-[65dvh]">
              {inServiceList.length === 0 ? (
                <p className="text-xs text-[#71717a] text-center py-8">Tidak ada yang sedang dicukur</p>
              ) : (
                inServiceList.map((item) => (
                  <div key={item.id} className="p-4 bg-[#27272a]/70 rounded-xl border border-[#C6FF3D]/30 space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-2xl font-black text-[#C6FF3D]">#{item.queueNumber}</span>
                      <Badge variant="success">Sedang Kursi</Badge>
                    </div>
                    <div className="font-semibold text-[#f4f4f5]">{item.customerName}</div>
                    <div className="text-xs text-[#71717a]">
                      Kapster: <span className="text-[#C6FF3D] font-medium">{item.barberName ?? "Kapster"}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.services.map((s) => (
                        <span key={s.id} className="text-[10px] bg-[#101014] text-[#f4f4f5] px-2 py-0.5 rounded">
                          {s.name}
                        </span>
                      ))}
                    </div>
                    <div className="pt-2">
                      <Button size="sm" variant="secondary" className="w-full" onClick={() => void updateStatus(item.id, "done")}>
                        Selesai Cukur (Ke Kasir)
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Kolom Selesai */}
          <div className="bg-[#1a1a20] rounded-2xl border border-[#27272a] p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
              <span className="font-semibold text-sm text-[#f4f4f5] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-500"></span>
                Selesai Hari Ini ({doneList.length})
              </span>
              {isOwner && doneList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearDoneQueue}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
                  title="Bersihkan daftar antrean selesai hari ini"
                >
                  Bersihkan
                </button>
              )}
            </div>
            <div className="flex-1 space-y-3 mt-4 overflow-y-auto max-h-[65dvh]">
              {doneList.length === 0 ? (
                <p className="text-xs text-[#71717a] text-center py-8">Belum ada antrean selesai</p>
              ) : (
                doneList.map((item) => (
                  <div key={item.id} className="p-3 bg-[#101014] rounded-xl border border-[#27272a] flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-[#f4f4f5]">#{item.queueNumber} - {item.customerName}</span>
                      <p className="text-[#71717a]">{item.barberName ?? "Kapster"}</p>
                    </div>
                    <Badge variant="neutral">Selesai</Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Antrean */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Pendaftaran Antrean Baru">
        <form onSubmit={(e) => void handleAddQueue(e)} className="space-y-4">
          {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-xl">{error}</div>}

          <Input
            label="Nama Pelanggan"
            placeholder="Contoh: Mas Agus"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1 w-full text-left">
            <label className="text-sm font-medium text-[#f4f4f5]">Pilih Kapster</label>
            <select
              value={selectedBarberId}
              onChange={(e) => setSelectedBarberId(e.target.value)}
              className="w-full px-4 py-3 min-h-12 bg-[#1a1a20] border border-[#27272a] rounded-xl text-[#f4f4f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#C6FF3D]"
            >
              <option value="">-- Kapster Siap / Siapa Saja --</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 w-full text-left">
            <label className="text-sm font-medium text-[#f4f4f5]">Pilih Layanan</label>
            <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-[#101014] rounded-xl border border-[#27272a]">
              {services.map((s) => (
                <label key={s.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#27272a] cursor-pointer text-sm">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedServiceIds.includes(s.id)}
                      onChange={() => toggleService(s.id)}
                      className="accent-[#C6FF3D] w-4 h-4"
                    />
                    <span>{s.name}</span>
                  </div>
                  <span className="text-xs text-[#71717a]">
                    Rp {s.priceIdr.toLocaleString("id-ID")}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" loading={saving} className="w-full">
              Daftarkan ke Antrean
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
