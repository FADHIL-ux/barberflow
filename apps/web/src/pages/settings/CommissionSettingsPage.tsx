import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api.ts";
import { useFeature } from "../../lib/auth.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Input } from "../../components/ui/Input.tsx";
import { Modal } from "../../components/ui/Modal.tsx";

interface CommissionRuleItem {
  id: string;
  serviceId: string;
  serviceName: string;
  barberId: string | null;
  barberName: string | null;
  type: "percent" | "fixed";
  value: number;
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

interface CommissionSummaryItem {
  barberId: string;
  barberName: string;
  totalCommissionIdr: number;
  servicesDoneCount: number;
}

export default function CommissionSettingsPage() {
  const hasCommissions = useFeature("commissions");
  const [rules, setRules] = useState<CommissionRuleItem[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Aturan
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [ruleType, setRuleType] = useState<"percent" | "fixed">("percent");
  const [ruleValue, setRuleValue] = useState(20);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Laporan Ringkasan Komisi
  const [summary, setSummary] = useState<CommissionSummaryItem[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [rRes, sRes, bRes] = await Promise.all([
        api.get<{ items: CommissionRuleItem[] }>("/api/commissions/rules"),
        api.get<{ items: ServiceOption[] }>("/api/services"),
        api.get<{ items: BarberOption[] }>("/api/barbers"),
      ]);
      setRules(rRes.items);
      setServices(sRes.items);
      setBarbers(bRes.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      setLoadingSummary(true);
      const res = await api.get<{ items: CommissionSummaryItem[] }>("/api/commissions/summary");
      setSummary(res.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (hasCommissions) {
      void loadAll();
      void loadSummary();
    } else {
      setLoading(false);
    }
  }, [hasCommissions]);

  const openModal = () => {
    if (services.length > 0) setSelectedServiceId(services[0]!.id);
    setSelectedBarberId("");
    setRuleType("percent");
    setRuleValue(20);
    setError(null);
    setModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/commissions/rules", {
        serviceId: selectedServiceId,
        barberId: selectedBarberId ? selectedBarberId : null,
        type: ruleType,
        value: Number(ruleValue),
      });
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan aturan komisi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!window.confirm("Hapus aturan komisi ini?")) return;
    try {
      await api.del(`/api/commissions/rules/${id}`);
      await loadAll();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus aturan komisi.");
    }
  };

