const BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (res.status === 401) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      // Jangan paksa hard redirect jika sedang memeriksa status auth awal atau sudah di halaman publik
      const isPublicPage = window.location.pathname === "/login" ||
        window.location.pathname === "/daftar" ||
        window.location.pathname.startsWith("/receipt/") ||
        window.location.pathname.endsWith("/book");

      if (!path.includes("/auth/") && !isPublicPage) {
        window.location.href = "/login";
      }
      throw new ApiError(401, data.error ?? "Sesi tidak valid.");
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      throw new ApiError(res.status, data.error ?? "Terjadi kesalahan. Silakan coba lagi.");
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};

