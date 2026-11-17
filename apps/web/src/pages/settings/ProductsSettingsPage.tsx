import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Input } from "../../components/ui/Input.tsx";
import { Modal } from "../../components/ui/Modal.tsx";
import { Badge } from "../../components/ui/Badge.tsx";

interface ProductItem {
  id: string;
  name: string;
  priceIdr: number;
  stockQuantity: number;
  isActive: boolean;
}

export default function ProductsSettingsPage() {
  const [items, setItems] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [priceIdr, setPriceIdr] = useState(35000);
  const [stockQuantity, setStockQuantity] = useState(10);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ items: ProductItem[] }>("/api/products");
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat produk.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProducts();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setName("");
    setPriceIdr(35000);
    setStockQuantity(10);
    setIsActive(true);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: ProductItem) => {
    setEditingId(item.id);
    setName(item.name);
    setPriceIdr(item.priceIdr);
    setStockQuantity(item.stockQuantity);
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
        stockQuantity: Number(stockQuantity),
        isActive,
      };
      if (editingId) {
        await api.put(`/api/products/${editingId}`, payload);
      } else {
        await api.post("/api/products", payload);
      }
      setModalOpen(false);
      await fetchProducts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan produk.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Yakin ingin menghapus produk ini?")) return;
    try {
      await api.del(`/api/products/${id}`);
      await fetchProducts();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus produk.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-[#f4f4f5]">Daftar Produk Retail</h2>
          <p className="text-xs text-[#71717a]">Pomade, wax, hair tonic, vitamin, dll.</p>
        </div>
        <Button onClick={openCreateModal}>+ Tambah Produk</Button>
      </div>

      {loading ? (
        <p className="text-sm text-[#71717a]">Memuat produk...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#71717a] py-4">Belum ada produk. Tambahkan produk ritel untuk dijual di kasir.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase bg-[#27272a] text-[#71717a]">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Produk</th>
                <th className="px-4 py-3">Harga</th>
                <th className="px-4 py-3">Stok</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right rounded-r-lg">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {items.map((prod) => (
                <tr key={prod.id} className="hover:bg-[#27272a]/30">
                  <td className="px-4 py-3 font-medium text-[#f4f4f5]">{prod.name}</td>
                  <td className="px-4 py-3">{formatRupiah(prod.priceIdr)}</td>
                  <td className="px-4 py-3">{prod.stockQuantity} pcs</td>
                  <td className="px-4 py-3">
                    <Badge variant={prod.isActive ? "success" : "neutral"}>
                      {prod.isActive ? "Tersedia" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(prod)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => void handleDelete(prod.id)}>
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
        title={editingId ? "Edit Produk" : "Tambah Produk Baru"}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-xl">{error}</div>}

          <Input
            label="Nama Produk"
            placeholder="Contoh: Matte Clay Pomade 100gr"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />

          <Input
            label="Harga Jual (IDR)"
            type="number"
            min={0}
            step={1000}
            value={priceIdr}
            onChange={(e) => setPriceIdr(Number(e.target.value))}
            required
          />

          <Input
            label="Stok Tersedia (Unit/Pcs)"
            type="number"
            min={0}
            value={stockQuantity}
            onChange={(e) => setStockQuantity(Number(e.target.value))}
            required
          />

          <label className="flex items-center gap-2 text-sm text-[#f4f4f5] cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-[#C6FF3D] w-4 h-4"
            />
            Produk Aktif (Tampil di menu penjualan kasir)
          </label>

          <div className="pt-2">
            <Button type="submit" loading={saving} className="w-full">
              Simpan Produk
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

