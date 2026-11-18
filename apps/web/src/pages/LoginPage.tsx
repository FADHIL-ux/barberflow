import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { ApiError } from "../lib/api.ts";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === "super_admin") {
        navigate("/admin");
      } else {
        navigate("/antrian");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#101014] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#C6FF3D]">BarberFlow</h1>
          <p className="text-[#71717a] mt-2 text-sm">Masuk ke akun barbershop Anda</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="bg-[#1a1a20] rounded-2xl border border-[#27272a] p-6 space-y-4 shadow-xl">
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-400 text-sm">{error}</div>
          )}

          <Input
            label="Email"
            type="email"
            placeholder="nama@barbershop.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" className="w-full" loading={loading}>
            Masuk
          </Button>
        </form>

        <p className="text-center text-sm text-[#71717a] mt-6">
          Belum punya akun?{" "}
          <Link to="/daftar" className="text-[#C6FF3D] hover:underline font-medium">
            Daftar barbershop baru
          </Link>
        </p>
      </div>
    </div>
  );
}

