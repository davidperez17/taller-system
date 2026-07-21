import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search, ChevronRight, FileText } from "lucide-react";
import { many, normalizePlate } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { FOLLOWUP_DUE_SQL } from "@/lib/quotes";
import { quoteTotalSql } from "@/lib/totals";
import { QUOTE_STATUS_META, formatMoney, formatDate, type QuoteStatus } from "@/lib/status";
import { PageTitle, PlateBadge, VehicleTypeIcon, card, btnPrimary, inputCls } from "@/components/admin/ui";
import QuoteStatusChip, { ExpiredChip, FollowupChip } from "@/components/admin/QuoteStatusChip";

export const dynamic = "force-dynamic";
export const metadata = { title: "Presupuestos" };

// "sin_respuesta" no es un estado sino un filtro derivado (enviadas hace más de
// un día que el cliente no contestó). Va segundo porque es el destino del badge
// del menú y del aviso del cron: la lista de "a quién hay que llamar hoy".
const SIN_RESPUESTA = "sin_respuesta";
const FILTERS: { key: string; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: SIN_RESPUESTA, label: "Sin respuesta" },
  ...Object.entries(QUOTE_STATUS_META).map(([key, m]) => ({ key, label: m.label + "s" })),
];

// Historial permanente de cotizaciones pre-orden: pendientes, aprobadas (con la
// orden que generaron), rechazadas y canceladas. Nada se borra.
export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (user.role === "mecanico") redirect("/admin");

  const { estado = "todos", q = "" } = await searchParams;

  let where = "1=1";
  const args: (string | number)[] = [];
  if (estado === SIN_RESPUESTA) {
    where += ` AND ${FOLLOWUP_DUE_SQL}`;
  } else if (QUOTE_STATUS_META[estado as QuoteStatus]) {
    where += " AND q.status = ?";
    args.push(estado);
  }
  if (q.trim()) {
    where += " AND (q.plate LIKE ? OR COALESCE(c.name, q.client_name) ILIKE ? OR q.folio LIKE ?)";
    args.push(`%${normalizePlate(q)}%`, `%${q.trim()}%`, `%${q.trim().toUpperCase()}%`);
  }

  const quotes = await many<{
    id: number; folio: string; status: QuoteStatus; plate: string; vehicle_type: string;
    vehicle_brand: string | null; vehicle_model: string | null; description: string;
    valid_until: string | null; created_at: string; decision_total: number | null;
    order_id: number | null; order_folio: string | null; client: string | null;
    total: number; expired: boolean; followup_due: boolean;
  }>(
    `SELECT q.id, q.folio, q.status, q.plate, q.vehicle_type, q.vehicle_brand,
            q.vehicle_model, q.description, q.valid_until, q.created_at,
            q.decision_total, q.order_id,
            o.folio AS order_folio,
            COALESCE(c.name, q.client_name) AS client,
            ${quoteTotalSql("q")} AS total,
            (q.valid_until IS NOT NULL AND q.status = 'pendiente'
              AND q.valid_until < to_char(now(),'YYYY-MM-DD')) AS expired,
            ${FOLLOWUP_DUE_SQL} AS followup_due
       FROM quotes q
       LEFT JOIN clients c ON c.id = q.client_id
       LEFT JOIN orders o ON o.id = q.order_id
      WHERE ${where}
      ORDER BY q.created_at DESC, q.id DESC LIMIT 200`,
    args
  );

  return (
    <div className="space-y-5">
      <PageTitle
        title="PRESUPUESTOS"
        subtitle={`${quotes.length} presupuesto${quotes.length === 1 ? "" : "s"}`}
        action={
          <Link href="/admin/presupuestos/nuevo" className={btnPrimary}>
            <Plus className="w-4 h-4" aria-hidden="true" /> Nuevo presupuesto
          </Link>
        }
      />

      <form className="flex gap-2" action="/admin/presupuestos" method="GET">
        <input type="hidden" name="estado" value={estado} />
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por placa, cliente o folio…"
            aria-label="Buscar presupuestos"
            className={`${inputCls} pl-10`}
          />
        </div>
        <button type="submit" className={btnPrimary}>
          Buscar
        </button>
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/presupuestos?estado=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            aria-current={estado === f.key ? "page" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              estado === f.key
                ? "bg-sm-red text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <section className={`${card} overflow-hidden`}>
        {quotes.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
            <p className="mt-2 text-sm text-slate-500">
              {estado === "todos" && !q
                ? "Aún no hay presupuestos. Crea el primero para cotizarle a un cliente sin abrir una orden."
                : estado === SIN_RESPUESTA && !q
                  ? "Ninguna cotización lleva más de un día esperando respuesta. Todo al día."
                  : "No se encontraron presupuestos con estos filtros."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {quotes.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/presupuestos/${p.id}`}
                  className="flex items-center gap-3 px-4 lg:px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                >
                  <span className="text-slate-500 shrink-0">
                    <VehicleTypeIcon type={p.vehicle_type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <PlateBadge plate={p.plate} />
                      <span className="text-sm font-medium text-slate-700 truncate">
                        {[p.vehicle_brand, p.vehicle_model].filter(Boolean).join(" ") || "—"}
                      </span>
                      {p.expired && <ExpiredChip />}
                      {p.followup_due && <FollowupChip />}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {p.folio}
                      {p.client ? ` · ${p.client}` : ""} · {formatDate(p.created_at)}
                      {p.order_folio ? ` · Orden ${p.order_folio}` : ""}
                    </p>
                  </div>
                  <span className="hidden sm:block text-sm font-semibold tabular-nums text-slate-700 shrink-0">
                    {formatMoney(p.status === "pendiente" ? p.total : (p.decision_total ?? p.total))}
                  </span>
                  <QuoteStatusChip status={p.status} />
                  <ChevronRight
                    className="w-4 h-4 text-slate-300 group-hover:text-sm-red shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
