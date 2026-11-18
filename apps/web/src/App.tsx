import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useAuth } from "./lib/auth.tsx";
import { AppShell } from "./components/layout/AppShell.tsx";
import { Spinner } from "./components/ui/Spinner.tsx";

const LoginPage = lazy(() => import("./pages/LoginPage.tsx"));
const RegisterPage = lazy(() => import("./pages/RegisterPage.tsx"));
const QueuePage = lazy(() => import("./pages/QueuePage.tsx"));
const CashierPage = lazy(() => import("./pages/CashierPage.tsx"));
const CustomersPage = lazy(() => import("./pages/CustomersPage.tsx"));
const ReportPage = lazy(() => import("./pages/ReportPage.tsx"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage.tsx"));
const SettingsLayout = lazy(() => import("./pages/settings/SettingsLayout.tsx"));
const ProfileSettingsPage = lazy(() => import("./pages/settings/ProfileSettingsPage.tsx"));
const ServicesSettingsPage = lazy(() => import("./pages/settings/ServicesSettingsPage.tsx"));
const ProductsSettingsPage = lazy(() => import("./pages/settings/ProductsSettingsPage.tsx"));
const BarbersSettingsPage = lazy(() => import("./pages/settings/BarbersSettingsPage.tsx"));
const UsersSettingsPage = lazy(() => import("./pages/settings/UsersSettingsPage.tsx"));
const CommissionSettingsPage = lazy(() => import("./pages/settings/CommissionSettingsPage.tsx"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout.tsx"));
const PublicReceiptPage = lazy(() => import("./pages/PublicReceiptPage.tsx"));
const PublicBookingPage = lazy(() => import("./pages/PublicBookingPage.tsx"));
const BookingsPage = lazy(() => import("./pages/BookingsPage.tsx"));

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
          <Route path="/transaksi" element={<TransactionsPage />} />
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
  );
}

