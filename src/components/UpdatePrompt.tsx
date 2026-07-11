"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, X, Loader2 } from "lucide-react";

// Pop interno de actualización: cuando se despliega una versión nueva del
// service worker (ver VERSION en public/sw.js), el navegador instala el SW
// nuevo y lo deja en espera. Aquí lo detectamos y ofrecemos aplicarlo: al
// tocar "Aplicar" mandamos SKIP_WAITING, el SW toma control y recargamos.
export default function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [applying, setApplying] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;
    let reloading = false;
    // Si no había SW controlando, este es el primer install: el controllerchange
    // que dispara clients.claim() no debe recargar la página.
    const hadController = !!navigator.serviceWorker.controller;

    // Cuando el SW en espera toma control (actualización), recargar una sola vez.
    const onControllerChange = () => {
      if (reloading || !hadController) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Solo es "actualización" si ya había un SW controlando (no la 1ª instalación).
    const promote = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const check = () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setWaiting(worker);
        }
      };
      check();
      worker.addEventListener("statechange", check);
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        reg = registration;
        // Puede haber quedado uno en espera de una carga anterior.
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaiting(registration.waiting);
        }
        registration.addEventListener("updatefound", () => {
          promote(registration.installing);
        });
      })
      .catch(() => {});

    // Buscar versiones nuevas al volver a la app y periódicamente.
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") reg?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", checkForUpdate);
    const interval = window.setInterval(checkForUpdate, 60 * 60 * 1000);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.clearInterval(interval);
    };
  }, []);

  function apply() {
    if (!waiting) return;
    setApplying(true);
    waiting.postMessage({ type: "SKIP_WAITING" });
    // El reload lo dispara controllerchange. Respaldo por si no llega el evento.
    window.setTimeout(() => window.location.reload(), 3000);
  }

  if (!mounted || !waiting) return null;

  return createPortal(
    <div
      role="alertdialog"
      aria-label="Actualización disponible"
      className="fixed inset-x-0 bottom-0 z-[9998] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-6 pointer-events-none"
    >
      <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 flex items-center gap-3 animate-slide-up">
        <span className="shrink-0 rounded-xl bg-primary-100 text-primary-700 p-2" aria-hidden="true">
          <RefreshCw className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">Actualización disponible</p>
          <p className="text-xs text-slate-500">Hay una versión nueva de la app lista para usarse.</p>
        </div>
        <button
          type="button"
          onClick={apply}
          disabled={applying}
          className="shrink-0 inline-flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 active:bg-primary-700 disabled:opacity-60 text-white rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer"
        >
          {applying ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
          {applying ? "Aplicando…" : "Aplicar"}
        </button>
        {!applying && (
          <button
            type="button"
            onClick={() => setWaiting(null)}
            aria-label="Ahora no"
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
