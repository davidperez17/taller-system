import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, MessageSquareText, Wrench, Eye, EyeOff, Trash2, Phone, KeyRound, ExternalLink,
} from "lucide-react";
import { one, many } from "@/lib/db";
import {
  STATUS_META, STATUS_FLOW, ROLES, formatMoney, formatDate, formatDateShort, type OrderStatus,
} from "@/lib/status";
import {
  updateOrderStatusAction, addOrderNoteAction, addOrderItemAction,
  deleteOrderItemAction, updateOrderInfoAction,
} from "@/app/admin/actions";
import {
  StatusBadge, PlateBadge, VehicleTypeIcon, PageTitle, card, btnPrimary, btnSecondary, inputCls, labelCls,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detalle de orden" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await one<{
    id: number; folio: string; tracking_code: string; status: OrderStatus; description: string;
    diagnosis: string | null; km: string | null; fuel_level: string | null;
    assigned_to: number | null; estimated_delivery: string | null; created_at: string;
    updated_at: string; plate: string; type: string; brand: string | null; model: string | null;
    year: string | null; color: string | null; client_id: number; client_name: string;
    client_phone: string | null;
  }>(
    `SELECT o.*, v.plate, v.type, v.brand, v.model, v.year, v.color,
              c.id AS client_id, c.name AS client_name, c.phone AS client_phone
       FROM orders o
       JOIN vehicles v ON v.id = o.vehicle_id
       JOIN clients c ON c.id = v.client_id
       WHERE o.id = ?`,
    [Number(id)]
  );

  if (!order) notFound();

  const items = await many<{
    id: number; kind: string; description: string; qty: number; unit_price: number;
  }>("SELECT * FROM order_items WHERE order_id = ? ORDER BY id", [order.id]);
  const total = items.reduce((s, i) => s + i.qty * i.unit_price, 0);

  const events = await many<{
    id: number; type: string; title: string; detail: string | null; is_public: number;
    created_at: string; author: string | null;
  }>(
    `SELECT e.*, u.name AS author FROM order_events e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.order_id = ? ORDER BY e.created_at DESC, e.id DESC`,
    [order.id]
  );

  const team = await many<{ id: number; name: string; role: string }>(
    "SELECT id, name, role FROM users WHERE active = 1 ORDER BY name"
  );

  const meta = STATUS_META[order.status];
  const nextStatuses = STATUS_FLOW.filter((s) => s !== order.status);

  return (
    <div className="space-y-5">
      <PageTitle
        title={order.folio}
        subtitle={`Ingresó el ${formatDate(order.created_at)}`}
        action={
          <Link href="/admin/ordenes" className={btnSecondary}>
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Órdenes
          </Link>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-5">
          {/* Estado + cambio */}
          <section className={`${card} p-5`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Estado actual
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={order.status} />
                  <span className="text-sm text-slate-500">{meta.description}</span>
                </div>
              </div>
            </div>
            <form action={updateOrderStatusAction} className="mt-4 space-y-3">
              <input type="hidden" name="order_id" value={order.id} />
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="status" className={labelCls}>
                    Cambiar a
                  </label>
                  <select id="status" name="status" className={inputCls} defaultValue="">
                    <option value="" disabled>
                      Selecciona nueva etapa…
                    </option>
                    {nextStatuses.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_META[s].label}
                      </option>
                    ))}
                    <option value="cancelado">Cancelar orden</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="status-note" className={labelCls}>
                    Mensaje para el cliente (opcional)
                  </label>
                  <input
                    id="status-note"
                    name="note"
                    placeholder="Ej. Encontramos la falla en el alternador."
                    className={inputCls}
                  />
                </div>
              </div>
              <button type="submit" className={btnPrimary}>
                Actualizar estado y notificar
              </button>
              <p className="text-xs text-slate-400">
                Al cambiar la etapa se envía una notificación push al cliente y se registra en su
                línea de tiempo.
              </p>
            </form>
          </section>

          {/* Anotaciones */}
          <section className={`${card} p-5`}>
            <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
              ANOTACIONES
            </h2>
            <form action={addOrderNoteAction} className="mt-3 space-y-3">
              <input type="hidden" name="order_id" value={order.id} />
              <div>
                <label htmlFor="note-title" className={labelCls}>
                  Anotación *
                </label>
                <input
                  id="note-title"
                  name="title"
                  required
                  placeholder="Ej. Se desmontó la culata para revisión."
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="note-detail" className={labelCls}>
                  Detalle (opcional)
                </label>
                <textarea id="note-detail" name="detail" rows={2} className={inputCls} />
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_public"
                    defaultChecked
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Visible para el cliente (envía notificación)
                </label>
                <button type="submit" className={btnPrimary}>
                  Agregar anotación
                </button>
              </div>
            </form>

            <ul className="mt-5 space-y-4">
              {events.map((ev) => (
                <li key={ev.id} className="flex gap-3">
                  <div
                    className={`rounded-xl p-2 h-fit shrink-0 ${
                      ev.type === "estado"
                        ? "bg-blue-50 text-blue-600"
                        : ev.is_public
                          ? "bg-slate-100 text-slate-500"
                          : "bg-amber-50 text-amber-600"
                    }`}
                    aria-hidden="true"
                  >
                    {ev.type === "estado" ? (
                      <Wrench className="w-4 h-4" />
                    ) : (
                      <MessageSquareText className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800">{ev.title}</p>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 ${
                          ev.is_public
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {ev.is_public ? (
                          <>
                            <Eye className="w-3 h-3" aria-hidden="true" /> Cliente
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3" aria-hidden="true" /> Interna
                          </>
                        )}
                      </span>
                    </div>
                    {ev.detail && (
                      <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-wrap">{ev.detail}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDate(ev.created_at)}
                      {ev.author ? ` · ${ev.author}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Presupuesto */}
          <section className={`${card} p-5`}>
            <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
              PRESUPUESTO
            </h2>
            {items.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="py-2 pr-2 font-semibold">Concepto</th>
                      <th className="py-2 px-2 font-semibold">Tipo</th>
                      <th className="py-2 px-2 font-semibold text-right">Cant.</th>
                      <th className="py-2 px-2 font-semibold text-right">P. unitario</th>
                      <th className="py-2 px-2 font-semibold text-right">Importe</th>
                      <th className="py-2 pl-2" aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2.5 pr-2 text-slate-700">{it.description}</td>
                        <td className="py-2.5 px-2 text-slate-500 capitalize">{it.kind}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-slate-500">{it.qty}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-slate-500">
                          {formatMoney(it.unit_price)}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums font-medium text-slate-700">
                          {formatMoney(it.qty * it.unit_price)}
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          <form action={deleteOrderItemAction} className="inline">
                            <input type="hidden" name="id" value={it.id} />
                            <input type="hidden" name="order_id" value={order.id} />
                            <button
                              type="submit"
                              aria-label={`Eliminar ${it.description}`}
                              className="p-1.5 text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200">
                      <td colSpan={4} className="py-3 font-semibold text-slate-800">
                        Total
                      </td>
                      <td className="py-3 text-right font-bold text-slate-900 tabular-nums">
                        {formatMoney(total)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <form
              action={addOrderItemAction}
              className="mt-4 grid grid-cols-2 sm:grid-cols-[1fr_auto_5rem_7rem_auto] gap-2 items-end"
            >
              <input type="hidden" name="order_id" value={order.id} />
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="item-desc" className={labelCls}>
                  Concepto
                </label>
                <input
                  id="item-desc"
                  name="description"
                  required
                  placeholder="Ej. Cambio de balatas delanteras"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="item-kind" className={labelCls}>
                  Tipo
                </label>
                <select id="item-kind" name="kind" className={inputCls}>
                  <option value="servicio">Servicio</option>
                  <option value="repuesto">Repuesto</option>
                </select>
              </div>
              <div>
                <label htmlFor="item-qty" className={labelCls}>
                  Cant.
                </label>
                <input
                  id="item-qty"
                  name="qty"
                  type="number"
                  step="0.5"
                  min="0.5"
                  defaultValue={1}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="item-price" className={labelCls}>
                  P. unitario
                </label>
                <input
                  id="item-price"
                  name="unit_price"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className={inputCls}
                />
              </div>
              <button type="submit" className={`${btnPrimary} col-span-2 sm:col-span-1`}>
                Agregar
              </button>
            </form>
          </section>
        </div>

        {/* Columna lateral */}
        <div className="space-y-5">
          {/* Vehículo y cliente */}
          <section className={`${card} p-5`}>
            <div className="flex items-center gap-3">
              <span className="text-slate-400">
                <VehicleTypeIcon type={order.type} className="w-7 h-7" />
              </span>
              <div className="min-w-0">
                <PlateBadge plate={order.plate} />
                <p className="text-sm font-medium text-slate-700 mt-1 truncate">
                  {[order.brand, order.model, order.year, order.color].filter(Boolean).join(" ") || "Sin datos"}
                </p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Cliente</dt>
                <dd>
                  <Link
                    href={`/admin/clientes/${order.client_id}`}
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    {order.client_name}
                  </Link>
                </dd>
              </div>
              {order.client_phone && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Teléfono</dt>
                  <dd>
                    <a
                      href={`tel:${order.client_phone}`}
                      className="font-medium text-slate-700 flex items-center gap-1"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      {order.client_phone}
                    </a>
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Kilometraje</dt>
                <dd className="text-slate-700">{order.km || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Combustible</dt>
                <dd className="text-slate-700">{order.fuel_level || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Entrega estimada</dt>
                <dd className="text-slate-700">{formatDateShort(order.estimated_delivery)}</dd>
              </div>
            </dl>
          </section>

          {/* Acceso del cliente */}
          <section className={`${card} p-5 bg-blue-50/50`}>
            <h2 className="font-heading font-semibold text-slate-800 tracking-wide flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-600" aria-hidden="true" /> ACCESO DEL CLIENTE
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Entrega estos datos al cliente para que siga su reparación:
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400">Placa</span>
                <PlateBadge plate={order.plate} />
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400">Código de acceso</span>
                <span className="plate-badge bg-white border border-blue-200 rounded-md px-2.5 py-0.5 text-blue-700">
                  {order.tracking_code}
                </span>
              </div>
            </div>
            <a
              href={`/seguimiento/${order.plate}?code=${order.tracking_code}`}
              target="_blank"
              rel="noopener"
              className={`${btnSecondary} w-full mt-4`}
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" /> Ver como cliente
            </a>
          </section>

          {/* Datos de la orden */}
          <section className={`${card} p-5`}>
            <h2 className="font-heading font-semibold text-slate-800 tracking-wide">
              DATOS DE LA ORDEN
            </h2>
            <form action={updateOrderInfoAction} className="mt-3 space-y-3">
              <input type="hidden" name="order_id" value={order.id} />
              <div>
                <label htmlFor="edit-desc" className={labelCls}>
                  Trabajo solicitado
                </label>
                <textarea
                  id="edit-desc"
                  name="description"
                  rows={2}
                  defaultValue={order.description}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="edit-diag" className={labelCls}>
                  Diagnóstico
                </label>
                <textarea
                  id="edit-diag"
                  name="diagnosis"
                  rows={3}
                  defaultValue={order.diagnosis ?? ""}
                  placeholder="Visible para el cliente con su código de acceso."
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-km" className={labelCls}>
                    Kilometraje
                  </label>
                  <input id="edit-km" name="km" defaultValue={order.km ?? ""} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="edit-fuel" className={labelCls}>
                    Combustible
                  </label>
                  <input
                    id="edit-fuel"
                    name="fuel_level"
                    defaultValue={order.fuel_level ?? ""}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-delivery" className={labelCls}>
                    Entrega estimada
                  </label>
                  <input
                    id="edit-delivery"
                    name="estimated_delivery"
                    type="date"
                    defaultValue={order.estimated_delivery ?? ""}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="edit-assigned" className={labelCls}>
                    Asignada a
                  </label>
                  <select
                    id="edit-assigned"
                    name="assigned_to"
                    defaultValue={order.assigned_to ?? ""}
                    className={inputCls}
                  >
                    <option value="">Sin asignar</option>
                    {team.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({ROLES[u.role]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className={`${btnSecondary} w-full`}>
                Guardar cambios
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
