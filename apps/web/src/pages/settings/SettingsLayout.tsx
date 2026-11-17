import { Outlet, NavLink } from "react-router-dom";

const settingsTabs = [
  { to: "profil", label: "Profil Barbershop" },
  { to: "layanan", label: "Layanan & Harga" },
  { to: "produk", label: "Produk" },
  { to: "kapster", label: "Kapster" },
  { to: "pengguna", label: "Pengguna & Kasir" },
  { to: "komisi", label: "Aturan Komisi (Pro)" },
];

export default function SettingsLayout() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f4f4f5]">Pengaturan Barbershop</h1>
        <p className="text-sm text-[#71717a] mt-1">Kelola data master, preferensi nota, dan staf barbershop Anda.</p>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-2 border-b border-[#27272a]">
        {settingsTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors min-h-10 flex items-center ${
                isActive ? "bg-[#C6FF3D] text-[#101014]" : "text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#1a1a20]"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="bg-[#1a1a20] rounded-2xl border border-[#27272a] p-4 md:p-6 shadow-sm">
        <Outlet />
      </div>
    </div>
  );
}

