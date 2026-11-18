import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth.tsx";
import { useOnlineStatus } from "../../lib/useOnlineStatus.ts";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  {
    to: "/admin",
    label: "Panel Admin",
    roles: ["super_admin"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    to: "/antrian",
    label: "Antrean",
    roles: ["owner", "cashier", "barber"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    to: "/kasir",
    label: "Kasir",
    roles: ["owner", "cashier"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: "/transaksi",
    label: "Transaksi",
    roles: ["owner", "cashier"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    to: "/pelanggan",
    label: "Pelanggan",
    roles: ["owner", "cashier", "barber"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: "/booking",
    label: "Booking",
    roles: ["owner", "cashier"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: "/laporan",
    label: "Laporan",
    roles: ["owner", "cashier"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    to: "/pengaturan",
    label: "Pengaturan",
    roles: ["owner"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useOnlineStatus();
  const navigate = useNavigate();

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex flex-col md:flex-row min-h-dvh bg-[#101014] text-[#f4f4f5]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#1a1a20] border-r border-[#27272a] fixed top-0 left-0 h-dvh z-10">
        <div className="p-4 border-b border-[#27272a]">
          <div className="flex items-center justify-between">
            <span className="text-[#C6FF3D] font-bold text-xl">BarberFlow</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-[#C6FF3D]" : "bg-red-500"}`} />
              <span className="text-[11px] text-[#71717a] font-medium">{isOnline ? "Online" : "Offline"}</span>
            </div>
          </div>
          {pendingCount > 0 && (
            <div className="mt-2 p-2 bg-yellow-900/30 border border-yellow-800 rounded-lg text-xs text-yellow-300 flex justify-between items-center">
              <span>{pendingCount} transaksi offline</span>
              <button
                onClick={() => void syncNow()}
                disabled={!isOnline || isSyncing}
                className="underline font-bold cursor-pointer disabled:opacity-50"
              >
                {isSyncing ? "..." : "Sync"}
              </button>
            </div>
          )}
          {user && <p className="text-[#71717a] text-xs mt-2 truncate">{user.name} ({user.role})</p>}
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors min-h-12 ${
                  isActive ? "bg-[#C6FF3D] text-[#101014]" : "text-[#f4f4f5] hover:bg-[#27272a]"
                }`
              }
            >
              {item.icon} {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-[#27272a]">
          <button
            onClick={() => void handleLogout()}
            className="w-full text-left px-3 py-3 text-sm text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#27272a] rounded-xl transition-colors min-h-12 cursor-pointer"
          >
            Keluar
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-dvh">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#1a1a20] border-b border-[#27272a] sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-[#C6FF3D] font-bold text-lg">BarberFlow</span>
            {!isOnline ? (
              <span className="text-[10px] bg-red-900/60 text-red-300 border border-red-700 px-2 py-0.5 rounded-full font-medium">
                Offline
              </span>
            ) : pendingCount > 0 ? (
              <button
                onClick={() => void syncNow()}
                className="text-[10px] bg-yellow-900/60 text-yellow-300 border border-yellow-700 px-2 py-0.5 rounded-full font-medium cursor-pointer"
              >
                {isSyncing ? "Sinkron..." : `${pendingCount} antre`}
              </button>
            ) : null}
          </div>
          {user && <span className="text-[#71717a] text-xs">{user.name}</span>}
        </header>

        <div className="flex-1 overflow-y-auto pb-20 md:pb-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1a1a20] border-t border-[#27272a] z-10">
        <div className="flex items-stretch h-16">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 gap-1 text-[10px] font-medium transition-colors ${
                  isActive ? "text-[#C6FF3D]" : "text-[#71717a]"
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

