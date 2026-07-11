import Link from "next/link";
import { Plus, Search, ChevronRight } from "lucide-react";
import { many, normalizePlate } from "@/lib/db";
import { STATUS_META, formatDate, type OrderStatus } from "@/lib/status";
import { StatusBadge, PlateBadge, VehicleTypeIcon, PageTitle, card, btnPrimary, inputCls } from "@/components/admin/ui";
import CancelOrderButton from "@/components/admin/CancelOrderButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Órdenes" };

const FILTERS: { key: string; label: string }[] = [
  { key: "activas", label: "Activas" },
  { key: "todas", label: "Todas" },
  ...Object.entries(STATUS_META).map(([key, m]) => ({ key, label: m.label })),
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const { estado = "activas", q = "" } = await searchParams;

  let where = "1=1";
  const args: (string | number)[] = [];
  if (estado === "activas") {
    where += " AND o.status NOT IN ('entregado','cancelado')";
  } else if (estado !== "todas" && STATUS_META[estado as OrderStatus]) {
    where += " AND o.status = ?";
    args.push(estado);
  }
  if (q.trim()) {
    where += " AND (v.plate LIKE ? OR c.name LIKE ? OR o.folio LIKE ?)";
    const plateLike = `%${normalizePlate(q)}%`;
    const like = `%${q.trim()}%`;
    args.push(plateLike, like, like);
  }

  const orders = await many<{
    id: number; folio: string; status: string; description: string; updated_at: string;
    created_at: string; plate: string; type: string; brand: string | null;
    model: string | null; client: string;
  }>(
    `SELECT o.id, o.folio, o.status, o.description, o.updated_at, o.created_at,
              v.plate, v.type, v.brand, v.model, c.name AS client
       FROM orders o
       JOIN vehicles v ON v.id = o.vehicle_id
       JOIN clients c ON c.id = v.client_id
       WHERE ${where}
       ORDER BY o.updated_at DESC LIMIT 200`,
    args
  );

  return (
    <div className="space-y-5">
      <PageTitle
        title="ÓRDENES DE TRABAJO"
        subtitle={`${orders.length} orden${orders.length === 1 ? "" : "es"}`}
        action={
          <Link href="/admin/ordenes/nueva" className={btnPrimary}>
            <Plus className="w-4 h-4" aria-hidden="true" /> Nueva orden
          </Link>
        }
      />

      <form className="flex gap-2" action="/admin/ordenes" method="GET">
        <input type="hidden" name="estado" value={estado} />
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por placa, cliente o folio…"
            aria-label="Buscar órdenes"
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
            href={`/admin/ordenes?estado=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            aria-current={estado === f.key ? "page" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              estado === f.key
                ? "bg-primary-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <section className={`${card} overflow-hidden`}>
        {orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            No se encontraron órdenes con estos filtros.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center">
                <Link
                  href={`/admin/ordenes/${o.id}`}
                  className="flex items-center gap-3 pl-4 lg:pl-5 pr-2 py-3.5 hover:bg-slate-50 transition-colors group flex-1 min-w-0"
                >
                  <span className="text-slate-400 shrink-0">
                    <VehicleTypeIcon type={o.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <PlateBadge plate={o.plate} />
                      <span className="text-sm font-medium text-slate-700 truncate">
                        {[o.brand, o.model].filter(Boolean).join(" ") || "—"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {o.folio} · {o.client} · Actualizada {formatDate(o.updated_at)}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                  <ChevronRight
                    className="w-4 h-4 text-slate-300 group-hover:text-primary-600 shrink-0"
                    aria-hidden="true"
                  />
                </Link>
                {o.status !== "cancelado" && o.status !== "entregado" && (
                  <CancelOrderButton orderId={o.id} label={`${o.plate} · ${o.folio}`} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
