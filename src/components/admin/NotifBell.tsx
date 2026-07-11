"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bell, X, ClipboardList, Wrench, Ban, Wallet, CheckCircle2, XCircle, History,
} from "lucide-react";
import { markNotifsSeenAction } from "@/app/admin/actions";
import {
  activityMeta, timeAgo, ACTIVITY_TONE_CLASS, type ActivityItem,
} from "@/lib/activity-meta";

// Cada cuánto la campana consulta el servidor por notificaciones nuevas.
const POLL_MS = 45 * 1000;

const ICONS: Record<string, typeof Bell> = {
  clipboard: ClipboardList,
  wrench: Wrench,
  ban: Ban,
  wallet: Wallet,
  check: CheckCircle2,
  x: XCircle,
  bell: Bell,
};

// Centro de notificaciones internas. La campana vive en la barra (móvil) y en
// el sidebar (escritorio); el panel se adapta a cada lado. Al abrir marca todo
// como leído (marca de agua) y refresca para bajar el badge.
export default function NotifBell({
  unread,
  items,
  placement,
}: {
  unread: number;
  items: ActivityItem[];
  placement: "bar" | "sidebar";
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Estado vivo: arranca con lo del render del servidor y se refresca por polling.
  const [count, setCount] = useState(unread);
  const [list, setList] = useState<ActivityItem[]>(items);
  const openRef = useRef(open);
  openRef.current = open;

  // Trae el conteo/lista del servidor. No pisa el badge mientras el panel está
  // abierto (ya se está marcando como leído).
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifs", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread: number; items: ActivityItem[] };
      setList(data.items);
      if (!openRef.current) setCount(data.unread);
    } catch {
      /* sin red: reintenta en el próximo ciclo */
    }
  }, []);

  useEffect(() => setMounted(true), []);

  // Polling en vivo + al volver a la pestaña, para que el número suba solo.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const badge = open ? 0 : count;

  async function openPanel() {
    setOpen(true);
    void refresh(); // lista fresca al abrir
    if (count > 0) {
      setCount(0);
      try {
        await markNotifsSeenAction();
      } catch {
        /* si falla, el badge vuelve en el próximo polling */
      }
    }
  }

  const panelPos =
    placement === "bar"
      ? "inset-x-0 bottom-0 max-h-[80dvh] rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
      : "top-16 left-[17rem] w-[22rem] max-h-[70vh] rounded-2xl";

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label={`Notificaciones${badge > 0 ? ` (${badge} sin leer)` : ""}`}
        className="relative p-2 rounded-lg text-primary-100 hover:bg-primary-900 hover:text-white transition-colors cursor-pointer"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex">
            <span className="absolute inline-flex w-full h-full rounded-full bg-red-400 opacity-75 animate-ping" aria-hidden="true" />
            <span className="relative min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums">
              {badge > 9 ? "9+" : badge}
            </span>
          </span>
        )}
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Notificaciones">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/30"
          />
          <div className={`absolute bg-white shadow-2xl border border-slate-200 flex flex-col ${panelPos}`}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
              <h2 className="font-heading font-semibold text-slate-800 tracking-wide">
                NOTIFICACIONES
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0">
              {list.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-400">
                  Sin actividad del equipo todavía.
                </p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {list.map((it) => {
                    const meta = activityMeta(it.type);
                    const Icon = ICONS[meta.icon] ?? Bell;
                    const Row = (
                      <div className="flex gap-3 px-4 py-3">
                        <span
                          className={`rounded-xl p-2 h-fit shrink-0 ${ACTIVITY_TONE_CLASS[meta.tone]}`}
                          aria-hidden="true"
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800">{it.title}</p>
                          {it.detail && (
                            <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{it.detail}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            {it.actor_name ?? "Sistema"} · {timeAgo(it.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                    return (
                      <li key={it.id}>
                        {it.url ? (
                          <Link
                            href={it.url}
                            onClick={() => setOpen(false)}
                            className="block hover:bg-slate-50 transition-colors"
                          >
                            {Row}
                          </Link>
                        ) : (
                          Row
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <Link
              href="/admin/actividad"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 px-4 py-3 border-t border-slate-100 text-sm font-semibold text-primary-600 hover:bg-slate-50 transition-colors shrink-0"
            >
              <History className="w-4 h-4" aria-hidden="true" /> Ver historial completo
            </Link>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
