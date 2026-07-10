import Link from "next/link";
import {
  Banknote, ClipboardList, TrendingUp, Wrench, Boxes, Wallet, HandCoins, Receipt, Users2, Scale,
} from "lucide-react";
import { many, one } from "@/lib/db";
import { formatMoney, STATUS_META, STATUS_FLOW, type OrderStatus } from "@/lib/status";
import { PageTitle, card } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reportes" };

const MONTH_LABELS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

// Fechas en día de Guatemala (UTC-6), como hace caja.
function gtNow(): Date {
  return new Date(Date.now() - 6 * 3600_000);
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Meses 'YYYY-MM' entre dos fechas (se quedan los últimos 12 para la gráfica).
function monthsBetween(desde: string, hasta: string): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  let y = Number(desde.slice(0, 4));
  let m = Number(desde.slice(5, 7)) - 1;
  const endKey = hasta.slice(0, 7);
  for (let i = 0; i < 36; i++) {
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    out.push({ key, label: MONTH_LABELS[m] });
    if (key === endKey) break;
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out.slice(-12);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string; desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const now = gtNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const today = iso(now);

  const PRESETS: Record<string, { label: string; desde: string; hasta: string }> = {
    mes: { label: "Este mes", desde: iso(new Date(Date.UTC(y, m, 1))), hasta: today },
    prev: {
      label: "Mes anterior",
      desde: iso(new Date(Date.UTC(y, m - 1, 1))),
      hasta: iso(new Date(Date.UTC(y, m, 0))),
    },
    "3m": { label: "3 meses", desde: iso(new Date(Date.UTC(y, m - 2, 1))), hasta: today },
    "6m": { label: "6 meses", desde: iso(new Date(Date.UTC(y, m - 5, 1))), hasta: today },
    ano: { label: "Este año", desde: iso(new Date(Date.UTC(y, 0, 1))), hasta: today },
  };

  const okDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const custom = okDate(sp.desde) && okDate(sp.hasta) && sp.desde! <= sp.hasta!;
  const presetKey = custom ? null : sp.r && PRESETS[sp.r] ? sp.r : "6m";
  const desde = custom ? sp.desde! : PRESETS[presetKey!].desde;
  const hasta = custom ? sp.hasta! : PRESETS[presetKey!].hasta;

  const months = monthsBetween(desde, hasta);
  const rangeDays = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400_000) + 1;
  const payrollFactor = rangeDays / 30.44; // prorrateo aproximado por días

  // Facturado y ganancia por mes y por tipo (servicio/repuesto), órdenes entregadas.
  const kindRows = await many<{ ym: string; kind: string; total: number; profit: number }>(
    `SELECT substr(o.delivered_at, 1, 7) AS ym, i.kind,
            COALESCE(SUM(i.qty * i.unit_price), 0)::float8 AS total,
            COALESCE(SUM(i.qty * (i.unit_price - i.unit_cost)), 0)::float8 AS profit
       FROM orders o JOIN order_items i ON i.order_id = o.id
      WHERE o.status = 'entregado' AND substr(o.delivered_at, 1, 10) BETWEEN ? AND ?
      GROUP BY ym, i.kind`,
    [desde, hasta]
  );
  const deliveredRows = await many<{ ym: string; n: number }>(
    `SELECT substr(delivered_at, 1, 7) AS ym, COUNT(*)::int AS n
       FROM orders
      WHERE status = 'entregado' AND substr(delivered_at, 1, 10) BETWEEN ? AND ?
      GROUP BY ym`,
    [desde, hasta]
  );
  const createdRows = await many<{ ym: string; n: number }>(
    `SELECT substr(created_at, 1, 7) AS ym, COUNT(*)::int AS n
       FROM orders WHERE substr(created_at, 1, 10) BETWEEN ? AND ?
      GROUP BY ym`,
    [desde, hasta]
  );

  const collected = (await one<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM payments
      WHERE to_char(created_at::timestamp - interval '6 hours', 'YYYY-MM-DD') BETWEEN ? AND ?`,
    [desde, hasta]
  ))!;

  const expenseRows = await many<{ category: string; total: number; n: number }>(
    `SELECT category, COALESCE(SUM(amount), 0)::float8 AS total, COUNT(*)::int AS n
       FROM expenses WHERE spent_on BETWEEN ? AND ? GROUP BY category`,
    [desde, hasta]
  );
  const expensesTotal = expenseRows.reduce((s, r) => s + r.total, 0);
  const expensesCount = expenseRows.reduce((s, r) => s + r.n, 0);

  const payrollMonthly = (await one<{ total: number }>(
    "SELECT COALESCE(SUM(monthly_cost), 0)::float8 AS total FROM users WHERE active = 1"
  ))!.total;
  const payrollRange = payrollMonthly * payrollFactor;

  // Desempeño por mecánico en el rango: ingresos/ganancia + tiempo de entrega.
  const mechMoney = await many<{
    id: number; name: string; monthly_cost: number; revenue: number; profit: number;
  }>(
    `SELECT u.id, u.name, u.monthly_cost,
            COALESCE(SUM(i.qty * i.unit_price), 0)::float8 AS revenue,
            COALESCE(SUM(i.qty * (i.unit_price - i.unit_cost)), 0)::float8 AS profit
       FROM users u
       JOIN orders o ON o.assigned_to = u.id AND o.status = 'entregado'
        AND substr(o.delivered_at, 1, 10) BETWEEN ? AND ?
       LEFT JOIN order_items i ON i.order_id = o.id
      GROUP BY u.id, u.name, u.monthly_cost
      ORDER BY revenue DESC
      LIMIT 8`,
    [desde, hasta]
  );
  const mechTime = await many<{ id: number; delivered: number; avg_days: number }>(
    `SELECT assigned_to AS id, COUNT(*)::int AS delivered,
            COALESCE(AVG(EXTRACT(EPOCH FROM (delivered_at::timestamp - created_at::timestamp)) / 86400.0), 0)::float8 AS avg_days
       FROM orders
      WHERE status = 'entregado' AND assigned_to IS NOT NULL
        AND substr(delivered_at, 1, 10) BETWEEN ? AND ?
      GROUP BY assigned_to`,
    [desde, hasta]
  );
  const timeById = new Map(mechTime.map((t) => [t.id, t]));
  const mechanics = mechMoney.map((mm) => {
    const t = timeById.get(mm.id);
    const cost = mm.monthly_cost * payrollFactor;
    return {
      ...mm,
      delivered: t?.delivered ?? 0,
      avgDays: t?.avg_days ?? 0,
      cost,
      net: mm.profit - cost,
    };
  });
  const maxMechRev = Math.max(1, ...mechanics.map((mm) => mm.revenue));

  const firstCosted = await one<{ d: string | null }>(
    "SELECT MIN(created_at) AS d FROM order_items WHERE unit_cost > 0"
  );

  // Estado actual (independiente del rango).
  const byStatus = await many<{ status: OrderStatus; n: number }>(
    `SELECT status, COUNT(*)::int AS n FROM orders
      WHERE status NOT IN ('entregado','cancelado') GROUP BY status`
  );
  const statusCount = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));
  const activeTotal = byStatus.reduce((s, r) => s + r.n, 0);
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
  const inv = (await one<{ value: number; low: number }>(
    `SELECT COALESCE(SUM(stock * cost), 0)::float8 AS value,
            COALESCE(SUM(CASE WHEN min_stock > 0 AND stock <= min_stock THEN 1 ELSE 0 END), 0)::int AS low
       FROM parts WHERE active = 1`
  ))!;

  // Agregados del rango.
  const byKind = { servicio: { total: 0, profit: 0 }, repuesto: { total: 0, profit: 0 } };
  const revByMonth = new Map<string, { total: number; profit: number }>();
  for (const r of kindRows) {
    const k = r.kind === "repuesto" ? "repuesto" : "servicio";
    byKind[k].total += r.total;
    byKind[k].profit += r.profit;
    const acc = revByMonth.get(r.ym) ?? { total: 0, profit: 0 };
    acc.total += r.total;
    acc.profit += r.profit;
    revByMonth.set(r.ym, acc);
  }
  const facturado = byKind.servicio.total + byKind.repuesto.total;
  const gross = byKind.servicio.profit + byKind.repuesto.profit;
  const itemsCost = facturado - gross;
  const net = gross - expensesTotal - payrollRange;
  const deliveredTotal = deliveredRows.reduce((s, r) => s + r.n, 0);
  const avgTicket = deliveredTotal > 0 ? facturado / deliveredTotal : 0;

  const deliveredByMonth = new Map(deliveredRows.map((r) => [r.ym, r.n]));
  const createdByMonth = new Map(createdRows.map((r) => [r.ym, r.n]));
  const revSeries = months.map((mo) => ({
    ...mo,
    total: revByMonth.get(mo.key)?.total ?? 0,
    profit: revByMonth.get(mo.key)?.profit ?? 0,
    orders: deliveredByMonth.get(mo.key) ?? 0,
    created: createdByMonth.get(mo.key) ?? 0,
  }));
  const maxRev = Math.max(1, ...revSeries.map((r) => r.total));
  const maxCreated = Math.max(1, ...revSeries.map((r) => r.created));

  const fmtDay = (s: string) =>
    new Date(`${s}T12:00:00Z`).toLocaleDateString("es-GT", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

  const kpis = [
    {
      label: "Facturado",
      value: formatMoney(facturado),
      icon: Banknote,
      tone: "bg-primary-50 text-primary-700",
      hint: `${deliveredTotal} órdenes entregadas · ticket ${formatMoney(avgTicket)}`,
    },
    {
      label: "Cobrado",
      value: formatMoney(collected.total),
      icon: Wallet,
      tone: "bg-accent-50 text-accent-700",
      hint: "Pagos registrados en caja en el período",
    },
    {
      label: "Margen bruto",
      value: formatMoney(gross),
      icon: TrendingUp,
      tone: "bg-violet-50 text-violet-700",
      hint: `Facturado menos ${formatMoney(itemsCost)} de costos de ítems`,
    },
    {
      label: "Gastos",
      value: formatMoney(expensesTotal),
      icon: Receipt,
      tone: "bg-amber-50 text-amber-700",
      hint:
        expensesCount > 0
          ? `${expensesCount} gastos registrados`
          : "Sin gastos registrados en el período",
    },
    {
      label: "Planilla estimada",
      value: formatMoney(payrollRange),
      icon: Users2,
      tone: "bg-slate-100 text-slate-600",
      hint:
        payrollMonthly > 0
          ? `${formatMoney(payrollMonthly)}/mes prorrateado a ${rangeDays} días`
          : "Registra costos del equipo en Equipo",
    },
    {
      label: "Ganancia neta",
      value: formatMoney(net),
      icon: Scale,
      tone: net >= 0 ? "bg-accent-50 text-accent-700" : "bg-red-50 text-red-700",
      hint: "Margen bruto − gastos − planilla",
      highlight: true,
    },
  ];

  const chip = (active: boolean) =>
    `inline-flex items-center rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
      active
        ? "bg-primary-600 text-white"
        : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"
    }`;

  const breakdown = [
    { label: "Facturado (órdenes entregadas)", value: facturado, sign: "" },
    { label: "Costo de repuestos y servicios", value: -itemsCost, sign: "−" },
    { label: "Margen bruto", value: gross, sign: "=", strong: true },
    { label: "Gastos del taller", value: -expensesTotal, sign: "−" },
    { label: "Planilla estimada del período", value: -payrollRange, sign: "−" },
    { label: "Ganancia neta", value: net, sign: "=", strong: true, final: true },
  ];

  return (
    <div className="space-y-6">
      <PageTitle title="REPORTES" subtitle="Ventas, gastos y ganancia del taller" />

      {/* Filtro de período */}
      <section className={`${card} p-4`}>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PRESETS).map(([k, p]) => (
            <Link key={k} href={`/admin/reportes?r=${k}`} className={chip(presetKey === k)}>
              {p.label}
            </Link>
          ))}
          {custom && <span className={chip(true)}>Personalizado</span>}
        </div>
        <form method="GET" className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="desde" className="block text-xs font-medium text-slate-500 mb-1">
              Desde
            </label>
            <input
              id="desde"
              name="desde"
              type="date"
              defaultValue={desde}
              max={today}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="hasta" className="block text-xs font-medium text-slate-500 mb-1">
              Hasta
            </label>
            <input
              id="hasta"
              name="hasta"
              type="date"
              defaultValue={hasta}
              max={today}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl px-4 py-2 text-sm font-semibold transition-colors cursor-pointer"
          >
            Aplicar
          </button>
          <p className="text-xs text-slate-400 ml-auto">
            Mostrando: <b>{fmtDay(desde)}</b> — <b>{fmtDay(hasta)}</b>
          </p>
        </form>
      </section>

      {/* KPIs del período */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 *:min-w-0">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`${card} p-4 ${k.highlight ? "ring-2 ring-accent-500/50" : ""}`}
          >
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

      <div className="grid lg:grid-cols-2 gap-5 items-start *:min-w-0">
        {/* Del facturado a la ganancia */}
        <section className={`${card} p-5`}>
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
            DEL FACTURADO A LA GANANCIA
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Cómo se compone el resultado del período</p>
          <ul className="mt-4">
            {breakdown.map((b) => (
              <li
                key={b.label}
                className={`flex items-center justify-between gap-3 py-2 text-sm ${
                  b.final
                    ? "border-t-2 border-slate-300 mt-1 pt-3"
                    : b.strong
                      ? "border-t border-slate-200"
                      : ""
                }`}
              >
                <span
                  className={
                    b.strong ? "font-semibold text-slate-800" : "text-slate-500"
                  }
                >
                  {b.sign && <span className="inline-block w-4 text-slate-400">{b.sign}</span>}
                  {b.label}
                </span>
                <span
                  className={`tabular-nums ${
                    b.final
                      ? `font-bold text-base ${b.value >= 0 ? "text-accent-700" : "text-red-600"}`
                      : b.strong
                        ? "font-semibold text-slate-800"
                        : "text-slate-600"
                  }`}
                >
                  {b.final ? formatMoney(b.value) : formatMoney(Math.abs(b.value))}
                </span>
              </li>
            ))}
          </ul>
          {(expensesTotal === 0 || payrollMonthly === 0) && (
            <p className="mt-3 text-[11px] text-slate-400">
              {expensesTotal === 0 && (
                <>
                  Aún no hay gastos en el período —{" "}
                  <Link href="/admin/gastos" className="text-primary-600 font-medium">
                    regístralos en Gastos
                  </Link>
                  .{" "}
                </>
              )}
              {payrollMonthly === 0 && (
                <>
                  Sin costos del equipo —{" "}
                  <Link href="/admin/usuarios" className="text-primary-600 font-medium">
                    agrégalos en Equipo
                  </Link>
                  .
                </>
              )}
            </p>
          )}
        </section>

        {/* Ventas por tipo */}
        <section className={`${card} p-5`}>
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
            VENTAS POR TIPO
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Servicios (mano de obra) vs. repuestos vendidos
          </p>
          {facturado === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Sin ventas en el período.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {(
                [
                  ["Servicios", byKind.servicio, "bg-primary-600"],
                  ["Repuestos", byKind.repuesto, "bg-violet-500"],
                ] as const
              ).map(([label, k, color]) => (
                <li key={label}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-700">
                      {label}
                      <span className="ml-2 text-xs text-slate-400">
                        {facturado > 0 ? Math.round((k.total / facturado) * 100) : 0}%
                      </span>
                    </span>
                    <span className="text-slate-500 tabular-nums">
                      {formatMoney(k.total)}
                      <span className="text-accent-700"> (+{formatMoney(k.profit)})</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: `${(k.total / facturado) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[11px] text-slate-400">
            Entre paréntesis: ganancia después del costo registrado de cada ítem.
          </p>
        </section>
      </div>

      {/* Ingresos y ganancia por mes */}
      <section className={`${card} p-5`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
              INGRESOS Y GANANCIA POR MES
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Órdenes entregadas en el período</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary-600" aria-hidden="true" /> Facturado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-accent-500" aria-hidden="true" /> Ganancia bruta
            </span>
          </div>
        </div>
        <div className="mt-5 flex items-end gap-2 sm:gap-4 h-48">
          {revSeries.map((r) => (
            <div key={r.key} className="flex-1 flex flex-col items-center justify-end gap-2 h-full min-w-0">
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
          La ganancia bruta descuenta el costo registrado en cada ítem.
          {firstCosted?.d
            ? ` Hay costos registrados desde el ${firstCosted.d.slice(0, 10)}; los ítems anteriores cuentan con costo 0 y sobreestiman la ganancia.`
            : " Aún no hay ítems con costo registrado: la ganancia mostrada equivale al facturado."}
        </p>
      </section>

      <div className="grid lg:grid-cols-2 gap-5 items-start *:min-w-0">
        {/* Órdenes recibidas */}
        <section className={`${card} p-5`}>
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
            ÓRDENES RECIBIDAS
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Nuevas por mes en el período</p>
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
        <section className={`${card} p-5`}>
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary-600" aria-hidden="true" /> DESEMPEÑO POR MECÁNICO
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Órdenes entregadas en el período, con costo y utilidad si su salario está registrado
          </p>
          {mechanics.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No hay órdenes entregadas con mecánico asignado en este período.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {mechanics.map((mm) => (
                <li key={mm.id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-700 truncate">{mm.name}</span>
                    <span className="text-slate-500 shrink-0 tabular-nums text-xs">
                      {mm.delivered} órd. · {mm.avgDays.toFixed(1)} días prom.
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-500"
                      style={{ width: `${(mm.revenue / maxMechRev) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500 tabular-nums">
                    Facturó {formatMoney(mm.revenue)} · ganancia bruta{" "}
                    <span className="text-accent-700">{formatMoney(mm.profit)}</span>
                    {mm.monthly_cost > 0 ? (
                      <>
                        {" "}
                        · costo {formatMoney(mm.cost)} · utilidad{" "}
                        <b className={mm.net >= 0 ? "text-accent-700" : "text-red-600"}>
                          {formatMoney(mm.net)}
                        </b>
                      </>
                    ) : (
                      <span className="text-slate-400"> · sin costo registrado</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Estado actual del taller (no depende del período) */}
      <section className={`${card} p-5`}>
        <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
          ESTADO ACTUAL DEL TALLER
        </h2>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 *:min-w-0">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <HandCoins className="w-3.5 h-3.5" aria-hidden="true" /> Por cobrar
            </p>
            <p className="text-lg font-bold text-slate-900 tabular-nums font-heading">
              {formatMoney(receivable.total)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" /> Órdenes activas
            </p>
            <p className="text-lg font-bold text-slate-900 tabular-nums font-heading">
              {activeTotal}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5" aria-hidden="true" /> Inventario
            </p>
            <p className="text-lg font-bold text-slate-900 tabular-nums font-heading">
              {formatMoney(inv.value)}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 *:min-w-0">
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
