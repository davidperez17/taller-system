"use client";

// Error boundary del seguimiento público. Si el server component (getTracking,
// anuncios) o el render tira, el cliente ve una tarjeta amable con reintento en
// vez de un 500 crudo ("This page couldn't load"). Cubre caídas momentáneas de
// la base o de red sin dejar la pantalla rota.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

export default function SeguimientoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El detalle real vive en los logs del server; aquí solo dejamos rastro en
    // consola del cliente para soporte.
    console.error("seguimiento error:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="min-h-screen bg-sm-bg flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-sm-border shadow-sm p-8 text-center max-w-md w-full">
        <AlertTriangle className="w-12 h-12 text-sm-red mx-auto" aria-hidden="true" />
        <h1 className="font-heading text-2xl font-bold text-sm-graphite mt-4 tracking-wide">
          NO PUDIMOS CARGAR EL SEGUIMIENTO
        </h1>
        <p className="text-sm-muted mt-2 max-w-sm mx-auto">
          Tuvimos un problema momentáneo. Volvé a intentar en unos segundos.
        </p>
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 bg-sm-red hover:bg-sm-red-hover active:bg-sm-red-active text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" /> Reintentar
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-white hover:bg-sm-bg text-sm-graphite border border-sm-border rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
