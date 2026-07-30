import Link from "next/link";
import { Search, ChevronRight, ChevronLeft, MapPin, ClipboardList } from "lucide-react";
import { many, one, normalizePlate } from "@/lib/db";
import { formatDateShort, formatMoney, CSAT_LEVELS, isCsatRating } from "@/lib/status";
import { getSessionUser } from "@/lib/auth";
import { ORDER_TOTALS_SQL } from "@/lib/totals";
import { resolveHistoryRange, CLOSED_DAY_SQL, ORDER_PAID_SQL } from "@/lib/history";
import CsatFace, { CSAT_TONE } from "@/components/CsatFace";
import {
  StatusBadge, PlateBadge, VehicleTypeIcon, PageTitle, card, btnSecondary, inputCls,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Historial de órdenes" };

// ─────────────────────────────────────────────────────────────────────────────
// Historial: el archivo de las órdenes que ya cerraron (entregadas y
// canceladas). La lista de /admin/ordenes está hecha para el trabajo del día
// —arranca en "Activas" y corta en 200 filas—, así que en un taller con años de
// operación lo viejo quedaba inalcanzable. Acá el período llega hasta "Todo", la
// lista pagina y los totales salen de un SUM sobre TODO el filtro (nunca de las
// filas de la página), para que el número de arriba no dependa de dónde vas.
//
// El dinero se le oculta al mecánico, mismo criterio que caja, presupuestos y el
// descuento de la orden.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

const ESTADOS: { key: string; label: string }[] = [
  { key: "cerradas", label: "Todas" },
  { key: "entregado", label: "Entregadas" },
  { key: "cancelado", label: "Canceladas" },
];

export default async function OrdersHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    estado?: string; q?: string; r?: string; desde?: string; hasta?: string; pagina?: string;
  }>;
}) {
  const sp = await searchParams;
  const { estado = "cerradas", q = "" } = sp;
  const range = resolveHistoryRange(sp);
  const me = await getSessionUser();
  const canSeeMoney = me?.role !== "mecanico";

  const closedDay = CLOSED_DAY_SQL("o");
  let where = "o.status IN ('entregado','cancelado')";
  const args: (string | number)[] = [];
  if (estado === "entregado" || estado === "cancelado") {
    where += " AND o.status = ?";
    args.push(estado);
  }
  if (range.desde) {
    where += ` AND ${closedDay} >= ?`;
    args.push(range.desde);
  }
  if (range.hasta) {
    where += ` AND ${closedDay} <= ?`;
    args.push(range.hasta);
  }
  if (q.trim()) {
    where += " AND (v.plate LIKE ? OR c.name LIKE ? OR o.folio LIKE ?)";
    const like = `%${q.trim()}%`;
    args.push(`%${normalizePlate(q)}%`, like, like);
  }

  const FROM = `FROM orders o
       JOIN vehicles v ON v.id = o.vehicle_id
       JOIN clients c ON c.id = v.client_id
       JOIN ${ORDER_TOTALS_SQL} t ON t.order_id = o.id
       LEFT JOIN ${ORDER_PAID_SQL} p ON p.order_id = o.id`;

  // Totales del filtro completo: las canceladas no facturan, así que el dinero
  // se cuenta solo sobre las entregadas (contarlas juntas inflaría el ticket).
  const agg = (await one<{
    n: number; entregadas: number; canceladas: number; facturado: number; saldo: number;
  }>(
    `SELECT COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE o.status = 'entregado')::int AS entregadas,
            COUNT(*) FILTER (WHERE o.status = 'cancelado')::int AS canceladas,
            COALESCE(SUM(t.total) FILTER (WHERE o.status = 'entregado'), 0)::float8 AS facturado,
            COALESCE(SUM(GREATEST(t.total - COALESCE(p.paid, 0), 0))
                     FILTER (WHERE o.status = 'entregado'), 0)::float8 AS saldo
       ${FROM}
      WHERE ${where}`,
    args
  ))!;

  const pages = Math.max(1, Math.ceil(agg.n / PAGE_SIZE));
  const pagina = Math.min(Math.max(1, Number(sp.pagina) || 1), pages);
  const offset = (pagina - 1) * PAGE_SIZE;

  const orders = await many<{
    id: number; folio: string; status: string; plate: string; type: string;
    brand: string | null; model: string | null; client: string; client_id: number;
    modality: string; closed_day: string; total: number; paid: number | null;
    rating: number | null;
  }>(
    `SELECT o.id, o.folio, o.status, v.plate, v.type, v.brand, v.model,
            c.name AS client, c.id AS client_id, o.modality,
            ${closedDay} AS closed_day, t.total, p.paid, f.rating
       ${FROM}
       LEFT JOIN order_feedback f ON f.order_id = o.id
      WHERE ${where}
      ORDER BY ${closedDay} DESC, o.id DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    args
  );

  // Los filtros y la paginación viven en la URL: cada combinación es un enlace
  // que se puede compartir o volver a abrir desde el historial del navegador.
  const hrefWith = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const estadoV = over.estado ?? estado;
    if (estadoV !== "cerradas") p.set("estado", String(estadoV));
    const qV = over.q ?? q;
    if (qV) p.set("q", String(qV));
    if ("r" in over || "desde" in over) {
      if (over.r) p.set("r", String(over.r));
      if (over.desde) p.set("desde", String(over.desde));
      if (over.hasta) p.set("hasta", String(over.hasta));
    } else if (range.custom) {
      p.set("desde", range.desde!);
      p.set("hasta", range.hasta!);
    } else if (range.presetKey && range.presetKey !== "todo") {
      p.set("r", range.presetKey);
    }
    const pag = over.pagina;
    if (pag && Number(pag) > 1) p.set("pagina", String(pag));
    const qs = p.toString();
    return `/admin/ordenes/historial${qs ? `?${qs}` : ""}`;
  };

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
      active ? "bg-sm-red text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
    }`;

  const tiles: { label: string; value: string; hint?: string }[] = [
    {
      label: "Órdenes cerradas",
      value: String(agg.n),
      hint: `${agg.entregadas} entregada${agg.entregadas === 1 ? "" : "s"} · ${agg.canceladas} cancelada${agg.canceladas === 1 ? "" : "s"}`,
    },
  ];
  if (canSeeMoney) {
    tiles.push(
      { label: "Facturado", value: formatMoney(agg.facturado), hint: "Solo entregadas, neto de descuentos" },
      {
        label: "Ticket promedio",
        value: formatMoney(agg.entregadas > 0 ? agg.facturado / agg.entregadas : 0),
        hint: "Facturado entre órdenes entregadas",
      },
      { label: "Saldo sin cobrar", value: formatMoney(agg.saldo), hint: "Entregadas con pago pendiente" }
    );
  }

  const desde = offset + 1;
  const hasta = offset + orders.length;

  return (
    <div className="space-y-5">
      <PageTitle
        title="HISTORIAL DE ÓRDENES"
        subtitle={
          agg.n === 0
            ? "Sin órdenes cerradas en este filtro"
            : `${agg.n} ${agg.n === 1 ? "orden cerrada" : "órdenes cerradas"} · página ${pagina} de ${pages}`
        }
        action={
          <Link href="/admin/ordenes" className={btnSecondary}>
            <ClipboardList className="w-4 h-4" aria-hidden="true" /> Órdenes activas
          </Link>
        }
      />

      <div className={`grid grid-cols-2 ${canSeeMoney ? "lg:grid-cols-4" : ""} gap-3`}>
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

      <form className="flex gap-2" action="/admin/ordenes/historial" method="GET">
        {estado !== "cerradas" && <input type="hidden" name="estado" value={estado} />}
        {range.custom ? (
          <>
            <input type="hidden" name="desde" value={range.desde!} />
            <input type="hidden" name="hasta" value={range.hasta!} />
          </>
        ) : (
          range.presetKey &&
          range.presetKey !== "todo" && <input type="hidden" name="r" value={range.presetKey} />
        )}
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por placa, cliente o folio…"
            aria-label="Buscar en el historial"
            className={`${inputCls} pl-10`}
          />
        </div>
        <button type="submit" className={btnSecondary}>
          Buscar
        </button>
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
        {ESTADOS.map((e) => (
          <Link
            key={e.key}
            href={hrefWith({ estado: e.key })}
            aria-current={estado === e.key ? "page" : undefined}
            className={chip(estado === e.key)}
          >
            {e.label}
          </Link>
        ))}
      </div>

      <section className={`${card} p-4 space-y-3`}>
        <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
          {Object.entries(range.presets).map(([k, p]) => (
            <Link
              key={k}
              href={hrefWith({ r: k === "todo" ? undefined : k })}
              aria-current={range.presetKey === k ? "page" : undefined}
              className={chip(range.presetKey === k)}
            >
              {p.label}
            </Link>
          ))}
          {range.custom && <span className={chip(true)}>Personalizado</span>}
        </div>
        <form method="GET" action="/admin/ordenes/historial" className="flex flex-wrap items-end gap-2">
          {estado !== "cerradas" && <input type="hidden" name="estado" value={estado} />}
          {q && <input type="hidden" name="q" value={q} />}
          <div>
            <label htmlFor="h-desde" className="block text-xs font-medium text-slate-500 mb-1">
              Desde
            </label>
            <input
              id="h-desde"
              name="desde"
              type="date"
              defaultValue={range.desde ?? ""}
              max={range.today}
              className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="h-hasta" className="block text-xs font-medium text-slate-500 mb-1">
              Hasta
            </label>
            <input
              id="h-hasta"
              name="hasta"
              type="date"
              defaultValue={range.hasta ?? range.today}
              max={range.today}
              className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <button type="submit" className={btnSecondary}>
            Aplicar
          </button>
        </form>
        <p className="text-[11px] text-slate-500">
          La fecha es la del cierre: la entrega en las entregadas, la última actualización en las
          canceladas.
        </p>
      </section>

      <section className={`${card} overflow-hidden`}>
        {orders.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">
              {q.trim()
                ? `Ninguna orden cerrada coincide con «${q.trim()}» en este período.`
                : "Todavía no hay órdenes cerradas en este período."}
            </p>
            <Link href={hrefWith({ estado: "cerradas", q: "", r: undefined })} className={`${btnSecondary} mt-3`}>
              Ver todo el historial
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {orders.map((o) => {
              const saldo = o.total - (o.paid ?? 0);
              const rating = isCsatRating(o.rating) ? o.rating : null;
              return (
                <li key={o.id}>
                  <Link
                    href={`/admin/ordenes/${o.id}`}
                    className="flex items-center gap-3 px-4 lg:px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                  >
                    <span className="text-slate-500 shrink-0">
                      <VehicleTypeIcon type={o.type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PlateBadge plate={o.plate} />
                        <StatusBadge status={o.status} />
                        {o.modality === "domicilio" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-sm-red/10 text-sm-red border border-sm-red/25 rounded-full px-1.5 py-0.5">
                            <MapPin className="w-2.5 h-2.5" aria-hidden="true" /> Domicilio
                          </span>
                        )}
                        {rating && (
                          <span
                            className={`grid place-items-center rounded-full w-5 h-5 shrink-0 ${CSAT_TONE[rating].disc} ${CSAT_TONE[rating].face}`}
                            title={`Calificó: ${CSAT_LEVELS[rating].label}`}
                          >
                            <CsatFace level={rating} className="w-3.5 h-3.5" />
                            <span className="sr-only">Calificó {CSAT_LEVELS[rating].label}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {o.folio} · {o.client}
                      </p>
                      {/* La fecha va primero: es el dato que se viene a buscar
                          acá, y en móvil la línea se recorta por la derecha. */}
                      <p className="text-xs text-slate-500 truncate">
                        {o.status === "entregado" ? "Entregada" : "Cancelada"}{" "}
                        {formatDateShort(o.closed_day)}
                        {[o.brand, o.model].filter(Boolean).join(" ")
                          ? ` · ${[o.brand, o.model].filter(Boolean).join(" ")}`
                          : ""}
                      </p>
                    </div>
                    {canSeeMoney && (
                      // En las canceladas el monto va apagado y rotulado: ese
                      // trabajo nunca se facturó y no cuenta en los totales de
                      // arriba, así que no puede verse igual que un cobro real.
                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm tabular-nums ${
                            o.status === "entregado"
                              ? "font-semibold text-slate-800"
                              : "text-slate-400"
                          }`}
                        >
                          {formatMoney(o.total)}
                        </p>
                        {o.status === "entregado" ? (
                          <p
                            className={`text-[11px] tabular-nums ${
                              saldo > 0.009 ? "text-sm-red font-semibold" : "text-slate-500"
                            }`}
                          >
                            {saldo > 0.009 ? `Debe ${formatMoney(saldo)}` : "Pagada"}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400">No facturada</p>
                        )}
                      </div>
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
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Paginación del historial">
          {pagina > 1 ? (
            <Link href={hrefWith({ pagina: pagina - 1 })} className={btnSecondary} rel="prev">
              <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Anteriores
            </Link>
          ) : (
            <span />
          )}
          <p className="text-xs text-slate-500 tabular-nums text-center">
            {desde}–{hasta} de {agg.n}
          </p>
          {pagina < pages ? (
            <Link href={hrefWith({ pagina: pagina + 1 })} className={btnSecondary} rel="next">
              Siguientes <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
