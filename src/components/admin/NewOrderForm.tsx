"use client";

import { useActionState, useState } from "react";
import { Loader2, Wrench, MapPin, LocateFixed } from "lucide-react";
import { createOrderAction } from "@/app/admin/actions";
import { card, btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/admin/ui";
import { VEHICLE_TYPES } from "@/lib/status";
import PhotoInput from "@/components/admin/PhotoInput";

type Vehicle = { id: number; plate: string; brand: string | null; model: string | null; client: string };
type Client = { id: number; name: string };

export default function NewOrderForm({
  vehicles,
  clients,
  preselect,
}: {
  vehicles: Vehicle[];
  clients: Client[];
  preselect: string;
}) {
  const [state, formAction, pending] = useActionState(createOrderAction, null);
  // Placa/cliente solo se exigen cuando se da de alta un vehículo nuevo:
  // si ya se eligió un vehículo registrado, esos campos se ignoran.
  const [vehicleId, setVehicleId] = useState(preselect);
  const [clientId, setClientId] = useState("");
  const [modality, setModality] = useState<"taller" | "domicilio">("taller");
  const [serviceLocation, setServiceLocation] = useState("");
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [geoMsg, setGeoMsg] = useState("");
  const newVehicle = !vehicleId;
  const needClientName = newVehicle && !clientId;

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("error");
      setGeoMsg("Este dispositivo no permite ubicación GPS. Escribe la dirección a mano.");
      return;
    }
    setGeoStatus("loading");
    setGeoMsg("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setServiceLocation(
          `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`
        );
        setGeoStatus("ok");
        setGeoMsg("Ubicación GPS capturada. Puedes ajustarla o agregar referencias.");
      },
      (err) => {
        setGeoStatus("error");
        setGeoMsg(
          err.code === err.PERMISSION_DENIED
            ? "Permiso de ubicación denegado. Actívalo o escribe la dirección a mano."
            : "No se pudo obtener la ubicación. Escribe la dirección a mano."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  const modalityOptions = [
    { value: "taller" as const, label: "En taller", icon: Wrench },
    { value: "domicilio" as const, label: "A domicilio", icon: MapPin },
  ];

  return (
    <form action={formAction} className={`${card} p-5 space-y-5`}>
      <fieldset className="space-y-3">
        <legend className="font-heading font-semibold text-slate-800 tracking-wide">
          MODALIDAD
        </legend>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-full sm:w-fit" role="radiogroup" aria-label="Modalidad del servicio">
          {modalityOptions.map((opt) => (
            <label
              key={opt.value}
              className={`flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${
                modality === opt.value
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <input
                type="radio"
                name="modality"
                value={opt.value}
                checked={modality === opt.value}
                onChange={() => setModality(opt.value)}
                className="sr-only"
              />
              <opt.icon className="w-4 h-4" aria-hidden="true" /> {opt.label}
            </label>
          ))}
        </div>
        {modality === "domicilio" && (
          <div>
            <label htmlFor="service_location" className={labelCls}>
              Ubicación de la visita
            </label>
            <input
              id="service_location"
              name="service_location"
              value={serviceLocation}
              onChange={(e) => {
                setServiceLocation(e.target.value);
                if (geoStatus !== "idle") {
                  setGeoStatus("idle");
                  setGeoMsg("");
                }
              }}
              placeholder="Ej. 4a calle 3-20, zona 1 · o km 15 carretera al sur"
              className={inputCls}
            />
            <div className="mt-2">
              <button
                type="button"
                onClick={useMyLocation}
                disabled={geoStatus === "loading"}
                className={`${btnSecondary} disabled:opacity-60`}
              >
                {geoStatus === "loading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <LocateFixed className="w-4 h-4" aria-hidden="true" />
                )}
                {geoStatus === "loading" ? "Ubicando…" : "Usar mi ubicación (GPS)"}
              </button>
              {geoMsg && (
                <p
                  className={`text-xs mt-1 ${
                    geoStatus === "error" ? "text-sm-red" : "text-emerald-600"
                  }`}
                >
                  {geoMsg}
                </p>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Dónde está el vehículo. Ayuda al técnico a ubicarse. El costo de ir se agrega
              después como un concepto en el presupuesto.
            </p>
          </div>
        )}
      </fieldset>

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

        {newVehicle && (
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
                  Nombre del cliente nuevo {needClientName && "*"}
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
              </div>
            </div>
          </div>
        )}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="estimated_delivery" className={labelCls}>
              Entrega estimada
            </label>
            <input id="estimated_delivery" name="estimated_delivery" type="date" className={inputCls} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-heading font-semibold text-slate-800 tracking-wide">
          RECEPCIÓN DEL VEHÍCULO
        </legend>
        <div>
          <label htmlFor="reception_notes" className={labelCls}>
            Estado al ingreso (opcional)
          </label>
          <textarea
            id="reception_notes"
            name="reception_notes"
            rows={2}
            placeholder="Ej. Rayón en puerta derecha, retrovisor flojo. Deja llaves y tarjeta de circulación."
            className={inputCls}
          />
          <p className="text-xs text-slate-400 mt-1">
            Golpes, rayones y pertenencias. Con fotos queda respaldo ante reclamos; el cliente
            lo ve en su línea de tiempo y sale en la orden impresa.
          </p>
        </div>
        <PhotoInput />
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
        {pending ? "Registrando…" : "Registrar ingreso"}
      </button>
    </form>
  );
}
