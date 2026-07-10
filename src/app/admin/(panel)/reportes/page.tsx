import { Banknote, ClipboardList, TrendingUp, Wrench, Boxes, Wallet, HandCoins } from "lucide-react";
import { many, one } from "@/lib/db";
import { formatMoney, STATUS_META, STATUS_FLOW, type OrderStatus } from "@/lib/status";
import { PageTitle, card } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reportes" };

const MONTH_LABELS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

// Últimos 6 meses como claves 'YYYY-MM' (incluye meses sin datos).
function lastMonths(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    out.push({ key, label: MONTH_LABELS[m.getMonth()] });
  }
  return out;
}

export default async function ReportsPage() {
  const months = lastMonths(6);
  const since = months[0].key; // 'YYYY-MM' del mes más antiguo del rango

  const revRows = await many<{ ym: string; total: number; profit: number; orders: number }>(
    `SELECT substr(o.delivered_at, 1, 7) AS ym,
            COALESCE(SUM(i.qty * i.unit_price), 0)::float8 AS total,
            COALESCE(SUM(i.qty * (i.unit_price - i.unit_cost)), 0)::float8 AS profit,
            COUNT(DISTINCT o.id)::int AS orders
     FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
     WHERE o.status = 'entregado' AND substr(o.delivered_at, 1, 7) >= ?
     GROUP BY ym`,
    [since]
  );
  const revByMonth = new Map(revRows.map((r) => [r.ym, r]));

  // Fecha desde la que existen costos reales en los ítems (antes, unit_cost=0
  // infla la "ganancia": el reporte lo advierte).
  const firstCosted = await one<{ d: string | null }>(
    "SELECT MIN(created_at) AS d FROM order_items WHERE unit_cost > 0"
  );

  const createdRows = await many<{ ym: string; n: number }>(
    `SELECT substr(created_at, 1, 7) AS ym, COUNT(*)::int AS n
     FROM orders WHERE substr(created_at, 1, 7) >= ?
     GROUP BY ym`,
    [since]
  );
  const createdByMonth = new Map(createdRows.map((r) => [r.ym, r.n]));

  const revSeries = months.map((m) => ({
    ...m,
    total: revByMonth.get(m.key)?.total ?? 0,
    profit: revByMonth.get(m.key)?.profit ?? 0,
    orders: revByMonth.get(m.key)?.orders ?? 0,
    created: createdByMonth.get(m.key) ?? 0,
  }));
  const maxRev = Math.max(1, ...revSeries.map((r) => r.total));
  const maxCreated = Math.max(1, ...revSeries.map((r) => r.created));

  const nowKey = months[months.length - 1].key;
  const prevKey = months[months.length - 2]?.key;
  const revNow = revByMonth.get(nowKey)?.total ?? 0;
  const revPrev = revByMonth.get(prevKey ?? "")?.total ?? 0;
  const growth = revPrev > 0 ? Math.round(((revNow - revPrev) / revPrev) * 100) : null;

  const allTime = (await one<{ orders: number; total: number }>(
    `SELECT COUNT(DISTINCT o.id)::int AS orders, COALESCE(SUM(i.qty * i.unit_price), 0)::float8 AS total
     FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
     WHERE o.status = 'entregado'`
  ))!;
  const avgTicket = allTime.orders > 0 ? allTime.total / allTime.orders : 0;

  const mechanics = await many<{
    id: number; name: string; delivered: number; revenue: number; profit: number;
  }>(
    `SELECT u.id, u.name,
            COUNT(DISTINCT o.id)::int AS delivered,
            COALESCE(SUM(i.qty * i.unit_price), 0)::float8 AS revenue,
            COALESCE(SUM(i.qty * (i.unit_price - i.unit_cost)), 0)::float8 AS profit
     FROM users u
     JOIN orders o ON o.assigned_to = u.id AND o.status = 'entregado'
     LEFT JOIN order_items i ON i.order_id = o.id
     GROUP BY u.id, u.name
     ORDER BY delivered DESC, revenue DESC
     LIMIT 8`
  );
  const maxMechRev = Math.max(1, ...mechanics.map((m) => m.revenue));

  const byStatus = await many<{ status: OrderStatus; n: number }>(
    `SELECT status, COUNT(*)::int AS n FROM orders
     WHERE status NOT IN ('entregado','cancelado') GROUP BY status`
  );
  const statusCount = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));
  const activeTotal = byStatus.reduce((s, r) => s + r.n, 0);

  const inv = (await one<{ value: number; low: number }>(
    `SELECT COALESCE(SUM(stock * cost), 0)::float8 AS value,
            COALESCE(SUM(CASE WHEN min_stock > 0 AND stock <= min_stock THEN 1 ELSE 0 END), 0)::int AS low
     FROM parts WHERE active = 1`
  ))!;

  // Dinero real: cobrado (pagos del mes, día de caja GT = UTC-6) y por cobrar.
  const collected = (await one<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM payments
      WHERE to_char(created_at::timestamp - interval '6 hours', 'YYYY-MM') = ?`,
    [nowKey]
  ))!;
  const receivable = (await one<{ total: number }>(
    `SELECT COALESCE(SUM(t.saldo), 0)::float8 AS total FROM (
       SELECT COALESCE(SUM(i.qty * i.unit_price), 0) - COALESCE(pg.paid, 0) AS saldo
         FROM orders o
         LEFT JOIN order_items i ON i.order_id = o.id
         LEFT JOIN (SELECT order_id, SUM(amount) AS paid FROM payments GROUP BY order_id) pg
           ON pg.order_id = o.id
        WHERE o.status != 'cancelado'
        GROUP BY o.id, pg.paid
     ) t WHERE t.saldo > 0.009`
  ))!;

  const kpis = [
    {
      label: "Facturado este mes",
      value: formatMoney(revNow),
      icon: Banknote,
      tone: "bg-amber-50 text-amber-700",
      hint:
        growth === null
          ? "Sin comparativa del mes anterior"
          : `${growth >= 0 ? "▲" : "▼"} ${Math.abs(growth)}% vs. mes anterior`,
    },
    {
      label: "Cobrado este mes",
      value: formatMoney(collected.total),
      icon: Wallet,
      tone: "bg-accent-50 text-accent-700",
      hint: "Pagos registrados en caja",
    },
    {
      label: "Por cobrar",
      value: formatMoney(receivable.total),
      icon: HandCoins,
      tone: receivable.total > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500",
      hint: "Saldos pendientes de órdenes activas y entregadas",
    },
    {
      label: "Ticket promedio",
      value: formatMoney(avgTicket),
      icon: TrendingUp,
      tone: "bg-primary-50 text-primary-700",
      hint: `${allTime.orders} órdenes entregadas`,
    },
    {
      label: "Órdenes activas",
      value: activeTotal,
      icon: ClipboardList,
      tone: "bg-violet-50 text-violet-700",
      hint: "En taller ahora mismo",
    },
    {
      label: "Valor de inventario",
      value: formatMoney(inv.value),
      icon: Boxes,
      tone: inv.low > 0 ? "bg-red-50 text-red-700" : "bg-accent-50 text-accent-700",
      hint: inv.low > 0 ? `${inv.low} por reponer` : "Stock saludable",
    },
  ];

  return (
    <div className="space-y-6">
      <PageTitle title="REPORTES" subtitle="Ingresos, órdenes y desempeño del taller" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className={`${card} p-4`}>
            <div className={`rounded-xl p-2 w-fit ${k.tone}`} aria-hidden="true">
              <k.icon className="w-5 h-5" />
            </div>
            <p className="text-xl lg:text-2xl font-bold text-slate-900 mt-2 tabular-nums font-heading tracking-wide">
              {k.value}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
            <p className="text-[11px] text-slate-400 mt-1">{k.hint}</p>
          </div>
        ))}
      </div>

      {/* Ingresos y ganancia por mes */}
      <section className={`${card} p-5`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
              INGRESOS Y GANANCIA POR MES
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Órdenes entregadas · últimos 6 meses</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary-600" aria-hidden="true" /> Facturado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-accent-500" aria-hidden="true" /> Ganancia
            </span>
          </div>
        </div>
        <div className="mt-5 flex items-end gap-2 sm:gap-4 h-48">
          {revSeries.map((r) => (
            <div key={r.key} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
              <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                {r.total > 0 ? formatMoney(r.total).replace(/\.00$/, "") : ""}
              </span>
              <div className="w-full max-w-[48px] flex items-end gap-1 h-full justify-center">
                <div
                  className="w-1/2 rounded-t-lg bg-primary-600 transition-all"
                  style={{ height: `${Math.max(2, (r.total / maxRev) * 100)}%` }}
                  title={`${r.orders} órdenes · facturado ${formatMoney(r.total)}`}
                />
                <div
                  className="w-1/2 rounded-t-lg bg-accent-500 transition-all"
                  style={{ height: `${Math.max(2, (Math.max(0, r.profit) / maxRev) * 100)}%` }}
                  title={`Ganancia ${formatMoney(r.profit)}`}
                />
              </div>
              <span className="text-xs text-slate-500 capitalize">{r.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          La ganancia descuenta el costo registrado en cada ítem (repuestos de inventario y
          servicios del catálogo).
          {firstCosted?.d
            ? ` Hay costos registrados desde el ${firstCosted.d.slice(0, 10)}; los ítems anteriores cuentan con costo 0 y sobreestiman la ganancia.`
            : " Aún no hay ítems con costo registrado: la ganancia mostrada equivale al facturado."}
        </p>
      </section>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* Órdenes recibidas por mes */}
        <section className={`${card} p-5 min-w-0`}>
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
            ÓRDENES RECIBIDAS
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Nuevas por mes · últimos 6 meses</p>
          <ul className="mt-4 space-y-2.5">
            {revSeries.map((r) => (
              <li key={r.key} className="flex items-center gap-3">
                <span className="w-8 text-xs text-slate-500 capitalize shrink-0">{r.label}</span>
                <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${(r.created / maxCreated) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-sm font-semibold text-slate-700 tabular-nums shrink-0">
                  {r.created}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Desempeño por mecánico */}
        <section className={`${card} p-5 min-w-0`}>
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary-600" aria-hidden="true" /> DESEMPEÑO POR MECÁNICO
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Órdenes entregadas e ingresos generados</p>
          {mechanics.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              Aún no hay órdenes entregadas con mecánico asignado.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {mechanics.map((m) => (
                <li key={m.id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-700 truncate">{m.name}</span>
                    <span className="text-slate-500 shrink-0 tabular-nums">
                      {m.delivered} órd. · {formatMoney(m.revenue)}
                      <span className="text-accent-700"> (+{formatMoney(m.profit)})</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-500"
                      style={{ width: `${(m.revenue / maxMechRev) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Órdenes activas por etapa */}
      <section className={`${card} p-5`}>
        <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
          ÓRDENES ACTIVAS POR ETAPA
        </h2>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STATUS_FLOW.filter((s) => s !== "entregado").map((s) => (
            <div
              key={s}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
            >
              <span className="text-xs font-medium text-slate-600">{STATUS_META[s].label}</span>
              <span className="text-sm font-bold text-slate-900 tabular-nums">
                {statusCount[s] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
