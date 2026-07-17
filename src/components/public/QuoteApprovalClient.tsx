"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/status";

// Aprobar/rechazar un presupuesto pre-orden con confirmación de dos pasos.
// Adaptado del ApprovalBox del seguimiento (función privada de TrackingClient,
// acoplada a su polling): aquí basta router.refresh() — el server component
// re-renderiza al estado decidido (aprobado muestra el enlace de seguimiento).
export default function QuoteApprovalClient({
  folio,
  code,
  total,
}: {
  folio: string;
  code: string;
  total: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<"aprobado" | "rechazado" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(decision: "aprobado" | "rechazado") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/public/presupuesto/${folio}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, decision }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "No se pudo enviar tu respuesta. Intenta de nuevo.");
        setConfirming(null);
        setBusy(false);
      }
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      setConfirming(null);
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 bg-sm-bg border border-sm-border rounded-xl p-4">
      <p className="text-sm font-semibold text-sm-graphite">
        ¿Autorizas este trabajo por {formatMoney(total)}?
      </p>
      <p className="text-xs text-sm-muted mt-0.5">
        Al aprobar, el taller abre tu orden de trabajo y te comparte un enlace para seguir la
        reparación en vivo.
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
