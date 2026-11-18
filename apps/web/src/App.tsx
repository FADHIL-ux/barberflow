import { Routes, Route, Navigate } from "react-router-dom";
import { Component, lazy, Suspense, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { useAuth } from "./lib/auth.tsx";
import { AppShell } from "./components/layout/AppShell.tsx";
import { Spinner } from "./components/ui/Spinner.tsx";

// Reload once automatically if a lazy-loaded chunk fails after a new deployment
function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    const key = "bf_chunk_reload";
    try {
      const mod = await factory();
      sessionStorage.removeItem(key);
      return mod;
    } catch (err) {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message || "Terjadi kesalahan tampilan." };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-[#101014] text-[#f4f4f5] flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-[#1a1a20] border border-[#27272a] rounded-2xl p-6 text-center space-y-4">
            <div className="text-3xl">⚠️</div>
            <h2 className="text-lg font-bold">Halaman Gagal Dimuat</h2>
            <p className="text-xs text-[#71717a]">{this.state.message}</p>
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem("bf_chunk_reload");
                window.location.reload();
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#C6FF3D] text-[#101014] font-semibold text-sm cursor-pointer"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const LoginPage = lazyWithRetry(() => import("./pages/LoginPage.tsx"));
const RegisterPage = lazyWithRetry(() => import("./pages/RegisterPage.tsx"));
const QueuePage = lazyWithRetry(() => import("./pages/QueuePage.tsx"));
const CashierPage = lazyWithRetry(() => import("./pages/CashierPage.tsx"));
const CustomersPage = lazyWithRetry(() => import("./pages/CustomersPage.tsx"));
const ReportPage = lazyWithRetry(() => import("./pages/ReportPage.tsx"));
const TransactionsPage = lazyWithRetry(() => import("./pages/TransactionsPage.tsx"));
const SettingsLayout = lazyWithRetry(() => import("./pages/settings/SettingsLayout.tsx"));
const ProfileSettingsPage = lazyWithRetry(() => import("./pages/settings/ProfileSettingsPage.tsx"));
const ServicesSettingsPage = lazyWithRetry(() => import("./pages/settings/ServicesSettingsPage.tsx"));
const ProductsSettingsPage = lazyWithRetry(() => import("./pages/settings/ProductsSettingsPage.tsx"));
const BarbersSettingsPage = lazyWithRetry(() => import("./pages/settings/BarbersSettingsPage.tsx"));
const UsersSettingsPage = lazyWithRetry(() => import("./pages/settings/UsersSettingsPage.tsx"));
const CommissionSettingsPage = lazyWithRetry(() => import("./pages/settings/CommissionSettingsPage.tsx"));
const AdminLayout = lazyWithRetry(() => import("./pages/admin/AdminLayout.tsx"));
const PublicReceiptPage = lazyWithRetry(() => import("./pages/PublicReceiptPage.tsx"));
const PublicBookingPage = lazyWithRetry(() => import("./pages/PublicBookingPage.tsx"));
const BookingsPage = lazyWithRetry(() => import("./pages/BookingsPage.tsx"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-[#101014]">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function defaultHome(role?: string) {
  return role === "super_admin" ? "/admin" : "/antrian";
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to={defaultHome(user?.role)} replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-[#101014]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-dvh bg-[#101014]">
            <Spinner size="lg" />
          </div>
        }
      >
        <Routes>
        {/* Public routes */}
        <Route path="/login" element={user ? <Navigate to={defaultHome(user.role)} replace /> : <LoginPage />} />
        <Route path="/daftar" element={user ? <Navigate to={defaultHome(user.role)} replace /> : <RegisterPage />} />
        <Route path="/receipt/:token" element={<PublicReceiptPage />} />
        <Route path="/:slug/book" element={<PublicBookingPage />} />

        {/* Protected routes inside AppShell */}
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to={defaultHome(user?.role)} replace />} />
          <Route
            path="/antrian"
            element={
              <RequireRole roles={["owner", "cashier", "barber"]}>
                <QueuePage />
              </RequireRole>
            }
          />
          <Route
            path="/kasir"
            element={
              <RequireRole roles={["owner", "cashier"]}>
                <CashierPage />
              </RequireRole>
            }
          />
          <Route
            path="/pelanggan"
            element={
              <RequireRole roles={["owner", "cashier", "barber"]}>
                <CustomersPage />
              </RequireRole>
            }
          />
          <Route
            path="/booking"
            element={
              <RequireRole roles={["owner", "cashier"]}>
                <BookingsPage />
              </RequireRole>
            }
          />
          <Route
            path="/laporan"
            element={
              <RequireRole roles={["owner", "cashier"]}>
                <ReportPage />
              </RequireRole>
            }
          />
          <Route
            path="/transaksi"
            element={
              <RequireRole roles={["owner", "cashier"]}>
                <TransactionsPage />
              </RequireRole>
            }
          />
          <Route
            path="/pengaturan"
            element={
              <RequireRole roles={["owner"]}>
                <SettingsLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="profil" replace />} />
            <Route path="profil" element={<ProfileSettingsPage />} />
            <Route path="layanan" element={<ServicesSettingsPage />} />
            <Route path="produk" element={<ProductsSettingsPage />} />
            <Route path="kapster" element={<BarbersSettingsPage />} />
            <Route path="pengguna" element={<UsersSettingsPage />} />
            <Route path="komisi" element={<CommissionSettingsPage />} />
          </Route>
          <Route
            path="/admin/*"
            element={
              <RequireRole roles={["super_admin"]}>
                <AdminLayout />
              </RequireRole>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

