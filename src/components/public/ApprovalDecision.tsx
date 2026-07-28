"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { formatMoney } from "@/lib/status";

export type Decision = "aprobado" | "rechazado";

// Bloque de decisión del cliente, compartido por el presupuesto pre-orden y el
// presupuesto dentro de una orden. Aprobar pide una confirmación; rechazar pide
// DOS (la segunda advierte que el taller detiene el trabajo), para que nadie
// rechace de un toque por error.
export default function ApprovalDecision({
  total,
  question,
  hint,
  rejectWarning,
  advisorHref,
  onDecide,
  onDecidingChange,
}: {
  total: number;
  question: string;
  hint: string;
  /** Qué pasa si rechaza, en la última advertencia. */
  rejectWarning: string;
  /** WhatsApp (o tel:) del taller con el mensaje ya escrito. */
  advisorHref: string;
  /** Devuelve el mensaje de error, o null si salió bien. */
  onDecide: (decision: Decision) => Promise<string | null>;
  /** Avisa cuando hay una confirmación abierta, para que el padre no tape los
      botones con overlays (el pop de avisos del seguimiento). */
  onDecidingChange?: (deciding: boolean) => void;
}) {
  const [step, setStep] = useState<{ decision: Decision; final: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const deciding = step !== null;
  useEffect(() => {
    onDecidingChange?.(deciding);
    return () => onDecidingChange?.(false); // al desmontar, el padre vuelve a la normalidad
  }, [deciding, onDecidingChange]);

  async function send(decision: Decision) {
    setBusy(true);
    setError("");
    const err = await onDecide(decision);
    if (err) {
      setError(err);
      setStep(null);
      setBusy(false);
    }
    // Si salió bien no se toca el estado: el padre recarga los datos y este
    // bloque desaparece, sin parpadeo intermedio.
  }

  function advance() {
    if (!step) return;
    // Rechazar pasa por la advertencia final antes de enviarse.
    if (step.decision === "rechazado" && !step.final) {
      setStep({ decision: "rechazado", final: true });
      return;
    }
    send(step.decision);
  }

  const isFinalReject = step?.decision === "rechazado" && step.final;

  return (
    <div className="mt-4 bg-sm-bg border border-sm-border rounded-xl p-4">
      <p className="text-sm font-semibold text-sm-graphite">{question}</p>
      <p className="text-xs text-sm-muted mt-0.5">{hint}</p>

      {step ? (
        <div className="mt-3">
          {isFinalReject ? (
            <p className="flex items-start gap-2 text-sm font-medium text-sm-red bg-white border border-sm-border rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>Última confirmación: {rejectWarning}</span>
            </p>
          ) : (
            <p className="text-sm font-medium text-sm-graphite">
              {step.decision === "aprobado"
                ? `Confirma: apruebas el presupuesto de ${formatMoney(total)}.`
                : "Confirma: rechazas este presupuesto."}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              onClick={advance}
              disabled={busy}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer ${
                step.decision === "aprobado"
                  ? "bg-sm-ok hover:bg-sm-ok-hover"
                  : isFinalReject
                    ? "bg-sm-red hover:bg-sm-red-hover active:bg-sm-red-active"
                    : "bg-sm-warn hover:bg-sm-warn-hover"
              }`}
            >
              {busy
                ? "Enviando…"
                : isFinalReject
                  ? "Sí, rechazar"
                  : "Sí, confirmar"}
            </button>
            <button
              onClick={() => setStep(null)}
              disabled={busy}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-white border border-sm-border text-sm-muted hover:bg-sm-bg transition-colors cursor-pointer"
            >
              {isFinalReject ? "Mejor no" : "Volver"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setStep({ decision: "aprobado", final: false })}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-sm-ok hover:bg-sm-ok-hover text-white transition-colors cursor-pointer"
          >
            Aprobar presupuesto
          </button>
          <button
            onClick={() => setStep({ decision: "rechazado", final: false })}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-white border border-sm-border text-sm-muted hover:bg-sm-bg transition-colors cursor-pointer"
          >
            Rechazar
          </button>
        </div>
      )}

      {error && <p className="text-sm text-sm-red mt-2">{error}</p>}

      {/* Tercera vía, siempre en el mismo sitio (también durante las
          confirmaciones): quien duda de un repuesto o del precio habla antes
          de decidir. Peso terciario a propósito — sin borde ni relleno — para
          no convertir el bloque en tres botones que compiten. */}
      <div className="mt-3 pt-3 border-t border-sm-border">
        <a
          href={advisorHref}
          target="_blank"
          rel="noopener"
          className="w-full min-h-11 flex items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-sm-graphite hover:bg-white active:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sm-red"
        >
          <MessageCircle className="w-4 h-4 text-sm-ok shrink-0" aria-hidden="true" />
          Hablar con asesor
        </a>
        <p className="text-center text-xs text-sm-muted mt-0.5">
          ¿Dudas con algún repuesto o el precio? Te respondemos por WhatsApp antes de que decidas.
        </p>
      </div>
    </div>
  );
}
