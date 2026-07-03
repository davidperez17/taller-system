"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, Users, Car, UserCog, LogOut, Wrench, ExternalLink,
} from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import type { SessionUser } from "@/lib/auth";
import { ROLES } from "@/lib/status";

const NAV = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard, exact: true },
  { href: "/admin/ordenes", label: "Órdenes", icon: ClipboardList },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/vehiculos", label: "Vehículos", icon: Car },
  { href: "/admin/usuarios", label: "Equipo", icon: UserCog, adminOnly: true },
];

export default function AdminNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => !n.adminOnly || user.role === "admin");

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <>
      {/* Sidebar escritorio */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-blue-950 text-white min-h-dvh sticky top-0">
        <div className="p-5 flex items-center gap-3 border-b border-blue-900">
          <div className="bg-blue-600 rounded-xl p-2" aria-hidden="true">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-heading font-bold tracking-wide leading-tight text-sm">
              SAN MIGUEL 96
            </p>
            <p className="text-blue-300 text-xs">Panel del taller</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1" aria-label="Navegación principal">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                isActive(item)
                  ? "bg-blue-600 text-white"
                  : "text-blue-200 hover:bg-blue-900 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-blue-200 hover:bg-blue-900 hover:text-white transition-colors"
          >
            <ExternalLink className="w-5 h-5 shrink-0" aria-hidden="true" />
            Ver app de clientes
          </a>
        </nav>
        <div className="p-4 border-t border-blue-900">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <p className="text-xs text-blue-300">{ROLES[user.role]}</p>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="flex items-center gap-2 text-sm text-blue-200 hover:text-white transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Barra superior móvil */}
      <header className="lg:hidden bg-blue-950 text-white sticky top-0 z-30 shadow-md">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="bg-blue-600 rounded-lg p-1.5" aria-hidden="true">
              <Wrench className="w-4 h-4" />
            </div>
            <p className="font-heading font-bold tracking-wide text-sm truncate">SAN MIGUEL 96</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Cerrar sesión"
              className="p-2 rounded-lg hover:bg-blue-900 transition-colors cursor-pointer"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
            </button>
          </form>
        </div>
      </header>

      {/* Bottom nav móvil */}
      <nav
        aria-label="Navegación principal"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="flex">
          {items.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive(item) ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive(item) ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <item.icon className="w-5 h-5" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
