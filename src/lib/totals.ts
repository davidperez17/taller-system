// ─────────────────────────────────────────────────────────────────────────────
// Totales con descuento y recargo. UN SOLO lugar para la aritmética del dinero.
//
// El descuento se aplica sobre el TOTAL, nunca por línea: se guarda como
// (discount_type, discount_value) en quotes y en orders, y "sin descuento" es
// SIEMPRE (NULL, 0) — ver la nota de la migración v16 en schema.ts.
//
// El recargo por pagar con tarjeta de débito va DESPUÉS del descuento:
//   subtotal − descuento = base;  recargo = base × surcharge_pct / 100;
//   total = base + recargo.
// surcharge_pct es 0 (sin recargo) o la tasa congelada al aplicarlo (v19).
//
// Este archivo tiene dos caras del MISMO cálculo porque el proyecto suma tanto
// en TS (reduce sobre las filas ya traídas) como en SQL (agregados de reportes,
// caja, tope de pagos). Si tocas una, toca la otra: divergir significa que la
// pantalla y el reporte muestran números distintos para el mismo trabajo.
//
// Sin dependencias, igual que validate.ts.
//
// Consumidores SQL — un `grep "qty \* unit_price"` fuera de este archivo solo
// debería encontrar los INSERT/UPDATE de items; cualquier otra cosa es una
// divergencia:
//   lib/reports.ts · lib/quotes.ts · app/admin/actions.ts (addPaymentAction)
//   app/admin/(panel)/{page,caja/page,reportes/page,presupuestos/page}.tsx
//   app/api/public/track/[placa]/approve/route.ts
// ─────────────────────────────────────────────────────────────────────────────

export type DiscountType = "porcentaje" | "monto";

export function isDiscountType(s: string): s is DiscountType {
  return s === "porcentaje" || s === "monto";
}

// Redondeo a centavos. El resto del sistema guarda floats crudos y redondea solo
// al pintar (formatMoney), pero el descuento obliga a cerrar antes: el cliente ve
// Subtotal, Descuento y Total juntos y los tres deben cuadrar. 10% de Q333.33 es
// Q33.333, y sin este redondeo la resta en pantalla no daría el total mostrado.
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type Totals = { subtotal: number; discount: number; surcharge: number; total: number };

// Tasa SUGERIDA del recargo por pagar con tarjeta de débito: la que pone el
// botón de un toque. El asesor puede cambiarla por presupuesto u orden (hasta
// MAX_SURCHARGE_PCT). Se congela en la fila (surcharge_pct) al aplicarla: si el
// banco cambia la comisión, los presupuestos y órdenes viejos conservan la tasa
// que vio el cliente.
export const DEBIT_SURCHARGE_PCT = 5;

// Tope del recargo editable. Ninguna comisión de POS se le acerca; frena el
// dedazo (50 en vez de 5) que inflaría el total que ve el cliente.
export const MAX_SURCHARGE_PCT = 20;

export type DiscountFields = {
  discount_type: DiscountType | null;
  discount_value: number;
};

/**
 * Subtotal → {subtotal, discount, surcharge, total}, con el descuento ya topado
 * y todo redondeado. Tolerante a basura (NaN, negativos, tipo desconocido)
 * porque lo llaman componentes que reciben la fila cruda de la BD.
 */
export function applyDiscount(
  subtotal: number,
  type: string | null | undefined,
  value: number | null | undefined,
  surchargePct: number | null | undefined = 0
): Totals {
  const sub = round2(Number.isFinite(subtotal) ? subtotal : 0);
  const raw = Number(value);
  const v = Number.isFinite(raw) && raw > 0 ? raw : 0;
  let discount = 0;
  if (v > 0 && sub > 0) {
    if (type === "porcentaje") discount = (sub * Math.min(v, 100)) / 100;
    else if (type === "monto") discount = Math.min(v, sub);
  }
  discount = round2(discount);
  const base = round2(sub - discount);
  const rawPct = Number(surchargePct);
  const pct = Number.isFinite(rawPct) && rawPct > 0 ? Math.min(rawPct, 100) : 0;
  const surcharge = round2((base * pct) / 100);
  return { subtotal: sub, discount, surcharge, total: round2(base + surcharge) };
}

export const sumItems = (items: { qty: number; unit_price: number }[]): number =>
  items.reduce((s, i) => s + i.qty * i.unit_price, 0);

/** Atajo para el caso normal: conceptos + fila de quotes/orders. */
export function totalsOf(
  items: { qty: number; unit_price: number }[],
  type: string | null | undefined,
  value: number | null | undefined,
  surchargePct: number | null | undefined = 0
): Totals {
  return applyDiscount(sumItems(items), type, value, surchargePct);
}

/** Etiqueta del renglón del recargo, igual en panel, PDF y páginas públicas. */
export const surchargeLabel = (pct: number) => `Recargo tarjeta de débito (${pct}%)`;

