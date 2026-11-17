import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.ts";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { Badge } from "../components/ui/Badge.tsx";

interface CustomerItem {
  id: string;
  name: string;
  phone: string | null;
  hairPreference: string | null;
  favoriteBarberId: string | null;
  favoriteBarberName: string | null;
  notes: string | null;
  createdAt: string;
  consents: {
    dataProcessing: boolean;
    whatsappReminder: boolean;
  };
}

interface VisitItem {
  id: string;
  receiptNumber: string;
  occurredAt: string;
  totalIdr: number;
  paymentMethod: string;
  barberName: string | null;
  items: Array<{ name: string; kind: string; quantity: number }>;
}

interface BarberOption {
  id: string;
  displayName: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [hairPreference, setHairPreference] = useState("");
  const [favoriteBarberId, setFavoriteBarberId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal Riwayat Kunjungan
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const fetchCustomers = async (keyword?: string) => {
    try {
      setLoading(true);
      const url = keyword ? `/api/customers?search=${encodeURIComponent(keyword)}` : "/api/customers";
      const res = await api.get<{ items: CustomerItem[] }>(url);
      setCustomers(res.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCustomers();
    api
      .get<{ items: BarberOption[] }>("/api/barbers")
      .then((res) => setBarbers(res.items))
      .catch(console.error);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchCustomers(search);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setName("");
    setPhone("");
    setHairPreference("");
    setFavoriteBarberId("");
    setNotes("");
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (cust: CustomerItem) => {
    setEditingId(cust.id);
    setName(cust.name);
    setPhone(cust.phone ?? "");
    setHairPreference(cust.hairPreference ?? "");
    setFavoriteBarberId(cust.favoriteBarberId ?? "");
    setNotes(cust.notes ?? "");
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        phone: phone.trim() ? phone.trim() : null,
        hairPreference: hairPreference.trim() ? hairPreference.trim() : null,
        favoriteBarberId: favoriteBarberId ? favoriteBarberId : null,
        notes: notes.trim() ? notes.trim() : null,
      };

      if (editingId) {
        await api.put(`/api/customers/${editingId}`, payload);
      } else {
        await api.post("/api/customers", payload);
      }
      setModalOpen(false);
      await fetchCustomers(search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan data pelanggan.");
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (cust: CustomerItem) => {
    setSelectedCustomer(cust);
    setHistoryModalOpen(true);
    setLoadingVisits(true);
    try {
      const res = await api.get<{ items: VisitItem[] }>(`/api/customers/${cust.id}/visits`);
      setVisits(res.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVisits(false);
    }
  };

  const toggleConsent = async (cust: CustomerItem, purpose: "data_processing" | "whatsapp_reminder", currentValue: boolean) => {
    try {
      await api.post(`/api/customers/${cust.id}/consent`, {
        purpose,
        isGranted: !currentValue,
      });
      await fetchCustomers(search);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal memperbarui persetujuan UU PDP.");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f4f4f5]">Database Pelanggan</h1>
          <p className="text-sm text-[#71717a] mt-1">
            Data kunjungan, selera potongan rambut, & kepatuhan privasi (UU PDP No. 27/2022)
          </p>
        </div>
        <Button onClick={openCreateModal}>+ Tambah Pelanggan</Button>
      </div>

      {/* Bar Pencarian */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <Input
          placeholder="Cari nama atau no. telepon pelanggan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Cari
        </Button>
      </form>

      {/* Tabel Pelanggan */}
      {loading ? (
        <p className="text-sm text-[#71717a]">Memuat data pelanggan...</p>
      ) : customers.length === 0 ? (
        <p className="text-sm text-[#71717a] py-8">Belum ada data pelanggan.</p>
      ) : (
        <div className="bg-[#1a1a20] rounded-2xl border border-[#27272a] overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase bg-[#27272a] text-[#71717a]">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Telepon</th>
                <th className="px-4 py-3">Preferensi Model</th>
                <th className="px-4 py-3">Kapster Favorit</th>
                <th className="px-4 py-3">Persetujuan UU PDP</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-[#27272a]/30">
                  <td className="px-4 py-3 font-semibold text-[#f4f4f5]">
                    {c.name}
                    {c.notes && <p className="text-xs text-[#71717a] font-normal">{c.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#71717a]">{c.phone ?? "-"}</td>
                  <td className="px-4 py-3 text-xs text-[#f4f4f5]">{c.hairPreference ?? "-"}</td>
                  <td className="px-4 py-3 text-xs text-[#C6FF3D]">{c.favoriteBarberName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => void toggleConsent(c, "data_processing", c.consents.dataProcessing)}
                        title="Persetujuan pengolahan data riwayat pangkas"
                        className="cursor-pointer"
                      >
                        <Badge variant={c.consents.dataProcessing ? "success" : "neutral"}>
                          Data: {c.consents.dataProcessing ? "Setuju" : "Batal"}
                        </Badge>
                      </button>
                      <button
                        onClick={() => void toggleConsent(c, "whatsapp_reminder", c.consents.whatsappReminder)}
                        title="Persetujuan pengiriman pengingat & promo via WhatsApp"
                        className="cursor-pointer"
                      >
                        <Badge variant={c.consents.whatsappReminder ? "success" : "neutral"}>
                          WA: {c.consents.whatsappReminder ? "Setuju" : "Batal"}
                        </Badge>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => void openHistory(c)}>
                      Riwayat
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(c)}>
                      Ubah
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Tambah / Edit Pelanggan */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Ubah Data Pelanggan" : "Tambah Pelanggan Baru"}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-xl">{error}</div>}

          <Input
            label="Nama Lengkap"
            placeholder="Contoh: Budi Santoso"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Nomor Telepon / WhatsApp"
            placeholder="081234567890 (8-16 digit)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            helper="Nomor telepon disimpan secara aman untuk pencatatan nota dan kontak persetujuan"
          />

          <Input
            label="Preferensi Gaya Rambut"
            placeholder="Contoh: Low Fade samping tipis, atas sisir samping"
            value={hairPreference}
            onChange={(e) => setHairPreference(e.target.value)}
          />

          <div className="flex flex-col gap-1 w-full text-left">
            <label className="text-sm font-medium text-[#f4f4f5]">Kapster Langganan / Favorit</label>
            <select
              value={favoriteBarberId}
              onChange={(e) => setFavoriteBarberId(e.target.value)}
              className="w-full px-4 py-3 min-h-12 bg-[#1a1a20] border border-[#27272a] rounded-xl text-[#f4f4f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#C6FF3D]"
            >
              <option value="">-- Belum Ada Preferensi Khusus --</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Catatan Khusus"
            placeholder="Contoh: Kulit sensitif, suka wangi pomade vanilla"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="p-3 bg-[#101014] rounded-xl border border-[#27272a] text-xs text-[#71717a] space-y-1">
            <span className="font-semibold text-[#f4f4f5]">Klausul Persetujuan UU PDP:</span>
            <p>
              Dengan menyimpan data ini, pelanggan menyetujui pemrosesan data riwayat pangkas rambut untuk kenyamanan pelayanan barbershop.
            </p>
          </div>

          <div className="pt-2">
            <Button type="submit" loading={saving} className="w-full">
              Simpan Data Pelanggan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Riwayat Kunjungan */}
      <Modal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Riwayat Kunjungan: ${selectedCustomer?.name}`}
      >
        <div className="space-y-4">
          {loadingVisits ? (
            <p className="text-xs text-[#71717a] text-center py-6">Memuat riwayat...</p>
          ) : visits.length === 0 ? (
            <p className="text-xs text-[#71717a] text-center py-6">Pelanggan ini belum memiliki riwayat transaksi.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {visits.map((v) => (
                <div key={v.id} className="p-3 bg-[#101014] rounded-xl border border-[#27272a] space-y-1.5 text-xs">
                  <div className="flex justify-between font-semibold text-[#f4f4f5]">
                    <span>Nota #{v.receiptNumber}</span>
                    <span className="text-[#C6FF3D]">{formatRupiah(v.totalIdr)}</span>
                  </div>
                  <div className="flex justify-between text-[#71717a] text-[11px]">
                    <span>{new Date(v.occurredAt).toLocaleString("id-ID")}</span>
                    <span>Kapster: {v.barberName ?? "-"}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {v.items.map((i, idx) => (
                      <span key={idx} className="bg-[#27272a] text-[#f4f4f5] px-2 py-0.5 rounded text-[10px]">
                        {i.name} ({i.quantity}x)
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