  if (!hasCommissions) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto">
        <div className="w-14 h-14 bg-yellow-900/30 text-yellow-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
          ⭐
        </div>
        <h2 className="text-xl font-bold text-[#f4f4f5]">Fitur Eksklusif Paket Pro</h2>
        <p className="text-sm text-[#71717a]">
          Pengaturan otomatisasi komisi kapster, pembagian hasil persen/nominal, dan laporan akumulasi komisi hanya aktif untuk langganan Pro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Bagian Aturan Komisi */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-[#f4f4f5]">Aturan Komisi Kapster</h2>
            <p className="text-xs text-[#71717a]">
              Persentase atau nominal Rupiah yang otomatis dialokasikan ke kapster saat transaksi selesai
            </p>
          </div>
          <Button onClick={openModal}>+ Tambah Aturan</Button>
        </div>

        {loading ? (
          <p className="text-sm text-[#71717a]">Memuat aturan komisi...</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-[#71717a] py-4">Belum ada aturan komisi. Tambahkan aturan untuk memotivasi kapster.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase bg-[#27272a] text-[#71717a]">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Layanan</th>
                  <th className="px-4 py-3">Kapster</th>
                  <th className="px-4 py-3">Nilai Komisi</th>
                  <th className="px-4 py-3 text-right rounded-r-lg">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-[#27272a]/30">
                    <td className="px-4 py-3 font-medium text-[#f4f4f5]">{r.serviceName}</td>
                    <td className="px-4 py-3 text-xs text-[#71717a]">
                      {r.barberName ? (
                        <span className="text-[#C6FF3D] font-medium">{r.barberName}</span>
                      ) : (
                        <span className="text-zinc-400">Semua Kapster (Default)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#f4f4f5]">
                      {r.type === "percent" ? `${r.value}% dari netto` : formatRupiah(r.value)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" className="text-red-400" onClick={() => void handleDeleteRule(r.id)}>
                        Hapus
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bagian Ringkasan Akumulasi Komisi Hari Ini */}
      <div className="space-y-4 pt-6 border-t border-[#27272a]">
        <div>
          <h2 className="text-lg font-semibold text-[#f4f4f5]">Akumulasi Komisi Hari Ini</h2>
          <p className="text-xs text-[#71717a]">Total perolehan komisi kapster dari transaksi hari ini</p>
        </div>

        {loadingSummary ? (
          <p className="text-sm text-[#71717a]">Memuat komisi...</p>
        ) : summary.length === 0 ? (
          <p className="text-sm text-[#71717a] py-4">Belum ada komisi tercatat hari ini.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {summary.map((s) => (
              <div key={s.barberId} className="p-4 bg-[#101014] rounded-xl border border-[#27272a] space-y-1">
                <span className="text-xs text-[#71717a]">Kapster</span>
                <div className="font-bold text-base text-[#f4f4f5]">{s.barberName}</div>
                <div className="text-xs text-[#71717a]">{s.servicesDoneCount} layanan selesai</div>
                <div className="text-lg font-black text-[#C6FF3D] pt-2">
                  {formatRupiah(s.totalCommissionIdr)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Tambah Aturan */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Konfigurasi Aturan Komisi">
        <form onSubmit={(e) => void handleSaveRule(e)} className="space-y-4">
          {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-xl">{error}</div>}

          <div className="flex flex-col gap-1 w-full text-left">
            <label className="text-sm font-medium text-[#f4f4f5]">Pilih Layanan</label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full px-4 py-3 min-h-12 bg-[#1a1a20] border border-[#27272a] rounded-xl text-[#f4f4f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#C6FF3D]"
              required
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatRupiah(s.priceIdr)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 w-full text-left">
            <label className="text-sm font-medium text-[#f4f4f5]">Target Kapster</label>
            <select
              value={selectedBarberId}
              onChange={(e) => setSelectedBarberId(e.target.value)}
              className="w-full px-4 py-3 min-h-12 bg-[#1a1a20] border border-[#27272a] rounded-xl text-[#f4f4f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#C6FF3D]"
            >
              <option value="">-- Semua Kapster (Aturan Standar) --</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  Khusus: {b.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 w-full text-left">
            <label className="text-sm font-medium text-[#f4f4f5]">Jenis Komisi</label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <label className="flex items-center gap-2 p-3 bg-[#101014] rounded-xl border border-[#27272a] cursor-pointer text-sm">
                <input
                  type="radio"
                  name="commType"
                  checked={ruleType === "percent"}
                  onChange={() => setRuleType("percent")}
                  className="accent-[#C6FF3D]"
                />
                Persentase (%)
              </label>
              <label className="flex items-center gap-2 p-3 bg-[#101014] rounded-xl border border-[#27272a] cursor-pointer text-sm">
                <input
                  type="radio"
                  name="commType"
                  checked={ruleType === "fixed"}
                  onChange={() => setRuleType("fixed")}
                  className="accent-[#C6FF3D]"
                />
                Nominal Tetap (Rp)
              </label>
            </div>
          </div>

          <Input
            label={ruleType === "percent" ? "Besaran Persen (1-100%)" : "Nominal Komisi (Rupiah)"}
            type="number"
            min={0}
            max={ruleType === "percent" ? 100 : undefined}
            value={ruleValue}
            onChange={(e) => setRuleValue(Number(e.target.value))}
            required
            helper={
              ruleType === "percent"
                ? "Dihitung dari nilai bersih layanan setelah potongan diskon"
                : "Nominal pasti yang diterima kapster per layanan ini"
            }
          />

          <div className="pt-2">
            <Button type="submit" loading={saving} className="w-full">
              Simpan Aturan Komisi
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
