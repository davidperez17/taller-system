import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { many, normalizePlate } from "@/lib/db";
import { PageTitle, card, btnPrimary, btnSecondary, inputCls, PlateBadge, VehicleTypeIcon, StatusBadge } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vehículos" };

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const plateLike = `%${normalizePlate(q)}%`;
  const like = `%${q.trim()}%`;

  const vehicles = await many<{
    id: number; plate: string; type: string; brand: string | null; model: string | null;
    year: string | null; color: string | null; client_id: number; client: string;
    active_status: string | null; active_order_id: number | null;
  }>(
    `SELECT v.id, v.plate, v.type, v.brand, v.model, v.year, v.color,
              c.id AS client_id, c.name AS client,
              (SELECT o.status FROM orders o WHERE o.vehicle_id = v.id
                AND o.status NOT IN ('entregado','cancelado')
                ORDER BY o.created_at DESC LIMIT 1) AS active_status,
              (SELECT o.id FROM orders o WHERE o.vehicle_id = v.id
                AND o.status NOT IN ('entregado','cancelado')
                ORDER BY o.created_at DESC LIMIT 1) AS active_order_id
       FROM vehicles v JOIN clients c ON c.id = v.client_id
       WHERE v.plate LIKE ? OR v.brand LIKE ? OR v.model LIKE ? OR c.name LIKE ?
       ORDER BY v.created_at DESC LIMIT 300`,
    [plateLike, like, like, like]
  );

  return (
    <div className="space-y-5">
      <PageTitle title="VEHÍCULOS" subtitle={`${vehicles.length} registrados`} />

      <form className="flex gap-2" action="/admin/vehiculos" method="GET">
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por placa, marca, modelo o cliente…"
            aria-label="Buscar vehículos"
            className={`${inputCls} pl-10`}
          />
        </div>
        <button type="submit" className={btnPrimary}>
          Buscar
        </button>
      </form>

      <section className={`${card} overflow-hidden`}>
        {vehicles.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Sin resultados. Los vehículos se registran desde la ficha del cliente o al crear una
            orden nueva.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {vehicles.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-4 lg:px-5 py-3.5">
                <span className="text-slate-500 shrink-0">
                  <VehicleTypeIcon type={v.type} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PlateBadge plate={v.plate} />
                    {v.active_status && <StatusBadge status={v.active_status} />}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {[v.brand, v.model, v.year, v.color].filter(Boolean).join(" ") || "Sin datos"} ·{" "}
                    <Link
                      href={`/admin/clientes/${v.client_id}`}
                      className="text-sm-red hover:text-sm-red-hover"
                    >
                      {v.client}
                    </Link>
                  </p>
                </div>
                {v.active_order_id ? (
                  <Link href={`/admin/ordenes/${v.active_order_id}`} className={btnSecondary}>
                    Ver orden
                  </Link>
                ) : (
                  <Link href={`/admin/ordenes/nueva?vehiculo=${v.id}`} className={btnSecondary}>
                    <Plus className="w-4 h-4" aria-hidden="true" /> Orden
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
