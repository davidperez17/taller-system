"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, RefreshCw } from "lucide-react";
import { registerSW, urlBase64ToUint8Array } from "@/components/public/pwa";
import { subscribeAdminPushAction, unsubscribeAdminPushAction } from "@/app/admin/actions";

type State = "loading" | "off" | "on" | "denied" | "unsupported";

// Activa/desactiva las notificaciones push del panel para el usuario logueado
// (tabla admin_push_subs). Reutiliza el mismo service worker de la PWA.
export default function AdminPushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      if (state === "on") {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await unsubscribeAdminPushAction(sub.endpoint);
          await sub.unsubscribe();
        }
        setState("off");
      } else {
        const reg = await registerSW();
        if (!reg) return;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState("denied");
          return;
        }
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!key) return;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
          }));
        const res = await subscribeAdminPushAction(
          sub.toJSON() as { endpoint: string }
        );
        setState(res.ok ? "on" : "off");
      }
    } finally {
      setBusy(false);
    }
  }

  if (state === "unsupported") return null;

  if (compact) {
    return (
      <button
        onClick={toggle}
        disabled={busy || state === "denied" || state === "loading"}
        aria-label={state === "on" ? "Desactivar avisos del panel" : "Activar avisos del panel"}
        title={state === "on" ? "Avisos del panel activos" : "Activar avisos del panel"}
        className="p-2 rounded-xl hover:bg-primary-900 transition-colors cursor-pointer disabled:opacity-50"
      >
        {busy ? (
          <RefreshCw className="w-5 h-5 animate-spin" aria-hidden="true" />
        ) : state === "on" ? (
          <BellRing className="w-5 h-5 text-accent-400" aria-hidden="true" />
        ) : (
          <Bell className="w-5 h-5" aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={toggle}
        disabled={busy || state === "denied" || state === "loading"}
        className={`rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm font-semibold transition-colors cursor-pointer disabled:cursor-default ${
          state === "on"
            ? "bg-accent-50 text-accent-700 border border-accent-200"
            : "bg-primary-600 hover:bg-primary-500 text-white shadow-sm"
        }`}
      >
        {busy ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Guardando…
          </>
        ) : state === "on" ? (
          <>
            <BellRing className="w-4 h-4" aria-hidden="true" /> Avisos activos en este
            dispositivo — tocar para desactivar
          </>
        ) : state === "denied" ? (
          <>
            <BellOff className="w-4 h-4" aria-hidden="true" /> Notificaciones bloqueadas en el
            navegador
          </>
        ) : (
          <>
            <Bell className="w-4 h-4" aria-hidden="true" /> Recibir avisos del panel en este
            dispositivo
          </>
        )}
      </button>
    </div>
  );
}
