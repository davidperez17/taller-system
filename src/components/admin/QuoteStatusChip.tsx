import { Clock } from "lucide-react";
import { QUOTE_STATUS_META, type QuoteStatus } from "@/lib/status";

// Clases estáticas por estado (no interpoladas) para que el JIT de Tailwind
// las conserve, igual que ACTIVITY_TONE_CLASS.
const CHIP_CLASS: Record<QuoteStatus, string> = {
  pendiente: "bg-amber-50 text-amber-700 border-amber-200",
  aprobado: "bg-accent-50 text-accent-700 border-accent-200",
  rechazado: "bg-red-50 text-red-700 border-red-200",
  cancelado: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function QuoteStatusChip({ status }: { status: QuoteStatus }) {
  const meta = QUOTE_STATUS_META[status] ?? QUOTE_STATUS_META.pendiente;
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold uppercase tracking-wide border rounded-full px-2 py-0.5 ${
        CHIP_CLASS[status] ?? CHIP_CLASS.pendiente
      }`}
    >
      {meta.label}
    </span>
  );
}

// Aviso de vigencia vencida (solo tiene sentido en pendientes).
export function ExpiredChip() {
  return (
    <span className="inline-flex items-center text-[11px] font-semibold uppercase tracking-wide bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5">
      Vencido
    </span>
  );
}

// Cotización enviada que lleva más de un día sin respuesta del cliente y sin
// seguimiento del equipo (FOLLOWUP_DUE_SQL en lib/quotes.ts). Lleva icono
// porque convive con el chip ámbar de "Pendiente": sin él, dos chips cálidos
// seguidos se leen como uno solo.
export function FollowupChip() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5">
      <Clock className="w-3 h-3" aria-hidden="true" />
      Sin respuesta
    </span>
  );
}
