"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell, X, ClipboardList, Wrench, Ban, Wallet, CheckCircle2, XCircle, History,
} from "lucide-react";
import { markNotifsSeenAction } from "@/app/admin/actions";
import {
  activityMeta, timeAgo, ACTIVITY_TONE_CLASS, type ActivityItem,
} from "@/lib/activity-meta";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const badge = seen ? 0 : unread;

  async function openPanel() {
    setOpen(true);
    if (unread > 0 && !seen) {
      setSeen(true);
      try {
        await markNotifsSeenAction();
        router.refresh();
      } catch {
        /* si falla, el badge vuelve en el próximo render del servidor */
      }
    }
  }

  const panelPos =
    placement === "bar"
      ? "inset-x-0 bottom-0 max-h-[80dvh] rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
      : "bottom-6 left-[17rem] w-[22rem] max-h-[70vh] rounded-2xl";

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
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>

      {open && (
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
              {items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-400">
                  Sin actividad del equipo todavía.
                </p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {items.map((it) => {
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
        </div>
      )}
    </>
  );
}
