import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Input } from "../../components/ui/Input.tsx";
import { Modal } from "../../components/ui/Modal.tsx";
import { Badge } from "../../components/ui/Badge.tsx";

interface BarberItem {
  id: string;
  displayName: string;
  phone: string | null;
  skills: string[];
  isActive: boolean;
}

export default function BarbersSettingsPage() {
  const [items, setItems] = useState<BarberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBarbers = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ items: BarberItem[] }>("/api/barbers");
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat daftar kapster.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBarbers();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setDisplayName("");
    setPhone("");
    setSkillsText("");
    setIsActive(true);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: BarberItem) => {
    setEditingId(item.id);
    setDisplayName(item.displayName);
    setPhone(item.phone ?? "");
    setSkillsText((item.skills ?? []).join(", "));
    setIsActive(item.isActive);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const skills = skillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        displayName,
        phone: phone.trim() ? phone.trim() : null,
        skills,
        isActive,
      };

      if (editingId) {
        await api.put(`/api/barbers/${editingId}`, payload);
      } else {
        await api.post("/api/barbers", payload);
      }
      setModalOpen(false);
      await fetchBarbers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan kapster.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Yakin ingin menghapus data kapster ini?")) return;
    try {
      await api.del(`/api/barbers/${id}`);
      await fetchBarbers();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus kapster.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-[#f4f4f5]">Daftar Kapster (Barber)</h2>
          <p className="text-xs text-[#71717a]">Pengaturan nama barber, kontak, dan keahlian.</p>
        </div>
        <Button onClick={openCreateModal}>+ Tambah Kapster</Button>
      </div>

      {loading ? (
        <p className="text-sm text-[#71717a]">Memuat data kapster...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#71717a] py-4">Belum ada kapster terdaftar. Tambahkan kapster untuk antrean dan komisi.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase bg-[#27272a] text-[#71717a]">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Nama Kapster</th>
                <th className="px-4 py-3">Telepon</th>
                <th className="px-4 py-3">Keahlian</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right rounded-r-lg">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {items.map((b) => (
                <tr key={b.id} className="hover:bg-[#27272a]/30">
                  <td className="px-4 py-3 font-medium text-[#f4f4f5]">{b.displayName}</td>
                  <td className="px-4 py-3 text-[#71717a]">{b.phone ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(b.skills ?? []).length > 0 ? (
                        (b.skills ?? []).map((s, idx) => (
                          <span key={idx} className="text-xs bg-[#27272a] text-[#f4f4f5] px-2 py-0.5 rounded-md">
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#71717a]">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={b.isActive ? "success" : "neutral"}>
                      {b.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(b)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => void handleDelete(b.id)}>
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
        title={editingId ? "Edit Kapster" : "Tambah Kapster Baru"}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-xl">{error}</div>}

          <Input
            label="Nama Panggilan / Display Name"
            placeholder="Contoh: Mas Budi"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            minLength={2}
          />

          <Input
            label="Nomor Telepon (Opsional)"
            placeholder="08123456789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <Input
            label="Keahlian Khusus (Pisahkan dengan koma)"
            placeholder="Fade, Taper, Coloring, Hot Towel"
            value={skillsText}
            onChange={(e) => setSkillsText(e.target.value)}
            helper="Daftar keahlian yang dikuasai kapster"
          />

          <label className="flex items-center gap-2 text-sm text-[#f4f4f5] cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-[#C6FF3D] w-4 h-4"
            />
            Kapster Aktif (Bisa dipilih di antrean & booking)
          </label>

          <div className="pt-2">
            <Button type="submit" loading={saving} className="w-full">
              Simpan Data Kapster
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

