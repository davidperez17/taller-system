import { redirect } from "next/navigation";
import { Receipt, Plus, Info } from "lucide-react";
import { many, one } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { EXPENSE_CATEGORIES, formatMoney } from "@/lib/status";
import { createExpenseAction, deleteExpenseAction } from "@/app/admin/actions";
import { PageTitle, card, btnPrimary, inputCls, labelCls } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gastos" };

// Día actual en Guatemala (UTC-6): para el filtro de mes y el default del form.
function todayGT(): string {
  return new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") redirect("/admin");

  const { mes } = await searchParams;
  const today = todayGT();
  const month = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : today.slice(0, 7);

  const expenses = await many<{
    id: number; spent_on: string; category: string; amount: number;
    notes: string | null; author: string | null;
  }>(
    `SELECT e.*, u.name AS author FROM expenses e
       LEFT JOIN users u ON u.id = e.created_by
      WHERE substr(e.spent_on, 1, 7) = ?
      ORDER BY e.spent_on DESC, e.id DESC`,
    [month]
  );
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

  const payroll = (await one<{ total: number }>(
    "SELECT COALESCE(SUM(monthly_cost), 0)::float8 AS total FROM users WHERE active = 1"
  ))!;

  const monthLabel = new Date(`${month}-15T12:00:00Z`).toLocaleDateString("es-GT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-5">
      <PageTitle
        title="GASTOS"
        subtitle="Gastos del taller: renta, servicios, herramienta e insumos"
      />

      {/* Filtro de mes + resumen */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <form method="GET" className="flex items-end gap-2">
          <div>
            <label htmlFor="mes" className={labelCls}>
              Mes
            </label>
            <input id="mes" name="mes" type="month" defaultValue={month} className={inputCls} />
          </div>
          <button type="submit" className={`${btnPrimary} py-2.5`}>
            Ver
          </button>
        </form>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900 tabular-nums font-heading tracking-wide">
            {formatMoney(total)}
          </p>
          <p className="text-xs text-slate-500">
            {expenses.length} gasto{expenses.length === 1 ? "" : "s"} en {monthLabel}
          </p>
        </div>
      </div>

      {cats.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {cats.map(([cat, amt]) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-600"
            >
              {EXPENSE_CATEGORIES[cat] ?? cat}
              <b className="tabular-nums text-slate-900">{formatMoney(amt)}</b>
            </span>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5 items-start *:min-w-0">
        {/* Lista del mes */}
        <section className={`${card} overflow-hidden lg:col-span-2`}>
          {expenses.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">
              Sin gastos registrados en este mes. Anota renta, luz, herramienta e insumos para que
              Reportes muestre la ganancia neta real.
            </p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {expenses.map((e) => (
                <li key={e.id} className="px-4 lg:px-5 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-700">
                        {EXPENSE_CATEGORIES[e.category] ?? e.category}
                      </span>
                      {e.notes && (
                        <span className="text-sm text-slate-500 truncate">· {e.notes}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {e.spent_on}
                      {e.author ? ` · ${e.author}` : ""}
                    </p>
                  </div>
                  <span className="font-semibold text-slate-900 tabular-nums shrink-0">
                    {formatMoney(e.amount)}
                  </span>
                  <form action={deleteExpenseAction} className="shrink-0">
                    <input type="hidden" name="id" value={e.id} />
                    <button
                      type="submit"
                      className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      Quitar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Nuevo gasto */}
        <section className={`${card} p-5`}>
          <h2 className="font-heading font-semibold text-slate-800 tracking-wide flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary-600" aria-hidden="true" /> NUEVO GASTO
          </h2>
          <form action={createExpenseAction} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="spent_on" className={labelCls}>
                  Fecha *
                </label>
                <input
                  id="spent_on"
                  name="spent_on"
                  type="date"
                  required
                  defaultValue={today}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="amount" className={labelCls}>
                  Monto (Q) *
                </label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  inputMode="decimal"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label htmlFor="category" className={labelCls}>
                Categoría
              </label>
              <select id="category" name="category" className={inputCls}>
                {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="notes" className={labelCls}>
                Nota (opcional)
              </label>
              <input
                id="notes"
                name="notes"
                placeholder="Ej. Recibo de luz de junio"
                className={inputCls}
              />
            </div>
            <button type="submit" className={`${btnPrimary} w-full`}>
              <Receipt className="w-4 h-4" aria-hidden="true" /> Registrar gasto
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-400 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            Los salarios del equipo no van aquí: regístralos como costo mensual en Equipo
            {payroll.total > 0
              ? ` (planilla actual: ${formatMoney(payroll.total)}/mes).`
              : " — aún no hay costos registrados."}{" "}
            Los repuestos ya descuentan su costo en cada orden.
          </p>
        </section>
      </div>
    </div>
  );
}
