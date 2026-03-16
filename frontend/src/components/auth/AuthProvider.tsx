"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getSession, login, logout, registerCompany, type Session } from "@/services/auth";

type Status = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: Status;
  user: Session["user"] | null;
  company: Session["company"] | null;
  refresh: () => Promise<void>;
  login: (input: { email: string; password: string; companyId?: string }) => Promise<void>;
  registerCompany: (input: {
    companyName: string;
    adminName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getSession();
      setSession(s);
      setStatus("authenticated");
    } catch {
      setSession(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const doLogin = useCallback(
    async (input: { email: string; password: string; companyId?: string }) => {
      await login(input);
      await refresh();
    },
    [refresh],
  );

  const doRegister = useCallback(
    async (input: {
      companyName: string;
      adminName: string;
      email: string;
      password: string;
    }) => {
      await registerCompany(input);
      await refresh();
    },
    [refresh],
  );

  const doLogout = useCallback(async () => {
    await logout();
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      company: session?.company ?? null,
      refresh,
      login: doLogin,
      registerCompany: doRegister,
      logout: doLogout,
    }),
    [status, session, refresh, doLogin, doRegister, doLogout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
