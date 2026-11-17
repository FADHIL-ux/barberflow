import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { type FeatureKey, type FeatureSet } from "@barberflow/shared";
import { api } from "./api.ts";

export interface User {
  id: string;
  name: string;
  role: "owner" | "cashier" | "barber" | "super_admin";
}

export interface AuthState {
  user: User | null;
  features: FeatureSet | null;
  plan: string | null;
  loading: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, features: null, plan: null, loading: true });

  const refresh = useCallback(async () => {
    try {
      const [meRes, featRes] = await Promise.all([
        api.get<{ user: User }>("/api/auth/me"),
        api.get<{ features: FeatureSet; plan: string }>("/api/features").catch(() => ({ features: null, plan: null })),
      ]);
      setState({
        user: meRes.user,
        features: (featRes as { features: FeatureSet; plan: string }).features,
        plan: (featRes as { features: FeatureSet; plan: string }).plan,
        loading: false,
      });
    } catch {
      setState({ user: null, features: null, plan: null, loading: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ user: User }>("/api/auth/login", { email, password });
    const featRes = await api.get<{ features: FeatureSet; plan: string }>("/api/features").catch(() => ({ features: null, plan: null }));
    setState({
      user: res.user,
      features: (featRes as { features: FeatureSet; plan: string }).features,
      plan: (featRes as { features: FeatureSet; plan: string }).plan,
      loading: false,
    });
  }, []);

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout").catch(() => undefined);
    setState({ user: null, features: null, plan: null, loading: false });
    window.location.href = "/login";
  }, []);

  return <AuthContext.Provider value={{ ...state, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useFeature(key: FeatureKey): boolean {
  const { features } = useAuth();
  return features?.[key] ?? false;
}

