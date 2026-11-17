import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api.ts";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";

interface BookingInfo {
  barbershop: {
    id: string;
    name: string;
    slug: string;
    address: string;
    phone: string | null;
    openTime: string;
    closeTime: string;
  };
  barbers: Array<{ id: string; displayName: string; skills: string[] }>;
  services: Array<{
    id: string;
    name: string;
    priceIdr: number;
    durationMinutes: number;
    description: string;
  }>;
}

export default function PublicBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [info, setInfo] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Booking
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10));
  const [bookingTime, setBookingTime] = useState("10:00");
  const [submitting, setSubmitting] = useState(false);
  const [successBooking, setSuccessBooking] = useState<{
    serviceName: string;
    startsAt: string;
  } | null>(null);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  useEffect(() => {
    if (!slug) return;
    api
      .get<BookingInfo>(`/public/${slug}/info`)
      .then((res) => {
        setInfo(res);
        if (res.services.length > 0) setSelectedServiceId(res.services[0]!.id);
        if (res.barbers.length > 0) setSelectedBarberId(res.barbers[0]!.id);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Barbershop tidak ditemukan.");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    setSubmitting(true);
    setError(null);
    try {
      const startsAt = new Date(`${bookingDate}T${bookingTime}:00+07:00`).toISOString();
      const res = await api.post<{ serviceName: string; startsAt: string }>(`/public/${slug}/bookings`, {
        barberId: selectedBarberId,
        serviceId: selectedServiceId,
        customerName,
        customerPhone: customerPhone.trim() ? customerPhone.trim() : null,
        startsAt,
      });
      setSuccessBooking(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memesan jadwal cukur.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#101014] text-[#f4f4f5] flex items-center justify-center p-4">
        <p className="text-sm text-[#71717a]">Memuat halaman booking...</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-dvh bg-[#101014] text-[#f4f4f5] flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-[#1a1a20] p-6 rounded-2xl border border-[#27272a] text-center space-y-3">
          <div className="text-3xl text-red-400">⚠️</div>
          <h2 className="text-lg font-bold text-[#f4f4f5]">Barbershop Tidak Ditemukan</h2>
          <p className="text-xs text-[#71717a]">{error ?? "Alamat link booking salah atau tidak aktif."}</p>
        </div>
      </div>
    );
  }

  if (successBooking) {
    return (
      <div className="min-h-dvh bg-[#101014] text-[#f4f4f5] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#1a1a20] p-6 rounded-2xl border border-[#27272a] text-center space-y-4">
          <div className="w-14 h-14 bg-green-900/40 text-[#C6FF3D] rounded-full flex items-center justify-center mx-auto text-3xl font-black">
            ✓
          </div>
          <h2 className="text-xl font-bold text-[#f4f4f5]">Booking Berhasil Dikonfirmasi!</h2>
          <div className="p-4 bg-[#101014] rounded-xl border border-[#27272a] text-xs text-left space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#71717a]">Barbershop:</span>
              <span className="font-bold text-[#f4f4f5]">{info.barbershop.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#71717a]">Layanan:</span>
              <span className="font-semibold text-[#C6FF3D]">{successBooking.serviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#71717a]">Waktu:</span>
              <span className="text-[#f4f4f5]">
                {new Date(successBooking.startsAt).toLocaleString("id-ID", {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#71717a]">Pelanggan:</span>
              <span className="text-[#f4f4f5]">{customerName}</span>
            </div>
          </div>

          <p className="text-xs text-[#71717a]">
            Silakan datang tepat waktu 5 menit sebelum jadwal. Hubungi barbershop di {info.barbershop.phone ?? "toko"} bila ada perubahan.
          </p>

          <Button onClick={() => setSuccessBooking(null)} className="w-full">
            Buat Booking Baru
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#101014] text-[#f4f4f5] p-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-[#1a1a20] rounded-2xl border border-[#27272a] p-6 space-y-5 shadow-2xl">
        {/* Header Toko */}
        <div className="text-center space-y-1 border-b border-[#27272a] pb-4">
          <span className="text-xs font-bold text-[#C6FF3D] uppercase tracking-wider">Reservasi Online</span>
          <h1 className="text-2xl font-black text-[#f4f4f5]">{info.barbershop.name}</h1>
          <p className="text-xs text-[#71717a]">{info.barbershop.address}</p>
          <p className="text-[11px] text-[#71717a]">
            Jam Operasional: {info.barbershop.openTime} - {info.barbershop.closeTime}
          </p>
        </div>

        {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-xl">{error}</div>}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Input
            label="Nama Anda"
            placeholder="Contoh: Dimas Aditya"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
            minLength={2}
          />

          <Input
            label="Nomor WhatsApp"
            placeholder="081234567890"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            helper="Untuk konfirmasi dan pengingat jadwal"
          />

          {/* Pilih Layanan */}
          <div className="flex flex-col gap-1 w-full text-left">
            <label className="text-sm font-medium text-[#f4f4f5]">Pilih Layanan</label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full px-4 py-3 min-h-12 bg-[#101014] border border-[#27272a] rounded-xl text-[#f4f4f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#C6FF3D]"
              required
            >
              {info.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatRupiah(s.priceIdr)} • {s.durationMinutes} menit)
                </option>
              ))}
            </select>
          </div>

          {/* Pilih Kapster */}
          <div className="flex flex-col gap-1 w-full text-left">
            <label className="text-sm font-medium text-[#f4f4f5]">Pilih Kapster</label>
            <select
              value={selectedBarberId}
              onChange={(e) => setSelectedBarberId(e.target.value)}
              className="w-full px-4 py-3 min-h-12 bg-[#101014] border border-[#27272a] rounded-xl text-[#f4f4f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#C6FF3D]"
              required
            >
              {info.barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName} {b.skills.length > 0 ? `(${b.skills.join(", ")})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Tanggal & Jam */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tanggal"
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              required
            />
            <Input
              label="Jam"
              type="time"
              value={bookingTime}
              onChange={(e) => setBookingTime(e.target.value)}
              required
            />
          </div>

          <div className="pt-2">
            <Button type="submit" loading={submitting} className="w-full text-base font-bold" size="lg">
              Konfirmasi Booking
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
