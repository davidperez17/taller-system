import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/lib/db";
import { createOrderAction } from "@/app/admin/actions";
import { PageTitle, card, btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/admin/ui";
import { VEHICLE_TYPES } from "@/lib/status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nueva orden" };

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ vehiculo?: string }>;
}) {
  const { vehiculo } = await searchParams;
  const db = getDb();
  const vehicles = db
    .prepare(
      `SELECT v.id, v.plate, v.brand, v.model, c.name AS client
       FROM vehicles v JOIN clients c ON c.id = v.client_id ORDER BY v.created_at DESC LIMIT 500`
    )
    .all() as { id: number; plate: string; brand: string | null; model: string | null; client: string }[];
  const clients = db
    .prepare("SELECT id, name FROM clients ORDER BY name LIMIT 1000")
    .all() as { id: number; name: string }[];

  return (
    <div className="space-y-5 max-w-2xl">
      <PageTitle
        title="NUEVA ORDEN DE TRABAJO"
        subtitle="Registra el ingreso de un vehículo al taller"
        action={
          <Link href="/admin/ordenes" className={btnSecondary}>
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver
          </Link>
        }
      />

      <form action={createOrderAction} className={`${card} p-5 space-y-5`}>
        <fieldset className="space-y-4">
          <legend className="font-heading font-semibold text-slate-800 tracking-wide">
            VEHÍCULO
          </legend>
          <div>
            <label htmlFor="vehicle_id" className={labelCls}>
              Vehículo ya registrado
            </label>
            <select
              id="vehicle_id"
              name="vehicle_id"
              defaultValue={vehiculo ?? ""}
              className={inputCls}
            >
              <option value="">— Registrar vehículo nuevo —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} · {[v.brand, v.model].filter(Boolean).join(" ")} · {v.client}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Si eliges uno aquí, se ignoran los campos de vehículo nuevo.
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 p-4 space-y-4">
            <p className="text-sm font-medium text-slate-600">Vehículo nuevo</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="new_plate" className={labelCls}>
                  Placa *
                </label>
                <input
                  id="new_plate"
                  name="new_plate"
                  placeholder="ABC1234"
                  autoCapitalize="characters"
                  className={`${inputCls} plate-badge uppercase`}
                />
              </div>
              <div>
                <label htmlFor="new_type" className={labelCls}>
                  Tipo
                </label>
                <select id="new_type" name="new_type" className={inputCls}>
                  {Object.entries(VEHICLE_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="new_brand" className={labelCls}>
                  Marca
                </label>
                <input id="new_brand" name="new_brand" className={inputCls} />
              </div>
              <div>
                <label htmlFor="new_model" className={labelCls}>
                  Modelo
                </label>
                <input id="new_model" name="new_model" className={inputCls} />
              </div>
              <div>
                <label htmlFor="new_year" className={labelCls}>
                  Año
                </label>
                <input id="new_year" name="new_year" inputMode="numeric" className={inputCls} />
              </div>
              <div>
                <label htmlFor="new_color" className={labelCls}>
                  Color
                </label>
                <input id="new_color" name="new_color" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="client_id" className={labelCls}>
                  Cliente existente
                </label>
                <select id="client_id" name="client_id" className={inputCls}>
                  <option value="">— Cliente nuevo —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="new_client_name" className={labelCls}>
                  Nombre del cliente nuevo
                </label>
                <input id="new_client_name" name="new_client_name" className={inputCls} />
              </div>
              <div>
                <label htmlFor="new_client_phone" className={labelCls}>
                  Teléfono
                </label>
                <input
                  id="new_client_phone"
                  name="new_client_phone"
                  type="tel"
                  inputMode="tel"
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-heading font-semibold text-slate-800 tracking-wide">
            TRABAJO SOLICITADO
          </legend>
          <div>
            <label htmlFor="description" className={labelCls}>
              Descripción del problema o servicio *
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={3}
              placeholder="Ej. No enciende, revisar sistema eléctrico y cambio de aceite."
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="km" className={labelCls}>
                Kilometraje
              </label>
              <input id="km" name="km" inputMode="numeric" className={inputCls} />
            </div>
            <div>
              <label htmlFor="fuel_level" className={labelCls}>
                Combustible
              </label>
              <select id="fuel_level" name="fuel_level" className={inputCls}>
                <option value="">—</option>
                <option>Vacío</option>
                <option>1/4</option>
                <option>1/2</option>
                <option>3/4</option>
                <option>Lleno</option>
              </select>
            </div>
            <div>
              <label htmlFor="estimated_delivery" className={labelCls}>
                Entrega estimada
              </label>
              <input id="estimated_delivery" name="estimated_delivery" type="date" className={inputCls} />
            </div>
          </div>
        </fieldset>

        <button type="submit" className={`${btnPrimary} w-full py-3`}>
          Registrar ingreso
        </button>
      </form>
    </div>
  );
}
