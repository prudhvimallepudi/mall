import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  avatar_id?: string | null;
  business_name?: string | null;
  gst_number?: string | null;
  logo_url?: string | null;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  loginWithSessionId: (sessionId: string) => Promise<void>;
  demoLogin: (email: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get("/auth/me");
      setUser(r.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If URL has session_id fragment, let the login screen handle it first
    if (typeof window !== "undefined" && window.location?.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  const loginWithSessionId = async (sessionId: string) => {
    const r = await api.post("/auth/session", { session_id: sessionId });
    if (r.data?.session_token) await AsyncStorage.setItem("session_token", r.data.session_token);
    setUser(r.data.user);
  };

  const demoLogin = async (email: string, name = "Demo Owner") => {
    const r = await api.post("/auth/demo-login", { email, name });
    if (r.data?.session_token) await AsyncStorage.setItem("session_token", r.data.session_token);
    setUser(r.data.user);
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    await AsyncStorage.removeItem("session_token");
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, loginWithSessionId, demoLogin, logout, refresh,
      updateUser: (patch) => setUser((u) => (u ? { ...u, ...patch } : u)) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
