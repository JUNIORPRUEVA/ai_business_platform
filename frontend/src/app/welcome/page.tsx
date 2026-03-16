"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GradientBackdrop } from "@/components/layout/GradientBackdrop";
import { Button } from "@/components/ui/Button";

export default function WelcomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <GradientBackdrop />

      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full"
        >
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70">
              Plataforma SaaS multiempresa · NestJS · IA · Automatización
            </div>

            <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
              AI Business Platform
            </h1>
            <p className="mt-4 text-balance text-lg leading-8 text-white/70 sm:text-xl">
              Automatiza tu empresa con inteligencia artificial
            </p>
            <p className="mt-6 text-balance text-base leading-7 text-white/60">
              Automatiza conversaciones, clientes y ventas con bots inteligentes.
            </p>

            <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
              <Link href="/register" className="w-full sm:w-auto">
                <Button className="w-full px-8 py-4 text-base" variant="primary">
                  Crear Empresa
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button className="w-full px-8 py-4 text-base" variant="secondary">
                  Iniciar Sesión
                </Button>
              </Link>
            </div>

            <div className="mt-12 text-xs text-white/40">
              Diseño corporativo · Seguro · Listo para licencia empresarial
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
