"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  AdjustmentsHorizontalIcon,
  BoltIcon,
  CreditCardIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  CubeTransparentIcon,
  HomeIcon,
  Squares2X2Icon,
  UsersIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/billing", label: "Facturación", icon: CreditCardIcon },
  { href: "/bots", label: "Bots", icon: CubeTransparentIcon },
  { href: "/channels", label: "Canales", icon: Squares2X2Icon },
  { href: "/contacts", label: "Contactos", icon: UsersIcon },
  { href: "/conversations", label: "Conversaciones", icon: ChatBubbleLeftRightIcon },
  { href: "/automations", label: "Automatizaciones", icon: BoltIcon },
  { href: "/settings", label: "Configuración", icon: Cog6ToothIcon },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, company, logout } = useAuth();

  async function onLogout() {
    await logout();
    router.push("/welcome");
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-7xl px-6 py-12 text-white/60">Cargando…</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/welcome");
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        <aside className="hidden w-64 shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4 md:block">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-black">
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{company?.name ?? "Empresa"}</div>
              <div className="truncate text-xs text-white/50">{user?.email ?? ""}</div>
            </div>
          </div>

          <nav className="space-y-1">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                    active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-white/10 pt-4">
            <Button onClick={onLogout} variant="secondary" className="w-full">
              Cerrar sesión
            </Button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="mb-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{company?.name ?? "AI Business Platform"}</div>
              <div className="truncate text-xs text-white/50">
                {user?.name ? `${user.name} · ` : ""}{user?.role ?? ""}
              </div>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <Button onClick={onLogout} variant="secondary">
                Logout
              </Button>
            </div>
          </header>

          <main className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
