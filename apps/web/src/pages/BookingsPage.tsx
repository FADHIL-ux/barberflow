import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api.ts";
import { Badge } from "../components/ui/Badge.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { Spinner } from "../components/ui/Spinner.tsx";

export interface BookingItem {
  id: string;
  barber_id: string;
  barber_name: string;
  service_id: string;
  service_name: string;
  duration_minutes: number;
  customer_name: string;
  customer_phone: string | null;
  starts_at: string;
  ends_at: string;
  status: "booked" | "cancelled" | "done";
  created_at: string;
}

interface ServiceOption {
  id: string;
  name: string;
  durationMinutes: number;
  priceIdr: number;
  isActive: boolean;
}

interface BarberOption {
  id: string;
  displayName: string;
  isActive: boolean;
}

type FilterTab = "all" | "upcoming" | "done" | "cancelled";

export default function BookingsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("upcoming");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal Manual Booking
  const [modalOpen, setModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [startsAtInput, setStartsAtInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<{ items: BookingItem[] }>("/api/bookings");
      setBookings(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat jadwal booking.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMeta = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void fetchBookings();
    void fetchMeta();
    // Auto-refresh setiap 30 detik untuk menerima booking baru
    const interval = setInterval(() => {
      void fetchBookings();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchBookings, fetchMeta]);

  const getDefaultStartsAt = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 15);
    d.setSeconds(0, 0);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const openCreateModal = () => {
    setCustomerName("");
    setCustomerPhone("");
    const activeSvcs = services.filter((s) => s.isActive);
    const activeBars = barbers.filter((b) => b.isActive);
    setSelectedServiceId(activeSvcs[0]?.id ?? "");
    setSelectedBarberId(activeBars[0]?.id ?? "");
    setStartsAtInput(getDefaultStartsAt());
    setFormError(null);
    setModalOpen(true);
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setFormError("Nama pelanggan wajib diisi.");
      return;
    }
    if (!selectedServiceId) {
      setFormError("Pilih layanan cukur.");
      return;
    }
    if (!selectedBarberId) {
      setFormError("Pilih kapster yang bertugas.");
      return;
    }
    if (!startsAtInput) {
      setFormError("Waktu booking wajib diisi.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() ? customerPhone.trim() : null,
        serviceId: selectedServiceId,
        barberId: selectedBarberId,
        startsAt: new Date(startsAtInput).toISOString(),
      };

      await api.post("/api/bookings", payload);
      setModalOpen(false);
      await fetchBookings();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menyimpan jadwal booking.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: "done" | "cancelled") => {
    setUpdatingId(id);
    try {
      await api.patch(`/api/bookings/${id}/status`, { status });
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status } : b))
      );
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal memperbarui status booking.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteBooking = async (id: string, custName: string) => {
    if (!confirm(`Hapus jadwal booking untuk "${custName}" secara permanen?`)) return;
    setUpdatingId(id);
    try {
      await api.del(`/api/bookings/${id}`);
      setBookings((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus booking.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Navigasi ke halaman kasir dengan data booking ter-prefill
  const handlePayAtCashier = (booking: BookingItem) => {
    const svc = services.find((s) => s.id === booking.service_id);
    sessionStorage.setItem(
      "prefillFromBooking",
      JSON.stringify({
        bookingId: booking.id,
        customerName: booking.customer_name,
        barberId: booking.barber_id,
        barberName: booking.barber_name,
        serviceId: booking.service_id,
        serviceName: booking.service_name,
        servicePriceIdr: svc?.priceIdr ?? 0,
      })
    );
    navigate("/kasir");
  };

  const calculateEstimatedEnd = (startLocal: string, serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc || !startLocal) return "-";
    const start = new Date(startLocal);
    if (isNaN(start.getTime())) return "-";
    const end = new Date(start.getTime() + svc.durationMinutes * 60000);
    return (
      end.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) +
      ` (Durasi ${svc.durationMinutes} mnt)`
    );
  };

  const now = new Date();

  // Filter booking sesuai tab yang dipilih
  const filteredBookings = bookings.filter((b) => {
    if (filter === "upcoming") {
      return b.status === "booked" && new Date(b.ends_at) >= now;
    }
    if (filter === "done") {
      return b.status === "done";
    }
    if (filter === "cancelled") {
      return b.status === "cancelled";
    }
    return true; // "all"
  });

  const getStatusBadge = (status: BookingItem["status"]) => {
    switch (status) {
      case "booked":
        return <Badge variant="warning">Booked</Badge>;
      case "done":
        return <Badge variant="success">Selesai</Badge>;
      case "cancelled":
        return <Badge variant="danger">Dibatalkan</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTimeOnly = (iso: string) => {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#f4f4f5]">Jadwal Booking & Janji Temu</h1>
          <p className="text-sm text-[#71717a] mt-0.5">
            Kelola pesanan jadwal cukur pelanggan online maupun input janji temu manual
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            + Input Booking Manual
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setLoading(true);
              void fetchBookings();
            }}
            disabled={loading}
          >
            {loading ? "Memuat..." : "Segarkan"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-[#27272a] pb-2 overflow-x-auto">
        <button
          onClick={() => setFilter("upcoming")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            filter === "upcoming"
              ? "bg-[#C6FF3D] text-[#101014]"
              : "text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#1a1a20]"
          }`}
        >
          Akan Datang ({bookings.filter((b) => b.status === "booked" && new Date(b.ends_at) >= now).length})
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            filter === "all"
              ? "bg-[#C6FF3D] text-[#101014]"
              : "text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#1a1a20]"
          }`}
        >
          Semua ({bookings.length})
        </button>
        <button
          onClick={() => setFilter("done")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            filter === "done"
              ? "bg-[#C6FF3D] text-[#101014]"
              : "text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#1a1a20]"
          }`}
        >
          Selesai ({bookings.filter((b) => b.status === "done").length})
        </button>
        <button
          onClick={() => setFilter("cancelled")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            filter === "cancelled"
              ? "bg-[#C6FF3D] text-[#101014]"
              : "text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#1a1a20]"
          }`}
        >
          Dibatalkan ({bookings.filter((b) => b.status === "cancelled").length})
        </button>
      </div>

      {/* Booking List */}
      {loading && bookings.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-[#1a1a20] border border-[#27272a] rounded-2xl p-12 text-center space-y-3">
          <div className="text-3xl text-[#71717a]">📅</div>
          <h3 className="text-base font-bold text-[#f4f4f5]">Tidak Ada Booking Ditemukan</h3>
          <p className="text-xs text-[#71717a] max-w-sm mx-auto">
            {filter === "upcoming"
              ? "Belum ada jadwal booking yang akan datang. Pelanggan dapat memesan lewat tautan online atau dimasukkan manual lewat tombol di atas."
              : "Tidak ada data booking pada kategori ini."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBookings.map((booking) => {
            const isUpdating = updatingId === booking.id;
            return (
              <div
                key={booking.id}
                className="bg-[#1a1a20] border border-[#27272a] rounded-2xl p-5 space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-base text-[#f4f4f5]">
                        {booking.customer_name}
                      </h3>
                      {booking.customer_phone ? (
                        <a
                          href={`https://wa.me/${booking.customer_phone.replace(/^0/, "62").replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#C6FF3D] hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <span>💬</span> {booking.customer_phone}
                        </a>
                      ) : (
                        <span className="text-xs text-[#71717a]">Tanpa nomor telepon</span>
                      )}
                    </div>
                    {getStatusBadge(booking.status)}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#27272a] space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#71717a]">Layanan:</span>
                      <span className="font-semibold text-[#f4f4f5]">
                        {booking.service_name} ({booking.duration_minutes} mnt)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#71717a]">Kapster:</span>
                      <span className="font-semibold text-[#f4f4f5]">{booking.barber_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#71717a]">Jadwal:</span>
                      <span className="font-bold text-[#C6FF3D]">
                        {formatDateTime(booking.starts_at)} - {formatTimeOnly(booking.ends_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bar Tombol Aksi */}
                <div className="pt-3 border-t border-[#27272a] flex items-center justify-between gap-2">
                  {booking.status === "booked" ? (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1 text-xs"
                        disabled={isUpdating}
                        onClick={() => handlePayAtCashier(booking)}
                      >
                        💳 Bayar di Kasir
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-900/20"
                        disabled={isUpdating}
                        onClick={() => {
                          if (confirm(`Batalkan booking untuk ${booking.customer_name}?`)) {
                            void handleUpdateStatus(booking.id, "cancelled");
                          }
                        }}
                      >
                        Batalkan
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-[#71717a]">
                      {booking.status === "done" ? "✓ Telah selesai & dibayar" : "✗ Telah dibatalkan"}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    disabled={isUpdating}
                    onClick={() => void handleDeleteBooking(booking.id, booking.customer_name)}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Input Booking Manual */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Input Booking Manual"
      >
        <form onSubmit={(e) => void handleCreateBooking(e)} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-xl">
              {formError}
            </div>
          )}

          <Input
            label="Nama Pelanggan"
            placeholder="Contoh: Mas Budi"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
            minLength={2}
          />

          <Input
            label="No. WhatsApp / HP (Opsional)"
            placeholder="Contoh: 08123456789"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />

          <div className="flex flex-col gap-1 w-full text-left">
            <label className="text-sm font-medium text-[#f4f4f5]">Pilih Layanan</label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              required
              className="w-full px-4 py-3 min-h-12 bg-[#1a1a20] border border-[#27272a] rounded-xl text-[#f4f4f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#C6FF3D]"
            >
              <option value="">-- Pilih Layanan --</option>
              {services
                .filter((s) => s.isActive)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMinutes} menit - Rp {s.priceIdr.toLocaleString("id-ID")})
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 w-full text-left">
            <label className="text-sm font-medium text-[#f4f4f5]">Pilih Kapster</label>
            <select
              value={selectedBarberId}
              onChange={(e) => setSelectedBarberId(e.target.value)}
              required
              className="w-full px-4 py-3 min-h-12 bg-[#1a1a20] border border-[#27272a] rounded-xl text-[#f4f4f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#C6FF3D]"
            >
              <option value="">-- Pilih Kapster --</option>
              {barbers
                .filter((b) => b.isActive)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.displayName}
                  </option>
                ))}
            </select>
          </div>

          <Input
            type="datetime-local"
            label="Waktu Booking Mulai"
            value={startsAtInput}
            onChange={(e) => setStartsAtInput(e.target.value)}
            required
          />

          {selectedServiceId && startsAtInput && (
            <div className="p-3 bg-[#101014] rounded-xl border border-[#27272a] text-xs text-[#71717a] flex justify-between">
              <span>Estimasi Selesai:</span>
              <span className="font-semibold text-[#C6FF3D]">
                {calculateEstimatedEnd(startsAtInput, selectedServiceId)}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-[#27272a]">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan Booking"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
