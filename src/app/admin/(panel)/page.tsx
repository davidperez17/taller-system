import Link from "next/link";
import {
  ClipboardList, Car, CheckCircle2, Banknote, Plus, ChevronRight, AlertTriangle, Bell, History,
  FilePlus,
} from "lucide-react";
import { one, many } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getActivityHistory } from "@/lib/activity";
import { timeAgo } from "@/lib/activity-meta";
import { STATUS_META, STATUS_FLOW, formatMoney, formatDate, type OrderStatus } from "@/lib/status";
import { ORDER_TOTALS_SQL } from "@/lib/totals";
import {
  StatusBadge, PlateBadge, VehicleTypeIcon, PageTitle, card, btnPrimary, btnSecondary,
} from "@/components/admin/ui";
import ActivityRow from "@/components/admin/ActivityRow";
import CsatBadge from "@/components/admin/CsatBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Solo para decidir los accesos rápidos: el mecánico no entra a Presupuestos
  // (mismo gating que la nav), así que tampoco se le ofrece el atajo.
  const user = await getSessionUser();
  const canQuote = user?.role !== "mecanico";
  // La satisfacción es voz del cliente (mismo gate que Reclamos): el mecánico no
  // la ve, y la consulta ni siquiera se paga en su panel.
  const canSeeCsat = user?.role !== "mecanico";

  const active = (await one<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM orders WHERE status NOT IN ('entregado','cancelado')"
  ))!;
  const ready = (await one<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM orders WHERE status = 'listo'"
  ))!;
  const deliveredMonth = (await one<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM orders WHERE status = 'entregado'
       AND substr(delivered_at, 1, 7) = to_char(now(), 'YYYY-MM')`
  ))!;
  const revenueMonth = (await one<{ total: number }>(
    `SELECT COALESCE(SUM(t.total), 0)::float8 AS total
       FROM ${ORDER_TOTALS_SQL} t JOIN orders o ON o.id = t.order_id
       WHERE o.status = 'entregado'
       AND substr(o.delivered_at, 1, 7) = to_char(now(), 'YYYY-MM')`
  ))!;

  // created_at es TEXT 'YYYY-MM-DD HH:MM:SS' en UTC: la comparación lexicográfica
  // contra el mismo formato es correcta.
  const csat = canSeeCsat
    ? (await one<{ n: number; promedio: number; bajas: number }>(
        `SELECT COUNT(*)::int AS n,
                COALESCE(AVG(rating), 0)::float8 AS promedio,
                COALESCE(SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END), 0)::int AS bajas
           FROM order_feedback
          WHERE created_at >= to_char(now() - interval '30 days', 'YYYY-MM-DD HH24:MI:SS')`
      ))!
    : { n: 0, promedio: 0, bajas: 0 };

  const byStatus = await many<{ status: OrderStatus; n: number }>(
    `SELECT status, COUNT(*)::int AS n FROM orders
       WHERE status NOT IN ('entregado','cancelado') GROUP BY status`
  );
  const statusCount = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));

  const recent = await many<{
    id: number; folio: string; status: string; description: string;
    updated_at: string; plate: string; type: string; client: string;
  }>(
    `SELECT o.id, o.folio, o.status, o.description, o.updated_at, v.plate, v.type, c.name AS client
       FROM orders o
       JOIN vehicles v ON v.id = o.vehicle_id
       JOIN clients c ON c.id = v.client_id
       WHERE o.status NOT IN ('entregado','cancelado')
       ORDER BY o.updated_at DESC LIMIT 8`
  );

  const activity = await getActivityHistory({ limit: 6 });

  const lowStock = (await one<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM parts WHERE active = 1 AND min_stock > 0 AND stock <= min_stock`
  ))!;
  const dueReminders = (await one<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM service_reminders
     WHERE done = 0 AND substr(due_date, 1, 10) <= to_char(now(), 'YYYY-MM-DD')`
  ))!;

  const kpis = [
    { label: "En el taller", value: active.n, icon: Car, tone: "bg-sm-bg text-sm-red" },
    { label: "Listos para entrega", value: ready.n, icon: CheckCircle2, tone: "bg-accent-50 text-accent-700" },
    { label: "Entregados este mes", value: deliveredMonth.n, icon: ClipboardList, tone: "bg-violet-50 text-violet-700" },
    { label: "Facturado este mes", value: formatMoney(revenueMonth.total), icon: Banknote, tone: "bg-amber-50 text-amber-700" },
  ];

  return (
    <div className="space-y-6">
      <PageTitle
        title="INICIO"
        subtitle="Resumen del taller en tiempo real"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {canQuote && (
              <Link href="/admin/presupuestos/nuevo" className={btnSecondary}>
                <FilePlus className="w-4 h-4" aria-hidden="true" /> Nuevo presupuesto
              </Link>
            )}
            <Link href="/admin/ordenes/nueva" className={btnPrimary}>
              <Plus className="w-4 h-4" aria-hidden="true" /> Nueva orden
            </Link>
          </div>
        }
      />

      {/* Alertas */}
      {(lowStock.n > 0 || dueReminders.n > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {lowStock.n > 0 && (
            <Link
              href="/admin/inventario?filtro=bajos"
              className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 hover:bg-red-100 transition-colors"
            >
              <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>
                <b>{lowStock.n}</b> repuesto{lowStock.n === 1 ? "" : "s"} por agotarse.
              </span>
            </Link>
          )}
          {dueReminders.n > 0 && (
            <Link
              href="/admin/recordatorios"
              className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100 transition-colors"
            >
              <Bell className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>
                <b>{dueReminders.n}</b> recordatorio{dueReminders.n === 1 ? "" : "s"} de servicio por
                atender.
              </span>
            </Link>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className={`${card} p-4`}>
            <div className={`rounded-xl p-2 w-fit ${k.tone}`} aria-hidden="true">
              <k.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums font-heading tracking-wide">
              {k.value}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <section className={`${card} p-5`}>
        <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
          ÓRDENES POR ETAPA
        </h2>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STATUS_FLOW.filter((s) => s !== "entregado").map((s) => (
            <Link
              key={s}
              href={`/admin/ordenes?estado=${s}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors px-3 py-2.5"
            >
              <span className="text-xs font-medium text-slate-600">{STATUS_META[s].label}</span>
              <span className="text-sm font-bold text-slate-900 tabular-nums">
                {statusCount[s] ?? 0}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Satisfacción del cliente */}
      {canSeeCsat && (
        <section className={`${card} p-5`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
              SATISFACCIÓN (30 DÍAS)
            </h2>
            <Link
              href="/admin/satisfaccion"
              className="text-sm font-medium text-sm-red hover:text-sm-red-hover"
            >
              Ver todo
            </Link>
          </div>
          {csat.n === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Nadie ha calificado todavía. Al pasar una orden a «Entregado» el cliente recibe la
              invitación en su teléfono; también puedes pedírsela por WhatsApp desde la orden.
            </p>
          ) : (
            <div className="mt-3 flex items-center gap-4 flex-wrap">
              <CsatBadge rating={Math.max(1, Math.round(csat.promedio))} size="lg" />
              <div>
                <p className="text-2xl font-bold text-slate-900 tabular-nums font-heading tracking-wide">
                  {csat.promedio.toFixed(1)} <span className="text-base text-slate-500">/ 4</span>
                </p>
                <p className="text-xs text-slate-500">
                  {csat.n} calificaci{csat.n === 1 ? "ón" : "ones"} en los últimos 30 días
                </p>
              </div>
              {csat.bajas > 0 && (
                <Link
                  href="/admin/satisfaccion?r=mes"
                  className="ml-auto flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 hover:bg-red-100 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    <b>{csat.bajas}</b> calificó Regular o Malo — conviene llamar
                  </span>
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {/* Actividad del equipo */}
      <section className={`${card} overflow-hidden`}>
        <div className="p-5 pb-3 flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" aria-hidden="true" /> ACTIVIDAD DEL EQUIPO
          </h2>
          <Link
            href="/admin/actividad"
            className="text-sm font-medium text-sm-red hover:text-sm-red-hover"
          >
            Ver todo
          </Link>
        </div>
        {activity.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-500">Sin actividad del equipo todavía.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activity.map((it) => (
              <li key={it.id}>
                <ActivityRow item={it} timeLabel={timeAgo(it.created_at)} className="px-5 py-3" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Órdenes activas recientes */}
      <section className={`${card} overflow-hidden`}>
        <div className="p-5 pb-3 flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
            ÓRDENES ACTIVAS RECIENTES
          </h2>
          <Link
            href="/admin/ordenes"
            className="text-sm font-medium text-sm-red hover:text-sm-red-hover"
          >
            Ver todas
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-500">
            No hay órdenes activas. Crea la primera con “Nueva orden”.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/ordenes/${o.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                >
                  <span className="text-slate-500 shrink-0">
                    <VehicleTypeIcon type={o.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <PlateBadge plate={o.plate} />
                      <span className="text-sm text-slate-600 truncate">{o.client}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {o.folio} · {o.description || "Sin descripción"} · {formatDate(o.updated_at)}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                  <ChevronRight
                    className="w-4 h-4 text-slate-300 group-hover:text-sm-red shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
