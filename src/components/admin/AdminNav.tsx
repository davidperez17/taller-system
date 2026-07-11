"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, Users, Car, UserCog, Wrench, ExternalLink,
  Boxes, BarChart3, Bell, MoreHorizontal, X, BellRing, Wallet, Hammer, Receipt,
  Megaphone, History,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { ActivityItem } from "@/lib/activity-meta";
import InstallButton from "@/components/InstallButton";
import NotifBell from "@/components/admin/NotifBell";
import UserMenu from "@/components/admin/UserMenu";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  adminOnly?: boolean;
  noMechanic?: boolean;
  alertKey?: "inventario" | "recordatorios";
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard, exact: true },
  { href: "/admin/ordenes", label: "Órdenes", icon: ClipboardList },
  { href: "/admin/caja", label: "Caja", icon: Wallet, noMechanic: true },
  { href: "/admin/gastos", label: "Gastos", icon: Receipt, adminOnly: true },
  { href: "/admin/inventario", label: "Inventario", icon: Boxes, alertKey: "inventario" },
  { href: "/admin/servicios", label: "Servicios", icon: Hammer },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/admin/recordatorios", label: "Recordatorios", icon: Bell, alertKey: "recordatorios" },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/vehiculos", label: "Vehículos", icon: Car },
  { href: "/admin/novedades", label: "Novedades", icon: Megaphone, noMechanic: true },
  { href: "/admin/actividad", label: "Actividad", icon: History },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: BellRing },
  { href: "/admin/usuarios", label: "Equipo", icon: UserCog, adminOnly: true },
];

// Los 4 primeros van en la barra inferior móvil; el resto entra en "Más".
const PRIMARY = ["/admin", "/admin/ordenes", "/admin/inventario", "/admin/reportes"];

export type NavAlerts = { inventario?: number; recordatorios?: number };

export default function AdminNav({
  user,
  alerts = {},
  notif = { unread: 0, items: [] },
}: {
  user: SessionUser;
  alerts?: NavAlerts;
  notif?: { unread: number; items: ActivityItem[] };
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = NAV.filter(
    (n) =>
      (!n.adminOnly || user.role === "admin") &&
      (!n.noMechanic || user.role !== "mecanico")
  );

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const alertOf = (item: NavItem) => (item.alertKey ? alerts[item.alertKey] ?? 0 : 0);

  const bottomPrimary = items.filter((n) => PRIMARY.includes(n.href));
  const overflow = items.filter((n) => !PRIMARY.includes(n.href));
  const overflowAlerts = overflow.reduce((s, n) => s + alertOf(n), 0);

  return (
    <>
      {/* Sidebar escritorio */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-primary-950 text-white min-h-dvh sticky top-0">
        <div className="p-5 flex items-center gap-3 border-b border-primary-900">
          <div className="bg-primary-600 rounded-xl p-2" aria-hidden="true">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading font-bold tracking-wide leading-tight text-sm">
              SAN MIGUEL 96
            </p>
            <p className="text-primary-300 text-xs">Panel del taller</p>
          </div>
          <NotifBell unread={notif.unread} items={notif.items} placement="sidebar" />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Navegación principal">
          {items.map((item) => {
            const n = alertOf(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={item.href}
                aria-current={isActive(item) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive(item)
                    ? "bg-primary-600 text-white"
                    : "text-primary-200 hover:bg-primary-900 hover:text-white"
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {n > 0 && (
                  <span className="min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold tabular-nums">
                    {n}
                  </span>
                )}
              </Link>
            );
          })}
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-primary-200 hover:bg-primary-900 hover:text-white transition-colors"
          >
            <ExternalLink className="w-5 h-5 shrink-0" aria-hidden="true" />
            Ver app de clientes
          </a>
        </nav>
        <div className="p-3 border-t border-primary-900">
          <UserMenu user={user} placement="sidebar" />
        </div>
      </aside>

      {/* Barra superior móvil */}
      <header className="lg:hidden bg-primary-950 text-white sticky top-0 z-30 shadow-md">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="bg-primary-600 rounded-lg p-1.5" aria-hidden="true">
              <Wrench className="w-4 h-4" />
            </div>
            <p className="font-heading font-bold tracking-wide text-sm truncate">SAN MIGUEL 96</p>
          </div>
          <div className="flex items-center gap-1">
            <NotifBell unread={notif.unread} items={notif.items} placement="bar" />
            <UserMenu user={user} placement="bar" />
          </div>
        </div>
      </header>

      {/* Hoja "Más" (móvil) */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-label="Más secciones">
          <button
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <p className="font-heading font-semibold text-slate-800 tracking-wide">MÁS</p>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Cerrar"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {overflow.map((item) => {
                const n = alertOf(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-xl py-3 text-xs font-medium ${
                      isActive(item)
                        ? "bg-primary-50 text-primary-600"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <item.icon className="w-6 h-6" aria-hidden="true" />
                    {item.label}
                    {n > 0 && (
                      <span className="absolute top-2 right-4 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                        {n}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            <div className="mt-3">
              <InstallButton appName="SM96 Admin" label="Instalar app del panel" />
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav móvil */}
      <nav
        aria-label="Navegación principal"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="flex">
          {bottomPrimary.map((item) => {
            const n = alertOf(item);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  data-tour={item.href}
                  aria-current={isActive(item) ? "page" : undefined}
                  className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                    isActive(item) ? "text-primary-600" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <item.icon className="w-5 h-5" aria-hidden="true" />
                  {item.label}
                  {n > 0 && (
                    <span className="absolute top-1.5 right-[22%] min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {n}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              onClick={() => setMoreOpen(true)}
              data-tour="nav-more"
              aria-label="Más secciones"
              className="relative w-full flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
              Más
              {overflowAlerts > 0 && (
                <span className="absolute top-1.5 right-[24%] min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {overflowAlerts}
                </span>
              )}
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
