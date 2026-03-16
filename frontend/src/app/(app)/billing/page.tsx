"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import {
  cancelSubscription,
  createSubscription,
  getBillingSummary,
  type BillingSummary,
} from "@/services/billing";
import { Button } from "@/components/ui/Button";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const STATUS_LABEL: Record<BillingSummary["subscription"]["status"], string> = {
  trial: "Trial",
  active: "Activa",
  past_due: "Pago requerido",
  cancelled: "Cancelada",
};

export default function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setSummary(await getBillingSummary());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar facturación");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onPay() {
    setPaying(true);
    setError(null);
    try {
      const { approvalUrl } = await createSubscription();
      window.location.href = approvalUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la suscripción");
      setPaying(false);
    }
  }

  async function onCancel() {
    setCancelling(true);
    setError(null);
    try {
      await cancelSubscription();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la suscripción");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Facturación</h1>
        <p className="mt-2 text-sm text-white/65">
          Gestiona tu plan, estado de licencia y renovación mensual por PayPal.
        </p>
      </div>

      {loading ? <div className="text-sm text-white/60">Cargando facturación…</div> : null}

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
          <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">Plan actual</div>
                <h2 className="mt-2 text-2xl font-semibold">{summary.plan.name}</h2>
                <div className="mt-1 text-sm text-white/55">USD ${summary.plan.price} / mes</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                {STATUS_LABEL[summary.subscription.status]}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs text-white/45">Usuarios</div>
                <div className="mt-2 text-2xl font-semibold">{summary.plan.maxUsers}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs text-white/45">Bots</div>
                <div className="mt-2 text-2xl font-semibold">{summary.plan.maxBots}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs text-white/45">Canales</div>
                <div className="mt-2 text-2xl font-semibold">{summary.plan.maxChannels}</div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">Suscripción</div>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              <div className="flex items-center justify-between gap-4">
                <span>Estado</span>
                <span className="font-semibold text-white">{STATUS_LABEL[summary.subscription.status]}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Inicio</span>
                <span className="text-white">{formatDate(summary.subscription.startDate)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Renovación</span>
                <span className="text-white">{formatDate(summary.subscription.renewDate)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>PayPal</span>
                <span className="max-w-[220px] truncate text-white">
                  {summary.subscription.paypalSubscriptionId ?? "No creada todavía"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Button onClick={onPay} disabled={paying} className="w-full">
                {paying ? "Redirigiendo a PayPal…" : "Pagar con PayPal"}
              </Button>
              <Button onClick={onCancel} disabled={cancelling} variant="secondary" className="w-full">
                {cancelling ? "Cancelando…" : "Cancelar suscripción"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </motion.div>
  );
}
