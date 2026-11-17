import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api.ts";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [barbershopName, setBarbershopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/api/auth/register", {
        barbershopName,
        ownerName,
        email,
        password,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Terjadi kesalahan pendaftaran. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-dvh bg-[#101014] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#1a1a20] rounded-2xl border border-[#27272a] p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-green-900/50 text-green-400 rounded-full flex items-center justify-center mx-auto text-2xl">
            ✓
          </div>
          <h2 className="text-xl font-bold text-[#f4f4f5]">Pendaftaran Berhasil!</h2>
          <p className="text-sm text-[#71717a]">
            Akun barbershop Anda telah dibuat dengan paket Starter. Silakan masuk untuk mulai mengatur layanan dan kapster.
          </p>
          <Button onClick={() => navigate("/login")} className="w-full">
            Masuk Sekarang
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#101014] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#C6FF3D]">BarberFlow</h1>
          <p className="text-[#71717a] mt-2 text-sm">Daftar Barbershop Baru</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="bg-[#1a1a20] rounded-2xl border border-[#27272a] p-6 space-y-4 shadow-xl">
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-400 text-sm">{error}</div>
          )}

          <Input
            label="Nama Barbershop"
            placeholder="Contoh: Barbershop Keren"
            value={barbershopName}
            onChange={(e) => setBarbershopName(e.target.value)}
            required
            minLength={2}
          />

          <Input
            label="Nama Pemilik"
            placeholder="Nama lengkap Anda"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            required
            minLength={2}
          />

          <Input
            label="Email"
            type="email"
            placeholder="owner@barbershop.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="Minimal 10 karakter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
            helper="Password minimal 10 karakter untuk keamanan"
            autoComplete="new-password"
          />

          <Button type="submit" className="w-full" loading={loading}>
            Daftar Sekarang
          </Button>
        </form>

        <p className="text-center text-sm text-[#71717a] mt-6">
          Sudah punya akun?{" "}
          <Link to="/login" className="text-[#C6FF3D] hover:underline font-medium">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}

