const BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    if (!path.includes("/auth/login")) {
      window.location.href = "/login";
    }
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new ApiError(401, data.error ?? "Sesi tidak valid.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new ApiError(res.status, data.error ?? "Terjadi kesalahan. Silakan coba lagi.");
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
