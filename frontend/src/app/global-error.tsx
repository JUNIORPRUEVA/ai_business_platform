"use client";

import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[radial-gradient(circle_at_top,#55210f_0%,#140d0c_48%,#080808_100%)] text-white">
        <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-16">
          <section className="w-full rounded-[2rem] border border-white/10 bg-black/35 p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="text-xs uppercase tracking-[0.24em] text-red-200/70">Global Failure</div>
            <h1 className="mt-3 text-3xl font-semibold">La aplicación cayó en un fallback seguro</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-white/65">
              Se interceptó un error crítico para evitar una pantalla rota. Puedes reintentar la carga inmediata o recargar la página completa.
            </p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm text-white/65">
              {error.message || "Unexpected global application error"}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => reset()}>Reintentar</Button>
              <Button variant="secondary" onClick={() => window.location.reload()}>Recargar aplicación</Button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}