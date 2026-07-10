import { Search, PackagePlus, AlertTriangle, Boxes, Package } from "lucide-react";
import { many, one } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  createPartAction,
  updatePartAction,
  adjustStockAction,
  deletePartAction,
} from "@/app/admin/actions";
import { formatMoney, PART_CATEGORIES } from "@/lib/status";
import {
  PageTitle,
  card,
  btnPrimary,
  btnSecondary,
  inputCls,
  labelCls,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inventario" };

type Part = {
  id: number;
  sku: string | null;
  name: string;
  category: string | null;
  stock: number;
  min_stock: number;
  unit_price: number;
  cost: number;
  location: string | null;
  notes: string | null;
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const { q = "", filtro = "" } = await searchParams;
  const me = await getSessionUser();
  const like = `%${q.trim()}%`;

  const onlyLow = filtro === "bajos";
  const parts = await many<Part>(
    `SELECT id, sku, name, category, stock, min_stock, unit_price, cost, location, notes
     FROM parts
     WHERE active = 1
       AND (name ILIKE ? OR sku ILIKE ? OR category ILIKE ? OR location ILIKE ?)
       ${onlyLow ? "AND min_stock > 0 AND stock <= min_stock" : ""}
     ORDER BY (min_stock > 0 AND stock <= min_stock) DESC, name
     LIMIT 500`,
    [like, like, like, like]
  );

  const totals = (await one<{ n: number; value: number; low: number }>(
    `SELECT COUNT(*)::int AS n,
            COALESCE(SUM(stock * cost), 0)::float8 AS value,
            COALESCE(SUM(CASE WHEN min_stock > 0 AND stock <= min_stock THEN 1 ELSE 0 END), 0)::int AS low
     FROM parts WHERE active = 1`
  ))!;

  const kpis = [
    { label: "Repuestos", value: totals.n, icon: Package, tone: "bg-primary-50 text-primary-700" },
    {
      label: "Valor en bodega",
      value: formatMoney(totals.value),
      icon: Boxes,
      tone: "bg-accent-50 text-accent-700",
    },
    {
      label: "Stock bajo",
      value: totals.low,
      icon: AlertTriangle,
      tone: totals.low > 0 ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-500",
    },
  ];

  return (
    <div className="space-y-5">
      <PageTitle title="INVENTARIO" subtitle="Control de repuestos y stock" />

      <div className="grid grid-cols-3 gap-3">
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

      {totals.low > 0 && !onlyLow && (
        <a
          href="/admin/inventario?filtro=bajos"
          className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 hover:bg-red-100 transition-colors"
        >
          <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>
            <b>{totals.low}</b> repuesto{totals.low === 1 ? "" : "s"} por agotarse. Toca para ver
            solo los que necesitan reposición.
          </span>
        </a>
      )}

      <div className="grid lg:grid-cols-3 gap-5 items-start *:min-w-0">
        {/* Lista + búsqueda */}
        <div className="lg:col-span-2 min-w-0 space-y-4">
          <form className="flex gap-2" action="/admin/inventario" method="GET">
            {onlyLow && <input type="hidden" name="filtro" value="bajos" />}
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nombre, código, categoría o ubicación…"
                aria-label="Buscar repuestos"
                className={`${inputCls} pl-10`}
              />
            </div>
            <button type="submit" className={btnPrimary}>
              Buscar
            </button>
          </form>

          {onlyLow && (
            <a href="/admin/inventario" className="inline-block text-sm text-primary-600 hover:text-primary-500">
              ← Ver todo el inventario
            </a>
          )}

          <section className={`${card} overflow-hidden`}>
            {parts.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">
                {onlyLow
                  ? "Ningún repuesto por agotarse. Todo en orden."
                  : "Sin repuestos. Agrega el primero con el formulario."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {parts.map((p) => {
                  const low = p.min_stock > 0 && p.stock <= p.min_stock;
                  return (
                    <li key={p.id} className={low ? "bg-red-50/50" : ""}>
                      <div className="flex items-center gap-3 px-4 lg:px-5 py-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-800">{p.name}</span>
                            {p.category && (
                              <span className="text-[11px] font-semibold bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                                {p.category}
                              </span>
                            )}
                            {low && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                                <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Reponer
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            {[
                              p.sku && `Cód. ${p.sku}`,
                              p.location,
                              `Precio ${formatMoney(p.unit_price)}`,
                              p.unit_price > 0 && p.cost > 0 &&
                                `Margen ${Math.round(((p.unit_price - p.cost) / p.unit_price) * 100)}%`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className={`text-lg font-bold tabular-nums font-heading ${
                              low ? "text-red-600" : "text-slate-900"
                            }`}
                          >
                            {p.stock}
                          </p>
                          <p className="text-[11px] text-slate-400">mín. {p.min_stock}</p>
                        </div>
                      </div>

                      <div className="px-4 lg:px-5 pb-3 flex flex-wrap gap-4">
                        {/* Ajustar stock */}
                        <details className="text-sm">
                          <summary className="text-xs font-medium text-primary-600 cursor-pointer">
                            Ajustar stock
                          </summary>
                          <form action={adjustStockAction} className="mt-2 flex items-end gap-2 flex-wrap">
                            <input type="hidden" name="id" value={p.id} />
                            <div>
                              <label htmlFor={`mode-${p.id}`} className="sr-only">
                                Tipo de ajuste
                              </label>
                              <select id={`mode-${p.id}`} name="mode" className={inputCls}>
                                <option value="in">Entrada (+)</option>
                                <option value="out">Salida (−)</option>
                                <option value="set">Fijar cantidad</option>
                              </select>
                            </div>
                            <div className="w-28">
                              <label htmlFor={`amt-${p.id}`} className="sr-only">
                                Cantidad
                              </label>
                              <input
                                id={`amt-${p.id}`}
                                name="amount"
                                type="number"
                                step="any"
                                min="0"
                                defaultValue={1}
                                className={inputCls}
                              />
                            </div>
                            <button type="submit" className={btnPrimary}>
                              Aplicar
                            </button>
                          </form>
                        </details>

                        {/* Editar */}
                        <details className="text-sm">
                          <summary className="text-xs font-medium text-primary-600 cursor-pointer">
                            Editar
                          </summary>
                          <form action={updatePartAction} className="mt-2 grid sm:grid-cols-2 gap-2 max-w-xl">
                            <input type="hidden" name="id" value={p.id} />
                            <input name="name" defaultValue={p.name} required placeholder="Nombre" className={inputCls} />
                            <input name="sku" defaultValue={p.sku ?? ""} placeholder="Código / SKU" className={inputCls} />
                            <select name="category" defaultValue={p.category ?? ""} className={inputCls}>
                              <option value="">Sin categoría</option>
                              {PART_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            <input name="location" defaultValue={p.location ?? ""} placeholder="Ubicación" className={inputCls} />
                            <input name="min_stock" type="number" step="any" min="0" defaultValue={p.min_stock} placeholder="Stock mínimo" className={inputCls} />
                            <input name="unit_price" type="number" step="any" min="0" defaultValue={p.unit_price} placeholder="Precio venta" className={inputCls} />
                            <input name="cost" type="number" step="any" min="0" defaultValue={p.cost} placeholder="Costo" className={inputCls} />
                            <div className="sm:col-span-2 flex gap-2">
                              <button type="submit" className={btnPrimary}>
                                Guardar
                              </button>
                              {me?.role === "admin" && (
                                <button
                                  formAction={deletePartAction}
                                  className={btnSecondary}
                                  aria-label={`Eliminar ${p.name}`}
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </form>
                        </details>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Nuevo repuesto */}
        <section className={`${card} p-5 min-w-0`}>
          <h2 className="font-heading font-semibold text-slate-800 tracking-wide flex items-center gap-2">
            <PackagePlus className="w-4 h-4 text-primary-600" aria-hidden="true" /> NUEVO REPUESTO
          </h2>
          <form action={createPartAction} className="mt-3 space-y-3">
            <div>
              <label htmlFor="p-name" className={labelCls}>
                Nombre *
              </label>
              <input id="p-name" name="name" required className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="p-sku" className={labelCls}>
                  Código / SKU
                </label>
                <input id="p-sku" name="sku" className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-cat" className={labelCls}>
                  Categoría
                </label>
                <select id="p-cat" name="category" className={inputCls}>
                  <option value="">Sin categoría</option>
                  {PART_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="p-stock" className={labelCls}>
                  Stock actual
                </label>
                <input id="p-stock" name="stock" type="number" step="any" min="0" defaultValue={0} className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-min" className={labelCls}>
                  Stock mínimo
                </label>
                <input id="p-min" name="min_stock" type="number" step="any" min="0" defaultValue={0} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="p-price" className={labelCls}>
                  Precio venta
                </label>
                <input id="p-price" name="unit_price" type="number" step="any" min="0" defaultValue={0} className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-cost" className={labelCls}>
                  Costo
                </label>
                <input id="p-cost" name="cost" type="number" step="any" min="0" defaultValue={0} className={inputCls} />
              </div>
            </div>
            <div>
              <label htmlFor="p-loc" className={labelCls}>
                Ubicación en bodega
              </label>
              <input id="p-loc" name="location" placeholder="Ej. Estante A-3" className={inputCls} />
            </div>
            <button type="submit" className={`${btnPrimary} w-full`}>
              Agregar repuesto
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
