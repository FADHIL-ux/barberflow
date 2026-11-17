import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../lib/api.ts";
import { Badge } from "../components/ui/Badge.tsx";
import { Button } from "../components/ui/Button.tsx";
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

type FilterTab = "all" | "upcoming" | "done" | "cancelled";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("upcoming");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  useEffect(() => {
    void fetchBookings();
    // Auto-refresh setiap 30 detik untuk menerima booking online baru
    const interval = setInterval(() => {
      void fetchBookings();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchBookings]);

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
          <h1 className="text-2xl font-black text-[#f4f4f5]">Jadwal Booking Online</h1>
          <p className="text-sm text-[#71717a] mt-0.5">
            Kelola pesanan jadwal cukur pelanggan dari halaman publik barbershop Anda
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setLoading(true);
            void fetchBookings();
          }}
          disabled={loading}
          className="self-start sm:self-auto"
        >
          {loading ? "Memuat..." : "Segarkan"}
        </Button>
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
              ? "Belum ada jadwal booking yang akan datang. Pelanggan dapat memesan lewat tautan booking publik toko Anda."
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

                {/* Aksi hanya untuk status 'booked' */}
                {booking.status === "booked" && (
                  <div className="pt-3 border-t border-[#27272a] flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1 text-xs"
                      disabled={isUpdating}
                      onClick={() => void handleUpdateStatus(booking.id, "done")}
                    >
                      {isUpdating ? "Memproses..." : "Tandai Selesai"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      disabled={isUpdating}
                      onClick={() => {
                        if (confirm(`Batalkan booking untuk ${booking.customer_name}?`)) {
                          void handleUpdateStatus(booking.id, "cancelled");
                        }
                      }}
                    >
                      Batalkan
                    </Button>
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
