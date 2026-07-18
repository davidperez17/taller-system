import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, Wrench } from "lucide-react";
import { one, many } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  VEHICLE_TYPES, RECEPTION_EVENT_TITLE, formatMoney, formatDate, formatDateShort,
} from "@/lib/status";
import { totalsOf, type DiscountType } from "@/lib/totals";
import { btnSecondary } from "@/components/admin/ui";
import brand from "@/lib/brand.json";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Imprimir orden" };

// Orden de servicio imprimible: comprobante de recepción para el cliente con
// datos del vehículo, estado al ingreso, presupuesto, código de seguimiento y
// firmas. Vive fuera del grupo (panel) para imprimirse sin la navegación.
export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/admin/login");

  const { id } = await params;
  const order = await one<{
    id: number; folio: string; tracking_code: string; status: string; description: string;
    diagnosis: string | null; km: string | null; fuel_level: string | null;
    estimated_delivery: string | null; created_at: string;
    plate: string; type: string; brand: string | null; model: string | null;
    year: string | null; color: string | null; client_name: string; client_phone: string | null;
    discount_type: DiscountType | null; discount_value: number;
  }>(
    `SELECT o.*, v.plate, v.type, v.brand, v.model, v.year, v.color,
            c.name AS client_name, c.phone AS client_phone
       FROM orders o
       JOIN vehicles v ON v.id = o.vehicle_id
       JOIN clients c ON c.id = v.client_id
       WHERE o.id = ?`,
    [Number(id)]
  );
  if (!order) notFound();

  const items = await many<{ description: string; qty: number; unit_price: number }>(
    "SELECT description, qty, unit_price FROM order_items WHERE order_id = ? ORDER BY id",
    [order.id]
  );
  const { subtotal, discount, total } = totalsOf(
    items,
    order.discount_type,
    order.discount_value
  );

  const reception = await one<{ detail: string | null }>(
    "SELECT detail FROM order_events WHERE order_id = ? AND title = ? ORDER BY id LIMIT 1",
    [order.id, RECEPTION_EVENT_TITLE]
  );

  const h = await headers();
  const host = h.get("host") ?? "";
  const trackingUrl = `${h.get("x-forwarded-proto") ?? "https"}://${host}/seguimiento/${order.plate}`;

  const vehicleLine = [
    VEHICLE_TYPES[order.type] ?? order.type,
    [order.brand, order.model, order.year, order.color].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");

  const row = "flex justify-between gap-4 py-1.5 border-b border-slate-100 text-sm";
  const dt = "text-slate-500 shrink-0";
  const dd = "text-slate-900 font-medium text-right";

  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <div className="max-w-2xl mx-auto p-6 print:p-0 print:max-w-none">
        {/* Barra de acciones (no se imprime) */}
        <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
          <Link href={`/admin/ordenes/${order.id}`} className={btnSecondary}>
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver a la orden
          </Link>
          <PrintButton />
        </div>

        {/* Encabezado */}
        <header className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 text-white rounded-lg p-2 print:bg-slate-900" aria-hidden="true">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <p className="font-heading font-bold tracking-wide text-lg leading-tight uppercase">
                {brand.name}
              </p>
              <p className="text-xs text-slate-500">Orden de servicio · comprobante de recepción</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-heading font-bold text-2xl tracking-wide">{order.folio}</p>
            <p className="text-xs text-slate-500">{formatDate(order.created_at)}</p>
          </div>
        </header>

        {/* Cliente y vehículo */}
        <section className="mt-5 grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-x-8">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Cliente
            </h2>
            <div className={row}>
              <span className={dt}>Nombre</span>
              <span className={dd}>{order.client_name}</span>
            </div>
            <div className={row}>
              <span className={dt}>Teléfono</span>
              <span className={dd}>{order.client_phone || "—"}</span>
            </div>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 mt-4 sm:mt-0 print:mt-0">
              Vehículo
            </h2>
            <div className={row}>
              <span className={dt}>Placa</span>
              <span className={`${dd} plate-badge`}>{order.plate}</span>
            </div>
            <div className={row}>
              <span className={dt}>Vehículo</span>
              <span className={dd}>{vehicleLine || "—"}</span>
            </div>
            <div className={row}>
              <span className={dt}>Kilometraje / Combustible</span>
              <span className={dd}>
                {order.km || "—"} / {order.fuel_level || "—"}
              </span>
            </div>
            <div className={row}>
              <span className={dt}>Entrega estimada</span>
              <span className={dd}>{formatDateShort(order.estimated_delivery)}</span>
            </div>
          </div>
        </section>

        {/* Trabajo y estado al ingreso */}
        <section className="mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Trabajo solicitado
          </h2>
          <p className="text-sm whitespace-pre-wrap border border-slate-200 rounded-lg p-3">
            {order.description || "—"}
          </p>
        </section>
        {reception?.detail && (
          <section className="mt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Estado del vehículo al ingreso
            </h2>
            <p className="text-sm whitespace-pre-wrap border border-slate-200 rounded-lg p-3">
              {reception.detail}
            </p>
          </section>
        )}

        {/* Presupuesto */}
        {items.length > 0 && (
          <section className="mt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Presupuesto
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-300">
                  <th className="py-1.5 pr-2 font-semibold">Concepto</th>
                  <th className="py-1.5 px-2 font-semibold text-right">Cant.</th>
                  <th className="py-1.5 pl-2 font-semibold text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2">{it.description}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{it.qty}</td>
                    <td className="py-1.5 pl-2 text-right tabular-nums">
                      {formatMoney(it.qty * it.unit_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {discount > 0.009 && (
                  <>
                    <tr>
                      <td className="pt-2 text-slate-500">Subtotal</td>
                      <td />
                      <td className="pt-2 text-right tabular-nums text-slate-500">
                        {formatMoney(subtotal)}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-slate-500">
                        {order.discount_type === "porcentaje"
                          ? `Descuento (${order.discount_value}%)`
                          : "Descuento"}
                      </td>
                      <td />
                      <td className="text-right tabular-nums text-slate-500">
                        - {formatMoney(discount)}
                      </td>
                    </tr>
                  </>
                )}
                <tr>
                  <td className="py-2 font-semibold">Total</td>
                  <td />
                  <td className="py-2 text-right font-bold tabular-nums">{formatMoney(total)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="text-[11px] text-slate-400 mt-1">
              Presupuesto sujeto a diagnóstico; cualquier trabajo adicional se consulta antes con el
              cliente.
            </p>
          </section>
        )}

        {/* Seguimiento en línea */}
        <section className="mt-5 border-2 border-slate-900 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sigue tu reparación en línea
          </p>
          <p className="text-sm mt-1 break-all">{trackingUrl}</p>
          <div className="mt-2 flex items-center justify-center gap-6 text-sm">
            <span>
              Placa: <b className="plate-badge">{order.plate}</b>
            </span>
            <span>
              Código de acceso: <b className="plate-badge">{order.tracking_code}</b>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Con la placa ves el avance; con el código de acceso ves también anotaciones, fotos y
            presupuesto. Guarda este comprobante.
          </p>
        </section>

        {/* Firmas */}
        <section className="mt-10 print:mt-14 grid grid-cols-2 gap-10">
          <div className="border-t border-slate-400 pt-1.5 text-center">
            <p className="text-xs text-slate-500">Firma del cliente</p>
            <p className="text-[11px] text-slate-400">{order.client_name}</p>
          </div>
          <div className="border-t border-slate-400 pt-1.5 text-center">
            <p className="text-xs text-slate-500">Por el taller</p>
            <p className="text-[11px] text-slate-400">{me.name}</p>
          </div>
        </section>
        <p className="text-[10px] text-slate-400 mt-6 text-center">
          El cliente autoriza la revisión y los trabajos descritos. El taller no se hace responsable
          por objetos de valor no declarados al momento de la recepción.
        </p>
      </div>
    </div>
  );
}
