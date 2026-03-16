"use client";

import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { company, user } = useAuth();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-3"
    >
      <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-white/70">
        Bienvenido{user?.name ? `, ${user.name}` : ""}. Empresa: {company?.name ?? "-"}
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Bots", desc: "Configura modelos y comportamiento" },
          { title: "Canales", desc: "WhatsApp, Web, Integraciones" },
          { title: "Contactos", desc: "Clientes, tags y segmentación" },
        ].map((c) => (
          <div
            key={c.title}
            className="rounded-2xl border border-white/10 bg-black/30 p-4"
          >
            <div className="text-sm font-semibold">{c.title}</div>
            <div className="mt-1 text-xs text-white/60">{c.desc}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
