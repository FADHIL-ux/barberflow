import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api.ts";
import { useAuth } from "../../lib/auth.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Input } from "../../components/ui/Input.tsx";
import { Modal } from "../../components/ui/Modal.tsx";
import { Badge } from "../../components/ui/Badge.tsx";

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  role: "cashier" | "barber" | "owner";
  isActive: boolean;
}

export default function UsersSettingsPage() {
  const { user: currentUser } = useAuth();
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"cashier" | "barber">("cashier");
  const [tempPasswordModal, setTempPasswordModal] = useState<string | null>(null);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState<"cashier" | "barber">("cashier");
  const [editIsActive, setEditIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ items: UserItem[] }>("/api/users");
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat pengguna.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ temporaryPassword?: string }>("/api/users", {
        email,
        fullName,
        role,
      });
      setInviteModalOpen(false);
      setEmail("");
      setFullName("");
      setRole("cashier");
      if (res.temporaryPassword) {
        setTempPasswordModal(res.temporaryPassword);
      }
      await fetchUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengundang pengguna.");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: UserItem) => {
    setEditingUser(u);
    setEditFullName(u.fullName);
    setEditRole(u.role === "barber" ? "barber" : "cashier");
    setEditIsActive(u.isActive);
    setError(null);
    setEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/users/${editingUser.id}`, {
        fullName: editFullName,
        role: editRole,
        isActive: editIsActive,
      });
      setEditModalOpen(false);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memperbarui pengguna.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: UserItem) => {
    if (u.id === currentUser?.id) {
      alert("Tidak dapat menghapus akun Anda sendiri.");
      return;
    }
    if (!window.confirm(`Yakin ingin menghapus akses untuk ${u.fullName}?`)) return;
    try {
      await api.del(`/api/users/${u.id}`);
      await fetchUsers();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus pengguna.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-[#f4f4f5]">Pengguna & Staf Barbershop</h2>
          <p className="text-xs text-[#71717a]">Hak akses staf kasir dan kapster ke aplikasi.</p>
        </div>
        <Button onClick={() => { setError(null); setInviteModalOpen(true); }}>+ Tambah / Undang Pengguna</Button>
      </div>

      {loading ? (
        <p className="text-sm text-[#71717a]">Memuat daftar pengguna...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#71717a] py-4">Belum ada staf lain.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase bg-[#27272a] text-[#71717a]">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Nama Lengkap</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Peran</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right rounded-r-lg">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {items.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="hover:bg-[#27272a]/30">
                    <td className="px-4 py-3 font-medium text-[#f4f4f5]">
                      {u.fullName} {isSelf && <span className="text-xs text-[#C6FF3D] font-normal">(Anda)</span>}
                    </td>
                    <td className="px-4 py-3 text-[#71717a]">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="capitalize font-medium text-xs bg-[#27272a] px-2 py-0.5 rounded text-[#f4f4f5]">
                        {u.role === "owner" ? "Pemilik (Owner)" : u.role === "cashier" ? "Kasir" : "Kapster"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.isActive ? "success" : "neutral"}>
                        {u.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      {!isSelf && u.role !== "owner" ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                            Ubah
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => void handleDelete(u)}>
                            Hapus
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-[#71717a] pr-2">Utama</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Undang Pengguna */}
      <Modal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)} title="Undang Pengguna Baru">
        <form onSubmit={(e) => void handleInvite(e)} className="space-y-4">
          {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-xl">{error}</div>}

          <Input
            label="Nama Lengkap"
            placeholder="Contoh: Rian Anggara"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
          />

          <Input
            label="Email Akun"
            type="email"
            placeholder="rian@barbershop.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1 w-full text-left">
            <label className="text-sm font-medium text-[#f4f4f5]">Peran Akses</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "cashier" | "barber")}
              className="w-full px-4 py-3 min-h-12 bg-[#1a1a20] border border-[#27272a] rounded-xl text-[#f4f4f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#C6FF3D]"
            >
              <option value="cashier">Kasir (Bisa akses antrean, kasir, transaksi)</option>
              <option value="barber">Kapster (Hanya melihat antrean)</option>
            </select>
          </div>

          <div className="pt-2">
            <Button type="submit" loading={saving} className="w-full">
              Kirim Undangan / Buat Akun
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Pengguna */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Ubah Pengguna">
        <form onSubmit={(e) => void handleUpdate(e)} className="space-y-4">
          {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-xl">{error}</div>}

          <Input
            label="Nama Lengkap"
            value={editFullName}
            onChange={(e) => setEditFullName(e.target.value)}
            required
            minLength={2}
          />

          <div className="flex flex-col gap-1 w-full text-left">
            <label className="text-sm font-medium text-[#f4f4f5]">Peran Akses</label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as "cashier" | "barber")}
              className="w-full px-4 py-3 min-h-12 bg-[#1a1a20] border border-[#27272a] rounded-xl text-[#f4f4f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#C6FF3D]"
            >
              <option value="cashier">Kasir</option>
              <option value="barber">Kapster</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-[#f4f4f5] cursor-pointer">
            <input
              type="checkbox"
              checked={editIsActive}
              onChange={(e) => setEditIsActive(e.target.checked)}
              className="accent-[#C6FF3D] w-4 h-4"
            />
            Akun Aktif (Bisa masuk ke sistem)
          </label>

          <div className="pt-2">
            <Button type="submit" loading={saving} className="w-full">
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Kata Sandi Sementara */}
      <Modal open={Boolean(tempPasswordModal)} onClose={() => setTempPasswordModal(null)} title="Kata Sandi Sementara">
        <div className="space-y-4 text-center">
          <p className="text-sm text-[#f4f4f5]">
            Akun berhasil dibuat. Berikan kata sandi sementara berikut kepada staf:
          </p>
          <div className="p-4 bg-[#27272a] rounded-xl border border-[#C6FF3D]/40 font-mono text-lg text-[#C6FF3D] tracking-wider select-all">
            {tempPasswordModal}
          </div>
          <p className="text-xs text-[#71717a]">
            Catat atau salin sekarang. Kata sandi sementara ini tidak akan ditampilkan lagi demi keamanan.
          </p>
          <Button onClick={() => setTempPasswordModal(null)} className="w-full">
            Selesai
          </Button>
        </div>
      </Modal>
    </div>
  );
}

