"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { useAppErrors } from "@/components/errors/AppErrorProvider";

export default function AppErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { captureError, setPanelOpen } = useAppErrors();

  useEffect(() => {
    captureError(error, {
      type: "ui",
      module: "app_router",
      source: "frontend",
      path: window.location.pathname,
      method: "RENDER",
      message: error.message || "La vista falló durante el render",
    });
    setPanelOpen(true);
  }, [captureError, error, setPanelOpen]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 rounded-[2rem] border border-red-400/20 bg-red-500/5 px-6 py-12 text-center text-white">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-[0.22em] text-red-200/70">Fallback UI</div>
        <h2 className="text-2xl font-semibold">La pantalla encontró un error</h2>
        <p className="max-w-xl text-sm text-white/65">
          Registramos el fallo y mantuvimos el panel de errores disponible para diagnóstico. Puedes reintentar sin recargar toda la sesión.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => reset()}>Reintentar</Button>
        <Button variant="secondary" onClick={() => setPanelOpen(true)}>Abrir Error Center</Button>
      </div>
    </div>
  );
}