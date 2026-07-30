import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Plus, ChevronRight, MessageCircle, Bell, Wrench, Package, History,
} from "lucide-react";
import { one, many } from "@/lib/db";
import { waLink } from "@/lib/whatsapp";
import brand from "@/lib/brand.json";
import { getSessionUser } from "@/lib/auth";
import {
  formatDateShort, formatMoney, formatDay, daysUntil, VEHICLE_TYPES,
} from "@/lib/status";
import { ORDER_TOTALS_SQL } from "@/lib/totals";
import { CLOSED_DAY_SQL } from "@/lib/history";
import {
  StatusBadge, PlateBadge, VehicleTypeIcon, PageTitle, card, btnPrimary, btnSecondary,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vehículo" };

// ─────────────────────────────────────────────────────────────────────────────
// Ficha del vehículo: todo lo que se le ha hecho a esa placa.
//
// Es la pregunta de taller que antes no tenía pantalla —"¿qué le hicimos a este
// carro la vez pasada?"—: la lista de vehículos solo mostraba la orden activa y
// el historial del cliente mezcla todas sus placas. Acá van sus órdenes, los
// servicios y repuestos que se le pusieron (con fecha, para la garantía) y sus
// recordatorios abiertos.
//
// El dinero se le oculta al mecánico, igual que en el resto del panel.
// ─────────────────────────────────────────────────────────────────────────────

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await one<{
    id: number; plate: string; type: string; brand: string | null; model: string | null;
    year: string | null; color: string | null; notes: string | null; created_at: string;
    client_id: number; client: string; phone: string | null;
  }>(
    `SELECT v.id, v.plate, v.type, v.brand, v.model, v.year, v.color, v.notes, v.created_at,
            c.id AS client_id, c.name AS client, c.phone
       FROM vehicles v JOIN clients c ON c.id = v.client_id
      WHERE v.id = ?`,
    [Number(id)]
  );
  if (!vehicle) notFound();

  const me = await getSessionUser();
  const canSeeMoney = me?.role !== "mecanico";
  const closedDay = CLOSED_DAY_SQL("o");

  // Un solo agregado para las tarjetas: las canceladas no facturan ni cuentan
  // como visita, pero sí como orden abierta en su día.
  const agg = (await one<{
    ordenes: number; entregadas: number; abiertas: number; facturado: number;
    primera: string | null; ultima: string | null;
  }>(
    `SELECT COUNT(*)::int AS ordenes,
            COUNT(*) FILTER (WHERE o.status = 'entregado')::int AS entregadas,
            COUNT(*) FILTER (WHERE o.status NOT IN ('entregado','cancelado'))::int AS abiertas,
            COALESCE(SUM(t.total) FILTER (WHERE o.status = 'entregado'), 0)::float8 AS facturado,
            MIN(o.created_at) AS primera,
            MAX(${closedDay}) FILTER (WHERE o.status = 'entregado') AS ultima
       FROM orders o JOIN ${ORDER_TOTALS_SQL} t ON t.order_id = o.id
      WHERE o.vehicle_id = ?`,
    [vehicle.id]
  ))!;

  // Kilometraje: el último que alguien anotó al recibir el vehículo.
  const km = await one<{ km: string; created_at: string }>(
    `SELECT km, created_at FROM orders
      WHERE vehicle_id = ? AND km IS NOT NULL AND km <> ''
      ORDER BY created_at DESC LIMIT 1`,
    [vehicle.id]
  );

  const orders = await many<{
    id: number; folio: string; status: string; description: string; created_at: string;
    closed_day: string; total: number; modality: string;
  }>(
    `SELECT o.id, o.folio, o.status, o.description, o.created_at, o.modality,
            ${closedDay} AS closed_day, t.total
       FROM orders o JOIN ${ORDER_TOTALS_SQL} t ON t.order_id = o.id
      WHERE o.vehicle_id = ?
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT 100`,
    [vehicle.id]
  );

  // Qué se le ha hecho, agrupado por concepto: cuántas veces y cuándo fue la
  // última. Las canceladas quedan fuera —ese trabajo no se hizo.
  const items = await many<{
    kind: string; description: string; veces: number; qty: number; ultima: string; total: number;
  }>(
    `SELECT oi.kind, oi.description,
            COUNT(DISTINCT oi.order_id)::int AS veces,
            SUM(oi.qty)::float8 AS qty,
            MAX(o.created_at) AS ultima,
            SUM(oi.qty * oi.unit_price)::float8 AS total
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.vehicle_id = ? AND o.status <> 'cancelado'
      GROUP BY oi.kind, oi.description
      ORDER BY MAX(o.created_at) DESC, oi.description
      LIMIT 40`,
    [vehicle.id]
  );

  const reminders = await many<{ id: number; due_date: string; reason: string; notes: string | null }>(
    `SELECT id, due_date, reason, notes FROM service_reminders
      WHERE vehicle_id = ? AND done = 0 ORDER BY due_date LIMIT 5`,
    [vehicle.id]
  );

  const openOrder = orders.find((o) => o.status !== "entregado" && o.status !== "cancelado");
  const specs = [VEHICLE_TYPES[vehicle.type] ?? "Vehículo", vehicle.brand, vehicle.model, vehicle.year, vehicle.color]
    .filter(Boolean)
    .join(" · ");
  const waHref = vehicle.phone
    ? waLink(
        vehicle.phone,
        `Hola ${vehicle.client.split(" ")[0]}, le saludamos de ${brand.name} por su ${
          [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "vehículo"
        } placa ${vehicle.plate}.`
      )
    : null;

  const servicios = items.filter((i) => i.kind === "servicio");
  const repuestos = items.filter((i) => i.kind === "repuesto");

  const tiles: { label: string; value: string; hint?: string }[] = [
    {
      label: "Visitas",
      value: String(agg.entregadas),
      hint:
        agg.abiertas > 0
          ? `${agg.abiertas} en curso · ${agg.ordenes} órdenes en total`
          : `${agg.ordenes} ${agg.ordenes === 1 ? "orden" : "órdenes"} en total`,
    },
    {
      label: "Última visita",
      value: agg.ultima ? formatDateShort(agg.ultima) : "—",
      hint: agg.primera ? `Cliente desde ${formatDateShort(agg.primera)}` : "Sin órdenes aún",
    },
  ];
  if (canSeeMoney) {
    tiles.push({
      label: "Gasto histórico",
      value: formatMoney(agg.facturado),
      hint: "Facturado en sus entregas",
    });
  }
  tiles.push({
    label: "Kilometraje",
    value: km?.km ? km.km : "—",
    hint: km ? `Anotado el ${formatDateShort(km.created_at)}` : "Se anota al recibir el vehículo",
  });

  const itemList = (rows: typeof items, icon: React.ReactNode, empty: string) =>
    rows.length === 0 ? (
      <p className="px-5 pb-5 text-sm text-slate-500">{empty}</p>
    ) : (
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={`${r.kind}-${r.description}`} className="flex items-center gap-3 px-5 py-3">
            <span className="text-slate-400 shrink-0">{icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700 truncate">{r.description}</p>
              <p className="text-xs text-slate-500">
                {r.veces > 1 ? `${r.veces} veces · última ` : ""}
                {formatDateShort(r.ultima)}
              </p>
            </div>
            {canSeeMoney && (
              <p className="text-sm text-slate-600 tabular-nums shrink-0">{formatMoney(r.total)}</p>
            )}
          </li>
        ))}
      </ul>
    );

  return (
    <div className="space-y-5">
      <PageTitle
        title={vehicle.plate}
        subtitle={specs}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {openOrder ? (
              <Link href={`/admin/ordenes/${openOrder.id}`} className={btnPrimary}>
                Ver orden en curso
              </Link>
            ) : (
              <Link href={`/admin/ordenes/nueva?vehiculo=${vehicle.id}`} className={btnPrimary}>
                <Plus className="w-4 h-4" aria-hidden="true" /> Nueva orden
              </Link>
            )}
            <Link href="/admin/vehiculos" className={btnSecondary}>
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Vehículos
            </Link>
          </div>
        }
      />

      <div className={`grid grid-cols-2 ${canSeeMoney ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3`}>
        {tiles.map((t) => (
          <section key={t.label} className={`${card} p-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t.label}
            </p>
            <p className="font-heading text-xl lg:text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {t.value}
            </p>
            {t.hint && <p className="text-[11px] text-slate-500 mt-0.5">{t.hint}</p>}
          </section>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start *:min-w-0">
        <div className="lg:col-span-2 space-y-5">
          {/* Órdenes de esta placa */}
          <section className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between gap-3 p-5 pb-3">
              <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
                ÓRDENES
              </h2>
              <Link
                href={`/admin/ordenes/historial?q=${encodeURIComponent(vehicle.plate)}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-sm-red hover:text-sm-red-hover"
              >
                <History className="w-4 h-4" aria-hidden="true" /> Historial
              </Link>
            </div>
            {orders.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-slate-500">
                Este vehículo todavía no tiene órdenes.{" "}
                <Link
                  href={`/admin/ordenes/nueva?vehiculo=${vehicle.id}`}
                  className="text-sm-red font-medium hover:text-sm-red-hover"
                >
                  Crear la primera
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {orders.map((o) => {
                  const cerrada = o.status === "entregado" || o.status === "cancelado";
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/admin/ordenes/${o.id}`}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-700">{o.folio}</span>
                            <StatusBadge status={o.status} />
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {o.description || "Sin descripción"}
                          </p>
                          <p className="text-xs text-slate-500">
                            Ingresó {formatDateShort(o.created_at)}
                            {cerrada ? ` · cerró ${formatDateShort(o.closed_day)}` : ""}
                            {o.modality === "domicilio" ? " · a domicilio" : ""}
                          </p>
                        </div>
                        {canSeeMoney && (
                          <p className="text-sm font-semibold text-slate-800 tabular-nums shrink-0">
                            {formatMoney(o.total)}
                          </p>
                        )}
                        <ChevronRight
                          className="w-4 h-4 text-slate-300 group-hover:text-sm-red shrink-0"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {orders.length === 100 && (
              <p className="px-5 pb-4 text-[11px] text-slate-500">
                Se muestran las 100 más recientes. El resto está en el historial.
              </p>
            )}
          </section>

          {/* Servicios hechos */}
          <section className={`${card} overflow-hidden`}>
            <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide p-5 pb-3">
              SERVICIOS HECHOS
            </h2>
            {itemList(
              servicios,
              <Wrench className="w-4 h-4" aria-hidden="true" />,
              "Sin servicios registrados en sus órdenes."
            )}
          </section>

          {/* Repuestos puestos */}
          <section className={`${card} overflow-hidden`}>
            <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide p-5 pb-3">
              REPUESTOS PUESTOS
            </h2>
            {itemList(
              repuestos,
              <Package className="w-4 h-4" aria-hidden="true" />,
              "Sin repuestos registrados en sus órdenes."
            )}
            {repuestos.length > 0 && (
              <p className="px-5 pb-4 text-[11px] text-slate-500">
                La fecha sirve para la garantía: es el ingreso de la orden en que se puso.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-5">
          {/* Dueño */}
          <section className={`${card} p-5`}>
            <h2 className="font-heading font-semibold text-slate-800 tracking-wide">DUEÑO</h2>
            <Link
              href={`/admin/clientes/${vehicle.client_id}`}
              className="mt-2 flex items-center gap-2 text-sm font-medium text-sm-red hover:text-sm-red-hover"
            >
              {vehicle.client}
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            {vehicle.phone && <p className="text-sm text-slate-600 mt-1">{vehicle.phone}</p>}
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener" className={`${btnSecondary} mt-3 w-full`}>
                <MessageCircle className="w-4 h-4" aria-hidden="true" /> WhatsApp
              </a>
            )}
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Placa</dt>
                <dd>
                  <PlateBadge plate={vehicle.plate} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Tipo</dt>
                <dd className="flex items-center gap-1.5 text-slate-700">
                  <VehicleTypeIcon type={vehicle.type} className="w-4 h-4" />
                  {VEHICLE_TYPES[vehicle.type] ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Registrado</dt>
                <dd className="text-slate-700">{formatDateShort(vehicle.created_at)}</dd>
              </div>
            </dl>
            {vehicle.notes && (
              <p className="mt-3 text-sm text-slate-600 whitespace-pre-wrap border-t border-slate-100 pt-3">
                {vehicle.notes}
              </p>
            )}
            <p className="mt-3 text-[11px] text-slate-500">
              Los datos del vehículo se editan desde la ficha del cliente.
            </p>
          </section>

          {/* Recordatorios abiertos */}
          <section className={`${card} p-5`}>
            <h2 className="font-heading font-semibold text-slate-800 tracking-wide">
              RECORDATORIOS
            </h2>
            {reminders.length === 0 ? (
              <p className="text-sm text-slate-500 mt-2">
                Sin recordatorios abiertos para esta placa.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {reminders.map((r) => {
                  const d = daysUntil(r.due_date);
                  const when =
                    d < 0 ? `vencido hace ${Math.abs(d)} d` : d === 0 ? "es hoy" : `en ${d} d`;
                  return (
                    <li key={r.id} className="flex items-start gap-2.5">
                      <Bell
                        className={`w-4 h-4 shrink-0 mt-0.5 ${d < 0 ? "text-sm-red" : "text-slate-400"}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700">{r.reason}</p>
                        <p className="text-xs text-slate-500">
                          {formatDay(r.due_date)} ·{" "}
                          <span className={d < 0 ? "text-sm-red font-semibold" : ""}>{when}</span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link href="/admin/recordatorios" className={`${btnSecondary} mt-3 w-full`}>
              Ver recordatorios
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
