"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  ArrowLeft, Bell, BellRing, BookmarkPlus, BookmarkCheck, Car, Bike, Truck,
  CheckCircle2, Circle, CircleDot, HelpCircle, KeyRound, MessageSquareText,
  RefreshCw, SearchX, Wrench, CalendarClock, Receipt, History, LockKeyhole, FileDown, MapPin, X,
} from "lucide-react";
import { STATUS_FLOW, STATUS_META, type OrderStatus, formatMoney, formatDate, formatDateShort } from "@/lib/status";
import type { TrackingResult } from "@/lib/tracking";
import type { PublicAnnouncement } from "@/lib/announcements";
import { subscribeToPush, saveVehicle, getSavedVehicles, registerSW } from "./pwa";
import Novedades from "./Novedades";

const VEHICLE_ICON: Record<string, typeof Car> = { auto: Car, moto: Bike, camion: Truck, otro: Wrench };

export default function TrackingClient({
  initial,
  initialCode,
  announcements = [],
}: {
  initial: TrackingResult;
  initialCode: string;
  announcements?: PublicAnnouncement[];
}) {
  const [data, setData] = useState<TrackingResult>(initial);
  const [code, setCode] = useState(initialCode);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<number>(() => Date.now());
  const [, setTick] = useState(0); // re-render periódico para "hace Xs"
  const [refreshing, setRefreshing] = useState(false);
  const [notifState, setNotifState] = useState<"idle" | "loading" | "on" | "denied">("idle");
  const [savedLocal, setSavedLocal] = useState(false);
  const [showNotifPop, setShowNotifPop] = useState(false);
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
          setUpdatedAt(Date.now());
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

  // Sondeo como mecanismo primario (SSE no es fiable en serverless): cada 25 s
  // con la pestaña visible, y refresh inmediato al volver a la app.
  useEffect(() => {
    if (!initial.found) return;
    registerSW();
    setSavedLocal(getSavedVehicles().some((v) => v.plate === data.plate));
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setNotifState("on");
    }

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 25000);
    const tick = setInterval(() => setTick((t) => t + 1), 10000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
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
    if (!codeRef.current) return; // el botón solo se muestra en modo detallado
    setNotifState("loading");
    const ok = await subscribeToPush(data.plate, codeRef.current);
    setNotifState(ok ? "on" : "denied");
  }

  const popKey = `sm96_notif_pop_${data.plate}`;
  function dismissNotifPop() {
    setShowNotifPop(false);
    try {
      localStorage.setItem(popKey, "1"); // no volver a molestar en este equipo
    } catch {
      /* localStorage bloqueado (modo privado): se acepta perder la preferencia */
    }
  }
  async function enableFromPop() {
    setShowNotifPop(false);
    await enableNotifications();
  }

  // Pop proactivo para activar avisos. Solo en modo detallado (hay código para
  // suscribir la placa), si el permiso aún no se decidió y el cliente no lo
  // descartó antes. Un pequeño retraso para que no aparezca de golpe al cargar.
  useEffect(() => {
    if (!data.detailed) return;
    if (typeof window === "undefined" || !("Notification" in window) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return; // ya concedido o bloqueado: no molestar
    if (notifState === "on" || notifState === "loading") return;
    try {
      if (localStorage.getItem(popKey) === "1") return;
    } catch {
      /* localStorage bloqueado: se muestra igual */
    }
    const t = setTimeout(() => setShowNotifPop(true), 1500);
    return () => clearTimeout(t);
  }, [data.detailed, notifState, popKey]);

  function handleSave() {
    saveVehicle({ plate: data.plate, label: vehicleLabel(data), code: code || undefined });
    setSavedLocal(true);
  }

  /* ---------- Placa no encontrada ---------- */
  if (!data.found) {
    return (
      <Shell plate={data.plate} announcements={announcements}>
        <div className="bg-white rounded-2xl border border-sm-border shadow-sm p-8 text-center animate-slide-up">
          <SearchX className="w-12 h-12 text-sm-faint mx-auto" aria-hidden="true" />
          <h1 className="font-heading text-2xl font-bold text-sm-graphite mt-4 tracking-wide">
            NO ENCONTRAMOS LA PLACA {data.plate}
          </h1>
          <p className="text-sm-muted mt-2 max-w-sm mx-auto">
            Verifica que esté bien escrita. Si tu vehículo acaba de ingresar al taller,
            espera unos minutos a que lo registremos.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-6 bg-sm-red hover:bg-sm-red-hover text-white rounded-xl px-5 py-2.5 font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Buscar otra placa
          </Link>
        </div>
      </Shell>
    );
  }

  const order = data.order!;
  const meta = STATUS_META[order.status] ?? STATUS_META.recibido;
  const VehicleIcon = VEHICLE_ICON[data.vehicleType ?? "auto"] ?? Car;
  const finished = order.status === "entregado" || order.status === "cancelado";

  return (
    <Shell plate={data.plate} refreshing={refreshing} onRefresh={() => refresh()} announcements={announcements}>
      {/* Tarjeta vehículo + estado actual */}
      <section className="bg-white rounded-2xl border border-sm-border shadow-sm overflow-hidden animate-slide-up">
        <div className="p-5 flex items-start gap-4">
          <motion.div
            key={data.vehicleType ?? "auto"}
            className="bg-sm-bg text-sm-red rounded-2xl p-3 shrink-0"
            aria-hidden="true"
            initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 15 }}
          >
            <motion.div
              animate={{ y: [0, -2.5, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <VehicleIcon className="w-8 h-8" />
            </motion.div>
          </motion.div>
          <div className="min-w-0 flex-1">
            <span className="plate-badge inline-block bg-sm-bg border border-sm-border-strong rounded-lg px-3 py-1 text-sm-graphite">
              {data.plate}
            </span>
            {order.modality === "domicilio" && (
              <span className="inline-flex items-center gap-1 ml-2 align-middle text-[11px] font-semibold uppercase tracking-wide bg-sm-red/10 text-sm-red border border-sm-red/25 rounded-full px-2 py-0.5">
                <MapPin className="w-3 h-3" aria-hidden="true" /> A domicilio
              </span>
            )}
            {data.vehicle && (
              <p className="text-sm-graphite font-medium mt-1.5 truncate">{vehicleLabel(data)}</p>
            )}
            <p className="text-xs text-sm-faint mt-0.5">
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

      {/* Acciones — activar avisos requiere el código (propiedad de la orden) */}
      <section className={`grid gap-3 ${data.detailed ? "grid-cols-2" : "grid-cols-1"}`}>
        {data.detailed && (
          <button
            onClick={enableNotifications}
            disabled={notifState === "on" || notifState === "loading"}
            className={`rounded-2xl py-3 px-3 flex items-center justify-center gap-2 text-sm font-semibold transition-colors cursor-pointer disabled:cursor-default ${
              notifState === "on"
                ? "bg-sm-ok-bg text-sm-ok border border-sm-ok-border"
                : "bg-sm-red hover:bg-sm-red-hover active:bg-sm-red-active text-white shadow-sm"
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
        )}
        <button
          onClick={handleSave}
          disabled={savedLocal}
          className={`rounded-2xl py-3 px-3 flex items-center justify-center gap-2 text-sm font-semibold transition-colors cursor-pointer disabled:cursor-default border ${
            savedLocal
              ? "bg-sm-ok-bg text-sm-ok border-sm-ok-border"
              : "bg-white hover:bg-sm-bg text-sm-graphite border-sm-border shadow-sm"
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
        <p className="text-xs text-sm-warn bg-sm-warn-bg border border-sm-warn-border rounded-xl px-3 py-2 -mt-3">
          No se pudieron activar las notificaciones. Revisa los permisos de tu navegador.
        </p>
      )}

      {/* Pop proactivo para activar avisos (solo en modo detallado). */}
      {showNotifPop && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
          <div className="pointer-events-auto mx-auto max-w-md bg-white border border-sm-border shadow-xl rounded-2xl p-4 flex items-start gap-3 animate-slide-up">
            <div className="bg-sm-bg text-sm-red rounded-xl p-2 shrink-0" aria-hidden="true">
              <BellRing className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-heading font-semibold text-sm-graphite leading-tight">
                Activa los avisos de tu vehículo
              </p>
              <p className="text-xs text-sm-muted mt-1">
                Te avisamos apenas cambie el estado de tu reparación. Sin llamadas ni spam.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={enableFromPop}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-sm-red hover:bg-sm-red-hover active:bg-sm-red-active text-white rounded-xl py-2.5 text-sm font-semibold transition-colors cursor-pointer"
                >
                  <Bell className="w-4 h-4" aria-hidden="true" /> Activar avisos
                </button>
                <button
                  onClick={dismissNotifPop}
                  className="px-3 py-2.5 text-sm font-medium text-sm-muted hover:text-sm-graphite transition-colors cursor-pointer"
                >
                  Ahora no
                </button>
              </div>
            </div>
            <button
              onClick={dismissNotifPop}
              aria-label="Cerrar"
              className="p-1 -m-1 text-sm-faint hover:text-sm-graphite transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Progreso */}
      {order.status !== "cancelado" && (
        <section className="bg-white rounded-2xl border border-sm-border shadow-sm p-5">
          <h2 className="font-heading font-semibold text-lg text-sm-graphite tracking-wide">
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
                      <CheckCircle2 className="w-6 h-6 text-sm-ok shrink-0" aria-hidden="true" />
                    ) : current ? (
                      <CircleDot className="w-6 h-6 text-sm-red shrink-0 live-dot" aria-hidden="true" />
                    ) : (
                      <Circle className="w-6 h-6 text-sm-faint shrink-0" aria-hidden="true" />
                    )}
                    {i < STATUS_FLOW.length - 1 && (
                      <span
                        className={`w-0.5 flex-1 min-h-5 ${done ? "bg-sm-ok" : "bg-sm-border"}`}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className={`pb-5 ${i === STATUS_FLOW.length - 1 ? "pb-0" : ""}`}>
                    <p
                      className={`font-semibold text-sm ${
                        current ? "text-sm-red" : done ? "text-sm-graphite" : "text-sm-faint"
                      }`}
                    >
                      {sMeta.client}
                      {current && (
                        <span className="ml-2 text-[11px] font-bold uppercase tracking-wider bg-sm-red text-white rounded-full px-2 py-0.5">
                          Ahora
                        </span>
                      )}
                    </p>
                    {current && <p className="text-xs text-sm-muted mt-0.5">{sMeta.description}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Anotaciones — solo con código (el modo básico no expone eventos) */}
      {data.detailed && (
        <section className="bg-white rounded-2xl border border-sm-border shadow-sm p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading font-semibold text-lg text-sm-graphite tracking-wide">
              ANOTACIONES DEL TALLER
            </h2>
            <span className="flex items-center gap-1.5 text-xs text-sm-faint">
              <span className="w-2 h-2 rounded-full bg-sm-ok live-dot" aria-hidden="true" />
              Actualizado {agoLabel(updatedAt)}
            </span>
          </div>
          {data.events && data.events.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {data.events.map((ev) => (
                <li key={ev.id} className="flex gap-3">
                  <div
                    className={`rounded-xl p-2 h-fit shrink-0 ${
                      ev.type === "estado" ? "bg-sm-bg text-sm-red" : "bg-sm-bg text-sm-muted"
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
                    <p className="text-sm font-semibold text-sm-graphite">{ev.title}</p>
                    {ev.detail && (
                      <p className="text-sm text-sm-muted mt-0.5 whitespace-pre-wrap">{ev.detail}</p>
                    )}
                    {ev.photos && ev.photos.length > 0 && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {ev.photos.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noopener">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt="Foto del taller"
                              loading="lazy"
                              className="w-20 h-20 object-cover rounded-lg border border-sm-border"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-sm-faint mt-1">{formatDate(ev.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-sm-faint mt-3">
              Aún no hay anotaciones. Aquí verás cada avance que registre el equipo del taller.
            </p>
          )}
        </section>
      )}

      {/* Detalle con código */}
      {data.detailed ? (
        <section className="bg-white rounded-2xl border border-sm-border shadow-sm p-5">
          <h2 className="font-heading font-semibold text-lg text-sm-graphite tracking-wide flex items-center gap-2">
            <Receipt className="w-5 h-5 text-sm-red" aria-hidden="true" /> DETALLE DE LA ORDEN
          </h2>
          {order.diagnosis && (
            <div className="mt-3 bg-sm-bg rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-sm-faint">
                Diagnóstico
              </p>
              <p className="text-sm text-sm-graphite mt-1 whitespace-pre-wrap">{order.diagnosis}</p>
            </div>
          )}
          {data.items && data.items.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-sm-faint border-b border-sm-border">
                    <th className="py-2 pr-2 font-semibold">Concepto</th>
                    <th className="py-2 px-2 font-semibold text-right">Cant.</th>
                    <th className="py-2 pl-2 font-semibold text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sm-border">
                  {data.items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-2 text-sm-graphite">
                        {it.description}
                        <span className="ml-2 text-[11px] uppercase tracking-wide text-sm-faint">
                          {it.kind}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-sm-muted tabular-nums">{it.qty}</td>
                      <td className="py-2.5 pl-2 text-right text-sm-graphite tabular-nums">
                        {formatMoney(it.qty * it.unit_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-sm-border">
                    <td colSpan={2} className="py-3 font-semibold text-sm-graphite">
                      Total
                    </td>
                    <td className="py-3 text-right font-bold text-sm-graphite tabular-nums">
                      {formatMoney(data.total ?? 0)}
                    </td>
                  </tr>
                  {(data.paid ?? 0) > 0 && (
                    <>
                      <tr>
                        <td colSpan={2} className="py-1 text-sm text-sm-muted">
                          Pagado
                        </td>
                        <td className="py-1 text-right text-sm font-semibold text-sm-ok tabular-nums">
                          {formatMoney(data.paid ?? 0)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={2} className="pb-3 text-sm text-sm-muted">
                          Saldo
                        </td>
                        <td className="pb-3 text-right text-sm font-semibold text-sm-graphite tabular-nums">
                          {formatMoney((data.total ?? 0) - (data.paid ?? 0))}
                        </td>
                      </tr>
                    </>
                  )}
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-sm-faint mt-3">
              El presupuesto aún no está cargado. Te avisaremos cuando esté listo.
            </p>
          )}

          {(data.items?.length ?? 0) > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`/api/public/pdf/${encodeURIComponent(data.plate)}?code=${encodeURIComponent(codeRef.current)}&doc=cotizacion`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 text-sm font-semibold text-sm-graphite bg-white hover:bg-sm-bg border border-sm-border-strong rounded-xl px-4 py-2.5 transition-colors"
              >
                <FileDown className="w-4 h-4 text-sm-red" aria-hidden="true" />
                Descargar cotización (PDF)
              </a>
              {order.status === "entregado" && (
                <a
                  href={`/api/public/pdf/${encodeURIComponent(data.plate)}?code=${encodeURIComponent(codeRef.current)}&doc=informe`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-sm-graphite bg-white hover:bg-sm-bg border border-sm-border-strong rounded-xl px-4 py-2.5 transition-colors"
                >
                  <FileDown className="w-4 h-4 text-sm-ok" aria-hidden="true" />
                  Informe de servicio (PDF)
                </a>
              )}
            </div>
          )}

          {/* Aprobación del presupuesto por el cliente */}
          {order.status === "aprobacion" &&
            order.approval_status === "pendiente" &&
            (data.items?.length ?? 0) > 0 && (
              <ApprovalBox
                plate={data.plate}
                code={codeRef.current}
                total={data.total ?? 0}
                onDone={() => refresh()}
              />
            )}
          {order.approval_status === "aprobado" && order.approval_at && (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-sm-ok bg-sm-ok-bg border border-sm-ok-border rounded-xl px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              Aprobaste este presupuesto el {formatDate(order.approval_at)}
              {order.approval_total != null && <> por {formatMoney(order.approval_total)}</>}.
            </p>
          )}
          {order.approval_status === "rechazado" && order.approval_at && (
            <p className="mt-4 text-sm font-medium text-sm-warn bg-sm-warn-bg border border-sm-warn-border rounded-xl px-3 py-2.5">
              Rechazaste este presupuesto el {formatDate(order.approval_at)}. El taller se
              pondrá en contacto contigo para acordar cómo continuar.
            </p>
          )}

          {data.history && data.history.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-sm-graphite flex items-center gap-1.5">
                <History className="w-4 h-4 text-sm-faint" aria-hidden="true" /> Visitas anteriores
              </h3>
              <ul className="mt-2 space-y-1.5">
                {data.history.map((h) => (
                  <li key={h.folio} className="text-sm text-sm-muted flex justify-between gap-2">
                    <span className="truncate">
                      {h.folio} · {h.description || STATUS_META[h.status]?.label}
                    </span>
                    <span className="shrink-0 text-sm-faint">{formatDateShort(h.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section className="bg-sm-bg border border-sm-border rounded-2xl p-5">
          <h2 className="font-heading font-semibold text-lg text-sm-graphite tracking-wide flex items-center gap-2">
            <LockKeyhole className="w-5 h-5" aria-hidden="true" /> ¿QUIERES VER EL DETALLE COMPLETO?
          </h2>
          <p className="text-sm text-sm-muted mt-1">
            Con el código de acceso de tu orden de servicio puedes ver las anotaciones del
            taller, el presupuesto, el diagnóstico y tu historial de visitas, y activar
            las notificaciones.
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
              className="plate-badge flex-1 min-w-0 bg-white border border-sm-border-strong rounded-xl px-4 py-2.5 text-center text-lg text-sm-graphite placeholder:text-sm-faint focus:outline-none focus:ring-2 focus:ring-sm-red"
            />
            <button
              type="submit"
              className="bg-sm-red hover:bg-sm-red-hover active:bg-sm-red-active text-white rounded-xl px-4 font-semibold text-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <KeyRound className="w-4 h-4" aria-hidden="true" /> Ver
            </button>
          </form>
          {codeError && <p className="text-sm text-sm-red mt-2">{codeError}</p>}
          <p className="flex items-start gap-1.5 text-xs text-sm-faint mt-3">
            <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            El código viene impreso en tu orden de servicio. Si lo perdiste, pídelo en el taller
            mostrando una identificación.
          </p>
        </section>
      )}
    </Shell>
  );
}

// Aprobar/rechazar presupuesto con confirmación de dos pasos.
function ApprovalBox({
  plate,
  code,
  total,
  onDone,
}: {
  plate: string;
  code: string;
  total: number;
  onDone: () => void;
}) {
  const [confirming, setConfirming] = useState<"aprobado" | "rechazado" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(decision: "aprobado" | "rechazado") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/public/track/${plate}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, decision }),
      });
      if (res.ok) {
        onDone();
      } else {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "No se pudo enviar tu respuesta. Intenta de nuevo.");
        setConfirming(null);
      }
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 bg-sm-bg border border-sm-border rounded-xl p-4">
      <p className="text-sm font-semibold text-sm-graphite">
        ¿Autorizas la reparación por {formatMoney(total)}?
      </p>
      <p className="text-xs text-sm-muted mt-0.5">
        Al aprobar, el taller continúa con los repuestos y la reparación.
      </p>
      {confirming ? (
        <div className="mt-3">
          <p className="text-sm font-medium text-sm-graphite">
            {confirming === "aprobado"
              ? `Confirma: apruebas el presupuesto de ${formatMoney(total)}.`
              : "Confirma: rechazas este presupuesto."}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => send(confirming)}
              disabled={busy}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer ${
                confirming === "aprobado"
                  ? "bg-sm-ok hover:bg-sm-ok-hover"
                  : "bg-sm-warn hover:bg-sm-warn-hover"
              }`}
            >
              {busy ? "Enviando…" : "Sí, confirmar"}
            </button>
            <button
              onClick={() => setConfirming(null)}
              disabled={busy}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-white border border-sm-border text-sm-muted hover:bg-sm-bg transition-colors cursor-pointer"
            >
              Volver
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setConfirming("aprobado")}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-sm-ok hover:bg-sm-ok-hover text-white transition-colors cursor-pointer"
          >
            Aprobar presupuesto
          </button>
          <button
            onClick={() => setConfirming("rechazado")}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-white border border-sm-border text-sm-muted hover:bg-sm-bg transition-colors cursor-pointer"
          >
            Rechazar
          </button>
        </div>
      )}
      {error && <p className="text-sm text-sm-red mt-2">{error}</p>}
    </div>
  );
}

function vehicleLabel(d: TrackingResult): string {
  const v = d.vehicle;
  if (!v) return "Vehículo";
  return [v.brand, v.model, v.year, v.color].filter(Boolean).join(" ") || "Vehículo";
}

function agoLabel(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 15) return "ahora mismo";
  if (s < 60) return `hace ${s} s`;
  return `hace ${Math.round(s / 60)} min`;
}

function statusTone(color: string): string {
  switch (color) {
    case "green":
      return "bg-sm-ok-bg border-sm-ok-border text-sm-ok";
    case "amber":
      return "bg-sm-warn-bg border-sm-warn-border text-sm-warn";
    case "violet":
      return "bg-violet-50 border-violet-100 text-violet-900";
    case "red":
      return "bg-sm-bg border-sm-border text-sm-red";
    case "blue":
      return "bg-sm-bg border-sm-border text-sm-graphite";
    default:
      return "bg-sm-bg border-sm-border text-sm-graphite";
  }
}

function Shell({
  children,
  plate,
  refreshing,
  onRefresh,
  announcements = [],
}: {
  children: React.ReactNode;
  plate: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  announcements?: PublicAnnouncement[];
}) {
  return (
    <div className="pub min-h-dvh bg-sm-bg flex flex-col">
      <header className="bg-sm-graphite text-white sticky top-0 z-50 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-2.5">
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="grid place-items-center w-9 h-9 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <img
            src="/logo/logo-mts96.png"
            alt="Multiservicios San Miguel 96"
            width={1458}
            height={381}
            className="h-7 sm:h-8 w-auto shrink-0 select-none"
            draggable={false}
          />
          <div className="flex-1 min-w-0">
            <p className="font-heading font-semibold text-[15px] tracking-wide uppercase leading-none truncate">
              Seguimiento
            </p>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              aria-label="Actualizar ahora"
              className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </header>
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-5 space-y-5">
        <Novedades items={announcements} />
        {children}
      </main>
      <footer className="text-center text-xs text-sm-faint pb-6">
        Placa consultada: <span className="font-semibold">{plate}</span>
      </footer>
    </div>
  );
}
