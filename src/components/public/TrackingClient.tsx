"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Bell, BellRing, BookmarkPlus, BookmarkCheck, Car, Bike, Truck,
  CheckCircle2, Circle, CircleDot, HelpCircle, KeyRound, MessageSquareText,
  RefreshCw, SearchX, Wrench, CalendarClock, Receipt, History, LockKeyhole,
} from "lucide-react";
import { STATUS_FLOW, STATUS_META, type OrderStatus, formatMoney, formatDate, formatDateShort } from "@/lib/status";
import type { TrackingResult } from "@/lib/tracking";
import { subscribeToPush, saveVehicle, getSavedVehicles, registerSW } from "./pwa";

const VEHICLE_ICON: Record<string, typeof Car> = { auto: Car, moto: Bike, camion: Truck, otro: Wrench };

export default function TrackingClient({
  initial,
  initialCode,
}: {
  initial: TrackingResult;
  initialCode: string;
}) {
  const [data, setData] = useState<TrackingResult>(initial);
  const [code, setCode] = useState(initialCode);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [live, setLive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notifState, setNotifState] = useState<"idle" | "loading" | "on" | "denied">("idle");
  const [savedLocal, setSavedLocal] = useState(false);
  const codeRef = useRef(code);
  codeRef.current = code;

  const refresh = useCallback(
    async (withCode?: string) => {
      setRefreshing(true);
      try {
        const c = withCode !== undefined ? withCode : codeRef.current;
        const res = await fetch(
          `/api/public/track/${data.plate}${c ? `?code=${encodeURIComponent(c)}` : ""}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const json = (await res.json()) as TrackingResult;
          setData(json);
          return json;
        }
      } catch {
        /* sin conexión: se mantienen los datos actuales */
      } finally {
        setRefreshing(false);
      }
      return null;
    },
    [data.plate]
  );

  // Conexión en vivo (SSE) + respaldo por sondeo
  useEffect(() => {
    if (!initial.found) return;
    registerSW();
    setSavedLocal(getSavedVehicles().some((v) => v.plate === data.plate));
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setNotifState("on");
    }

    const es = new EventSource(`/api/public/events/${data.plate}`);
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "update") refresh();
      } catch {
        /* mensaje no JSON */
      }
    };
    const poll = setInterval(() => refresh(), 45000);
    return () => {
      es.close();
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.plate, initial.found]);

  async function unlockDetail(e: React.FormEvent) {
    e.preventDefault();
    setCodeError("");
    const c = codeInput.trim().toUpperCase();
    if (!c) return;
    const json = await refresh(c);
    if (json?.detailed) {
      setCode(c);
      if (getSavedVehicles().some((v) => v.plate === data.plate)) {
        saveVehicle({ plate: data.plate, label: vehicleLabel(json), code: c });
      }
    } else {
      setCodeError("Código incorrecto. Revisa el código impreso en tu orden de servicio.");
    }
  }

  async function enableNotifications() {
    setNotifState("loading");
    const ok = await subscribeToPush(data.plate);
    setNotifState(ok ? "on" : "denied");
  }

  function handleSave() {
    saveVehicle({ plate: data.plate, label: vehicleLabel(data), code: code || undefined });
    setSavedLocal(true);
  }

  /* ---------- Placa no encontrada ---------- */
  if (!data.found) {
    return (
      <Shell plate={data.plate}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center animate-slide-up">
          <SearchX className="w-12 h-12 text-slate-300 mx-auto" aria-hidden="true" />
          <h1 className="font-heading text-2xl font-bold text-slate-800 mt-4 tracking-wide">
            NO ENCONTRAMOS LA PLACA {data.plate}
          </h1>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto">
            Verifica que esté bien escrita. Si tu vehículo acaba de ingresar al taller,
            espera unos minutos a que lo registremos.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-5 py-2.5 font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Buscar otra placa
          </Link>
        </div>
      </Shell>
    );
  }

  const order = data.order!;
  const meta = STATUS_META[order.status] ?? STATUS_META.recibido;
  const VehicleIcon = VEHICLE_ICON[data.vehicle?.type ?? "auto"] ?? Car;
  const finished = order.status === "entregado" || order.status === "cancelado";

  return (
    <Shell plate={data.plate} live={live} refreshing={refreshing} onRefresh={() => refresh()}>
      {/* Tarjeta vehículo + estado actual */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-slide-up">
        <div className="p-5 flex items-start gap-4">
          <div className="bg-blue-50 text-blue-700 rounded-2xl p-3 shrink-0" aria-hidden="true">
            <VehicleIcon className="w-8 h-8" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="plate-badge inline-block bg-slate-100 border border-slate-300 rounded-lg px-3 py-1 text-slate-800">
              {data.plate}
            </span>
            <p className="text-slate-700 font-medium mt-1.5 truncate">{vehicleLabel(data)}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Orden {order.folio} · Ingresó el {formatDateShort(order.created_at)}
            </p>
          </div>
        </div>

        <div className={`px-5 py-4 border-t ${statusTone(meta.color)}`}>
          <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Estado actual</p>
          <p className="font-heading text-2xl font-bold tracking-wide mt-0.5">{meta.client}</p>
          <p className="text-sm mt-1 opacity-80">{meta.description}</p>
          {order.estimated_delivery && !finished && (
            <p className="flex items-center gap-1.5 text-sm mt-2 font-medium">
              <CalendarClock className="w-4 h-4" aria-hidden="true" />
              Entrega estimada: {formatDateShort(order.estimated_delivery)}
            </p>
          )}
        </div>
      </section>

      {/* Acciones */}
      <section className="grid grid-cols-2 gap-3">
        <button
          onClick={enableNotifications}
          disabled={notifState === "on" || notifState === "loading"}
          className={`rounded-2xl py-3 px-3 flex items-center justify-center gap-2 text-sm font-semibold transition-colors cursor-pointer disabled:cursor-default ${
            notifState === "on"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-sm"
          }`}
        >
          {notifState === "on" ? (
            <>
              <BellRing className="w-4 h-4" aria-hidden="true" /> Notificaciones activas
            </>
          ) : notifState === "loading" ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Activando…
            </>
          ) : (
            <>
              <Bell className="w-4 h-4" aria-hidden="true" /> Avisarme de cambios
            </>
          )}
        </button>
        <button
          onClick={handleSave}
          disabled={savedLocal}
          className={`rounded-2xl py-3 px-3 flex items-center justify-center gap-2 text-sm font-semibold transition-colors cursor-pointer disabled:cursor-default border ${
            savedLocal
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm"
          }`}
        >
          {savedLocal ? (
            <>
              <BookmarkCheck className="w-4 h-4" aria-hidden="true" /> Guardado
            </>
          ) : (
            <>
              <BookmarkPlus className="w-4 h-4" aria-hidden="true" /> Guardar vehículo
            </>
          )}
        </button>
      </section>
      {notifState === "denied" && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 -mt-3">
          No se pudieron activar las notificaciones. Revisa los permisos de tu navegador.
        </p>
      )}

      {/* Progreso */}
      {order.status !== "cancelado" && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
            AVANCE DE LA REPARACIÓN
          </h2>
          <ol className="mt-4 space-y-0">
            {STATUS_FLOW.map((s, i) => {
              const done = i < order.statusIndex || order.status === "entregado";
              const current = i === order.statusIndex && order.status !== "entregado";
              const sMeta = STATUS_META[s as OrderStatus];
              return (
                <li key={s} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    {done ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" aria-hidden="true" />
                    ) : current ? (
                      <CircleDot className="w-6 h-6 text-blue-600 shrink-0 live-dot" aria-hidden="true" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-200 shrink-0" aria-hidden="true" />
                    )}
                    {i < STATUS_FLOW.length - 1 && (
                      <span
                        className={`w-0.5 flex-1 min-h-5 ${done ? "bg-emerald-500" : "bg-slate-200"}`}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className={`pb-5 ${i === STATUS_FLOW.length - 1 ? "pb-0" : ""}`}>
                    <p
                      className={`font-semibold text-sm ${
                        current ? "text-blue-700" : done ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      {sMeta.client}
                      {current && (
                        <span className="ml-2 text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                          Ahora
                        </span>
                      )}
                    </p>
                    {current && <p className="text-xs text-slate-500 mt-0.5">{sMeta.description}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Anotaciones en vivo */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
            ANOTACIONES DEL TALLER
          </h2>
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${live ? "bg-emerald-500 live-dot" : "bg-slate-300"}`}
              aria-hidden="true"
            />
            {live ? "En vivo" : "Actualización periódica"}
          </span>
        </div>
        {data.events && data.events.length > 0 ? (
          <ul className="mt-4 space-y-4">
            {data.events.map((ev) => (
              <li key={ev.id} className="flex gap-3">
                <div
                  className={`rounded-xl p-2 h-fit shrink-0 ${
                    ev.type === "estado" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                  }`}
                  aria-hidden="true"
                >
                  {ev.type === "estado" ? (
                    <Wrench className="w-4 h-4" />
                  ) : (
                    <MessageSquareText className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{ev.title}</p>
                  {ev.detail && (
                    <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-wrap">{ev.detail}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">{formatDate(ev.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 mt-3">
            Aún no hay anotaciones. Aquí verás cada avance que registre el equipo del taller.
          </p>
        )}
      </section>

      {/* Detalle con código */}
      {data.detailed ? (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" aria-hidden="true" /> DETALLE DE LA ORDEN
          </h2>
          {order.diagnosis && (
            <div className="mt-3 bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Diagnóstico
              </p>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{order.diagnosis}</p>
            </div>
          )}
          {data.items && data.items.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="py-2 pr-2 font-semibold">Concepto</th>
                    <th className="py-2 px-2 font-semibold text-right">Cant.</th>
                    <th className="py-2 pl-2 font-semibold text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-2 text-slate-700">
                        {it.description}
                        <span className="ml-2 text-[11px] uppercase tracking-wide text-slate-400">
                          {it.kind}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-500 tabular-nums">{it.qty}</td>
                      <td className="py-2.5 pl-2 text-right text-slate-700 tabular-nums">
                        {formatMoney(it.qty * it.unit_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td colSpan={2} className="py-3 font-semibold text-slate-800">
                      Total
                    </td>
                    <td className="py-3 text-right font-bold text-slate-900 tabular-nums">
                      {formatMoney(data.total ?? 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-400 mt-3">
              El presupuesto aún no está cargado. Te avisaremos cuando esté listo.
            </p>
          )}

          {data.history && data.history.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-400" aria-hidden="true" /> Visitas anteriores
              </h3>
              <ul className="mt-2 space-y-1.5">
                {data.history.map((h) => (
                  <li key={h.folio} className="text-sm text-slate-500 flex justify-between gap-2">
                    <span className="truncate">
                      {h.folio} · {h.description || STATUS_META[h.status]?.label}
                    </span>
                    <span className="shrink-0 text-slate-400">{formatDateShort(h.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <h2 className="font-heading font-semibold text-lg text-blue-900 tracking-wide flex items-center gap-2">
            <LockKeyhole className="w-5 h-5" aria-hidden="true" /> ¿QUIERES VER EL DETALLE COMPLETO?
          </h2>
          <p className="text-sm text-blue-800/80 mt-1">
            Con el código de acceso de tu orden de servicio puedes ver el presupuesto,
            diagnóstico y tu historial de visitas.
          </p>
          <form onSubmit={unlockDetail} className="mt-3 flex gap-2">
            <label htmlFor="access-code" className="sr-only">
              Código de acceso
            </label>
            <input
              id="access-code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Ej. K7PM"
              maxLength={8}
              autoComplete="off"
              className="plate-badge flex-1 min-w-0 bg-white border border-blue-200 rounded-xl px-4 py-2.5 text-center text-lg text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl px-4 font-semibold text-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <KeyRound className="w-4 h-4" aria-hidden="true" /> Ver
            </button>
          </form>
          {codeError && <p className="text-sm text-red-600 mt-2">{codeError}</p>}
          <p className="flex items-start gap-1.5 text-xs text-blue-700/70 mt-3">
            <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            El código viene impreso en tu orden de servicio. Si lo perdiste, pídelo en el taller
            mostrando una identificación.
          </p>
        </section>
      )}
    </Shell>
  );
}

function vehicleLabel(d: TrackingResult): string {
  const v = d.vehicle;
  if (!v) return "";
  return [v.brand, v.model, v.year, v.color].filter(Boolean).join(" ") || "Vehículo";
}

function statusTone(color: string): string {
  switch (color) {
    case "green":
      return "bg-emerald-50 border-emerald-100 text-emerald-900";
    case "amber":
      return "bg-amber-50 border-amber-100 text-amber-900";
    case "violet":
      return "bg-violet-50 border-violet-100 text-violet-900";
    case "red":
      return "bg-red-50 border-red-100 text-red-900";
    case "blue":
      return "bg-blue-50 border-blue-100 text-blue-900";
    default:
      return "bg-slate-50 border-slate-100 text-slate-800";
  }
}

function Shell({
  children,
  plate,
  live,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  plate: string;
  live?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      <header className="bg-blue-950 text-white sticky top-0 z-20 shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="p-2 -ml-2 rounded-xl hover:bg-blue-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold tracking-wide leading-tight">SEGUIMIENTO</p>
            <p className="text-blue-300 text-xs truncate">Multiservicios San Miguel 96</p>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              aria-label="Actualizar ahora"
              className="p-2 rounded-xl hover:bg-blue-900 transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </header>
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-5 space-y-5">{children}</main>
      <footer className="text-center text-xs text-slate-400 pb-6">
        Placa consultada: <span className="font-semibold">{plate}</span>
      </footer>
    </div>
  );
}
