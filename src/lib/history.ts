import { gtNow, isoDay } from "./reports";

// ─────────────────────────────────────────────────────────────────────────────
// Período del historial de órdenes cerradas.
//
// Aparte de resolveRange() (lib/reports.ts) a propósito: los reportes SIEMPRE
// tienen un rango acotado —la planilla se prorratea por días y "todo" no
// significaría nada— mientras que el historial existe justo para alcanzar lo
// viejo, así que su preset por defecto es "Todo" y desde/hasta pueden ser null.
// Comparten el reloj (gtNow/isoDay) para que "este mes" empiece el mismo día en
// las dos pantallas.
// ─────────────────────────────────────────────────────────────────────────────

export type HistoryPreset = { label: string; desde: string | null; hasta: string | null };

export type HistoryRange = {
  /** null = sin piso (desde el primer registro). */
  desde: string | null;
  /** null = sin techo (hasta hoy). */
  hasta: string | null;
  today: string;
  presetKey: string | null;
  custom: boolean;
  presets: Record<string, HistoryPreset>;
  /** Querystring del período, para conservarlo al cambiar de estado o de página. */
  query: string;
};

export function resolveHistoryRange(sp: {
  r?: string;
  desde?: string;
  hasta?: string;
}): HistoryRange {
  const now = gtNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const today = isoDay(now);

  const presets: Record<string, HistoryPreset> = {
    todo: { label: "Todo", desde: null, hasta: null },
    mes: { label: "Este mes", desde: isoDay(new Date(Date.UTC(y, m, 1))), hasta: today },
    prev: {
      label: "Mes anterior",
      desde: isoDay(new Date(Date.UTC(y, m - 1, 1))),
      hasta: isoDay(new Date(Date.UTC(y, m, 0))),
    },
    "3m": { label: "3 meses", desde: isoDay(new Date(Date.UTC(y, m - 2, 1))), hasta: today },
    ano: { label: "Este año", desde: isoDay(new Date(Date.UTC(y, 0, 1))), hasta: today },
  };

  const okDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const custom = okDate(sp.desde) && okDate(sp.hasta) && sp.desde! <= sp.hasta!;
  const presetKey = custom ? null : sp.r && presets[sp.r] ? sp.r : "todo";
  const desde = custom ? sp.desde! : presets[presetKey!].desde;
  const hasta = custom ? sp.hasta! : presets[presetKey!].hasta;

  return {
    desde,
    hasta,
    today,
    presetKey,
    custom,
    presets,
    query: custom ? `desde=${desde}&hasta=${hasta}` : `r=${presetKey}`,
  };
}

// Día de cierre de una orden: la entrega si la hay, y si no la última
// actualización —las canceladas no tienen delivered_at, y las entregadas de
// antes de que existiera la columna tampoco. `o` es el alias de orders.
export const CLOSED_DAY_SQL = (o = "o") =>
  `substr(COALESCE(${o}.delivered_at, ${o}.updated_at), 1, 10)`;

/** Suma de pagos por orden, para el saldo. Se une por LEFT JOIN. */
export const ORDER_PAID_SQL = `(
  SELECT order_id, SUM(amount)::float8 AS paid FROM payments GROUP BY order_id
)`;
