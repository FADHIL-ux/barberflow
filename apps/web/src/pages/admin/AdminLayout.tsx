import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Input } from "../../components/ui/Input.tsx";
import { Spinner } from "../../components/ui/Spinner.tsx";
import { Modal } from "../../components/ui/Modal.tsx";

type Plan = "starter" | "pro";

interface TenantStats {
  transactionCount: number;
  whatsappUsedThisMonth: number;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  featureFlags: Record<string, boolean>;
  isActive: boolean;
  createdAt: string;
  stats: TenantStats;
}

interface CreateTenantForm {
  name: string;
  slug: string;
  plan: Plan;
  ownerEmail: string;
  ownerPassword: string;
  ownerName: string;
}

const FEATURE_LABELS: Record<string, string> = {
  commissions: "Komisi Kapster",
  financial_reports: "Laporan Keuangan",
  online_booking: "Booking Online",
  whatsapp_reminders: "Pengingat WhatsApp",
};

const EMPTY_FORM: CreateTenantForm = {
  name: "",
  slug: "",
  plan: "starter",
  ownerEmail: "",
  ownerPassword: "",
  ownerName: "",
};

export default function AdminLayout() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal buat tenant baru
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTenantForm>(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // State patch per-tenant (loading per ID)
  const [patching, setPatching] = useState<Record<string, boolean>>({});

  const fetchTenants = () => {
    setLoading(true);
    api
      .get<{ items: Tenant[] }>("/api/admin/tenants")
      .then((res) => setTenants(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Gagal memuat daftar tenant."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const patchTenant = async (id: string, payload: Partial<{ plan: Plan; isActive: boolean; featureFlags: Record<string, boolean> }>) => {
    setPatching((p) => ({ ...p, [id]: true }));
    try {
      const updated = await api.patch<Tenant>(`/api/admin/tenants/${id}`, payload);
      setTenants((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal memperbarui tenant.");
    } finally {
      setPatching((p) => ({ ...p, [id]: false }));
    }
  };

  const toggleFeature = (tenant: Tenant, key: string) => {
    const currentVal = tenant.featureFlags[key] ?? (tenant.plan === "pro");
    const newFlags = { ...tenant.featureFlags, [key]: !currentVal };
    void patchTenant(tenant.id, { featureFlags: newFlags });
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    if (
      !window.confirm(
        `Hapus permanen barbershop "${tenant.name}" (/${tenant.slug})?\n\nSeluruh akun pengguna, antrean, transaksi, pelanggan, dan booking milik barbershop ini akan ikut terhapus dan tidak dapat dikembalikan.`
      )
    ) {
      return;
    }
    setPatching((p) => ({ ...p, [tenant.id]: true }));
    try {
      await api.del(`/api/admin/tenants/${tenant.id}`);
      setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus tenant.");
    } finally {
      setPatching((p) => ({ ...p, [tenant.id]: false }));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await api.post("/api/admin/tenants", createForm);
      setShowCreate(false);
      setCreateForm(EMPTY_FORM);
      fetchTenants();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Gagal membuat tenant baru.");
    } finally {
      setCreating(false);
    }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="min-h-dvh bg-[#101014] text-[#f4f4f5] p-4 md:p-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl font-black text-[#C6FF3D]">Panel Super Admin</h1>
          <p className="text-xs text-[#71717a] mt-0.5">Kelola seluruh tenant barbershop di platform BarberFlow</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          + Tambah Tenant
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-xl">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-4">
          {tenants.length === 0 && (
            <div className="text-center py-12 text-[#71717a] text-sm">Belum ada tenant terdaftar.</div>
          )}

          {tenants.map((tenant) => {
            const isPro = tenant.plan === "pro";
            const isLoading = patching[tenant.id] ?? false;
            const allFeatureKeys = Object.keys(FEATURE_LABELS);

            // Resolve effective feature value: explicit flag override or plan default
            const effectiveFeature = (key: string): boolean => {
              if (typeof tenant.featureFlags[key] === "boolean") return tenant.featureFlags[key] as boolean;
              return isPro;
            };

            return (
              <div
                key={tenant.id}
                className={`bg-[#1a1a20] border rounded-2xl p-4 space-y-4 transition-opacity ${
                  tenant.isActive ? "border-[#27272a]" : "border-red-900/50 opacity-70"
                }`}
              >
                {/* Row atas: nama + status */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#f4f4f5] text-base">{tenant.name}</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          isPro ? "bg-[#C6FF3D]/20 text-[#C6FF3D]" : "bg-[#27272a] text-[#71717a]"
                        }`}
                      >
                        {isPro ? "PRO" : "STARTER"}
                      </span>
                      {!tenant.isActive && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-900/40 text-red-400">
                          NONAKTIF
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#71717a] mt-0.5">
                      /{tenant.slug} · Dibuat {fmtDate(tenant.createdAt)}
                    </p>
                  </div>

                  {/* Tombol Aktif/Nonaktif & Hapus */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void patchTenant(tenant.id, { isActive: !tenant.isActive })}
                      disabled={isLoading}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors cursor-pointer ${
                        tenant.isActive
                          ? "border-amber-800 text-amber-400 hover:bg-amber-900/20"
                          : "border-green-800 text-green-400 hover:bg-green-900/20"
                      } disabled:opacity-40`}
                    >
                      {isLoading ? "Menyimpan..." : tenant.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteTenant(tenant)}
                      disabled={isLoading}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      Hapus
                    </button>
                  </div>
                </div>

                {/* Statistik */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#101014] rounded-xl p-3 text-center">
                    <div className="text-lg font-black text-[#C6FF3D]">
                      {tenant.stats.transactionCount.toLocaleString("id-ID")}
                    </div>
                    <div className="text-[10px] text-[#71717a]">Total Transaksi</div>
                  </div>
                  <div className="bg-[#101014] rounded-xl p-3 text-center">
                    <div className="text-lg font-black text-[#f4f4f5]">{tenant.stats.whatsappUsedThisMonth}</div>
                    <div className="text-[10px] text-[#71717a]">WA Bulan Ini</div>
                  </div>
                </div>

                {/* Ubah Plan */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[#71717a] font-medium">Paket:</span>
                  {(["starter", "pro"] as Plan[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => void patchTenant(tenant.id, { plan: p })}
                      disabled={tenant.plan === p || isLoading}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default ${
                        tenant.plan === p
                          ? p === "pro"
                            ? "bg-[#C6FF3D]/20 border-[#C6FF3D] text-[#C6FF3D]"
                            : "bg-[#27272a] border-[#27272a] text-[#f4f4f5]"
                          : "border-[#27272a] text-[#71717a] hover:border-[#71717a]"
                      }`}
                    >
                      {p === "pro" ? "Pro" : "Starter"}
                    </button>
                  ))}
                </div>

                {/* Feature Flags */}
                <div>
                  <p className="text-[11px] text-[#71717a] font-semibold uppercase tracking-wide mb-2">
                    Feature Flags (Override)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {allFeatureKeys.map((key) => {
                      const isOn = effectiveFeature(key);
                      const hasOverride = typeof tenant.featureFlags[key] === "boolean";
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleFeature(tenant, key)}
                          disabled={isLoading}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs transition-colors cursor-pointer disabled:opacity-40 ${
                            isOn
                              ? "bg-[#C6FF3D]/10 border-[#C6FF3D]/40 text-[#C6FF3D]"
                              : "bg-[#101014] border-[#27272a] text-[#71717a]"
                          }`}
                        >
                          <span className="text-base leading-none">{isOn ? "✓" : "✗"}</span>
                          <span className="flex-1">
                            {FEATURE_LABELS[key] ?? key}
                            {hasOverride && (
                              <span className="ml-1 text-[9px] text-orange-400 font-bold uppercase">Override</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tambah Tenant */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tambah Tenant Baru">
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
          {createError && (
            <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-xl">{createError}</div>
          )}

          <Input
            label="Nama Barbershop"
            placeholder="Contoh: Barber Kings"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            required
          />

          <Input
            label="Slug (URL)"
            placeholder="Contoh: barber-kings"
            value={createForm.slug}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))
            }
            helper="Hanya huruf kecil, angka, dan tanda hubung"
            required
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[#f4f4f5]">Paket Langganan</label>
            <select
              value={createForm.plan}
              onChange={(e) => setCreateForm((f) => ({ ...f, plan: e.target.value as Plan }))}
              className="w-full px-4 py-3 min-h-12 bg-[#101014] border border-[#27272a] rounded-xl text-[#f4f4f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#C6FF3D]"
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
            </select>
          </div>

          <hr className="border-[#27272a]" />
          <p className="text-xs font-semibold text-[#71717a] uppercase tracking-wide">Akun Owner</p>

          <Input
            label="Nama Owner"
            placeholder="Contoh: Budi Santoso"
            value={createForm.ownerName}
            onChange={(e) => setCreateForm((f) => ({ ...f, ownerName: e.target.value }))}
            required
          />

          <Input
            label="Email Owner"
            type="email"
            placeholder="owner@barbershop.com"
            value={createForm.ownerEmail}
            onChange={(e) => setCreateForm((f) => ({ ...f, ownerEmail: e.target.value }))}
            required
          />

          <Input
            label="Password Sementara"
            type="password"
            placeholder="Min. 10 karakter"
            value={createForm.ownerPassword}
            onChange={(e) => setCreateForm((f) => ({ ...f, ownerPassword: e.target.value }))}
            helper="Minimal 10 karakter. Sampaikan ke pemilik barbershop secara aman"
            required
            minLength={10}
          />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>
              Batal
            </Button>
            <Button type="submit" loading={creating} className="flex-1">
              Buat Tenant
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
