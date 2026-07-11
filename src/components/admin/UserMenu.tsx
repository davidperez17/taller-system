"use client";

import { useState } from "react";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import type { SessionUser } from "@/lib/auth";
import { ROLES } from "@/lib/status";
import InstallButton from "@/components/InstallButton";
import AdminPushToggle from "@/components/admin/AdminPushToggle";

// Iniciales para el avatar (primeras letras de hasta dos palabras).
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase() || "?";
}

// Menú de usuario flotante. Agrupa las acciones del dispositivo/cuenta
// (instalar app, avisos push, cerrar sesión) que antes saturaban el pie del
// sidebar. En escritorio abre hacia arriba desde la tarjeta; en móvil es un
// desplegable desde el avatar de la barra superior.
export default function UserMenu({
  user,
  placement,
}: {
  user: SessionUser;
  placement: "sidebar" | "bar";
}) {
  const [open, setOpen] = useState(false);
  const avatar = initials(user.name);

  const popPos =
    placement === "sidebar"
      ? "bottom-full mb-2 left-0 right-0"
      : "top-full mt-2 right-0 w-64";

  return (
    <div className={placement === "sidebar" ? "relative" : "relative inline-block"}>
      {/* Disparador */}
      {placement === "sidebar" ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="w-full flex items-center gap-3 rounded-xl p-2 hover:bg-primary-900 transition-colors cursor-pointer text-left"
        >
          <span className="w-9 h-9 rounded-full bg-primary-600 text-white font-semibold text-sm flex items-center justify-center shrink-0">
            {avatar}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-white truncate">{user.name}</span>
            <span className="block text-xs text-primary-300">{ROLES[user.role]}</span>
          </span>
          <ChevronsUpDown className="w-4 h-4 text-primary-300 shrink-0" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Menú de usuario"
          className="p-1 rounded-full hover:bg-primary-900 transition-colors cursor-pointer"
        >
          <span className="w-8 h-8 rounded-full bg-primary-600 text-white font-semibold text-xs flex items-center justify-center">
            {avatar}
          </span>
        </button>
      )}

      {/* Popover flotante */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className={`absolute z-50 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 animate-slide-up ${popPos}`}
          >
            {/* Identidad (solo en móvil, donde el disparador es solo avatar) */}
            {placement === "bar" && (
              <div className="px-3 pt-2 pb-2 mb-1 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
                <p className="text-xs text-slate-400">{ROLES[user.role]}</p>
              </div>
            )}

            <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Este dispositivo
            </p>
            <InstallButton variant="menu" appName="SM96 Admin" label="Instalar app" />
            <AdminPushToggle variant="menu" />

            <div className="my-1 border-t border-slate-100" />
            <form action={logoutAction}>
              <button
                type="submit"
                role="menuitem"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left"
              >
                <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" /> Cerrar sesión
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
