import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  ArrowLeft, MessageCircle, Phone, KeyRound, ExternalLink, FileDown, Check, X,
  CircleAlert, Copy, EyeOff, ClipboardList,
} from "lucide-react";
import { many } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getQuoteWithItems } from "@/lib/quotes";
import { waLink, WA_TEMPLATES } from "@/lib/whatsapp";
import { formatMoney, formatDate, formatDay } from "@/lib/status";
import {
  decideQuoteAction, cancelQuoteAction, duplicateQuoteAction, generateOrderFromQuoteAction,
  updateQuoteInfoAction,
} from "@/app/admin/actions";
import ItemPicker from "@/components/admin/ItemPicker";
import OrderItemsEditor from "@/components/admin/OrderItemsEditor";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmSubmitButton from "@/components/admin/ConfirmSubmitButton";
import QuoteStatusChip, { ExpiredChip } from "@/components/admin/QuoteStatusChip";
import {
  PageTitle, PlateBadge, VehicleTypeIcon, card, btnPrimary, btnSecondary, inputCls, labelCls,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detalle de presupuesto" };

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (user.role === "mecanico") redirect("/admin");

  const { id } = await params;
  const data = await getQuoteWithItems(Number(id));
  if (!data) notFound();
  const { quote, items, total } = data;

  const isAdmin = user.role === "admin";
  const pending = quote.status === "pendiente";
  const costTotal = items.reduce((s, i) => s + i.qty * i.unit_cost, 0);
  const profit = total - costTotal;

  // La misma orden activa por placa ya en curso merece un aviso (la aprobación
  // crearía una segunda orden para el mismo vehículo, comportamiento válido
  // pero que el asesor debe conocer).
  const activeOrder = pending
    ? await many<{ id: number; folio: string }>(
        `SELECT o.id, o.folio FROM orders o JOIN vehicles v ON v.id = o.vehicle_id
          WHERE v.plate = ? AND o.status NOT IN ('entregado','cancelado') LIMIT 1`,
        [quote.plate]
      )
    : [];

  const pickerParts = pending
    ? await many<{
        id: number; name: string; sku: string | null; stock: number; unit_price: number; cost: number;
      }>(
        "SELECT id, name, sku, stock, unit_price, cost FROM parts WHERE active = 1 ORDER BY name LIMIT 200"
      )
    : [];
  const pickerServices = pending
    ? await many<{
        id: number; name: string; category: string | null; price: number; est_cost: number;
      }>(
        "SELECT id, name, category, price, est_cost FROM services WHERE active = 1 ORDER BY category NULLS LAST, name LIMIT 200"
      )
    : [];

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost"}`;
  const publicUrl = `${origin}/presupuesto/${quote.folio}?code=${quote.public_code}`;
  const waHref =
    quote.display_client_phone && total > 0
      ? waLink(
          quote.display_client_phone,
          WA_TEMPLATES.presupuesto_link({
            nombre: (quote.display_client_name ?? "").split(" ")[0] || "cliente",
            folio: quote.folio,
            total,
            code: quote.public_code,
            origin,
          })
        )
      : null;

  const vehicleLabel =
    [quote.vehicle_brand, quote.vehicle_model, quote.vehicle_year, quote.vehicle_color]
      .filter(Boolean)
      .join(" ") || "Sin datos";

  return (
    <div className="space-y-5">
      <PageTitle
        title={quote.folio}
        subtitle={`Creado el ${formatDate(quote.created_at)}`}
        action={
          <Link href="/admin/presupuestos" className={btnSecondary}>
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Presupuestos
          </Link>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5 items-start *:min-w-0">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-5">
          {/* Estado + decisión */}
          <section className={`${card} p-5`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Estado del presupuesto
            </p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <QuoteStatusChip status={quote.status} />
              {quote.expired && <ExpiredChip />}
              {quote.valid_until && (
                <span className="text-sm text-slate-500">
                  Vigente hasta el {formatDay(quote.valid_until)}
                </span>
              )}
            </div>

            {quote.status === "aprobado" && (
              <div className="mt-3 text-sm text-accent-800 bg-accent-50 border border-accent-200 rounded-xl px-3 py-2">
                Aprobado{quote.decided_via === "cliente" ? " por el cliente desde su enlace" : ""}
                {quote.decided_via === "staff" && quote.decided_by_name
                  ? ` (registrado por ${quote.decided_by_name})`
                  : ""}
                {quote.decided_at && <> el {formatDate(quote.decided_at)}</>} por{" "}
                <strong>{formatMoney(quote.decision_total ?? total)}</strong>.{" "}
                {quote.order_id && quote.order_folio ? (
                  <Link
                    href={`/admin/ordenes/${quote.order_id}`}
                    className="font-semibold text-sm-red hover:text-sm-red-hover underline"
                  >
                    Ver la orden {quote.order_folio}
                  </Link>
                ) : null}
              </div>
            )}
            {quote.status === "aprobado" && !quote.order_id && (
              <div className="mt-3 flex items-start gap-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <div className="flex-1">
                  La orden no llegó a generarse (fallo momentáneo). Reintenta aquí:
                  <form action={generateOrderFromQuoteAction} className="mt-2">
                    <input type="hidden" name="quote_id" value={quote.id} />
                    <SubmitButton className={btnPrimary} pendingText="Generando…">
                      <ClipboardList className="w-4 h-4" aria-hidden="true" /> Generar orden
                    </SubmitButton>
                  </form>
                </div>
              </div>
            )}
            {quote.status === "rechazado" && (
              <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                Rechazado{quote.decided_via === "cliente" ? " por el cliente desde su enlace" : ""}
                {quote.decided_via === "staff" && quote.decided_by_name
                  ? ` (registrado por ${quote.decided_by_name})`
                  : ""}
                {quote.decided_at && <> el {formatDate(quote.decided_at)}</>}. Puedes duplicarlo
                para re-cotizar con otros precios.
              </p>
            )}
            {quote.status === "cancelado" && (
              <p className="mt-3 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                Cancelado por el taller{quote.decided_at && <> el {formatDate(quote.decided_at)}</>}.
                Queda en el historial; puedes duplicarlo si el cliente vuelve.
              </p>
            )}

            {pending && activeOrder.length > 0 && (
              <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                Ojo: la placa {quote.plate} ya tiene la orden{" "}
                <Link
                  href={`/admin/ordenes/${activeOrder[0].id}`}
                  className="font-semibold underline"
                >
                  {activeOrder[0].folio}
                </Link>{" "}
                activa. Si este presupuesto se aprueba se creará una orden adicional.
              </p>
            )}

            {pending && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  ¿El cliente ya respondió en persona o por llamada?
                </p>
                {items.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">
                    Agrega conceptos al presupuesto para poder registrarlo como aprobado.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <form action={decideQuoteAction}>
                      <input type="hidden" name="quote_id" value={quote.id} />
                      <input type="hidden" name="decision" value="aprobado" />
                      <ConfirmSubmitButton
                        className="inline-flex items-center gap-1.5 rounded-xl bg-accent-600 hover:bg-accent-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer"
                        confirmTitle="¿Marcar como aprobado?"
                        confirmMessage={`Se registra la aprobación por ${formatMoney(total)} y se crea la orden de trabajo con estos conceptos (el stock de los repuestos se descuenta).`}
                        confirmLabel="Aprobar y crear orden"
                      >
                        <Check className="w-4 h-4" aria-hidden="true" /> Marcar aprobado
                      </ConfirmSubmitButton>
                    </form>
                    <form action={decideQuoteAction}>
                      <input type="hidden" name="quote_id" value={quote.id} />
                      <input type="hidden" name="decision" value="rechazado" />
                      <ConfirmSubmitButton
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer"
                        confirmTitle="¿Marcar como rechazado?"
                        confirmMessage="Se registra el rechazo del cliente. El presupuesto queda en el historial y podrás duplicarlo para re-cotizar."
                        confirmLabel="Marcar rechazado"
                      >
                        <X className="w-4 h-4" aria-hidden="true" /> Marcar rechazado
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Conceptos */}
          <section className={`${card} p-5`}>
            <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
              CONCEPTOS
            </h2>
            {items.length === 0 && !pending && (
              <p className="mt-3 text-sm text-slate-400">Este presupuesto no tiene conceptos.</p>
            )}
            <OrderItemsEditor
              orderId={quote.id}
              items={items.map((i) => ({ ...i, stock: null }))}
              isAdmin={isAdmin}
              total={total}
              profit={profit}
              mode="quote"
              readOnly={!pending}
            />
            {pending && (
              <ItemPicker
                orderId={quote.id}
                parts={pickerParts}
                services={pickerServices}
                isAdmin={isAdmin}
                mode="quote"
              />
            )}
            {isAdmin && items.length > 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                Costo y ganancia son solo del equipo; el cliente ve únicamente precios de venta.
              </p>
            )}
          </section>
        </div>

        {/* Columna lateral */}
        <div className="space-y-5">
          {/* Vehículo y cliente (snapshot del presupuesto) */}
          <section className={`${card} p-5`}>
            <div className="flex items-center gap-3">
              <span className="text-slate-400">
                <VehicleTypeIcon type={quote.vehicle_type} className="w-7 h-7" />
              </span>
              <div className="min-w-0">
                <PlateBadge plate={quote.plate} />
                <p className="text-sm font-medium text-slate-700 mt-1 truncate">{vehicleLabel}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Cliente</dt>
                <dd className="text-right">
                  {quote.client_id ? (
                    <Link
                      href={`/admin/clientes/${quote.client_id}`}
                      className="font-medium text-sm-red hover:text-sm-red-hover"
                    >
                      {quote.display_client_name ?? "—"}
                    </Link>
                  ) : (
                    <span className="font-medium text-slate-700">
                      {quote.display_client_name ?? "—"}
                    </span>
                  )}
                  {!quote.client_id && (
                    <p className="text-[11px] text-slate-400">
                      Se registrará en clientes si aprueba.
                    </p>
                  )}
                </dd>
              </div>
              {quote.display_client_phone && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Teléfono</dt>
                  <dd>
                    <a
                      href={`tel:${quote.display_client_phone}`}
                      className="font-medium text-slate-700 flex items-center gap-1"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      {quote.display_client_phone}
                    </a>
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Trabajo</dt>
                <dd className="text-slate-700 text-right whitespace-pre-wrap">{quote.description}</dd>
              </div>
              {quote.notes && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400 shrink-0">Notas internas</dt>
                  <dd className="text-slate-700 text-right whitespace-pre-wrap">{quote.notes}</dd>
                </div>
              )}
            </dl>
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center justify-center gap-2 w-full mt-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" /> Enviar por WhatsApp
              </a>
            )}
            {!waHref && pending && (
              <p className="mt-4 text-xs text-slate-400">
                {total <= 0
                  ? "Agrega conceptos para poder enviarlo por WhatsApp."
                  : "Sin teléfono del cliente: compártele el enlace o el PDF de abajo."}
              </p>
            )}
          </section>

          {/* Acceso del cliente */}
          <section className={`${card} p-5 bg-sm-bg/50`}>
            <h2 className="font-heading font-semibold text-slate-800 tracking-wide flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-sm-red" aria-hidden="true" /> ACCESO DEL CLIENTE
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Con estos datos el cliente revisa y aprueba su presupuesto en línea:
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400">Folio</span>
                <span className="plate-badge bg-white border border-sm-border rounded-md px-2.5 py-0.5 text-slate-700">
                  {quote.folio}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400">Código de acceso</span>
                <span className="plate-badge bg-white border border-sm-border rounded-md px-2.5 py-0.5 text-sm-red">
                  {quote.public_code}
                </span>
              </div>
            </div>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener"
              className={`${btnSecondary} w-full mt-4`}
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" /> Ver como cliente
            </a>
            <a
              href={`/admin/presupuestos/${quote.id}/pdf`}
              target="_blank"
              rel="noopener"
              className={`${btnSecondary} w-full mt-2`}
            >
              <FileDown className="w-4 h-4" aria-hidden="true" /> Descargar PDF
            </a>
            <p className="mt-1.5 text-[11px] text-slate-400 text-center break-all">{publicUrl}</p>
          </section>

          {/* Datos editables (solo pendiente) */}
          {pending && (
            <section className={`${card} p-5`}>
              <h2 className="font-heading font-semibold text-slate-800 tracking-wide">
                DATOS DEL PRESUPUESTO
              </h2>
              <form action={updateQuoteInfoAction} className="mt-3 space-y-3">
                <input type="hidden" name="quote_id" value={quote.id} />
                <div>
                  <label htmlFor="edit-desc" className={labelCls}>
                    Trabajo a cotizar *
                  </label>
                  <textarea
                    id="edit-desc"
                    name="description"
                    rows={2}
                    required
                    defaultValue={quote.description}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="edit-valid" className={labelCls}>
                    Vigente hasta
                  </label>
                  <input
                    id="edit-valid"
                    name="valid_until"
                    type="date"
                    defaultValue={quote.valid_until ?? ""}
                    className={inputCls}
                  />
                </div>
                {!quote.client_id && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="edit-cname" className={labelCls}>
                        Cliente
                      </label>
                      <input
                        id="edit-cname"
                        name="client_name"
                        defaultValue={quote.client_name ?? ""}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-cphone" className={labelCls}>
                        Teléfono
                      </label>
                      <input
                        id="edit-cphone"
                        name="client_phone"
                        type="tel"
                        inputMode="tel"
                        defaultValue={quote.client_phone ?? ""}
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}
                {quote.client_id && (
                  <>
                    <input type="hidden" name="client_name" value={quote.client_name ?? ""} />
                    <input type="hidden" name="client_phone" value={quote.client_phone ?? ""} />
                  </>
                )}
                <div>
                  <label htmlFor="edit-notes" className={labelCls}>
                    Notas internas
                  </label>
                  <textarea
                    id="edit-notes"
                    name="notes"
                    rows={2}
                    defaultValue={quote.notes ?? ""}
                    className={inputCls}
                  />
                </div>
                <SubmitButton className={`${btnSecondary} w-full`} pendingText="Guardando…">
                  Guardar cambios
                </SubmitButton>
              </form>
            </section>
          )}

          {/* Acciones */}
          <section className={`${card} p-5`}>
            <h2 className="font-heading font-semibold text-slate-800 tracking-wide">ACCIONES</h2>
            <form action={duplicateQuoteAction} className="mt-3">
              <input type="hidden" name="quote_id" value={quote.id} />
              <SubmitButton className={`${btnSecondary} w-full`} pendingText="Duplicando…">
                <Copy className="w-4 h-4" aria-hidden="true" /> Duplicar presupuesto
              </SubmitButton>
            </form>
            {pending && (
              <form action={cancelQuoteAction} className="mt-2">
                <input type="hidden" name="quote_id" value={quote.id} />
                <ConfirmSubmitButton
                  className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer"
                  confirmTitle="¿Cancelar presupuesto?"
                  confirmMessage="El presupuesto queda como cancelado en el historial (no se borra). El cliente ya no podrá aprobarlo."
                  confirmLabel="Cancelar presupuesto"
                >
                  <X className="w-4 h-4" aria-hidden="true" /> Cancelar presupuesto
                </ConfirmSubmitButton>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
