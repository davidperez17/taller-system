"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { completeTourAction } from "@/app/admin/actions";
import { btnPrimary, btnSecondary } from "@/components/admin/ui";

type Role = "admin" | "asesor" | "mecanico";

type Step = {
  /** Valor de data-tour del elemento a resaltar; sin target = tarjeta centrada. */
  target?: string;
  /** Nota extra cuando el elemento vive dentro de la hoja «Más» en móvil. */
  fallbackNote?: string;
  title: string;
  body: string;
  adminOnly?: boolean;
  noMechanic?: boolean;
};

const STEPS: Step[] = [
  {
    title: "¡BIENVENIDO AL PANEL!",
    body: "Te mostramos lo esencial en menos de un minuto. Puedes salir cuando quieras y repetir este tutorial desde Mi cuenta.",
  },
  {
    target: "/admin",
    title: "INICIO",
    body: "El resumen del taller en tiempo real: vehículos en el taller, listos para entrega y lo facturado del mes.",
  },
  {
    target: "/admin/ordenes",
    title: "ÓRDENES",
    body: "El corazón del panel. Crea una orden por cada vehículo que entra y actualiza su etapa; tu cliente sigue el avance en vivo con su placa.",
  },
  {
    target: "/admin/presupuestos",
    noMechanic: true,
    fallbackNote: "En el teléfono los encuentras tocando «Más».",
    title: "PRESUPUESTOS",
    body: "Cotiza sin abrir una orden: el cliente aprueba desde su teléfono y la orden de trabajo se crea sola. Todo queda en el historial, también lo rechazado.",
  },
  {
    target: "/admin/caja",
    noMechanic: true,
    fallbackNote: "En el teléfono la encuentras tocando «Más».",
    title: "CAJA",
    body: "Registra cobros, consulta el corte del día por método de pago y los saldos por cobrar.",
  },
  {
    target: "/admin/inventario",
    title: "INVENTARIO",
    body: "Control de repuestos y stock. Cuando algo se está agotando verás un aviso rojo aquí.",
  },
  {
    target: "/admin/recordatorios",
    fallbackNote: "En el teléfono los encuentras tocando «Más».",
    title: "RECORDATORIOS",
    body: "Programa avisos de próximo servicio y envíaselos a tus clientes por WhatsApp.",
  },
  {
    target: "/admin/usuarios",
    adminOnly: true,
    fallbackNote: "En el teléfono lo encuentras tocando «Más».",
    title: "EQUIPO",
    body: "Crea accesos para tu equipo. Asesores y mecánicos ven solo lo que necesitan.",
  },
  {
    title: "¡LISTO!",
    body: "Eso es lo esencial. Si quieres repasarlo, entra a Mi cuenta y toca «Ver tutorial de nuevo».",
  },
];

/** Evento global para relanzar el tutorial (lo dispara Mi cuenta). */
export const TOUR_EVENT = "sm96:tour-start";

const PAD = 6; // aire entre el elemento y el recorte del foco
const GAP = 12; // separación entre el recorte y la tarjeta

type Rect = { top: number; left: number; width: number; height: number };

function findVisible(tourId: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${tourId}"]`);
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export default function AdminTour({ autoStart, role }: { autoStart: boolean; role: Role }) {
  const steps = useMemo(
    () =>
      STEPS.filter(
        (s) =>
          (!s.adminOnly || role === "admin") && (!s.noMechanic || role !== "mecanico")
      ),
    [role]
  );

  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = steps[idx];
  const isLast = idx === steps.length - 1;

  const close = useCallback(() => {
    setOpen(false);
    setIdx(0);
    // Persistir en el usuario: omitido o completado, no se vuelve a mostrar solo.
    completeTourAction().catch(() => {});
  }, []);

  // Arranque automático la primera vez (con margen para que pinte el layout).
  useEffect(() => {
    if (!autoStart) return;
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [autoStart]);

  // Relanzamiento manual desde Mi cuenta.
  useEffect(() => {
    const start = () => {
      setIdx(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_EVENT, start);
    return () => window.removeEventListener(TOUR_EVENT, start);
  }, []);

  // Medición del elemento resaltado (y re-medición en resize/scroll).
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      if (!step?.target) {
        setRect(null);
        setUsedFallback(false);
        return;
      }
      let el = findVisible(step.target);
      let fallback = false;
      if (!el && step.fallbackNote) {
        el = findVisible("nav-more");
        fallback = true;
      }
      if (!el) {
        setRect(null);
        setUsedFallback(false);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      setUsedFallback(fallback);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, idx, step]);

  // Posición de la tarjeta: debajo del recorte; si no cabe, encima; clamp lateral.
  useEffect(() => {
    if (!open) return;
    const card = cardRef.current;
    if (!card) return;
    if (!rect) {
      setPos(null);
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tw = card.offsetWidth;
    const th = card.offsetHeight;
    let top = rect.top + rect.height + PAD + GAP;
    if (top + th > vh - 16) top = rect.top - PAD - GAP - th;
    if (top < 16) top = Math.max(16, (vh - th) / 2);
    const left = Math.min(
      Math.max(16, rect.left + rect.width / 2 - tw / 2),
      Math.max(16, vw - tw - 16)
    );
    setPos({ top, left });
  }, [open, rect, idx]);

  // Bloquear scroll del fondo y cerrar con Escape mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Llevar el foco a la tarjeta en cada paso (lectores de pantalla y teclado).
  useEffect(() => {
    if (open) cardRef.current?.focus();
  }, [open, idx]);

  if (!open || !step) return null;

  const centered = !step.target || !rect;

  const card = (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 w-[calc(100vw-2rem)] max-w-sm outline-none animate-slide-up"
      style={centered ? undefined : { visibility: pos ? "visible" : "hidden" }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          id="tour-title"
          className="font-heading font-bold text-slate-900 tracking-wide text-lg leading-tight"
        >
          {step.title}
        </h2>
        <button
          onClick={close}
          aria-label="Omitir tutorial"
          className="shrink-0 -m-1 p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed">{step.body}</p>
      {usedFallback && step.fallbackNote && (
        <p className="mt-2 text-sm text-sm-red font-medium">{step.fallbackNote}</p>
      )}

      <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === idx ? "w-5 bg-sm-red" : "w-1.5 bg-slate-200"
            }`}
          />
        ))}
        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {idx + 1} de {steps.length}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        {idx === 0 ? (
          <button onClick={close} className={btnSecondary}>
            Omitir
          </button>
        ) : (
          <button onClick={() => setIdx(idx - 1)} className={btnSecondary}>
            Atrás
          </button>
        )}
        {isLast ? (
          <button onClick={close} className={btnPrimary}>
            ¡A trabajar!
          </button>
        ) : (
          <button onClick={() => setIdx(idx + 1)} className={btnPrimary}>
            {idx === 0 ? "Empezar" : "Siguiente"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50">
      {centered ? (
        <>
          <div className="absolute inset-0 bg-slate-950/70" />
          <div className="absolute inset-0 grid place-items-center p-4">{card}</div>
        </>
      ) : (
        <>
          <div
            className="absolute rounded-xl transition-all duration-300 pointer-events-none"
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.7)",
            }}
          />
          <div className="absolute" style={pos ?? { top: 0, left: 0 }}>
            {card}
          </div>
        </>
      )}
    </div>
  );
}
