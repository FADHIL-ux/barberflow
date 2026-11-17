import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Modal } from "../components/ui/Modal.tsx";

interface DailyReportData {
  date: string;
  financials: {
    revenueIdr: number;
    expensesIdr: number;
    commissionsIdr: number;
    profitIdr: number;
    transactionCount: number;
    byPaymentMethod: {
      cash: number;
      qris: number;
      transfer: number;
    };
  };
  topServices: Array<{ key: string; name: string; quantity: number; revenueIdr: number }>;
  topBarbers: Array<{ key: string; name: string; quantity: number; revenueIdr: number }>;
}

interface ExpenseItem {
  id: string;
  expenseDate: string;
  category: string;
  description: string;
  amountIdr: number;
}

export default function ReportPage() {
  const { user, plan } = useAuth();
  const isOwner = user?.role === "owner";

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<DailyReportData | null>(null);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Input Pengeluaran
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState("Operasional");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState(50000);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const fetchReport = async (date: string) => {
    try {
      setLoading(true);
      const [repRes, expRes] = await Promise.all([
        api.get<DailyReportData>(`/api/reports/daily?date=${date}`),
        api.get<{ items: ExpenseItem[] }>("/api/expenses"),
      ]);
      setReport(repRes);
      setExpenses(expRes.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (plan === "pro") {
      void fetchReport(selectedDate);
    } else {
      setLoading(false);
    }
  }, [plan, selectedDate]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingExpense(true);
    setExpenseError(null);
    try {
      await api.post("/api/expenses", {
        expenseDate: selectedDate,
        category: expenseCategory,
        description: expenseDesc,
        amountIdr: Number(expenseAmount),
      });
      setExpenseModalOpen(false);
      setExpenseDesc("");
      setExpenseAmount(50000);
      await fetchReport(selectedDate);
    } catch (err) {
      setExpenseError(err instanceof ApiError ? err.message : "Gagal menyimpan pengeluaran.");
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm("Hapus catatan pengeluaran ini?")) return;
    try {
      await api.del(`/api/expenses/${id}`);
      await fetchReport(selectedDate);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus pengeluaran.");
    }
  };

  if (plan !== "pro") {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto min-h-[60dvh] flex flex-col justify-center items-center">
        <div className="w-16 h-16 bg-yellow-900/30 text-yellow-400 rounded-full flex items-center justify-center text-3xl font-bold">
          ★
        </div>
        <h2 className="text-xl font-bold text-[#f4f4f5]">Laporan Keuangan Khusus Paket Pro</h2>
        <p className="text-sm text-[#71717a]">
          Upgrade ke paket Pro untuk mengakses ringkasan omset harian & bulanan, pencatatan biaya operasional, dan riwayat pembayaran pelanggan.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f4f4f5]">
            {isOwner ? "Laporan Keuangan & Kinerja" : "Laporan Kasir & Pengeluaran"}
          </h1>
          <p className="text-sm text-[#71717a] mt-1">
            {isOwner
              ? "Ringkasan omset, beban biaya, laba bersih, dan peringkat layanan terlaris"
              : "Riwayat pembayaran pelanggan hari ini, omset kasir, dan pencatatan biaya operasional"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto py-2 text-xs"
          />
          <Button onClick={() => { setExpenseError(null); setExpenseModalOpen(true); }} variant="secondary">
            + Catat Biaya
          </Button>
        </div>
      </div>

      {loading || !report ? (
        <p className="text-sm text-[#71717a]">Memuat laporan...</p>
      ) : (
        <>
          {/* Kartu Ringkasan Finansial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pendapatan / Omset */}
            <div className="p-5 bg-[#1a1a20] rounded-2xl border border-[#27272a] space-y-2">
              <span className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">
                Total Omset ({report.financials.transactionCount} Transaksi)
              </span>
              <div className="text-2xl font-black text-[#C6FF3D]">
                {formatRupiah(report.financials.revenueIdr)}
              </div>
              <div className="text-[11px] text-[#71717a] pt-1 border-t border-[#27272a] flex justify-between">
                <span>Tunai: {formatRupiah(report.financials.byPaymentMethod.cash)}</span>
                <span>QRIS/TF: {formatRupiah(report.financials.byPaymentMethod.qris + report.financials.byPaymentMethod.transfer)}</span>
              </div>
            </div>

            {/* Pengeluaran Toko */}
            <div className="p-5 bg-[#1a1a20] rounded-2xl border border-[#27272a] space-y-2">
              <span className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">
                Pengeluaran Toko
              </span>
              <div className="text-2xl font-black text-red-400">
                {formatRupiah(report.financials.expensesIdr)}
              </div>
              <p className="text-[11px] text-[#71717a] pt-1 border-t border-[#27272a]">
                Perlengkapan, konsumsi, dan operasional
              </p>
            </div>

            {/* Jika Owner: Tampilkan Komisi & Laba Bersih */}
            {isOwner ? (
              <>
                {/* Komisi Kapster */}
                <div className="p-5 bg-[#1a1a20] rounded-2xl border border-[#27272a] space-y-2">
                  <span className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">
                    Alokasi Komisi
                  </span>
                  <div className="text-2xl font-black text-yellow-400">
                    {formatRupiah(report.financials.commissionsIdr)}
                  </div>
                  <p className="text-[11px] text-[#71717a] pt-1 border-t border-[#27272a]">
                    Hak komisi staf kapster yang bertugas
                  </p>
                </div>

                {/* Laba Bersih */}
                <div className="p-5 bg-[#1a1a20] rounded-2xl border border-[#27272a] space-y-2">
                  <span className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">
                    Laba Bersih (Profit)
                  </span>
                  <div className={`text-2xl font-black ${report.financials.profitIdr >= 0 ? "text-emerald-400" : "text-red-500"}`}>
                    {formatRupiah(report.financials.profitIdr)}
                  </div>
                  <p className="text-[11px] text-[#71717a] pt-1 border-t border-[#27272a]">
                    Omset dikurangi pengeluaran & komisi
                  </p>
                </div>
              </>
            ) : (
              /* Jika Kasir: Tampilkan Total Transaksi & Status Kas */
              <div className="p-5 bg-[#1a1a20] rounded-2xl border border-[#27272a] space-y-2 sm:col-span-2">
                <span className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">
                  Total Transaksi Kasir
                </span>
                <div className="text-2xl font-black text-[#f4f4f5]">
                  {report.financials.transactionCount} Pelanggan Selesai
                </div>
                <p className="text-[11px] text-[#71717a] pt-1 border-t border-[#27272a]">
                  Semua transaksi tercatat otomatis untuk keperluan tutup kasir harian
                </p>
              </div>
            )}
          </div>

          {/* Rincian Metode Pembayaran (Riwayat Pembayaran) */}
          <div className="bg-[#1a1a20] rounded-2xl border border-[#27272a] p-5 space-y-4">
            <h2 className="text-base font-bold text-[#f4f4f5]">
              Riwayat Pembayaran Masuk (Tutup Kasir)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-[#101014] rounded-xl border border-[#27272a] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#71717a]">💵 Tunai (Cash di Laci)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400">
                    {report.financials.revenueIdr > 0
                      ? Math.round((report.financials.byPaymentMethod.cash / report.financials.revenueIdr) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="text-lg font-bold text-[#f4f4f5]">
                  {formatRupiah(report.financials.byPaymentMethod.cash)}
                </div>
              </div>

              <div className="p-4 bg-[#101014] rounded-xl border border-[#27272a] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#71717a]">📱 QRIS (Digital)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400">
                    {report.financials.revenueIdr > 0
                      ? Math.round((report.financials.byPaymentMethod.qris / report.financials.revenueIdr) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="text-lg font-bold text-[#f4f4f5]">
                  {formatRupiah(report.financials.byPaymentMethod.qris)}
                </div>
              </div>

              <div className="p-4 bg-[#101014] rounded-xl border border-[#27272a] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#71717a]">🏦 Transfer Bank</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-900/30 text-purple-400">
                    {report.financials.revenueIdr > 0
                      ? Math.round((report.financials.byPaymentMethod.transfer / report.financials.revenueIdr) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="text-lg font-bold text-[#f4f4f5]">
                  {formatRupiah(report.financials.byPaymentMethod.transfer)}
                </div>
              </div>
            </div>
          </div>

          {/* Grid Layanan Terlaris (dan Kapster jika Owner) */}
          <div className={`grid grid-cols-1 ${isOwner ? "md:grid-cols-2" : "md:grid-cols-1"} gap-6`}>
            {/* Top Layanan */}
            <div className="bg-[#1a1a20] rounded-2xl border border-[#27272a] p-5 space-y-3">
              <h2 className="text-base font-bold text-[#f4f4f5]">Layanan Paling Laris Hari Ini</h2>
              {report.topServices.length === 0 ? (
                <p className="text-xs text-[#71717a] py-6 text-center">Belum ada data pangkas hari ini</p>
              ) : (
                <div className="divide-y divide-[#27272a]">
                  {report.topServices.map((svc, idx) => (
                    <div key={svc.key} className="py-2.5 flex justify-between items-center text-sm">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#27272a] text-[#C6FF3D] font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-medium text-[#f4f4f5]">{svc.name}</div>
                          <span className="text-xs text-[#71717a]">{svc.quantity} kali dikerjakan</span>
                        </div>
                      </div>
                      <span className="font-semibold text-xs text-[#f4f4f5]">{formatRupiah(svc.revenueIdr)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Kapster (Hanya Ditampilkan untuk Pemilik Toko) */}
            {isOwner && (
              <div className="bg-[#1a1a20] rounded-2xl border border-[#27272a] p-5 space-y-3">
                <h2 className="text-base font-bold text-[#f4f4f5]">Kapster Berkinerja Terbaik</h2>
                {report.topBarbers.length === 0 ? (
                  <p className="text-xs text-[#71717a] py-6 text-center">Belum ada kapster bertugas hari ini</p>
                ) : (
                  <div className="divide-y divide-[#27272a]">
                    {report.topBarbers.map((barber, idx) => (
                      <div key={barber.key} className="py-2.5 flex justify-between items-center text-sm">
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full bg-[#27272a] text-[#C6FF3D] font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-medium text-[#f4f4f5]">{barber.name}</div>
                            <span className="text-xs text-[#71717a]">{barber.quantity} pelanggan dilayani</span>
                          </div>
                        </div>
                        <span className="font-semibold text-xs text-[#C6FF3D]">{formatRupiah(barber.revenueIdr)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Daftar Catatan Pengeluaran Toko */}
          <div className="bg-[#1a1a20] rounded-2xl border border-[#27272a] p-5 space-y-3">
            <h2 className="text-base font-bold text-[#f4f4f5]">Daftar Pengeluaran Toko</h2>
            {expenses.length === 0 ? (
              <p className="text-xs text-[#71717a] py-4">Belum ada catatan pengeluaran.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#27272a] text-[#71717a] uppercase">
                    <tr>
                      <th className="px-4 py-2.5 rounded-l-lg">Tanggal</th>
                      <th className="px-4 py-2.5">Kategori</th>
                      <th className="px-4 py-2.5">Deskripsi</th>
                      <th className="px-4 py-2.5">Nominal</th>
                      {isOwner && <th className="px-4 py-2.5 text-right rounded-r-lg">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]">
                    {expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-[#27272a]/30">
                        <td className="px-4 py-2.5 text-[#71717a]">{e.expenseDate}</td>
                        <td className="px-4 py-2.5 font-medium text-[#f4f4f5]">{e.category}</td>
                        <td className="px-4 py-2.5 text-[#71717a]">{e.description || "-"}</td>
                        <td className="px-4 py-2.5 font-bold text-red-400">{formatRupiah(e.amountIdr)}</td>
                        {isOwner && (
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => void handleDeleteExpense(e.id)}
                              className="text-red-400 hover:text-red-300 font-medium cursor-pointer"
                            >
                              Hapus
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Input Pengeluaran */}
      <Modal open={expenseModalOpen} onClose={() => setExpenseModalOpen(false)} title="Catat Pengeluaran Toko">
        <form onSubmit={(e) => void handleAddExpense(e)} className="space-y-4">
          {expenseError && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-xl">{expenseError}</div>}

          <div className="flex flex-col gap-1 w-full text-left">
            <label className="text-sm font-medium text-[#f4f4f5]">Kategori Biaya</label>
            <select
              value={expenseCategory}
              onChange={(e) => setExpenseCategory(e.target.value)}
              className="w-full px-4 py-3 min-h-12 bg-[#1a1a20] border border-[#27272a] rounded-xl text-[#f4f4f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#C6FF3D]"
            >
              <option value="Operasional">Operasional (Listrik, Air, Wifi)</option>
              <option value="Perlengkapan">Perlengkapan (Pisau cukur, tissue, handuk)</option>
              <option value="Konsumsi">Konsumsi & Minuman Pelanggan</option>
              <option value="Pemeliharaan">Pemeliharaan Alat (Mesin clipper, kursi)</option>
              <option value="Lainnya">Biaya Lain-lain</option>
            </select>
          </div>

          <Input
            label="Keterangan / Deskripsi Biaya"
            placeholder="Contoh: Beli silet cukur 5 pack"
            value={expenseDesc}
            onChange={(e) => setExpenseDesc(e.target.value)}
          />

          <Input
            label="Nominal Pengeluaran (Rupiah)"
            type="number"
            min={1000}
            step={1000}
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(Number(e.target.value))}
            required
          />

          <div className="pt-2">
            <Button type="submit" loading={savingExpense} className="w-full">
              Simpan Pengeluaran
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
