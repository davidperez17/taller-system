"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { createQuoteAction } from "@/app/admin/actions";
import { card, btnPrimary, inputCls, labelCls } from "@/components/admin/ui";
import { VEHICLE_TYPES } from "@/lib/status";

type Vehicle = { id: number; plate: string; brand: string | null; model: string | null; client: string };
type Client = { id: number; name: string };

// Alta de presupuesto pre-orden: mismo patrón de vehículo/cliente que
// NewOrderForm, pero aquí NO se crea nada en el CRM — el presupuesto guarda un
// snapshot y el cliente/vehículo se materializan si el cliente aprueba.
export default function NewQuoteForm({
  vehicles,
  clients,
  preselect,
}: {
  vehicles: Vehicle[];
  clients: Client[];
  preselect: string;
}) {
  const [state, formAction, pending] = useActionState(createQuoteAction, null);
  const [vehicleId, setVehicleId] = useState(preselect);
  const [clientId, setClientId] = useState("");
  const newVehicle = !vehicleId;
  const needClientName = newVehicle && !clientId;

  return (
    <form action={formAction} className={`${card} p-5 space-y-5`}>
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
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className={inputCls}
          >
            <option value="">— Vehículo nuevo (solo se anota, no se registra) —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate} · {[v.brand, v.model].filter(Boolean).join(" ")} · {v.client}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Si eliges uno aquí, se ignoran los campos de vehículo nuevo.
          </p>
        </div>

        {newVehicle && (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 space-y-4">
            <p className="text-sm font-medium text-slate-600">Datos del vehículo</p>
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
                  required
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
                <select
                  id="client_id"
                  name="client_id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className={inputCls}
                >
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
                  Nombre del cliente {needClientName && "*"}
                </label>
                <input
                  id="new_client_name"
                  name="new_client_name"
                  required={needClientName}
                  className={inputCls}
                />
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
                <p className="text-xs text-slate-500 mt-1">
                  Con teléfono podrás enviarle el presupuesto por WhatsApp.
                </p>
              </div>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-heading font-semibold text-slate-800 tracking-wide">
          TRABAJO A COTIZAR
        </legend>
        <div>
          <label htmlFor="description" className={labelCls}>
            Descripción del trabajo *
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={3}
            placeholder="Ej. Cambio de frenos delanteros y revisión de suspensión."
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="valid_until" className={labelCls}>
              Vigente hasta (opcional)
            </label>
            <input id="valid_until" name="valid_until" type="date" className={inputCls} />
            <p className="text-xs text-slate-500 mt-1">
              Pasada la fecha, el cliente ya no puede aprobarlo en línea.
            </p>
          </div>
          <div>
            <label htmlFor="notes" className={labelCls}>
              Notas internas (opcional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder="Solo las ve el equipo."
              className={inputCls}
            />
          </div>
        </div>
      </fieldset>

      {state?.error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2"
        >
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${btnPrimary} w-full py-3`}>
        {pending && <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />}
        {pending ? "Creando…" : "Crear presupuesto"}
      </button>
      <p className="text-xs text-slate-500 -mt-2">
        Los conceptos y precios se agregan en el siguiente paso.
      </p>
    </form>
  );
}
