"use client";

import { useState, useCallback } from "react";
import {
  Search, Wrench, CheckCircle2, StickyNote, ClipboardList, Package, Bell, Banknote,
  Smartphone, Monitor, Send, X, BellRing,
} from "lucide-react";
import { sendTestPushAction } from "@/app/admin/actions";
import {
  CLIENT_PRESETS, ADMIN_PRESETS, type NotifPreset, type NotifIcon, type NotifTone,
} from "@/lib/notifications";
import { card, btnPrimary, btnSecondary, inputCls, labelCls, PlateBadge } from "@/components/admin/ui";

const ICONS: Record<NotifIcon, typeof Search> = {
  search: Search,
  wrench: Wrench,
  check: CheckCircle2,
  note: StickyNote,
  clipboard: ClipboardList,
  package: Package,
  bell: Bell,
  banknote: Banknote,
};

const TONE_ICON: Record<NotifTone, string> = {
  blue: "bg-sm-bg text-sm-red",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-accent-100 text-accent-700",
  violet: "bg-violet-100 text-violet-700",
  red: "bg-red-100 text-red-700",
  slate: "bg-slate-100 text-slate-700",
};

const TONE_BAR: Record<NotifTone, string> = {
  blue: "bg-sm-red",
  amber: "bg-amber-500",
  green: "bg-accent-500",
  violet: "bg-violet-500",
  red: "bg-red-500",
  slate: "bg-slate-500",
};

function PresetIcon({ preset, className }: { preset: NotifPreset; className?: string }) {
  const Icon = ICONS[preset.icon];
  return <Icon className={className ?? "w-5 h-5"} aria-hidden="true" />;
}

type Toast = { id: number; preset: NotifPreset };

export default function NotifTester({
  subPlates,
}: {
  subPlates: { plate: string; n: number }[];
}) {
  const [plate, setPlate] = useState(subPlates[0]?.plate ?? "ABC1234");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((preset: NotifPreset) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, preset }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  async function sendClient(preset: NotifPreset) {
    const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!cleanPlate) {
      setResults((r) => ({ ...r, [preset.id]: "Ingresa una placa primero." }));
      return;
    }
    setSendingId(preset.id);
    try {
      const res = await sendTestPushAction(cleanPlate, preset.id);
      const msg = res.error
        ? res.error
        : res.sent > 0
          ? `✓ Enviada a ${res.sent} dispositivo${res.sent === 1 ? "" : "s"} suscrito${res.sent === 1 ? "" : "s"} a ${cleanPlate}.`
          : `Sin dispositivos suscritos a ${cleanPlate}. Activa "Avisarme de cambios" en la app del cliente para recibirla.`;
      setResults((r) => ({ ...r, [preset.id]: msg }));
      pushToast({
        ...preset,
        title: res.sent > 0 ? "Push de prueba enviada" : "Push disparada (0 suscritos)",
        body: msg,
        audience: "admin",
        tone: res.sent > 0 ? "green" : "amber",
      });
    } catch {
      setResults((r) => ({ ...r, [preset.id]: "No se pudo enviar. Revisa las claves VAPID." }));
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Vista cliente ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-sm-red" aria-hidden="true" />
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
            AVISOS AL CLIENTE
          </h2>
        </div>
        <p className="text-sm text-slate-500 -mt-2">
          Así se ven las notificaciones que recibe el cliente en su celular. Envía una prueba real a
          una placa suscrita.
        </p>

        <div className={`${card} p-4 flex flex-wrap items-end gap-3`}>
          <div className="flex-1 min-w-[180px]">
            <label htmlFor="notif-plate" className={labelCls}>
              Placa de prueba
            </label>
            <input
              id="notif-plate"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="ABC1234"
              className={`${inputCls} plate-badge`}
            />
          </div>
          {subPlates.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {subPlates.slice(0, 6).map((s) => (
                <button
                  key={s.plate}
                  type="button"
                  onClick={() => setPlate(s.plate)}
                  className="text-xs font-medium bg-slate-100 hover:bg-sm-bg text-slate-600 hover:text-sm-red rounded-full px-2.5 py-1 transition-colors cursor-pointer"
                  title={`${s.n} dispositivo(s) suscrito(s)`}
                >
                  {s.plate} · {s.n}
                </button>
              ))}
            </div>
          )}
        </div>
        {subPlates.length === 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Aún nadie activó las notificaciones. En la app del cliente (con esta placa) toca
            <b> “Avisarme de cambios”</b> para suscribir un dispositivo y recibir la prueba.
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-3 *:min-w-0">
          {CLIENT_PRESETS.map((preset) => {
            const title = preset.title.replace("{placa}", plate || "ABC1234");
            return (
              <div key={preset.id} className={`${card} p-4 space-y-3`}>
                {/* Mockup de push en celular */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start gap-3">
                    <div className="bg-sm-red rounded-lg p-1.5 shrink-0" aria-hidden="true">
                      <Wrench className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate">
                          San Miguel 96
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">ahora</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{preset.body}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-400">{preset.label}</span>
                  <button
                    type="button"
                    onClick={() => sendClient(preset)}
                    disabled={sendingId === preset.id}
                    className={btnPrimary}
                  >
                    <Send className="w-4 h-4" aria-hidden="true" />
                    {sendingId === preset.id ? "Enviando…" : "Enviar prueba"}
                  </button>
                </div>
                {results[preset.id] && (
                  <p className="text-xs text-slate-500">{results[preset.id]}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Vista admin ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-sm-red" aria-hidden="true" />
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
            AVISOS EN EL PANEL
          </h2>
        </div>
        <p className="text-sm text-slate-500 -mt-2">
          Alertas internas para el equipo del taller. Toca “Ver ejemplo” para mostrar cómo aparecen
          en pantalla.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 *:min-w-0">
          {ADMIN_PRESETS.map((preset) => (
            <div key={preset.id} className={`${card} p-4 flex items-center gap-3`}>
              <div className={`rounded-xl p-2 shrink-0 ${TONE_ICON[preset.tone]}`} aria-hidden="true">
                <PresetIcon preset={preset} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{preset.title}</p>
                <p className="text-xs text-slate-500 truncate">{preset.body}</p>
              </div>
              <button
                type="button"
                onClick={() => pushToast(preset)}
                className={btnSecondary}
              >
                Ver ejemplo
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Contenedor de toasts ── */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-[min(92vw,360px)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`${card} overflow-hidden shadow-lg flex items-stretch`}
          >
            <div className={`w-1.5 shrink-0 ${TONE_BAR[t.preset.tone]}`} aria-hidden="true" />
            <div className="flex items-start gap-3 p-3 flex-1 min-w-0">
              <div className={`rounded-lg p-1.5 shrink-0 ${TONE_ICON[t.preset.tone]}`} aria-hidden="true">
                <PresetIcon preset={t.preset} className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{t.preset.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t.preset.body}</p>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Cerrar"
                className="p-1 rounded-md text-slate-400 hover:bg-slate-100 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="flex items-center gap-2 text-xs text-slate-400">
        <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
        Todos los avisos de esta pantalla son de demostración. No cambian ninguna orden real.
      </p>
    </div>
  );
}
