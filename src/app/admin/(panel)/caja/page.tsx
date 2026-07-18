import Link from "next/link";
import { Banknote, CreditCard, Landmark, Wallet } from "lucide-react";
import { many, one } from "@/lib/db";
import { formatMoney, formatDate, STATUS_META, type OrderStatus } from "@/lib/status";
import { ORDER_TOTALS_SQL } from "@/lib/totals";
import { PageTitle, card, inputCls, labelCls, btnSecondary, PlateBadge } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Caja" };

// Guatemala es UTC-6 sin horario de verano: el "día de caja" se calcula
// restando 6 horas a los timestamps UTC guardados como TEXT.
const DAY_GT = "to_char(p.created_at::timestamp - interval '6 hours', 'YYYY-MM-DD')";

function todayGT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const METHOD_META = {
  efectivo: { label: "Efectivo", icon: Banknote, tone: "bg-accent-50 text-accent-700" },
  tarjeta: { label: "Tarjeta", icon: CreditCard, tone: "bg-sm-bg text-sm-red" },
  transferencia: { label: "Transferencia", icon: Landmark, tone: "bg-violet-50 text-violet-700" },
} as const;

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const { dia } = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dia ?? "") ? dia! : todayGT();
  const monthKey = day.slice(0, 7);

  const dayPayments = await many<{
    id: number; amount: number; method: keyof typeof METHOD_META; reference: string | null;
    created_at: string; author: string | null; folio: string; plate: string; order_id: number;
  }>(
    `SELECT p.id, p.amount, p.method, p.reference, p.created_at, u.name AS author,
            o.folio, o.id AS order_id, v.plate
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       JOIN vehicles v ON v.id = o.vehicle_id
       LEFT JOIN users u ON u.id = p.created_by
      WHERE ${DAY_GT} = ?
      ORDER BY p.created_at DESC, p.id DESC`,
    [day]
  );
  const dayTotal = dayPayments.reduce((s, p) => s + p.amount, 0);
  const byMethod = Object.fromEntries(
    (Object.keys(METHOD_META) as (keyof typeof METHOD_META)[]).map((m) => [
      m,
      dayPayments.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0),
    ])
  );

  const monthRow = await one<{ total: number; n: number }>(
    `SELECT COALESCE(SUM(p.amount), 0)::float8 AS total, COUNT(*)::int AS n
       FROM payments p
      WHERE substr(${DAY_GT}, 1, 7) = ?`,
    [monthKey]
  );

  // Órdenes con saldo pendiente (presupuesto > pagado), sin las canceladas.
  const pending = await many<{
    id: number; folio: string; status: OrderStatus; plate: string; client_name: string;
    total: number; paid: number;
  }>(
    `SELECT o.id, o.folio, o.status, v.plate, c.name AS client_name,
            COALESCE(i.total, 0)::float8 AS total, COALESCE(pg.paid, 0)::float8 AS paid
       FROM orders o
       JOIN vehicles v ON v.id = o.vehicle_id
       JOIN clients c ON c.id = v.client_id
       LEFT JOIN ${ORDER_TOTALS_SQL} i ON i.order_id = o.id
       LEFT JOIN (SELECT order_id, SUM(amount) AS paid FROM payments GROUP BY order_id) pg
         ON pg.order_id = o.id
      WHERE o.status != 'cancelado' AND COALESCE(i.total, 0) - COALESCE(pg.paid, 0) > 0.009
      ORDER BY o.created_at DESC
      LIMIT 50`
  );
  const pendingTotal = pending.reduce((s, o) => s + (o.total - o.paid), 0);

  return (
    <div className="space-y-6">
      <PageTitle
        title="CAJA"
        subtitle="Cobros del día, corte por método y saldos por cobrar"
        action={
          <form className="flex items-end gap-2">
            <div>
              <label htmlFor="dia" className={labelCls}>
                Día de corte
              </label>
              <input id="dia" type="date" name="dia" defaultValue={day} className={inputCls} />
            </div>
            <button type="submit" className={btnSecondary}>
              Ver
            </button>
          </form>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className={`${card} p-4 col-span-2 lg:col-span-1`}>
          <div className="rounded-xl p-2 w-fit bg-slate-100 text-slate-700" aria-hidden="true">
            <Wallet className="w-5 h-5" />
          </div>
          <p className="text-xl lg:text-2xl font-bold text-slate-900 mt-2 tabular-nums font-heading tracking-wide">
            {formatMoney(dayTotal)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Cobrado el {day}</p>
          <p className="text-[11px] text-slate-400 mt-1">{dayPayments.length} pagos</p>
        </div>
        {(Object.keys(METHOD_META) as (keyof typeof METHOD_META)[]).map((m) => {
          const meta = METHOD_META[m];
          return (
            <div key={m} className={`${card} p-4`}>
              <div className={`rounded-xl p-2 w-fit ${meta.tone}`} aria-hidden="true">
                <meta.icon className="w-5 h-5" />
              </div>
              <p className="text-xl font-bold text-slate-900 mt-2 tabular-nums font-heading tracking-wide">
                {formatMoney(byMethod[m])}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{meta.label}</p>
            </div>
          );
        })}
        <div className={`${card} p-4`}>
          <div className="rounded-xl p-2 w-fit bg-amber-50 text-amber-700" aria-hidden="true">
            <Banknote className="w-5 h-5" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2 tabular-nums font-heading tracking-wide">
            {formatMoney(monthRow?.total ?? 0)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Cobrado en el mes</p>
          <p className="text-[11px] text-slate-400 mt-1">{monthRow?.n ?? 0} pagos</p>
        </div>
      </div>

      {/* Pagos del día */}
      <section className={`${card} overflow-hidden`}>
        <div className="px-5 pt-5">
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
            PAGOS DEL DÍA
          </h2>
        </div>
        {dayPayments.length === 0 ? (
          <p className="px-5 pb-5 pt-3 text-sm text-slate-400">Sin pagos registrados este día.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="py-2 pl-5 pr-2 font-semibold">Hora</th>
                  <th className="py-2 px-2 font-semibold">Orden</th>
                  <th className="py-2 px-2 font-semibold">Placa</th>
                  <th className="py-2 px-2 font-semibold">Método</th>
                  <th className="py-2 px-2 font-semibold">Registró</th>
                  <th className="py-2 pl-2 pr-5 font-semibold text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dayPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 pl-5 pr-2 text-slate-500 tabular-nums">
                      {formatDate(p.created_at).split(",").pop()}
                    </td>
                    <td className="py-2.5 px-2">
                      <Link
                        href={`/admin/ordenes/${p.order_id}`}
                        className="font-medium text-sm-red hover:underline"
                      >
                        {p.folio}
                      </Link>
                    </td>
                    <td className="py-2.5 px-2 text-slate-600">{p.plate}</td>
                    <td className="py-2.5 px-2 text-slate-500 capitalize">
                      {p.method}
                      {p.reference && (
                        <span className="ml-1 text-xs text-slate-400">({p.reference})</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-slate-500">{p.author ?? "—"}</td>
                    <td className="py-2.5 pl-2 pr-5 text-right font-semibold text-slate-800 tabular-nums">
                      {formatMoney(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Saldos pendientes */}
      <section className={`${card} overflow-hidden`}>
        <div className="px-5 pt-5 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
            POR COBRAR
          </h2>
          <span className="text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 tabular-nums">
            {formatMoney(pendingTotal)}
          </span>
        </div>
        {pending.length === 0 ? (
          <p className="px-5 pb-5 pt-3 text-sm text-slate-400">
            No hay órdenes con saldo pendiente.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="py-2 pl-5 pr-2 font-semibold">Orden</th>
                  <th className="py-2 px-2 font-semibold">Placa</th>
                  <th className="py-2 px-2 font-semibold">Cliente</th>
                  <th className="py-2 px-2 font-semibold">Etapa</th>
                  <th className="py-2 px-2 font-semibold text-right">Total</th>
                  <th className="py-2 px-2 font-semibold text-right">Pagado</th>
                  <th className="py-2 pl-2 pr-5 font-semibold text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pending.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2.5 pl-5 pr-2">
                      <Link
                        href={`/admin/ordenes/${o.id}`}
                        className="font-medium text-sm-red hover:underline"
                      >
                        {o.folio}
                      </Link>
                    </td>
                    <td className="py-2.5 px-2">
                      <PlateBadge plate={o.plate} />
                    </td>
                    <td className="py-2.5 px-2 text-slate-600 max-w-[12rem] truncate">
                      {o.client_name}
                    </td>
                    <td className="py-2.5 px-2 text-slate-500">
                      {STATUS_META[o.status]?.label ?? o.status}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-slate-500">
                      {formatMoney(o.total)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-slate-500">
                      {formatMoney(o.paid)}
                    </td>
                    <td className="py-2.5 pl-2 pr-5 text-right font-semibold text-amber-700 tabular-nums">
                      {formatMoney(o.total - o.paid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
