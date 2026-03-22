"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getSession, login, logout, registerCompany, type Session } from "@/services/auth";
import { useAppErrors } from "@/components/errors/AppErrorProvider";
import { toAppRequestError } from "@/services/app-error";

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
  const { captureError } = useAppErrors();
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getSession();
      setSession(s);
      setStatus("authenticated");
    } catch (error) {
      const normalized = toAppRequestError(error, {
        module: "auth_session",
        source: "frontend",
        path: "/api/auth/session",
        method: "GET",
        message: "No se pudo validar la sesión",
      });
      if (normalized.statusCode !== 401) {
        captureError(normalized);
      }
      setSession(null);
      setStatus("unauthenticated");
    }
  }, [captureError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const doLogin = useCallback(
    async (input: { email: string; password: string; companyId?: string }) => {
      try {
        await login(input);
        await refresh();
      } catch (error) {
        captureError(error, {
          module: "auth_login",
          source: "frontend",
          path: "/api/auth/login",
          method: "POST",
          message: "No se pudo iniciar sesión",
        });
        throw error;
      }
    },
    [captureError, refresh],
  );

  const doRegister = useCallback(
    async (input: {
      companyName: string;
      adminName: string;
      email: string;
      password: string;
    }) => {
      try {
        await registerCompany(input);
        await refresh();
      } catch (error) {
        captureError(error, {
          module: "auth_register",
          source: "frontend",
          path: "/api/auth/register",
          method: "POST",
          message: "No se pudo registrar la empresa",
        });
        throw error;
      }
    },
    [captureError, refresh],
  );

  const doLogout = useCallback(async () => {
    try {
      await logout();
      setSession(null);
      setStatus("unauthenticated");
    } catch (error) {
      captureError(error, {
        module: "auth_logout",
        source: "frontend",
        path: "/api/auth/logout",
        method: "POST",
        message: "No se pudo cerrar la sesión",
      });
      throw error;
    }
  }, [captureError]);

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
