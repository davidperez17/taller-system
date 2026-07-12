import Link from "next/link";
import { many } from "@/lib/db";
import { getActivityHistory } from "@/lib/activity";
import { formatDate } from "@/lib/status";
import { ACTIVITY_META, type ActivityType } from "@/lib/activity-meta";
import { PageTitle, card } from "@/components/admin/ui";
import ActivityRow from "@/components/admin/ActivityRow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Actividad del equipo" };

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
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sm-red"
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
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sm-red"
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
            className="inline-flex items-center justify-center gap-2 bg-sm-red hover:bg-sm-red-hover text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors cursor-pointer"
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
            {items.map((it) => (
              <li key={it.id}>
                <ActivityRow item={it} timeLabel={formatDate(it.created_at)} showType />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
