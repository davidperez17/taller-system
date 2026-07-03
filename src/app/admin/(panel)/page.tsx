import Link from "next/link";
import { ClipboardList, Car, CheckCircle2, Banknote, Plus, ChevronRight } from "lucide-react";
import { getDb } from "@/lib/db";
import { STATUS_META, STATUS_FLOW, formatMoney, formatDate, type OrderStatus } from "@/lib/status";
import { StatusBadge, PlateBadge, VehicleTypeIcon, PageTitle, card, btnPrimary } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const db = getDb();

  const active = db
    .prepare(
      "SELECT COUNT(*) AS n FROM orders WHERE status NOT IN ('entregado','cancelado')"
    )
    .get() as { n: number };
  const ready = db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'listo'")
    .get() as { n: number };
  const deliveredMonth = db
    .prepare(
      `SELECT COUNT(*) AS n FROM orders WHERE status = 'entregado'
       AND strftime('%Y-%m', delivered_at) = strftime('%Y-%m', 'now')`
    )
    .get() as { n: number };
  const revenueMonth = db
    .prepare(
      `SELECT COALESCE(SUM(i.qty * i.unit_price), 0) AS total
       FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.status = 'entregado'
       AND strftime('%Y-%m', o.delivered_at) = strftime('%Y-%m', 'now')`
    )
    .get() as { total: number };

  const byStatus = db
    .prepare(
      `SELECT status, COUNT(*) AS n FROM orders
       WHERE status NOT IN ('entregado','cancelado') GROUP BY status`
    )
    .all() as { status: OrderStatus; n: number }[];
  const statusCount = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));

  const recent = db
    .prepare(
      `SELECT o.id, o.folio, o.status, o.description, o.updated_at, v.plate, v.type, c.name AS client
       FROM orders o
       JOIN vehicles v ON v.id = o.vehicle_id
       JOIN clients c ON c.id = v.client_id
       WHERE o.status NOT IN ('entregado','cancelado')
       ORDER BY o.updated_at DESC LIMIT 8`
    )
    .all() as {
    id: number; folio: string; status: string; description: string;
    updated_at: string; plate: string; type: string; client: string;
  }[];

  const kpis = [
    { label: "En el taller", value: active.n, icon: Car, tone: "bg-blue-50 text-blue-700" },
    { label: "Listos para entrega", value: ready.n, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Entregados este mes", value: deliveredMonth.n, icon: ClipboardList, tone: "bg-violet-50 text-violet-700" },
    { label: "Facturado este mes", value: formatMoney(revenueMonth.total), icon: Banknote, tone: "bg-amber-50 text-amber-700" },
  ];

  return (
    <div className="space-y-6">
      <PageTitle
        title="INICIO"
        subtitle="Resumen del taller en tiempo real"
        action={
          <Link href="/admin/ordenes/nueva" className={btnPrimary}>
            <Plus className="w-4 h-4" aria-hidden="true" /> Nueva orden
          </Link>
        }
      />

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

      {/* Actividad reciente */}
      <section className={`${card} overflow-hidden`}>
        <div className="p-5 pb-3 flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
            ÓRDENES ACTIVAS RECIENTES
          </h2>
          <Link
            href="/admin/ordenes"
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            Ver todas
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-400">
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
                  <span className="text-slate-400 shrink-0">
                    <VehicleTypeIcon type={o.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <PlateBadge plate={o.plate} />
                      <span className="text-sm text-slate-600 truncate">{o.client}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {o.folio} · {o.description || "Sin descripción"} · {formatDate(o.updated_at)}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                  <ChevronRight
                    className="w-4 h-4 text-slate-300 group-hover:text-blue-600 shrink-0"
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
