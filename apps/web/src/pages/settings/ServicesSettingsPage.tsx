import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Input } from "../../components/ui/Input.tsx";
import { Modal } from "../../components/ui/Modal.tsx";
import { Badge } from "../../components/ui/Badge.tsx";

interface ServiceItem {
  id: string;
  name: string;
  priceIdr: number;
  durationMinutes: number;
  description: string;
  isActive: boolean;
}

export default function ServicesSettingsPage() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [priceIdr, setPriceIdr] = useState(50000);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ items: ServiceItem[] }>("/api/services");
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat layanan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchServices();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setName("");
    setPriceIdr(50000);
    setDurationMinutes(30);
    setDescription("");
    setIsActive(true);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: ServiceItem) => {
    setEditingId(item.id);
    setName(item.name);
    setPriceIdr(item.priceIdr);
    setDurationMinutes(item.durationMinutes);
    setDescription(item.description);
    setIsActive(item.isActive);
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
        priceIdr: Number(priceIdr),
        durationMinutes: Number(durationMinutes),
        description,
        isActive,
      };
      if (editingId) {
        await api.put(`/api/services/${editingId}`, payload);
      } else {
        await api.post("/api/services", payload);
      }
      setModalOpen(false);
      await fetchServices();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan layanan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Yakin ingin menghapus layanan ini?")) return;
    try {
      await api.del(`/api/services/${id}`);
      await fetchServices();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus layanan.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-[#f4f4f5]">Daftar Layanan</h2>
          <p className="text-xs text-[#71717a]">Layanan pangkas rambut, cuci, styling, dll.</p>
        </div>
        <Button onClick={openCreateModal}>+ Tambah Layanan</Button>
      </div>

      {loading ? (
        <p className="text-sm text-[#71717a]">Memuat layanan...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#71717a] py-4">Belum ada layanan. Klik tombol tambah untuk memulai.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase bg-[#27272a] text-[#71717a]">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Layanan</th>
                <th className="px-4 py-3">Harga</th>
                <th className="px-4 py-3">Durasi</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right rounded-r-lg">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {items.map((svc) => (
                <tr key={svc.id} className="hover:bg-[#27272a]/30">
                  <td className="px-4 py-3 font-medium text-[#f4f4f5]">
                    {svc.name}
                    {svc.description && <p className="text-xs text-[#71717a] font-normal">{svc.description}</p>}
                  </td>
                  <td className="px-4 py-3">{formatRupiah(svc.priceIdr)}</td>
                  <td className="px-4 py-3">{svc.durationMinutes} mnt</td>
                  <td className="px-4 py-3">
                    <Badge variant={svc.isActive ? "success" : "neutral"}>
                      {svc.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(svc)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => void handleDelete(svc.id)}>
                      Hapus
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Layanan" : "Tambah Layanan Baru"}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-xl">{error}</div>}

          <Input
            label="Nama Layanan"
            placeholder="Contoh: Potong Rambut Pria + Cuci"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />

          <Input
            label="Harga (IDR)"
            type="number"
            min={0}
            step={1000}
            value={priceIdr}
            onChange={(e) => setPriceIdr(Number(e.target.value))}
            required
          />

          <Input
            label="Estimasi Durasi (Menit)"
            type="number"
            min={5}
            max={480}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            required
          />

          <Input
            label="Deskripsi Layanan (Opsional)"
            placeholder="Keterangan singkat..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <label className="flex items-center gap-2 text-sm text-[#f4f4f5] cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-[#C6FF3D] w-4 h-4"
            />
            Layanan Aktif (Bisa dipilih di Kasir)
          </label>

          <div className="pt-2">
            <Button type="submit" loading={saving} className="w-full">
              Simpan Layanan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

