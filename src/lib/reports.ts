import { many, one } from "./db";
import {
  formatMoney, formatDate, formatDateShort, formatDay, ROLES, EXPENSE_CATEGORIES,
} from "./status";
import { ORDER_ITEM_NET_SQL } from "./totals";

// ─────────────────────────────────────────────────────────────────────────────
// Reportes: resolución del período y detalle de cada KPI.
//
// Vive en lib/ porque lo comparten la página de reportes (los totales de las
// tarjetas) y el detalle por métrica (/admin/reportes/[metrica]): ambos deben
// contar EXACTAMENTE lo mismo o el detalle contradiría a la tarjeta que lo
// abrió. Cada loader devuelve su total con un SUM propio sobre todo el rango,
// nunca sumando las filas listadas (que van con LIMIT).
// ─────────────────────────────────────────────────────────────────────────────

// Fechas en día de Guatemala (UTC-6), como hace caja.
export function gtNow(): Date {
  return new Date(Date.now() - 6 * 3600_000);
}
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Los pagos guardan created_at en UTC; el día de caja se corre 6 h para atrás.
const PAYMENT_DAY_SQL = "to_char(p.created_at::timestamp - interval '6 hours', 'YYYY-MM-DD')";

export type RangePreset = { label: string; desde: string; hasta: string };

export type ResolvedRange = {
  desde: string;
  hasta: string;
  today: string;
  presetKey: string | null;
  custom: boolean;
  rangeDays: number;
  payrollFactor: number;
  presets: Record<string, RangePreset>;
  // Querystring que preserva el período al navegar entre reportes y detalles.
  query: string;
};

export function resolveRange(sp: {
  r?: string;
  desde?: string;
  hasta?: string;
}): ResolvedRange {
  const now = gtNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const today = isoDay(now);

  const presets: Record<string, RangePreset> = {
    mes: { label: "Este mes", desde: isoDay(new Date(Date.UTC(y, m, 1))), hasta: today },
    prev: {
      label: "Mes anterior",
      desde: isoDay(new Date(Date.UTC(y, m - 1, 1))),
      hasta: isoDay(new Date(Date.UTC(y, m, 0))),
    },
    "3m": { label: "3 meses", desde: isoDay(new Date(Date.UTC(y, m - 2, 1))), hasta: today },
    "6m": { label: "6 meses", desde: isoDay(new Date(Date.UTC(y, m - 5, 1))), hasta: today },
    ano: { label: "Este año", desde: isoDay(new Date(Date.UTC(y, 0, 1))), hasta: today },
  };

  const okDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const custom = okDate(sp.desde) && okDate(sp.hasta) && sp.desde! <= sp.hasta!;
  const presetKey = custom ? null : sp.r && presets[sp.r] ? sp.r : "6m";
  const desde = custom ? sp.desde! : presets[presetKey!].desde;
  const hasta = custom ? sp.hasta! : presets[presetKey!].hasta;
  const rangeDays = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400_000) + 1;

  return {
    desde,
    hasta,
    today,
    presetKey,
    custom,
    rangeDays,
    payrollFactor: rangeDays / 30.44, // prorrateo aproximado por días
    presets,
    query: custom
      ? `desde=${desde}&hasta=${hasta}`
      : `r=${presetKey}`,
  };
}

// ---------- Detalle por métrica ----------

export const REPORT_METRICS = [
  "facturado",
  "cobrado",
  "margen",
  "gastos",
  "planilla",
  "neta",
] as const;
export type ReportMetric = (typeof REPORT_METRICS)[number];

export function isReportMetric(s: string): s is ReportMetric {
  return (REPORT_METRICS as readonly string[]).includes(s);
}

// Fila del historial. Uniforme a propósito: los seis detalles se pintan con el
// mismo componente (izquierda qué fue, derecha cuánto), así el equipo aprende a
// leer uno y sabe leer los seis.
export type DetailRow = {
  key: string;
  title: string;
  subtitle?: string | null;
  extra?: string | null;
  amount: number;
  href?: string | null;
};

export type MetricDetail = {
  label: string;
  description: string;
  total: number;
  // Resumen de cabecera (p. ej. desglose por método de pago o categoría).
  summary: { label: string; value: string }[];
  rows: DetailRow[];
  countLabel: string;
  // Filas que no se listaron por el tope; 0 = se ve todo.
  truncated: number;
  emptyText: string;
  note?: string;
};

