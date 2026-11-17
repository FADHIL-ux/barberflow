import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Input } from "../../components/ui/Input.tsx";
import { QrCode } from "../../components/ui/QrCode.tsx";

interface ProfileData {
  name: string;
  slug?: string;
  address: string;
  phone: string | null;
  receiptFooter: string;
  paperWidthMm: 58 | 80;
  openTime: string;
  closeTime: string;
}

export default function ProfileSettingsPage() {
  const [data, setData] = useState<ProfileData>({
    name: "",
    slug: "",
    address: "",
    phone: "",
    receiptFooter: "Terima kasih, sampai jumpa kembali!",
    paperWidthMm: 58,
    openTime: "09:00",
    closeTime: "21:00",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    api
      .get<ProfileData>("/api/profile")
      .then((res) => {
        setData({
          ...res,
          phone: res.phone ?? "",
        });
      })
      .catch((err) => {
        setMsg({ type: "error", text: err instanceof ApiError ? err.message : "Gagal memuat profil." });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.put("/api/profile", {
        name: data.name,
        address: data.address,
        phone: data.phone?.trim() ? data.phone.trim() : null,
        receiptFooter: data.receiptFooter,
        paperWidthMm: data.paperWidthMm,
        openTime: data.openTime,
        closeTime: data.closeTime,
      });
      setMsg({ type: "success", text: "Profil dan preferensi struk berhasil disimpan!" });
    } catch (err) {
      setMsg({ type: "error", text: err instanceof ApiError ? err.message : "Gagal menyimpan profil." });
    } finally {
      setSaving(false);
    }
  };

  const bookingUrl = data.slug
    ? `${window.location.origin}/${data.slug}/book`
    : "";

  const copyBookingUrl = () => {
    if (!bookingUrl) return;
    void navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <p className="text-sm text-[#71717a]">Memuat data profil...</p>;

  return (
    <div className="space-y-8 max-w-lg">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <h2 className="text-lg font-semibold text-[#f4f4f5]">Informasi Toko & Kertas Struk</h2>

        {msg && (
          <div
            className={`p-3 rounded-xl text-sm ${
              msg.type === "success"
                ? "bg-green-900/30 border border-green-800 text-green-400"
                : "bg-red-900/30 border border-red-800 text-red-400"
            }`}
          >
            {msg.text}
          </div>
        )}

        <Input
          label="Nama Barbershop"
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          required
        />

        <Input
          label="Alamat Lengkap"
          value={data.address}
          onChange={(e) => setData({ ...data, address: e.target.value })}
          required
        />

        <Input
          label="Nomor Telepon / WhatsApp Toko"
          placeholder="08123456789"
          value={data.phone ?? ""}
          onChange={(e) => setData({ ...data, phone: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Jam Buka"
            type="time"
            value={data.openTime}
            onChange={(e) => setData({ ...data, openTime: e.target.value })}
            required
          />
          <Input
            label="Jam Tutup"
            type="time"
            value={data.closeTime}
            onChange={(e) => setData({ ...data, closeTime: e.target.value })}
            required
          />
        </div>

        <div className="flex flex-col gap-1 w-full text-left">
          <label className="text-sm font-medium text-[#f4f4f5]">Lebar Kertas Printer Termal</label>
          <div className="flex gap-4 mt-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="paperWidth"
                checked={data.paperWidthMm === 58}
                onChange={() => setData({ ...data, paperWidthMm: 58 })}
                className="accent-[#C6FF3D]"
              />
              58 mm (Printer Mini Portabel)
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="paperWidth"
                checked={data.paperWidthMm === 80}
                onChange={() => setData({ ...data, paperWidthMm: 80 })}
                className="accent-[#C6FF3D]"
              />
              80 mm (Printer Desktop Standar)
            </label>
          </div>
        </div>

        <Input
          label="Pesan Penutup Struk (Footer Nota)"
          value={data.receiptFooter}
          onChange={(e) => setData({ ...data, receiptFooter: e.target.value })}
          required
          helper="Ditampilkan pada bagian bawah cetakan nota kasir"
        />

        <Button type="submit" loading={saving} className="mt-4">
          Simpan Perubahan
        </Button>
      </form>

      {/* Bagian Tautan & QR Code Booking Online */}
      {data.slug && (
        <div className="pt-6 border-t border-[#27272a] space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#f4f4f5]">Tautan & QR Code Booking Online</h3>
            <p className="text-xs text-[#71717a] mt-0.5">
              Bagikan tautan atau cetak QR Code ini di meja kasir/pintu masuk agar pelanggan dapat reservasi online langsung.
            </p>
          </div>

          <div className="flex items-center gap-2 p-3 bg-[#101014] border border-[#27272a] rounded-xl text-xs">
            <span className="truncate flex-1 font-mono text-[#C6FF3D]">{bookingUrl}</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={copyBookingUrl}
              className="text-xs shrink-0"
            >
              {copied ? "Tersalin! ✓" : "Salin Link"}
            </Button>
          </div>

          <QrCode
            value={bookingUrl}
            size={180}
            label={`Scan untuk booking jadwal di ${data.name}`}
          />
        </div>
      )}
    </div>
  );
}


