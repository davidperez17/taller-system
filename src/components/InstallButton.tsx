"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X, Share, SquarePlus, MoreVertical } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Tone = "primary" | "onDark";

const TONES: Record<Tone, string> = {
  primary:
    "bg-primary-600 hover:bg-primary-500 active:bg-primary-700 text-white shadow-sm",
  onDark:
    "bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur",
};

export default function InstallButton({
  appName = "la app",
  label = "Instalar app",
  tone = "primary",
  className = "",
}: {
  appName?: string;
  label?: string;
  tone?: Tone;
  className?: string;
}) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [help, setHelp] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const ua = navigator.userAgent || "";
    const iOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (/Macintosh/i.test(ua) && "ontouchend" in document); // iPad reciente
    setIsIOS(iOS);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setHelp(false);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Bloquea el scroll del fondo mientras el modal de ayuda está abierto.
  useEffect(() => {
    if (!help) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [help]);

  // Ya instalada / abierta como app → no tiene sentido mostrar el botón.
  if (installed) return null;

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      try {
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") setInstalled(true);
      } catch {
        /* ignore */
      }
      setDeferred(null);
      return;
    }
    // iOS y navegadores sin prompt nativo → instrucciones manuales.
    setHelp(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`w-full rounded-2xl py-3.5 px-4 flex items-center justify-center gap-2 font-semibold transition-colors cursor-pointer ${TONES[tone]} ${className}`}
      >
        <Download className="w-5 h-5" aria-hidden="true" />
        {label}
      </button>

      {help && mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
            style={{ height: "100dvh" }}
            role="dialog"
            aria-label={`Cómo instalar ${appName}`}
          >
          <button
            className="absolute inset-0 bg-black/50"
            aria-label="Cerrar"
            onClick={() => setHelp(false)}
          />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 shadow-2xl pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:pb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-bold text-lg text-slate-900 tracking-wide">
                INSTALAR {appName.toUpperCase()}
              </h3>
              <button
                onClick={() => setHelp(false)}
                aria-label="Cerrar"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    Toca el botón <b>Compartir</b>
                    <Share className="w-4 h-4 text-primary-600 inline" aria-hidden="true" />
                    en la barra de Safari.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    Elige <b>Agregar a inicio</b>
                    <SquarePlus className="w-4 h-4 text-primary-600 inline" aria-hidden="true" />
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <span>
                    Confirma con <b>Agregar</b>. Aparecerá como <b>{appName}</b> en tu pantalla de
                    inicio.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    Abre el menú del navegador
                    <MoreVertical className="w-4 h-4 text-slate-600 inline" aria-hidden="true" />
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <span>
                    Elige <b>Instalar app</b> o <b>Agregar a pantalla de inicio</b>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <span>
                    Confirma. Quedará como <b>{appName}</b> en tu dispositivo.
                  </span>
                </li>
              </ol>
            )}

            <p className="text-xs text-slate-400 mt-4">
              Debe abrirse en el navegador (Safari o Chrome), no dentro de otra app.
            </p>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
