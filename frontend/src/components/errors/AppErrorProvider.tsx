"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  BugAntIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  SignalIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import {
  AppErrorData,
  AppErrorLogFeed,
  AppRequestError,
  buildErrorId,
  jsonFetch,
  serializeAppError,
  toAppRequestError,
} from "@/services/app-error";

import { Button } from "@/components/ui/Button";

type AppErrorContextValue = {
  errors: AppErrorData[];
  panelOpen: boolean;
  debugMode: boolean;
  captureError: (error: unknown, overrides?: Partial<AppErrorData>) => AppRequestError;
  dismissError: (id: string) => void;
  clearErrors: () => void;
  setPanelOpen: (open: boolean) => void;
  setDebugMode: (enabled: boolean) => void;
};

const AppErrorContext = createContext<AppErrorContextValue | null>(null);

const DEBUG_STORAGE_KEY = "abp_debug_mode";

export function AppErrorProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [panelOpen, setPanelOpen] = useState(false);
  const [debugMode, setDebugModeState] = useState(false);
  const [localErrors, setLocalErrors] = useState<AppErrorData[]>([]);
  const [backendErrors, setBackendErrors] = useState<AppErrorData[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(DEBUG_STORAGE_KEY);
    setDebugModeState(saved === "1");
  }, []);

  const capture = useCallback(
    (error: unknown, overrides: Partial<AppErrorData> = {}) => {
      const normalized = toAppRequestError(error, {
        id: buildErrorId(),
        source: overrides.source ?? "frontend",
        type: overrides.type ?? "unknown",
        module: overrides.module ?? "ui",
        path: overrides.path ?? pathname,
        method: overrides.method ?? "CLIENT",
        message: overrides.message ?? "Unexpected application error",
        statusCode: overrides.statusCode ?? 500,
        requestId: overrides.requestId,
        details: overrides.details,
        stack: overrides.stack,
        timestamp: overrides.timestamp,
      });

      setLocalErrors((current) => {
        if (current.some((item) => item.id === normalized.id)) {
          return current;
        }
        return [normalized, ...current].slice(0, 120);
      });
      return normalized;
    },
    [pathname],
  );

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      capture(event.error ?? event.message, {
        type: "ui",
        module: "window",
        source: "frontend",
        path: pathname,
        method: "CLIENT",
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      capture(event.reason, {
        type: "ui",
        module: "promise",
        source: "frontend",
        path: pathname,
        method: "CLIENT",
      });
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [capture, pathname]);

  useEffect(() => {
    let cancelled = false;

    async function pollBackendErrors() {
      try {
        const feed = await jsonFetch<AppErrorLogFeed>(`/api/system/errors?limit=60&debug=${debugMode ? "1" : "0"}`);
        if (!cancelled) {
          setBackendErrors(feed.items);
        }
      } catch (error) {
        const normalized = toAppRequestError(error, {
          type: "unknown",
          module: "error_feed",
          source: "frontend",
          path: "/api/system/errors",
          method: "GET",
          message: "No se pudo cargar el feed de errores",
        });

        if (normalized.statusCode === 401) {
          if (!cancelled) {
            setBackendErrors([]);
          }
          return;
        }

        capture(normalized, {
          module: "error_feed",
          source: "frontend",
          path: "/api/system/errors",
          method: "GET",
        });
      }
    }

    void pollBackendErrors();
    const interval = window.setInterval(() => {
      void pollBackendErrors();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [debugMode]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const errors = useMemo(() => {
    const merged = new Map<string, AppErrorData>();
    [...localErrors, ...backendErrors].forEach((entry) => {
      merged.set(entry.id, entry);
    });
    return Array.from(merged.values()).sort((left, right) =>
      right.timestamp.localeCompare(left.timestamp),
    );
  }, [backendErrors, localErrors]);

  const copyError = useCallback(async (error: AppErrorData) => {
    try {
      await navigator.clipboard.writeText(serializeAppError(error));
      setCopiedId(error.id);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      capture(error, {
        type: "ui",
        module: "clipboard",
        source: "frontend",
        path: pathname,
        method: "CLIENT",
        message: "No se pudo copiar el error",
      });
    }
  }, [capture, pathname]);

  const dismissError = useCallback((id: string) => {
    setLocalErrors((current) => current.filter((item) => item.id !== id));
    setBackendErrors((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setLocalErrors([]);
    setBackendErrors([]);
  }, []);

  const setDebugMode = useCallback((enabled: boolean) => {
    setDebugModeState(enabled);
    window.localStorage.setItem(DEBUG_STORAGE_KEY, enabled ? "1" : "0");
  }, []);

  const value = useMemo<AppErrorContextValue>(
    () => ({
      errors,
      panelOpen,
      debugMode,
      captureError: capture,
      dismissError,
      clearErrors,
      setPanelOpen,
      setDebugMode,
    }),
    [clearErrors, debugMode, dismissError, errors, panelOpen, setDebugMode],
  );

  return (
    <AppErrorContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3">
        <button
          type="button"
          onClick={() => setPanelOpen(!panelOpen)}
          className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-amber-300/30 bg-zinc-950/95 px-4 py-3 text-left text-white shadow-[0_18px_65px_rgba(0,0,0,0.4)] backdrop-blur"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300 text-black">
            <BugAntIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-amber-200/70">Error Center</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
              <span>{errors.length} eventos</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/65">
                {debugMode ? "debug on" : "debug off"}
              </span>
            </div>
          </div>
          {panelOpen ? <ChevronDownIcon className="h-5 w-5 text-white/60" /> : <ChevronUpIcon className="h-5 w-5 text-white/60" />}
        </button>

        {panelOpen ? (
          <section className="pointer-events-auto w-[min(92vw,34rem)] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(30,30,34,0.96),rgba(10,10,12,0.98))] text-white shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-amber-200/70">Live Error Monitor</div>
                  <h2 className="mt-2 text-lg font-semibold">Panel global de errores</h2>
                  <p className="mt-1 text-sm text-white/55">
                    Captura frontend, backend y rechazos no controlados en tiempo real.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="rounded-xl border border-white/10 p-2 text-white/65 transition hover:bg-white/5 hover:text-white"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="secondary" className="px-3 py-2" onClick={clearErrors}>
                  <TrashIcon className="h-4 w-4" /> Limpiar
                </Button>
                <button
                  type="button"
                  onClick={() => setDebugMode(!debugMode)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    debugMode
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  <SignalIcon className="h-4 w-4" />
                  {debugMode ? "Debug activo" : "Activar debug"}
                </button>
              </div>
            </div>

            <div className="max-h-[65vh] overflow-y-auto px-4 py-4">
              {errors.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-white/55">
                  No hay errores registrados ahora mismo.
                </div>
              ) : (
                <div className="space-y-3">
                  {errors.map((error) => (
                    <article
                      key={error.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-amber-100">
                              {error.source}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-white/60">
                              {error.type}
                            </span>
                            <span className="text-xs text-white/40">{new Date(error.timestamp).toLocaleString("es-DO")}</span>
                          </div>
                          <h3 className="mt-3 text-sm font-semibold text-white">{error.message}</h3>
                          <div className="mt-2 grid gap-1 text-xs text-white/55">
                            <div>Módulo: {error.module}</div>
                            <div>Ruta: {error.method} {error.path}</div>
                            <div>Status: {error.statusCode} · Request ID: {error.requestId}</div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void copyError(error)}
                            className="rounded-xl border border-white/10 p-2 text-white/60 transition hover:bg-white/5 hover:text-white"
                          >
                            <ClipboardDocumentIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => dismissError(error.id)}
                            className="rounded-xl border border-white/10 p-2 text-white/60 transition hover:bg-white/5 hover:text-white"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {error.details.length > 0 ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/65">
                          {error.details.join(" • ")}
                        </div>
                      ) : null}

                      {debugMode && error.stack ? (
                        <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] leading-5 text-white/55">
                          {error.stack}
                        </pre>
                      ) : null}

                      {copiedId === error.id ? (
                        <div className="mt-3 text-xs text-emerald-200">Error copiado al portapapeles.</div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </AppErrorContext.Provider>
  );
}

export function useAppErrors() {
  const context = useContext(AppErrorContext);
  if (!context) {
    throw new Error("useAppErrors must be used within AppErrorProvider");
  }
  return context;
}