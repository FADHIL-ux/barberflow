import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Modal } from "../components/ui/Modal.tsx";

interface TransactionItem {
  id: string;
  receiptNumber: string;
  tempReceiptRef: string | null;
  customerName: string | null;
  barberName: string | null;
  subtotalIdr: number;
  discountIdr: number;
  totalIdr: number;
  paymentMethod: string;
  occurredAt: string;
  itemsCount: number;
}

interface ReceiptDetail {
  id: string;
  receiptNumber: string;
  occurredAt: string;
  subtotalIdr: number;
  discountIdr: number;
  totalIdr: number;
  paymentMethod: string;
  barberName: string | null;
  barbershopName: string;
  address: string;
  phone: string | null;
  receiptFooter: string;
  paperWidthMm: 58 | 80;
  items: Array<{
    name: string;
    unitPriceIdr: number;
    quantity: number;
    lineTotalIdr: number;
    kind: string;
  }>;
}

export default function TransactionsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [items, setItems] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptDetail | null>(null);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ items: TransactionItem[] }>("/api/transactions");
      setItems(res.items ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTransactions();
  }, []);

  const openReceiptModal = async (id: string) => {
    try {
      const res = await api.get<ReceiptDetail>(`/api/transactions/${id}/receipt`);
      setSelectedReceipt(res);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal memuat struk transaksi.");
    }
  };

  const handleReprint = async () => {
    if (!selectedReceipt) return;
    try {
      await api.post(`/api/transactions/${selectedReceipt.id}/reprint`);
      window.print();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal mencatat cetak ulang.");
    }
  };

  const handleDeleteOne = async (id: string, receiptNumber: string) => {
    if (!window.confirm(`Hapus transaksi nota #${receiptNumber}? Data komisi dan item terkait juga akan dibersihkan.`)) {
      return;
    }
    try {
      await api.del(`/api/transactions/${id}`);
      await fetchTransactions();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus transaksi.");
    }
  };

  const handleClearAll = async () => {
    const confirmation = window.prompt(
      "PERINGATAN: Anda akan menghapus SELURUH riwayat transaksi toko dan me-reset nomor struk kembali ke awal.\n\nKetik 'BERSIHKAN' untuk mengonfirmasi:"
    );
    if (confirmation !== "BERSIHKAN") {
      if (confirmation !== null) alert("Kata konfirmasi salah. Pembersihan riwayat dibatalkan.");
      return;
    }

    try {
      setClearing(true);
      await api.del("/api/transactions/clear-all");
      alert("Seluruh riwayat transaksi berhasil dibersihkan dan nomor struk telah di-reset ke awal.");
      await fetchTransactions();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal membersihkan riwayat transaksi.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f4f4f5]">Riwayat Transaksi</h1>
          <p className="text-sm text-[#71717a] mt-1">Daftar transaksi kasir dan cetak ulang nota</p>
        </div>

        {/* Tombol Khusus Owner untuk Reset/Bersihkan Transaksi */}
        {isOwner && items.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={clearing}
            onClick={() => void handleClearAll()}
            className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-red-900/50"
          >
            {clearing ? "Membersihkan..." : "🗑️ Bersihkan Semua Riwayat"}
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[#71717a]">Memuat riwayat transaksi...</p>
      ) : items.length === 0 ? (
        <div className="bg-[#1a1a20] rounded-2xl border border-[#27272a] p-12 text-center space-y-2">
          <p className="text-base font-semibold text-[#f4f4f5]">Belum ada riwayat transaksi</p>
          <p className="text-xs text-[#71717a]">Semua transaksi kasir yang selesai akan tercatat otomatis di sini.</p>
        </div>
      ) : (
        <div className="bg-[#1a1a20] rounded-2xl border border-[#27272a] overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase bg-[#27272a] text-[#71717a]">
              <tr>
                <th className="px-4 py-3">No. Nota</th>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Pelanggan</th>
                <th className="px-4 py-3">Kapster</th>
                <th className="px-4 py-3">Metode</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {items.map((tx) => (
                <tr key={tx.id} className="hover:bg-[#27272a]/30">
                  <td className="px-4 py-3 font-mono font-bold text-[#C6FF3D]">
                    #{tx.receiptNumber}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#71717a]">
                    {new Date(tx.occurredAt).toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#f4f4f5]">
                    {tx.customerName ?? "Umum"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#71717a]">
                    {tx.barberName ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#101014] text-[#f4f4f5]">
                      {tx.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#f4f4f5]">
                    {formatRupiah(tx.totalIdr)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => void openReceiptModal(tx.id)}>
                        Lihat Nota
                      </Button>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteOne(tx.id, tx.receiptNumber)}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20 transition-colors cursor-pointer"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Detail Struk & Cetak Ulang */}
      <Modal
        open={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        title={`Nota #${selectedReceipt?.receiptNumber}`}
      >
        {selectedReceipt && (
          <div className="space-y-4">
            <div
              id="thermal-receipt"
              className="bg-white text-black p-4 rounded-xl font-mono text-xs leading-tight shadow"
            >
              <div className="text-center pb-2 border-b border-dashed border-gray-400">
                <div className="font-bold uppercase text-sm">{selectedReceipt.barbershopName}</div>
                <div className="text-[10px] text-gray-700">{selectedReceipt.address}</div>
                <div className="text-[10px] text-gray-500">
                  {new Date(selectedReceipt.occurredAt).toLocaleString("id-ID")}
                </div>
              </div>

              <div className="py-2 border-b border-dashed border-gray-400 space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span>No. Nota:</span>
                  <span className="font-bold">#{selectedReceipt.receiptNumber}</span>
                </div>
                {selectedReceipt.barberName && (
                  <div className="flex justify-between">
                    <span>Kapster:</span>
                    <span>{selectedReceipt.barberName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Metode:</span>
                  <span className="uppercase">{selectedReceipt.paymentMethod}</span>
                </div>
              </div>

              <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
                {selectedReceipt.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between text-[10px]">
                    <span>
                      {i.name} x{i.quantity}
                    </span>
                    <span className="font-semibold">{formatRupiah(i.lineTotalIdr)}</span>
                  </div>
                ))}
              </div>

              <div className="py-2 space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatRupiah(selectedReceipt.subtotalIdr)}</span>
                </div>
                {selectedReceipt.discountIdr > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Diskon:</span>
                    <span>-{formatRupiah(selectedReceipt.discountIdr)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold pt-1 border-t border-dashed border-gray-400">
                  <span>Total:</span>
                  <span>{formatRupiah(selectedReceipt.totalIdr)}</span>
                </div>
              </div>

              <div className="text-center pt-2 border-t border-dashed border-gray-400 text-[10px] text-gray-600 italic">
                {selectedReceipt.receiptFooter}
              </div>
            </div>

            <Button onClick={() => void handleReprint()} className="w-full">
              🖨️ Cetak Ulang Struk (Audit Dicatat)
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
