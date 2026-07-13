import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, ChevronRight, MessageCircle } from "lucide-react";
import { one, many } from "@/lib/db";
import { waLink } from "@/lib/whatsapp";
import brand from "@/lib/brand.json";
import {
  updateClientAction, createVehicleAction, deleteClientAction, deleteVehicleAction,
} from "@/app/admin/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { getSessionUser } from "@/lib/auth";
import { formatDate } from "@/lib/status";
import { VEHICLE_TYPES } from "@/lib/status";
import {
  StatusBadge, PlateBadge, VehicleTypeIcon, PageTitle, card, btnPrimary, btnSecondary, inputCls, labelCls,
} from "@/components/admin/ui";
import ConfirmSubmitButton from "@/components/admin/ConfirmSubmitButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cliente" };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await one<
    { id: number; name: string; phone: string | null; email: string | null; address: string | null; notes: string | null; created_at: string }
  >("SELECT * FROM clients WHERE id = ?", [Number(id)]);
  if (!client) notFound();

  const me = await getSessionUser();
  const vehicles = await many<{
    id: number; plate: string; type: string; brand: string | null; model: string | null;
    year: string | null; color: string | null; active_orders: number;
  }>(
    `SELECT v.*,
            (SELECT COUNT(*) FROM orders o
              WHERE o.vehicle_id = v.id AND o.status NOT IN ('entregado','cancelado'))::int AS active_orders
       FROM vehicles v WHERE v.client_id = ? ORDER BY v.created_at DESC`,
    [client.id]
  );

  const orders = await many<{
    id: number; folio: string; status: string; description: string; updated_at: string;
    plate: string; type: string;
  }>(
    `SELECT o.id, o.folio, o.status, o.description, o.updated_at, v.plate, v.type
       FROM orders o JOIN vehicles v ON v.id = o.vehicle_id
       WHERE v.client_id = ? ORDER BY o.created_at DESC LIMIT 50`,
    [client.id]
  );

  return (
    <div className="space-y-5">
      <PageTitle
        title={client.name.toUpperCase()}
        subtitle={`Cliente desde ${formatDate(client.created_at)}`}
        action={
          <div className="flex items-center gap-2">
            {client.phone &&
              waLink(client.phone, `Hola ${client.name.split(" ")[0]}, le saludamos de ${brand.name}.`) && (
                <a
                  href={
                    waLink(
                      client.phone,
                      `Hola ${client.name.split(" ")[0]}, le saludamos de ${brand.name}.`
                    )!
                  }
                  target="_blank"
                  rel="noopener"
                  className={btnSecondary}
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" /> WhatsApp
                </a>
              )}
            <Link href="/admin/clientes" className={btnSecondary}>
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Clientes
            </Link>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5 items-start *:min-w-0">
        <div className="lg:col-span-2 space-y-5">
          {/* Vehículos */}
          <section className={`${card} p-5`}>
            <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
              VEHÍCULOS
            </h2>
            {vehicles.length === 0 ? (
              <p className="text-sm text-slate-400 mt-2">Este cliente aún no tiene vehículos.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {vehicles.map((v) => (
                  <li key={v.id} className="py-3 flex items-center gap-3">
                    <span className="text-slate-400 shrink-0">
                      <VehicleTypeIcon type={v.type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <PlateBadge plate={v.plate} />
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {[v.brand, v.model, v.year, v.color].filter(Boolean).join(" ") || "Sin datos"}
                      </p>
                    </div>
                    <Link
                      href={`/admin/ordenes/nueva?vehiculo=${v.id}`}
                      className={btnSecondary}
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" /> Orden
                    </Link>
                    {me?.role === "admin" &&
                      (v.active_orders > 0 ? (
                        <span className="text-[11px] font-medium text-slate-400 shrink-0">
                          En taller
                        </span>
                      ) : (
                        <form action={deleteVehicleAction} className="shrink-0">
                          <input type="hidden" name="id" value={v.id} />
                          <input type="hidden" name="client_id" value={client.id} />
                          <ConfirmSubmitButton
                            ariaLabel={`Quitar ${v.plate} y todo su historial`}
                            className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                            confirmTitle={`¿Quitar ${v.plate}?`}
                            confirmMessage="Se borran también sus órdenes, historial y pagos. No se puede deshacer."
                            confirmLabel="Quitar"
                          >
                            Quitar
                          </ConfirmSubmitButton>
                        </form>
                      ))}
                  </li>
                ))}
              </ul>
            )}
            {me?.role === "admin" && vehicles.length > 0 && (
              <p className="mt-2 text-[11px] text-slate-400">
                Quitar un vehículo borra también sus órdenes, historial y pagos. Si está en el
                taller, primero cancela o entrega su orden.
              </p>
            )}

            <details className="mt-4">
              <summary className="text-sm font-medium text-sm-red cursor-pointer">
                Agregar vehículo
              </summary>
              <form action={createVehicleAction} className="mt-3 grid grid-cols-2 gap-3">
                <input type="hidden" name="client_id" value={client.id} />
                <div>
                  <label htmlFor="v-plate" className={labelCls}>
                    Placa *
                  </label>
                  <input
                    id="v-plate"
                    name="plate"
                    required
                    autoCapitalize="characters"
                    className={`${inputCls} plate-badge uppercase`}
                  />
                </div>
                <div>
                  <label htmlFor="v-type" className={labelCls}>
                    Tipo
                  </label>
                  <select id="v-type" name="type" className={inputCls}>
                    {Object.entries(VEHICLE_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="v-brand" className={labelCls}>
                    Marca
                  </label>
                  <input id="v-brand" name="brand" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="v-model" className={labelCls}>
                    Modelo
                  </label>
                  <input id="v-model" name="model" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="v-year" className={labelCls}>
                    Año
                  </label>
                  <input id="v-year" name="year" inputMode="numeric" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="v-color" className={labelCls}>
                    Color
                  </label>
                  <input id="v-color" name="color" className={inputCls} />
                </div>
                <SubmitButton className={`${btnPrimary} col-span-2`} pendingText="Guardando…">
                  Guardar vehículo
                </SubmitButton>
              </form>
            </details>
          </section>

          {/* Historial de órdenes */}
          <section className={`${card} overflow-hidden`}>
            <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide p-5 pb-3">
              HISTORIAL DE SERVICIOS
            </h2>
            {orders.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-slate-400">Sin órdenes registradas.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/admin/ordenes/${o.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group"
                    >
                      <span className="text-slate-400 shrink-0">
                        <VehicleTypeIcon type={o.type} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {o.folio} · {o.plate}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {o.description || "Sin descripción"} · {formatDate(o.updated_at)}
                        </p>
                      </div>
                      <StatusBadge status={o.status} />
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

        {/* Datos del cliente */}
        <section className={`${card} p-5`}>
          <h2 className="font-heading font-semibold text-slate-800 tracking-wide">DATOS</h2>
          <form action={updateClientAction} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={client.id} />
            <div>
              <label htmlFor="e-name" className={labelCls}>
                Nombre *
              </label>
              <input id="e-name" name="name" required defaultValue={client.name} className={inputCls} />
            </div>
            <div>
              <label htmlFor="e-phone" className={labelCls}>
                Teléfono
              </label>
              <input
                id="e-phone"
                name="phone"
                type="tel"
                defaultValue={client.phone ?? ""}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="e-email" className={labelCls}>
                Correo
              </label>
              <input
                id="e-email"
                name="email"
                type="email"
                defaultValue={client.email ?? ""}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="e-address" className={labelCls}>
                Dirección
              </label>
              <input id="e-address" name="address" defaultValue={client.address ?? ""} className={inputCls} />
            </div>
            <div>
              <label htmlFor="e-notes" className={labelCls}>
                Notas internas
              </label>
              <textarea id="e-notes" name="notes" rows={3} defaultValue={client.notes ?? ""} className={inputCls} />
            </div>
            <SubmitButton className={`${btnPrimary} w-full`} pendingText="Guardando…">
              Guardar cambios
            </SubmitButton>
          </form>
          <form action={deleteClientAction} className="mt-3">
            <input type="hidden" name="id" value={client.id} />
            <ConfirmSubmitButton
              className="w-full text-sm text-red-500 hover:text-red-600 font-medium py-2 cursor-pointer"
              confirmTitle={`¿Eliminar a ${client.name}?`}
              confirmMessage="Se eliminan el cliente y todos sus vehículos, órdenes, historial y pagos. No se puede deshacer."
              confirmLabel="Eliminar cliente"
            >
              Eliminar cliente y sus vehículos
            </ConfirmSubmitButton>
          </form>
        </section>
      </div>
    </div>
  );
}
