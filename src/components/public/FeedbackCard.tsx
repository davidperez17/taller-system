"use client";

import { useState } from "react";
import { Check, RefreshCw, Send, Star } from "lucide-react";
import {
  CSAT_LEVELS,
  CSAT_ORDER,
  CSAT_REASONS,
  isLowCsat,
  type CsatRating,
} from "@/lib/status";
import CsatFace, { CSAT_TONE } from "@/components/CsatFace";

export type TrackFeedback = {
  rating: number;
  reasons: string[];
  comment: string | null;
  created_at: string;
};

// Clases de la fila seleccionada, por nivel. Estáticas a propósito: el JIT de
// Tailwind no ve strings interpolados. El amarillo usa su variante -ink para el
// borde, que es el único de los cuatro que no llega a 3:1 sobre blanco.
const ROW: Record<CsatRating, string> = {
  4: "peer-checked:border-csat-exc peer-checked:bg-csat-exc/10 peer-focus-visible:ring-csat-exc",
  3: "peer-checked:border-csat-bien peer-checked:bg-csat-bien/10 peer-focus-visible:ring-csat-bien",
  2: "peer-checked:border-csat-reg-ink peer-checked:bg-csat-reg/15 peer-focus-visible:ring-csat-reg-ink",
  1: "peer-checked:border-csat-mal peer-checked:bg-csat-mal/10 peer-focus-visible:ring-csat-mal",
};