// Tope de filas listadas. El total SIEMPRE sale de un SUM aparte, así que
// recortar la lista no falsea el número: solo se avisa cuántas faltan.
const LIMIT = 500;

const plural = (n: number, uno: string, varios: string) =>
  `${n} ${n === 1 ? uno : varios}`;

export async function loadMetricDetail(
  metric: ReportMetric,
  range: ResolvedRange
): Promise<MetricDetail> {
  const { desde, hasta } = range;

  if (metric === "facturado" || metric === "margen") {
    const isMargin = metric === "margen";
    const agg = (await one<{ total: number; cost: number; n: number }>(
      `SELECT COALESCE(SUM(i.net), 0)::float8 AS total,
              COALESCE(SUM(i.cost), 0)::float8 AS cost,
              COUNT(DISTINCT o.id)::int AS n
         FROM orders o JOIN ${ORDER_ITEM_NET_SQL} i ON i.order_id = o.id
        WHERE o.status = 'entregado' AND substr(o.delivered_at, 1, 10) BETWEEN ? AND ?`,
      [desde, hasta]
    ))!;
    const rows = await many<{
      id: number; folio: string; plate: string; client: string | null; delivered_at: string;
      modality: string; total: number; cost: number;
    }>(
      `SELECT o.id, o.folio, v.plate, c.name AS client, o.delivered_at, o.modality,
              COALESCE(SUM(i.net), 0)::float8 AS total,
              COALESCE(SUM(i.cost), 0)::float8 AS cost
         FROM orders o
         JOIN vehicles v ON v.id = o.vehicle_id
         LEFT JOIN clients c ON c.id = v.client_id
         JOIN ${ORDER_ITEM_NET_SQL} i ON i.order_id = o.id
        WHERE o.status = 'entregado' AND substr(o.delivered_at, 1, 10) BETWEEN ? AND ?
        GROUP BY o.id, o.folio, v.plate, c.name, o.delivered_at, o.modality
        ORDER BY o.delivered_at DESC, o.id DESC
        LIMIT ${LIMIT}`,
      [desde, hasta]
    );
    const gross = agg.total - agg.cost;
    return {
      label: isMargin ? "Margen bruto" : "Facturado",
      description: isMargin
        ? "Cada orden entregada del período con lo que se cobró, lo que costó y lo que dejó."
        : "Cada orden entregada del período y lo que se le facturó.",
      total: isMargin ? gross : agg.total,
      summary: isMargin
        ? [
            { label: "Facturado", value: formatMoney(agg.total) },
            { label: "Costo de ítems", value: formatMoney(agg.cost) },
            {
              label: "Margen",
              value: `${agg.total > 0 ? Math.round((gross / agg.total) * 100) : 0}%`,
            },
          ]
        : [
            { label: "Órdenes", value: String(agg.n) },
            {
              label: "Ticket promedio",
              value: formatMoney(agg.n > 0 ? agg.total / agg.n : 0),
            },
          ],
      rows: rows.map((r) => {
        const profit = r.total - r.cost;
        return {
          key: String(r.id),
          title: `${r.folio} · ${r.plate}`,
          subtitle: `${r.client ?? "Sin cliente"} · ${formatDateShort(r.delivered_at)}${
            r.modality === "domicilio" ? " · a domicilio" : ""
          }`,
          extra: isMargin
            ? `Facturado ${formatMoney(r.total)} − costo ${formatMoney(r.cost)}`
            : null,
          amount: isMargin ? profit : r.total,
          href: `/admin/ordenes/${r.id}`,
        };
      }),
      countLabel: plural(agg.n, "orden entregada", "órdenes entregadas"),
      truncated: Math.max(0, agg.n - rows.length),
      emptyText: "No hay órdenes entregadas en este período.",
      note: isMargin
        ? "El margen descuenta el costo registrado en cada ítem. Los ítems sin costo cuentan como costo 0 y suben el margen. Si la orden llevó descuento, se reparte entre sus conceptos."
        : "Solo cuentan las órdenes entregadas: una orden en curso todavía no factura. Lo facturado es neto de descuentos: si la orden llevó uno, aquí cuenta lo que se cobró, no la suma de los conceptos.",
    };
  }

  if (metric === "cobrado") {
    const agg = (await one<{ total: number; n: number }>(
      `SELECT COALESCE(SUM(p.amount), 0)::float8 AS total, COUNT(*)::int AS n
         FROM payments p WHERE ${PAYMENT_DAY_SQL} BETWEEN ? AND ?`,
      [desde, hasta]
    ))!;
    const byMethod = await many<{ method: string; total: number }>(
      `SELECT p.method, COALESCE(SUM(p.amount), 0)::float8 AS total
         FROM payments p WHERE ${PAYMENT_DAY_SQL} BETWEEN ? AND ?
        GROUP BY p.method ORDER BY total DESC`,
      [desde, hasta]
    );
    const rows = await many<{
      id: number; amount: number; method: string; reference: string | null; created_at: string;
      order_id: number; folio: string; plate: string; by_name: string | null;
    }>(
      `SELECT p.id, p.amount, p.method, p.reference, p.created_at,
              o.id AS order_id, o.folio, v.plate, u.name AS by_name
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         JOIN vehicles v ON v.id = o.vehicle_id
         LEFT JOIN users u ON u.id = p.created_by
        WHERE ${PAYMENT_DAY_SQL} BETWEEN ? AND ?
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT ${LIMIT}`,
      [desde, hasta]
    );
    return {
      label: "Cobrado",
      description: "Cada pago que entró a caja en el período.",
      total: agg.total,
      summary: byMethod.map((b) => ({
        label: b.method.charAt(0).toUpperCase() + b.method.slice(1),
        value: formatMoney(b.total),
      })),
      rows: rows.map((r) => ({
        key: String(r.id),
        title: `${r.folio} · ${r.plate}`,
        subtitle: `${formatDate(r.created_at)} · ${r.method}${
          r.reference ? ` · ref. ${r.reference}` : ""
        }`,
        extra: r.by_name ? `Registró ${r.by_name}` : null,
        amount: r.amount,
        href: `/admin/ordenes/${r.order_id}`,
      })),
      countLabel: plural(agg.n, "pago registrado", "pagos registrados"),
      truncated: Math.max(0, agg.n - rows.length),
      emptyText: "No se registraron pagos en este período.",
      note: "Cobrado no es lo mismo que facturado: aquí entra el dinero que ya se recibió, aunque la orden se haya entregado en otro mes o siga en el taller. Por eso el cobrado no entra en la Ganancia neta, que solo cuenta lo entregado: puedes tener la caja llena y la ganancia en rojo si cobraste por adelantado trabajo que aún no sale.",
    };
  }

  if (metric === "gastos") {
    const agg = (await one<{ total: number; n: number }>(
      `SELECT COALESCE(SUM(amount), 0)::float8 AS total, COUNT(*)::int AS n
         FROM expenses WHERE spent_on BETWEEN ? AND ?`,
      [desde, hasta]
    ))!;
    const byCat = await many<{ category: string; total: number }>(
      `SELECT category, COALESCE(SUM(amount), 0)::float8 AS total
         FROM expenses WHERE spent_on BETWEEN ? AND ?
        GROUP BY category ORDER BY total DESC`,
      [desde, hasta]
    );
    const rows = await many<{
      id: number; spent_on: string; category: string; amount: number;
      notes: string | null; by_name: string | null;
    }>(
      `SELECT e.id, e.spent_on, e.category, e.amount, e.notes, u.name AS by_name
         FROM expenses e LEFT JOIN users u ON u.id = e.created_by
        WHERE e.spent_on BETWEEN ? AND ?
        ORDER BY e.spent_on DESC, e.id DESC
        LIMIT ${LIMIT}`,
      [desde, hasta]
    );
    return {
      label: "Gastos",
      description: "Cada gasto del taller registrado en el período.",
      total: agg.total,
      summary: byCat.map((b) => ({
        label: EXPENSE_CATEGORIES[b.category] ?? b.category,
        value: formatMoney(b.total),
      })),
      rows: rows.map((r) => ({
        key: String(r.id),
        title: EXPENSE_CATEGORIES[r.category] ?? r.category,
        subtitle: `${formatDay(r.spent_on)}${r.by_name ? ` · registró ${r.by_name}` : ""}`,
        extra: r.notes,
        amount: r.amount,
        href: "/admin/gastos",
      })),
      countLabel: plural(agg.n, "gasto registrado", "gastos registrados"),
      truncated: Math.max(0, agg.n - rows.length),
      emptyText: "No hay gastos registrados en este período.",
      note: "Los salarios no van aquí: se registran como costo mensual de cada persona en Equipo y salen en Planilla.",
    };
  }

  if (metric === "planilla") {
    const users = await many<{ id: number; name: string; role: string; monthly_cost: number }>(
      `SELECT id, name, role, monthly_cost FROM users
        WHERE active = 1 AND monthly_cost > 0 ORDER BY monthly_cost DESC`
    );
    const monthly = users.reduce((s, u) => s + u.monthly_cost, 0);
    return {
      label: "Planilla estimada",
      description: `Costo mensual del equipo activo, prorrateado a los ${range.rangeDays} días del período.`,
      total: monthly * range.payrollFactor,
      summary: [
        { label: "Costo mensual", value: formatMoney(monthly) },
        { label: "Días del período", value: String(range.rangeDays) },
        { label: "Factor", value: `× ${range.payrollFactor.toFixed(2)}` },
      ],
      rows: users.map((u) => ({
        key: String(u.id),
        title: u.name,
        subtitle: ROLES[u.role] ?? u.role,
        extra: `${formatMoney(u.monthly_cost)}/mes × ${range.payrollFactor.toFixed(2)}`,
        amount: u.monthly_cost * range.payrollFactor,
        href: "/admin/usuarios",
      })),
      countLabel: plural(users.length, "persona con costo", "personas con costo"),
      truncated: 0,
      emptyText: "Nadie del equipo tiene costo mensual registrado. Agrégalo en Equipo.",
      note: "Es una estimación: se prorratea el costo mensual por los días del período, no se marcan horas reales.",
    };
  }

  // neta — no es una lista de hechos sino la fórmula; cada renglón lleva a su
  // propio detalle.
  const inv = (await one<{ total: number; cost: number }>(
    `SELECT COALESCE(SUM(i.net), 0)::float8 AS total,
            COALESCE(SUM(i.cost), 0)::float8 AS cost
       FROM orders o JOIN ${ORDER_ITEM_NET_SQL} i ON i.order_id = o.id
      WHERE o.status = 'entregado' AND substr(o.delivered_at, 1, 10) BETWEEN ? AND ?`,
    [desde, hasta]
  ))!;
  const exp = (await one<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM expenses WHERE spent_on BETWEEN ? AND ?",
    [desde, hasta]
  ))!;
  const payroll =
    (await one<{ total: number }>(
      "SELECT COALESCE(SUM(monthly_cost), 0)::float8 AS total FROM users WHERE active = 1"
    ))!.total * range.payrollFactor;

  const gross = inv.total - inv.cost;
  const net = gross - exp.total - payroll;
  const link = (m: string) => `/admin/reportes/${m}?${range.query}`;

  return {
    label: "Ganancia neta",
    description: "De lo facturado a lo que realmente quedó. Toca cualquier renglón para ver su detalle.",
    total: net,
    summary: [
      { label: "Margen bruto", value: formatMoney(gross) },
      { label: "Gastos + planilla", value: formatMoney(exp.total + payroll) },
    ],
    rows: [
      {
        key: "facturado",
        title: "Facturado",
        subtitle: "Órdenes entregadas del período",
        amount: inv.total,
        href: link("facturado"),
      },
      {
        key: "costo",
        title: "Costo de repuestos y servicios",
        subtitle: "Costo registrado en cada ítem vendido",
        amount: -inv.cost,
        href: link("margen"),
      },
      {
        key: "gastos",
        title: "Gastos del taller",
        subtitle: "Renta, insumos, herramientas…",
        amount: -exp.total,
        href: link("gastos"),
      },
      {
        key: "planilla",
        title: "Planilla estimada",
        subtitle: "Costo del equipo prorrateado al período",
        amount: -payroll,
        href: link("planilla"),
      },
    ],
    countLabel: "4 componentes",
    truncated: 0,
    emptyText: "Sin movimientos en este período.",
    note: "Ganancia neta = facturado − costo de ítems − gastos − planilla.",
  };
}
