import Link from "next/link";
import {
  ClipboardList, Wrench, Ban, Wallet, CheckCircle2, XCircle, Bell,
} from "lucide-react";
import { many } from "@/lib/db";
import { getActivityHistory } from "@/lib/activity";
import { formatDate } from "@/lib/status";
import {
  activityMeta, ACTIVITY_META, ACTIVITY_TONE_CLASS, type ActivityType,
} from "@/lib/activity-meta";
import { PageTitle, card } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Actividad del equipo" };

const ICONS: Record<string, typeof Bell> = {
  clipboard: ClipboardList,
  wrench: Wrench,
  ban: Ban,
  wallet: Wallet,
  check: CheckCircle2,
  x: XCircle,
  bell: Bell,
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; type?: string }>;
}) {
  const { actor = "", type = "" } = await searchParams;
  const actorId = Number(actor) || null;
  const typeFilter = type in ACTIVITY_META ? type : null;

  const [items, users] = await Promise.all([
    getActivityHistory({ actorId, type: typeFilter, limit: 300 }),
    many<{ id: number; name: string }>(
      "SELECT id, name FROM users WHERE active = 1 ORDER BY name"
    ),
  ]);

  const typeOptions = Object.entries(ACTIVITY_META) as [ActivityType, (typeof ACTIVITY_META)[ActivityType]][];
  const hasFilter = !!actorId || !!typeFilter;

  return (
    <div className="space-y-5">
      <PageTitle
        title="ACTIVIDAD DEL EQUIPO"
        subtitle="Quién hizo qué y cuándo: órdenes, estados, cobros y respuestas del cliente"
      />

      {/* Filtros */}
      <form method="GET" className={`${card} p-4 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end`}>
        <div>
          <label htmlFor="f-actor" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Quién
          </label>
          <select
            id="f-actor"
            name="actor"
            defaultValue={actor}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todo el equipo</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-type" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Tipo
          </label>
          <select
            id="f-type"
            name="type"
            defaultValue={type}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos los tipos</option>
            {typeOptions.map(([key, m]) => (
              <option key={key} value={key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors cursor-pointer"
          >
            Filtrar
          </button>
          {hasFilter && (
            <Link
              href="/admin/actividad"
              className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Limpiar
            </Link>
          )}
        </div>
      </form>

      {/* Timeline */}
      <section className={`${card} overflow-hidden`}>
        {items.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">
            No hay actividad registrada con estos filtros.
          </p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {items.map((it) => {
              const meta = activityMeta(it.type);
              const Icon = ICONS[meta.icon] ?? Bell;
              const Row = (
                <div className="flex gap-3 px-4 lg:px-5 py-3.5">
                  <span
                    className={`rounded-xl p-2 h-fit shrink-0 ${ACTIVITY_TONE_CLASS[meta.tone]}`}
                    aria-hidden="true"
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800">{it.title}</p>
                      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {meta.label}
                      </span>
                    </div>
                    {it.detail && (
                      <p className="text-sm text-slate-500 mt-0.5">{it.detail}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {it.actor_name ?? "Sistema"} · {formatDate(it.created_at)}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={it.id}>
                  {it.url ? (
                    <Link href={it.url} className="block hover:bg-slate-50 transition-colors">
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
      </section>
    </div>
  );
}