function Stars({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`flex gap-0.5 ${className}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <Star key={i} className="w-3.5 h-3.5 fill-current" />
      ))}
    </span>
  );
}

// Semáforo de satisfacción: el cliente califica el servicio de un toque cuando su
// vehículo ya fue entregado. Un solo POST lleva nivel + motivos + comentario.
//
// Accesibilidad: son inputs radio REALES dentro de un fieldset, no un
// role="radiogroup" a mano. Así el roving focus con flechas, el aria-checked y el
// anuncio "1 de 4" los da el navegador, y peer-checked:/peer-focus-visible:
// resuelven los estados visuales sin JS. La selección nunca depende solo del
// color: cambia el borde, se tiñe el fondo y aparece un check.
export default function FeedbackCard({
  plate,
  code,
  initial,
  onSent,
}: {
  plate: string;
  code: string;
  initial: TrackFeedback | null;
  onSent: () => void;
}) {
  const [rating, setRating] = useState<CsatRating | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // El "gracias" sale del envío local (sin esperar al refresh, para que no haya
  // parpadeo) o de lo que ya venía del servidor.
  const done: TrackFeedback | null =
    initial ??
    (sent && rating !== null
      ? { rating, reasons, comment: comment.trim() || null, created_at: "" }
      : null);

  if (done) {
    const r = (done.rating as CsatRating) ?? 3;
    const meta = CSAT_LEVELS[r] ?? CSAT_LEVELS[3];
    const tone = CSAT_TONE[r] ?? CSAT_TONE[3];
    return (
      <section
        id="calificar"
        className="scroll-mt-20 bg-white rounded-2xl border border-sm-border shadow-sm p-5 animate-slide-up"
      >
        <h2 className="font-heading font-semibold text-lg text-sm-graphite tracking-wide">
          ¡GRACIAS POR CALIFICARNOS!
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <span
            className={`grid place-items-center w-14 h-14 rounded-full shrink-0 ${tone.disc} ${tone.face}`}
            aria-hidden="true"
          >
            <CsatFace level={r} className="w-9 h-9" />
          </span>
          <div className="min-w-0">
            <p className="font-heading font-bold text-xl text-sm-graphite tracking-wide">
              {meta.label}
            </p>
            <Stars n={meta.stars} className={`mt-0.5 ${tone.ink}`} />
          </div>
        </div>
        <p className="text-sm text-sm-muted mt-3">
          {isLowCsat(r)
            ? "Lamentamos no haber estado a la altura. Ya avisamos al equipo y un asesor va a revisar tu caso."
            : "Nos alegra saberlo. ¡Gracias por confiarnos tu vehículo!"}
        </p>
      </section>
    );
  }

  const low = rating !== null && isLowCsat(rating);

  function toggleReason(key: string) {
    setReasons((rs) => (rs.includes(key) ? rs.filter((r) => r !== key) : [...rs, key]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === null || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/public/track/${encodeURIComponent(plate)}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          rating,
          // Si subió de Malo a Excelente, los motivos marcados antes no viajan.
          reasons: low ? reasons : [],
          comment: comment.trim(),
        }),
      });
      if (res.ok) {
        setSent(true);
        onSent(); // el padre recarga: la próxima vez el "gracias" viene del servidor
        return;
      }
      const json = await res.json().catch(() => ({}));
      setError(json.error || "No se pudo enviar tu calificación. Intenta de nuevo.");
      setSending(false);
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      setSending(false);
    }
  }

  return (
    <section
      id="calificar"
      className="scroll-mt-20 bg-white rounded-2xl border border-sm-border shadow-sm p-5 animate-slide-up"
    >
      <form onSubmit={submit}>
        <fieldset className="border-0 p-0 m-0">
          <legend className="font-heading font-semibold text-lg text-sm-graphite tracking-wide">
            ¿CÓMO TE ATENDIMOS?
          </legend>
          <p className="text-sm text-sm-muted mt-1">
            Tu vehículo ya fue entregado. Toca la carita que mejor describa tu experiencia: nos
            toma 10 segundos y nos ayuda a mejorar.
          </p>

          <div className="mt-4 space-y-2">
            {CSAT_ORDER.map((lvl) => {
              const meta = CSAT_LEVELS[lvl];
              const tone = CSAT_TONE[lvl];
              return (
                <label key={lvl} className="block cursor-pointer">
                  <input
                    type="radio"
                    name="csat"
                    value={lvl}
                    checked={rating === lvl}
                    onChange={() => setRating(lvl)}
                    className="peer sr-only"
                  />
                  <span
                    className={`flex items-center gap-3 h-16 rounded-2xl border-2 border-sm-border bg-white px-3 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 ${ROW[lvl]}`}
                  >
                    <span
                      className={`grid place-items-center w-11 h-11 rounded-full shrink-0 ${tone.disc} ${tone.face}`}
                      aria-hidden="true"
                    >
                      <CsatFace level={lvl} className="w-7 h-7" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-heading font-bold text-lg text-sm-graphite tracking-wide leading-none">
                        {meta.label}
                      </span>
                      <span className="block text-xs text-sm-muted mt-1">{meta.description}</span>
                    </span>
                    <Stars n={meta.stars} className={`shrink-0 ${tone.ink}`} />
                    {/* El check se pinta desde el estado y no con peer-checked:
                        porque la variante peer solo alcanza HERMANOS del input
                        (`.peer:checked ~ &`), no descendientes de un hermano.
                        El borde y el fondo sí son hermanos directos y sí la usan. */}
                    <Check
                      className={`w-5 h-5 shrink-0 transition-opacity ${tone.ink} ${
                        rating === lvl ? "opacity-100" : "opacity-0"
                      }`}
                      aria-hidden="true"
                    />
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {low && (
          <fieldset className="mt-4 border-0 p-0 m-0">
            <legend className="text-sm font-semibold text-sm-graphite">
              ¿Qué fue lo que falló? (puedes marcar varias)
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(CSAT_REASONS).map(([key, label]) => (
                <label key={key} className="cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reasons.includes(key)}
                    onChange={() => toggleReason(key)}
                    className="peer sr-only"
                  />
                  <span className="inline-flex items-center min-h-11 rounded-full border border-sm-border-strong bg-white px-4 text-sm font-medium text-sm-graphite transition-colors peer-checked:bg-sm-graphite peer-checked:text-white peer-checked:border-sm-graphite peer-focus-visible:ring-2 peer-focus-visible:ring-sm-red peer-focus-visible:ring-offset-2">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {rating !== null && (
          <div className="mt-4">
            <label htmlFor="csat-comment" className="block text-sm font-semibold text-sm-graphite">
              {low ? "Cuéntanos qué pasó (opcional)" : "¿Algo que quieras decirnos? (opcional)"}
            </label>
            <textarea
              id="csat-comment"
              rows={3}
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                low
                  ? "Ej. El carro quedó bien, pero me lo entregaron dos días tarde."
                  : "Ej. Muy buena atención, me explicaron todo antes de reparar."
              }
              className="mt-1.5 w-full bg-white border border-sm-border-strong rounded-xl px-3.5 py-2.5 text-sm text-sm-graphite placeholder:text-sm-faint focus:outline-none focus:ring-2 focus:ring-sm-red focus:border-sm-red"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-sm-red mt-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={rating === null || sending}
          className="mt-4 w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-sm-red hover:bg-sm-red-hover active:bg-sm-red-active disabled:bg-sm-border-strong disabled:cursor-default text-white text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sm-red focus-visible:ring-offset-2"
        >
          {sending ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Enviando…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" aria-hidden="true" /> Enviar calificación
            </>
          )}
        </button>
        <p className="mt-2 text-center text-xs text-sm-faint">
          Solo se envía una vez y la lee el equipo del taller.
        </p>
      </form>
    </section>
  );
}
