"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, X, Loader2 } from "lucide-react";

// Build con el que se cargó esta pestaña (horneado en next.config.ts).
const BUILD = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

// Pop interno de actualización. Se muestra automáticamente cuando:
//  1) hay un deploy nuevo: /api/version devuelve un build distinto al cargado, o
//  2) el service worker instaló una versión nueva y quedó en espera.
// Al tocar "Aplicar" recargamos (y activamos el SW en espera si lo hay).
export default function UpdatePrompt() {
  const [show, setShow] = useState(false);
  const [applying, setApplying] = useState(false);
  const [mounted, setMounted] = useState(false);
  const waitingSW = useRef<ServiceWorker | null>(null);
  const latestBuild = useRef<string>(BUILD);
  const dismissedBuild = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const hasSW = "serviceWorker" in navigator;
    let reg: ServiceWorkerRegistration | null = null;
    let reloading = false;
    let stopped = false;
    // Sin SW controlando = primera instalación: el controllerchange que dispara
    // clients.claim() no debe recargar.
    const hadController = hasSW ? !!navigator.serviceWorker.controller : false;

    const onControllerChange = () => {
      if (reloading || !hadController) return;
      reloading = true;
      window.location.reload();
    };

    const promote = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const check = () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          waitingSW.current = worker;
          setShow(true);
        }
      };
      check();
      worker.addEventListener("statechange", check);
    };

    if (hasSW) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          reg = registration;
          if (registration.waiting && navigator.serviceWorker.controller) {
            waitingSW.current = registration.waiting;
            setShow(true);
          }
          registration.addEventListener("updatefound", () => promote(registration.installing));
        })
        .catch(() => {});
    }

    // Deploy nuevo: comparar el build en runtime contra el cargado.
    const checkBuild = async () => {
      if (BUILD === "dev") return; // local/dev: sin pops
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { build?: string };
        if (stopped || !data.build) return;
        latestBuild.current = data.build;
        if (data.build !== BUILD && data.build !== dismissedBuild.current) setShow(true);
      } catch {
        /* offline: reintenta en el próximo ciclo */
      }
    };

    // Al volver a la app y cada 5 min: buscar deploy nuevo y actualizar el SW.
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      checkBuild();
      reg?.update().catch(() => {});
    };
    checkBuild();
    document.addEventListener("visibilitychange", poll);
    const interval = window.setInterval(poll, 5 * 60 * 1000);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", poll);
      window.clearInterval(interval);
      if (hasSW) navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  function apply() {
    setApplying(true);
    const w = waitingSW.current;
    if (w) {
      // El SW en espera toma control y controllerchange dispara el reload.
      w.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(() => window.location.reload(), 3000); // respaldo
    } else {
      // Deploy nuevo sin SW en espera: recargar trae el HTML/JS frescos (red primero).
      window.location.reload();
    }
  }

  function dismiss() {
    // No volver a molestar por este build; reaparece en el próximo deploy.
    dismissedBuild.current = latestBuild.current;
    setShow(false);
  }

  if (!mounted || !show) return null;

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
            onClick={dismiss}
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