// ─────────────────────────────────────────────────────────────────────────────
// Cara SQL: fragmentos que se interpolan en las queries, mismo patrón que
// EXPIRED_SQL/FOLLOWUP_DUE_SQL (lib/quotes.ts) y PAYMENT_DAY_SQL (lib/reports.ts).
//
// Ninguno lleva `?`, así que no interfieren con la numeración posicional de
// toPg() (db.ts): se pueden meter en cualquier punto de una query parametrizada
// sin descuadrar los $n.
//
// Se descartó una VIEW: CREATE OR REPLACE VIEW no admite cambiar la lista de
// columnas, así que una migración futura sobre order_items obligaría a un
// DROP ... CASCADE, que no es idempotente y rompería ensureSchema.
// ─────────────────────────────────────────────────────────────────────────────

/** Monto del descuento. `t` = alias de quotes/orders; `sub` = expresión del subtotal. */
export const discountSql = (t: string, sub: string) =>
  `ROUND((CASE
      WHEN ${t}.discount_type = 'porcentaje'
        THEN (${sub}) * LEAST(GREATEST(COALESCE(${t}.discount_value, 0), 0), 100) / 100
      WHEN ${t}.discount_type = 'monto'
        THEN LEAST(GREATEST(COALESCE(${t}.discount_value, 0), 0), (${sub}))
      ELSE 0
    END)::numeric, 2)::float8`;

/**
 * Monto del recargo. `base` = subtotal ya descontado. Mismo redondeo que
 * applyDiscount: primero se cierra la base a centavos y luego el recargo.
 */
export const surchargeSql = (t: string, base: string) =>
  `ROUND(((${base}) * LEAST(GREATEST(COALESCE(${t}.surcharge_pct, 0), 0), 100) / 100)::numeric, 2)::float8`;

// ── Presupuestos ────────────────────────────────────────────────────────────
// Alias `qi` a propósito: los call-sites ya usan `i` para otras cosas.

export const quoteSubtotalSql = (q: string) =>
  `(SELECT COALESCE(SUM(qi.qty * qi.unit_price), 0)::float8
      FROM quote_items qi WHERE qi.quote_id = ${q}.id)`;

const quoteBaseSql = (q: string) =>
  `ROUND((${quoteSubtotalSql(q)} - ${discountSql(q, quoteSubtotalSql(q))})::numeric, 2)::float8`;

export const quoteTotalSql = (q: string) =>
  `ROUND((${quoteBaseSql(q)} + ${surchargeSql(q, quoteBaseSql(q))})::numeric, 2)::float8`;

// ── Órdenes ─────────────────────────────────────────────────────────────────

// Subtotal ya descontado de una orden (alias o2/s de ORDER_TOTALS_SQL).
const ORDER_BASE_SQL = `ROUND((COALESCE(s.subtotal, 0)
                - ${discountSql("o2", "COALESCE(s.subtotal, 0)")})::numeric, 2)::float8`;

/**
 * Una fila por orden: subtotal, costo, descuento, recargo por tarjeta y total
 * (ya descontado y con el recargo). `total` es lo que se le cobra al cliente.
 */
export const ORDER_TOTALS_SQL = `(
  SELECT o2.id AS order_id,
         ROUND(COALESCE(s.subtotal, 0)::numeric, 2)::float8 AS subtotal,
         COALESCE(s.cost, 0)::float8 AS cost,
         ${discountSql("o2", "COALESCE(s.subtotal, 0)")} AS discount,
         ${surchargeSql("o2", ORDER_BASE_SQL)} AS surcharge,
         ROUND((${ORDER_BASE_SQL}
                + ${surchargeSql("o2", ORDER_BASE_SQL)})::numeric, 2)::float8 AS total
    FROM orders o2
    LEFT JOIN (SELECT order_id,
                      SUM(qty * unit_price)::float8 AS subtotal,
                      SUM(qty * unit_cost)::float8  AS cost
                 FROM order_items GROUP BY order_id) s ON s.order_id = o2.id
)`;

/**
 * Una fila por CONCEPTO con el descuento PRORRATEADO a su peso en el subtotal.
 * Es lo que permite que los reportes agrupados por tipo/mecánico/modalidad bajen
 * sus ingresos sin inventar una categoría "descuento" que no cuadraría con nada.
 *
 * El recargo por tarjeta NO se prorratea: no es venta de servicios ni de
 * repuestos, sino lo que cubre la comisión del banco, y Reportes lo muestra en
 * su propio renglón (SUM(ORDER_TOTALS_SQL.surcharge)).
 *
 * Invariante: SUM(net) de una orden == total − recargo. Puede diferir en
 * fracciones de centavo por el prorrateo en float, lo cual es aceptable para
 * agregados; los sitios que muestran el total de UNA orden usan
 * ORDER_TOTALS_SQL.total, nunca la suma de net.
 */
export const ORDER_ITEM_NET_SQL = `(
  SELECT oi.id, oi.order_id, oi.kind, oi.part_id, oi.service_id, oi.created_at,
         oi.qty, oi.unit_price, oi.unit_cost,
         (oi.qty * oi.unit_price)::float8 AS gross,
         (oi.qty * oi.unit_cost)::float8  AS cost,
         (CASE WHEN ot.subtotal > 0
               THEN (oi.qty * oi.unit_price) * ((ot.total - ot.surcharge) / ot.subtotal)
               ELSE 0 END)::float8 AS net
    FROM order_items oi
    JOIN ${ORDER_TOTALS_SQL} ot ON ot.order_id = oi.order_id
)`;
