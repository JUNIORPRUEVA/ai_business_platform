"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { GradientBackdrop } from "@/components/layout/GradientBackdrop";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function RegisterPage() {
  const router = useRouter();
  const { registerCompany } = useAuth();

  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!companyName.trim()) e.companyName = "Ingresa el nombre de la empresa";
    if (!adminName.trim()) e.adminName = "Ingresa el nombre del administrador";
    if (!email.trim() || !isEmail(email)) e.email = "Correo inválido";
    if (password.length < 8) e.password = "Mínimo 8 caracteres";
    if (confirmPassword !== password) e.confirmPassword = "No coincide";
    return e;
  }, [companyName, adminName, email, password, confirmPassword]);

  const canSubmit = Object.keys(fieldErrors).length === 0 && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await registerCompany({ companyName, adminName, email, password });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <GradientBackdrop />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="w-full max-w-lg"
        >
          <Card className="p-8 sm:p-10">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight">Crear Empresa</h1>
              <p className="mt-2 text-sm text-white/60">
                Crea tu compañía y el usuario administrador.
              </p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <Input
                label="Nombre de la empresa"
                name="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                error={fieldErrors.companyName}
                placeholder="Ej: Fulltech S.A."
                autoComplete="organization"
              />
              <Input
                label="Nombre del administrador"
                name="adminName"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                error={fieldErrors.adminName}
                placeholder="Ej: Juan Pérez"
                autoComplete="name"
              />
              <Input
                label="Correo"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
                placeholder="admin@empresa.com"
                autoComplete="email"
              />
              <Input
                label="Contraseña"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
                placeholder="********"
                autoComplete="new-password"
              />
              <Input
                label="Confirmar contraseña"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={fieldErrors.confirmPassword}
                placeholder="********"
                autoComplete="new-password"
              />

              {error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
                  {error}
                </div>
              ) : null}

              <Button className="w-full py-4" type="submit" disabled={!canSubmit}>
                {submitting ? "Creando..." : "Crear y entrar"}
              </Button>
            </form>

            <div className="mt-8 flex items-center justify-between text-sm text-white/60">
              <span>¿Ya tienes cuenta?</span>
              <Link className="text-white hover:text-white/80" href="/login">
                Iniciar sesión
              </Link>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
