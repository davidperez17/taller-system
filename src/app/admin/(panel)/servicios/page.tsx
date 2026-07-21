import { Fragment } from "react";
import { Hammer, Plus } from "lucide-react";
import { many } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { formatMoney } from "@/lib/status";
import {
  createServiceAction, updateServiceAction, deleteServiceAction,
} from "@/app/admin/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { PageTitle, card, btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/admin/ui";
import ConfirmSubmitButton from "@/components/admin/ConfirmSubmitButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Servicios" };

// Catálogo de servicios con precio de venta y costo estimado (mano de obra,
// insumos). Alimenta el selector de ítems de las órdenes y los reportes de
// ganancia.
export default async function ServicesPage() {
  const me = await getSessionUser();
  const services = await many<{
    id: number; name: string; category: string | null; price: number; est_cost: number;
  }>(
    "SELECT id, name, category, price, est_cost FROM services WHERE active = 1 ORDER BY category NULLS LAST, name"
  );

  return (
    <div className="space-y-5">
      <PageTitle
        title="SERVICIOS"
        subtitle="Catálogo de servicios del taller: precios y costos estimados"
      />

      <div className="grid lg:grid-cols-3 gap-5 items-start *:min-w-0">
        <section className={`${card} overflow-hidden lg:col-span-2`}>
          {services.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              Aún no hay servicios. Agrega los más comunes (cambio de aceite, frenos,
              afinamiento…) para cotizar más rápido en las órdenes.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <th className="py-2.5 pl-5 pr-2 font-semibold">Servicio</th>
                    <th className="py-2.5 px-2 font-semibold hidden sm:table-cell">Categoría</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Precio</th>
                    <th className="py-2.5 px-2 font-semibold text-right hidden md:table-cell">Costo est.</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Margen</th>
                    <th className="py-2.5 pl-2 pr-5" aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => {
                    const margin = s.price > 0 ? ((s.price - s.est_cost) / s.price) * 100 : 0;
                    return (
                      <Fragment key={s.id}>
                      <tr className="align-top border-t border-slate-50">
                        <td className="pt-3 pl-5 pr-2 font-medium text-slate-700">{s.name}</td>
                        <td className="pt-3 px-2 text-slate-500 hidden sm:table-cell">
                          {s.category ?? "—"}
                        </td>
                        <td className="pt-3 px-2 text-right tabular-nums text-slate-700">
                          {formatMoney(s.price)}
                        </td>
                        <td className="pt-3 px-2 text-right tabular-nums text-slate-500 hidden md:table-cell">
                          {formatMoney(s.est_cost)}
                        </td>
                        <td
                          className={`pt-3 px-2 text-right tabular-nums font-semibold ${
                            margin >= 40
                              ? "text-accent-700"
                              : margin >= 15
                                ? "text-slate-600"
                                : "text-amber-700"
                          }`}
                        >
                          {s.price > 0 ? `${Math.round(margin)}%` : "—"}
                        </td>
                        <td className="pt-3 pl-2 pr-5 text-right">
                          {me?.role === "admin" && (
                            <form action={deleteServiceAction} className="inline">
                              <input type="hidden" name="id" value={s.id} />
                              <ConfirmSubmitButton
                                className="text-xs font-medium text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
                                confirmTitle={`¿Quitar ${s.name}?`}
                                confirmMessage="Se elimina este servicio del catálogo. No se puede deshacer."
                                confirmLabel="Quitar"
                              >
                                Quitar
                              </ConfirmSubmitButton>
                            </form>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={6} className="pb-3 px-5">
                          <details>
                            <summary className="text-xs font-medium text-sm-red cursor-pointer w-fit">
                              Editar
                            </summary>
                            <form
                              action={updateServiceAction}
                              className="mt-3 mb-1 flex flex-wrap items-end gap-3"
                            >
                              <input type="hidden" name="id" value={s.id} />
                              <div className="grow basis-52">
                                <label htmlFor={`sn-${s.id}`} className={labelCls}>
                                  Nombre
                                </label>
                                <input
                                  id={`sn-${s.id}`}
                                  name="name"
                                  defaultValue={s.name}
                                  required
                                  className={inputCls}
                                />
                              </div>
                              <div className="grow basis-36">
                                <label htmlFor={`sc-${s.id}`} className={labelCls}>
                                  Categoría
                                </label>
                                <input
                                  id={`sc-${s.id}`}
                                  name="category"
                                  defaultValue={s.category ?? ""}
                                  className={inputCls}
                                />
                              </div>
                              <div className="w-28 grow sm:grow-0">
                                <label htmlFor={`sp-${s.id}`} className={labelCls}>
                                  Precio (Q)
                                </label>
                                <input
                                  id={`sp-${s.id}`}
                                  name="price"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  inputMode="decimal"
                                  defaultValue={s.price}
                                  className={inputCls}
                                />
                              </div>
                              <div className="w-28 grow sm:grow-0">
                                <label htmlFor={`se-${s.id}`} className={labelCls}>
                                  Costo est. (Q)
                                </label>
                                <input
                                  id={`se-${s.id}`}
                                  name="est_cost"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  inputMode="decimal"
                                  defaultValue={s.est_cost}
                                  className={inputCls}
                                />
                              </div>
                              <SubmitButton className={btnSecondary} pendingText="Guardando…">
                                Guardar
                              </SubmitButton>
                            </form>
                          </details>
                        </td>
                      </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={`${card} p-5`}>
          <h2 className="font-heading font-semibold text-slate-800 tracking-wide flex items-center gap-2">
            <Plus className="w-4 h-4 text-sm-red" aria-hidden="true" /> NUEVO SERVICIO
          </h2>
          <form action={createServiceAction} className="mt-3 space-y-3">
            <div>
              <label htmlFor="new-name" className={labelCls}>
                Nombre *
              </label>
              <input
                id="new-name"
                name="name"
                required
                placeholder="Ej. Cambio de aceite y filtro"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="new-category" className={labelCls}>
                Categoría
              </label>
              <input
                id="new-category"
                name="category"
                placeholder="Ej. Mantenimiento"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-price" className={labelCls}>
                  Precio (Q)
                </label>
                <input
                  id="new-price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="new-cost" className={labelCls}>
                  Costo estimado (Q)
                </label>
                <input
                  id="new-cost"
                  name="est_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className={inputCls}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 flex items-start gap-1.5">
              <Hammer className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              El costo estimado (mano de obra, insumos) se usa para calcular la ganancia en
              reportes. Se guarda una copia en cada orden: cambiarlo después no altera órdenes
              pasadas.
            </p>
            <SubmitButton className={`${btnPrimary} w-full`} pendingText="Agregando…">
              Agregar servicio
            </SubmitButton>
          </form>
        </section>
      </div>
    </div>
  );
}
