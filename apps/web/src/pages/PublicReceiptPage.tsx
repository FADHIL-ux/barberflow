import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api.ts";
import { Button } from "../components/ui/Button.tsx";

interface PublicReceiptData {
  receiptNumber: number | string;
  barbershopName: string;
  address: string;
  footer: string;
  paperWidthMm: 58 | 80;
  occurredAt: string;
  barberName: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unitPriceIdr: number;
    lineTotalIdr: number;
  }>;
  subtotalIdr: number;
  discountIdr: number;
  totalIdr: number;
  paymentMethod: string;
}

export default function PublicReceiptPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  useEffect(() => {
    if (!token) return;
    api
      .get<{ receipt: PublicReceiptData }>(`/public/receipt/${token}`)
      .then((res) => setData(res.receipt))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Gagal memuat struk digital.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  const handleShareWa = () => {
    const text = encodeURIComponent(
      `Halo! Berikut tautan nota digital pangkas rambut Anda dari ${data?.barbershopName}: ${window.location.href}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#101014] text-[#f4f4f5] flex items-center justify-center p-4">
        <p className="text-sm text-[#71717a]">Memuat nota digital...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-dvh bg-[#101014] text-[#f4f4f5] flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-[#1a1a20] p-6 rounded-2xl border border-[#27272a] text-center space-y-3">
          <div className="text-3xl text-red-400">⚠️</div>
          <h2 className="text-lg font-bold text-[#f4f4f5]">Nota Tidak Ditemukan</h2>
          <p className="text-xs text-[#71717a]">{error ?? "Tautan nota salah atau tidak berlaku."}</p>
        </div>
      </div>
    );
  }

  // Pengaturan lebar kertas termal (58mm atau 80mm)
  const is58mm = data.paperWidthMm === 58;

  return (
    <div className="min-h-dvh bg-[#101014] p-4 flex flex-col items-center justify-center text-[#101014]">
      {/* Tombol aksi (disembunyikan saat window.print) */}
      <div className="w-full max-w-sm mb-4 flex gap-2 print:hidden">
        <Button onClick={handlePrint} className="flex-1">
          🖨️ Cetak Struk
        </Button>
        <Button onClick={handleShareWa} variant="secondary" className="flex-1">
          💬 Bagikan WA
        </Button>
      </div>

      {/* Kontainer Struk Termal yang dicetak */}
      <div
        id="thermal-receipt"
        className={`bg-white p-5 rounded-xl shadow-2xl font-mono text-xs leading-tight print:shadow-none print:p-0 print:m-0 print:w-full ${
          is58mm ? "w-[58mm] max-w-[58mm]" : "w-[80mm] max-w-[80mm]"
        }`}
      >
        {/* Header Toko */}
        <div className="text-center space-y-1 pb-3 border-b border-dashed border-gray-400">
          <h1 className="text-base font-black uppercase tracking-wider">{data.barbershopName}</h1>
          <p className="text-[10px] text-gray-700">{data.address}</p>
          <p className="text-[10px] text-gray-600">
            {new Date(data.occurredAt).toLocaleString("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>

        {/* Info Nota */}
        <div className="py-2 border-b border-dashed border-gray-400 space-y-0.5 text-[11px]">
          <div className="flex justify-between">
            <span>No. Nota:</span>
            <span className="font-bold">#{data.receiptNumber}</span>
          </div>
          {data.barberName && (
            <div className="flex justify-between">
              <span>Kapster:</span>
              <span className="font-bold">{data.barberName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Metode:</span>
            <span className="uppercase font-semibold">{data.paymentMethod}</span>
          </div>
        </div>

        {/* Daftar Item */}
        <div className="py-2 border-b border-dashed border-gray-400 space-y-2">
          {data.items.map((item, idx) => (
            <div key={idx} className="space-y-0.5">
              <div className="font-bold text-[11px]">{item.name}</div>
              <div className="flex justify-between text-[10px] text-gray-700">
                <span>
                  {item.quantity} x {formatRupiah(item.unitPriceIdr)}
                </span>
                <span className="font-semibold text-black">{formatRupiah(item.lineTotalIdr)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Total & Diskon */}
        <div className="py-2 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatRupiah(data.subtotalIdr)}</span>
          </div>
          {data.discountIdr > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Diskon:</span>
              <span>-{formatRupiah(data.discountIdr)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-black border-t border-dashed border-gray-400 pt-1">
            <span>TOTAL:</span>
            <span>{formatRupiah(data.totalIdr)}</span>
          </div>
        </div>

        {/* Footer Nota */}
        <div className="text-center pt-4 border-t border-dashed border-gray-400 space-y-1">
          <p className="text-[10px] italic">{data.footer}</p>
          <p className="text-[8px] text-gray-500">Power by BarberFlow SaaS</p>
        </div>
      </div>
    </div>
  );
}
