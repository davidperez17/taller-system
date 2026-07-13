import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  ArrowLeft, MessageSquareText, MessageCircle, Wrench, Eye, EyeOff, Trash2, Phone, KeyRound, ExternalLink, Printer, FileDown, MapPin,
} from "lucide-react";
import { waLink, WA_TEMPLATES } from "@/lib/whatsapp";
import { one, many } from "@/lib/db";
import {
  STATUS_META, ROLES, formatMoney, formatDate, formatDateShort, type OrderStatus,
} from "@/lib/status";
import {
  addOrderNoteAction,
  deleteOrderItemAction, updateOrderInfoAction, addPaymentAction, deletePaymentAction,
} from "@/app/admin/actions";
import { getSessionUser } from "@/lib/auth";
import ItemPicker from "@/components/admin/ItemPicker";
import ItemCostCell from "@/components/admin/ItemCostCell";
import SubmitButton from "@/components/admin/SubmitButton";
import PhotoInput from "@/components/admin/PhotoInput";
import StatusChangeForm from "@/components/admin/StatusChangeForm";
import ConfirmSubmitButton from "@/components/admin/ConfirmSubmitButton";
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
    approval_status: "pendiente" | "aprobado" | "rechazado";
    approval_at: string | null; approval_total: number | null;
    modality: string; service_location: string | null;
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
    unit_cost: number;
  }>("SELECT * FROM order_items WHERE order_id = ? ORDER BY id", [order.id]);
  const total = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const costTotal = items.reduce((s, i) => s + i.qty * i.unit_cost, 0);
  const profit = total - costTotal;
  const margin = total > 0 ? profit / total : 0;
  const hasCost = costTotal > 0.009;

  const events = await many<{
    id: number; type: string; title: string; detail: string | null; is_public: number;
    created_at: string; author: string | null; photo_urls: string | null;
  }>(
    `SELECT e.*, u.name AS author FROM order_events e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.order_id = ? ORDER BY e.created_at DESC, e.id DESC`,
    [order.id]
  );

  const team = await many<{ id: number; name: string; role: string }>(
    "SELECT id, name, role FROM users WHERE active = 1 ORDER BY name"
  );

  const payments = await many<{
    id: number; amount: number; method: string; reference: string | null;
    notes: string | null; created_at: string; author: string | null;
  }>(
    `SELECT p.*, u.name AS author FROM payments p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.order_id = ? ORDER BY p.created_at DESC, p.id DESC`,
    [order.id]
  );
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const saldo = total - paid;
  const me = await getSessionUser();
  const isAdmin = me?.role === "admin";

  const pickerParts = await many<{
    id: number; name: string; sku: string | null; stock: number; unit_price: number; cost: number;
  }>(
    "SELECT id, name, sku, stock, unit_price, cost FROM parts WHERE active = 1 ORDER BY name LIMIT 200"
  );
  const pickerServices = await many<{
    id: number; name: string; category: string | null; price: number; est_cost: number;
  }>(
    "SELECT id, name, category, price, est_cost FROM services WHERE active = 1 ORDER BY category NULLS LAST, name LIMIT 200"
  );

  const meta = STATUS_META[order.status];

  // Enlaces de WhatsApp con mensaje prellenado según la situación de la orden.
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost"}`;
  const waActions: { label: string; href: string }[] = [];
  if (order.client_phone) {
    const base = { nombre: order.client_name.split(" ")[0], placa: order.plate, origin };
    const push = (label: string, msg: string) => {
      const href = waLink(order.client_phone, msg);
      if (href) waActions.push({ label, href });
    };
    if (order.status === "listo") {
      push("Vehículo listo", WA_TEMPLATES.listo(base));
    } else if (order.status === "aprobacion" && total > 0) {
      push(
        "Presupuesto listo",
        WA_TEMPLATES.presupuesto({ ...base, total, code: order.tracking_code })
      );
    } else if (order.status !== "cancelado") {
      push("Estado actual", WA_TEMPLATES.estado({ ...base, estado: meta.client }));
    }
    if (saldo > 0.009 && (order.status === "listo" || order.status === "entregado")) {
      push("Saldo pendiente", WA_TEMPLATES.saldo({ ...base, saldo }));
    }
  }

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

      <div className="grid lg:grid-cols-3 gap-5 items-start *:min-w-0">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-5">
          {/* Estado + cambio */}
          <section className={`${card} p-5`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Estado actual
                </p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <StatusBadge status={order.status} />
                  {order.modality === "domicilio" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide bg-sm-red/10 text-sm-red border border-sm-red/25 rounded-full px-2 py-0.5">
                      <MapPin className="w-3 h-3" aria-hidden="true" /> A domicilio
                    </span>
                  )}
                  {order.approval_status === "aprobado" && (
                    <span className="text-[11px] font-semibold uppercase tracking-wide bg-accent-50 text-accent-700 border border-accent-200 rounded-full px-2 py-0.5">
                      Presupuesto aprobado
                    </span>
                  )}
                  {order.approval_status === "rechazado" && (
                    <span className="text-[11px] font-semibold uppercase tracking-wide bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                      Presupuesto rechazado
                    </span>
                  )}
                  <span className="text-sm text-slate-500">{meta.description}</span>
                </div>
              </div>
            </div>
            {order.approval_status === "rechazado" && (
              <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                El cliente rechazó el presupuesto
                {order.approval_at && <> el {formatDate(order.approval_at)}</>}. Contactarlo para
                re-cotizar o cancelar la orden.
              </p>
            )}
            {order.approval_status === "aprobado" &&
              order.approval_total != null &&
              Math.abs(total - order.approval_total) > 0.009 && (
                <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Ojo: el total actual ({formatMoney(total)}) ya no coincide con el aprobado por el
                  cliente ({formatMoney(order.approval_total)}).
                </p>
              )}
            <StatusChangeForm orderId={order.id} currentStatus={order.status} />
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
              <PhotoInput />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_public"
                    defaultChecked
                    className="w-4 h-4 rounded border-slate-300 text-sm-red focus:ring-sm-red"
                  />
                  Visible para el cliente (envía notificación)
                </label>
                <SubmitButton className={btnPrimary} pendingText="Agregando…">
                  Agregar anotación
                </SubmitButton>
              </div>
            </form>

            <ul className="mt-5 space-y-4">
              {events.map((ev) => (
                <li key={ev.id} className="flex gap-3">
                  <div
                    className={`rounded-xl p-2 h-fit shrink-0 ${
                      ev.type === "estado"
                        ? "bg-sm-bg text-sm-red"
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
                            ? "bg-accent-50 text-accent-700"
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
                    <EventPhotos raw={ev.photo_urls} />
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
                      <th className="py-2 px-2 font-semibold hidden sm:table-cell">Tipo</th>
                      <th className="py-2 px-2 font-semibold text-right">Cant.</th>
                      {isAdmin && <th className="py-2 px-2 font-semibold text-right">Costo unit.</th>}
                      <th className="py-2 px-2 font-semibold text-right hidden md:table-cell">P. venta</th>
                      <th className="py-2 px-2 font-semibold text-right">Importe</th>
                      {isAdmin && <th className="py-2 px-2 font-semibold text-right">Ganancia</th>}
                      <th className="py-2 pl-2" aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((it) => {
                      const lineProfit = it.qty * (it.unit_price - it.unit_cost);
                      return (
                        <tr key={it.id}>
                          <td className="py-2.5 pr-2 text-slate-700">{it.description}</td>
                          <td className="py-2.5 px-2 text-slate-500 capitalize hidden sm:table-cell">
                            {it.kind}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-slate-500">{it.qty}</td>
                          {isAdmin && (
                            <td className="py-2.5 px-2 text-right">
                              <ItemCostCell
                                itemId={it.id}
                                orderId={order.id}
                                cost={it.unit_cost}
                                label={it.description}
                              />
                            </td>
                          )}
                          <td className="py-2.5 px-2 text-right tabular-nums text-slate-500 hidden md:table-cell">
                            {formatMoney(it.unit_price)}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums font-medium text-slate-700">
                            {formatMoney(it.qty * it.unit_price)}
                          </td>
                          {isAdmin && (
                            <td
                              className={`py-2.5 px-2 text-right tabular-nums font-medium ${
                                lineProfit < -0.009 ? "text-red-600" : "text-accent-700"
                              }`}
                            >
                              {formatMoney(lineProfit)}
                            </td>
                          )}
                          <td className="py-2.5 pl-2 text-right">
                            <form action={deleteOrderItemAction} className="inline">
                              <input type="hidden" name="id" value={it.id} />
                              <input type="hidden" name="order_id" value={order.id} />
                              <ConfirmSubmitButton
                                ariaLabel={`Eliminar ${it.description}`}
                                className="p-1.5 text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                                confirmTitle="¿Eliminar concepto?"
                                confirmMessage={`Se quita "${it.description}" de la orden.`}
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </ConfirmSubmitButton>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200">
                      <td className="py-3 font-semibold text-slate-800">Total</td>
                      <td className="hidden sm:table-cell" />
                      <td />
                      {isAdmin && <td />}
                      <td className="hidden md:table-cell" />
                      <td className="py-3 text-right font-bold text-slate-900 tabular-nums">
                        {formatMoney(total)}
                      </td>
                      {isAdmin && (
                        <td
                          className={`py-3 text-right font-bold tabular-nums ${
                            profit < -0.009 ? "text-red-600" : "text-accent-700"
                          }`}
                        >
                          {formatMoney(profit)}
                        </td>
                      )}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <ItemPicker orderId={order.id} parts={pickerParts} services={pickerServices} isAdmin={isAdmin} />
          </section>

          {/* Pagos */}
          <section className={`${card} p-5`}>
            <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
              PAGOS
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 rounded-xl px-2 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total</p>
                <p className="font-heading font-bold text-base sm:text-lg text-slate-800 tabular-nums">{formatMoney(total)}</p>
              </div>
              <div className="bg-accent-50 rounded-xl px-2 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-700/70">Pagado</p>
                <p className="font-heading font-bold text-base sm:text-lg text-accent-700 tabular-nums">{formatMoney(paid)}</p>
              </div>
              <div className={`rounded-xl px-2 py-3 ${saldo > 0.009 ? "bg-amber-50" : "bg-slate-50"}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${saldo > 0.009 ? "text-amber-700/70" : "text-slate-400"}`}>Saldo</p>
                <p className={`font-heading font-bold text-base sm:text-lg tabular-nums ${saldo > 0.009 ? "text-amber-700" : "text-slate-500"}`}>{formatMoney(saldo)}</p>
              </div>
            </div>

            {/* Rentabilidad — solo admin. El cliente nunca ve costo ni ganancia. */}
            {isAdmin && items.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                  Rentabilidad · solo el equipo la ve
                </p>
                <div className="mt-2.5 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Costo</p>
                    <p className="font-heading font-bold text-base sm:text-lg tabular-nums text-slate-700">
                      {formatMoney(costTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ganancia</p>
                    <p
                      className={`font-heading font-bold text-base sm:text-lg tabular-nums ${
                        profit < -0.009 ? "text-red-600" : "text-accent-700"
                      }`}
                    >
                      {formatMoney(profit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Margen</p>
                    <p
                      className={`font-heading font-bold text-base sm:text-lg tabular-nums ${
                        profit < -0.009 ? "text-red-600" : "text-slate-700"
                      }`}
                    >
                      {total > 0 ? `${Math.round(margin * 100)}%` : "—"}
                    </p>
                  </div>
                </div>
                {!hasCost && (
                  <p className="mt-2.5 text-xs text-slate-400">
                    Sin costos registrados: la ganancia mostrada equivale al total. Escribe el costo
                    real de cada concepto en la tabla de arriba para ver el margen verdadero.
                  </p>
                )}
              </div>
            )}

            {payments.length > 0 && (
              <ul className="mt-4 divide-y divide-slate-50">
                {payments.map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700">
                        {formatMoney(p.amount)}
                        <span className="ml-2 text-[11px] uppercase tracking-wide text-slate-400 capitalize">
                          {p.method}
                        </span>
                        {p.reference && (
                          <span className="ml-2 text-xs text-slate-400">ref. {p.reference}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDate(p.created_at)}
                        {p.author ? ` · ${p.author}` : ""}
                        {p.notes ? ` · ${p.notes}` : ""}
                      </p>
                    </div>
                    {me?.role === "admin" && (
                      <form action={deletePaymentAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmSubmitButton
                          ariaLabel={`Eliminar pago de ${formatMoney(p.amount)}`}
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                          confirmTitle="¿Eliminar pago?"
                          confirmMessage={`Se elimina el pago de ${formatMoney(p.amount)} de la orden. No se puede deshacer.`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {me?.role !== "mecanico" && saldo > 0.009 && (
              <form
                action={addPaymentAction}
                className="mt-4 grid grid-cols-2 sm:grid-cols-[7rem_auto_1fr_auto] gap-2 items-end"
              >
                <input type="hidden" name="order_id" value={order.id} />
                <div>
                  <label htmlFor="pay-amount" className={labelCls}>
                    Monto *
                  </label>
                  <input
                    id="pay-amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Math.round(saldo * 100) / 100}
                    required
                    inputMode="decimal"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="pay-method" className={labelCls}>
                    Método
                  </label>
                  <select id="pay-method" name="method" className={inputCls}>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor="pay-ref" className={labelCls}>
                    Referencia (opcional)
                  </label>
                  <input id="pay-ref" name="reference" className={inputCls} />
                </div>
                <SubmitButton
                  className={`${btnPrimary} col-span-2 sm:col-span-1`}
                  pendingText="Registrando…"
                >
                  Registrar pago
                </SubmitButton>
              </form>
            )}
            {payments.length === 0 && saldo <= 0.009 && (
              <p className="text-sm text-slate-400 mt-3">
                Sin importes por cobrar: agrega conceptos al presupuesto primero.
              </p>
            )}
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
                    className="font-medium text-sm-red hover:text-sm-red-hover"
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
              {order.modality === "domicilio" && order.service_location && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400 shrink-0">Ubicación</dt>
                  <dd className="text-slate-700 text-right flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{order.service_location}</span>
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
            {waActions.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  WhatsApp al cliente
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {waActions.map((a) => (
                    <a
                      key={a.label}
                      href={a.href}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-accent-50 text-accent-700 border border-accent-200 rounded-full px-3 py-1.5 hover:bg-accent-100 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> {a.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Acceso del cliente */}
          <section className={`${card} p-5 bg-sm-bg/50`}>
            <h2 className="font-heading font-semibold text-slate-800 tracking-wide flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-sm-red" aria-hidden="true" /> ACCESO DEL CLIENTE
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
                <span className="plate-badge bg-white border border-sm-border rounded-md px-2.5 py-0.5 text-sm-red">
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
            <a
              href={`/admin/ordenes/${order.id}/imprimir`}
              target="_blank"
              rel="noopener"
              className={`${btnSecondary} w-full mt-2`}
            >
              <Printer className="w-4 h-4" aria-hidden="true" /> Imprimir orden de servicio
            </a>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a
                href={`/admin/ordenes/${order.id}/pdf?doc=cotizacion`}
                target="_blank"
                rel="noopener"
                className={btnSecondary}
              >
                <FileDown className="w-4 h-4" aria-hidden="true" /> Cotización
              </a>
              <a
                href={`/admin/ordenes/${order.id}/pdf?doc=informe`}
                target="_blank"
                rel="noopener"
                className={btnSecondary}
              >
                <FileDown className="w-4 h-4" aria-hidden="true" /> Informe
              </a>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 text-center">
              PDF para enviar al cliente por WhatsApp o correo.
            </p>
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
              <SubmitButton className={`${btnSecondary} w-full`} pendingText="Guardando…">
                Guardar cambios
              </SubmitButton>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

// Miniaturas de las fotos de una anotación (photo_urls = JSON array de Blob).
function EventPhotos({ raw }: { raw: string | null }) {
  if (!raw) return null;
  let urls: string[] = [];
  try {
    urls = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(urls) || urls.length === 0) return null;
  return (
    <div className="mt-2 flex gap-2 flex-wrap">
      {urls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noopener">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Foto de la anotación"
            loading="lazy"
            className="w-20 h-20 object-cover rounded-lg border border-slate-200 hover:opacity-90 transition-opacity"
          />
        </a>
      ))}
    </div>
  );
}
