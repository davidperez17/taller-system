// ─────────────────────────────────────────────────────────────────────────────
// Totales con descuento. UN SOLO lugar para la aritmética del dinero.
//
// El descuento se aplica sobre el TOTAL, nunca por línea: se guarda como
// (discount_type, discount_value) en quotes y en orders, y "sin descuento" es
// SIEMPRE (NULL, 0) — ver la nota de la migración v16 en schema.ts.
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

export type Totals = { subtotal: number; discount: number; total: number };

export type DiscountFields = {
  discount_type: DiscountType | null;
  discount_value: number;
};

/**
 * Subtotal → {subtotal, discount, total}, con el descuento ya topado y
 * redondeado. Tolerante a basura (NaN, negativos, tipo desconocido) porque lo
 * llaman componentes que reciben la fila cruda de la BD.
 */
export function applyDiscount(
  subtotal: number,
  type: string | null | undefined,
  value: number | null | undefined
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
  return { subtotal: sub, discount, total: round2(sub - discount) };
}

export const sumItems = (items: { qty: number; unit_price: number }[]): number =>
  items.reduce((s, i) => s + i.qty * i.unit_price, 0);

/** Atajo para el caso normal: conceptos + fila de quotes/orders. */
export function totalsOf(
  items: { qty: number; unit_price: number }[],
  type: string | null | undefined,
  value: number | null | undefined
): Totals {
  return applyDiscount(sumItems(items), type, value);
}

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

// ── Presupuestos ────────────────────────────────────────────────────────────
// Alias `qi` a propósito: los call-sites ya usan `i` para otras cosas.

export const quoteSubtotalSql = (q: string) =>
  `(SELECT COALESCE(SUM(qi.qty * qi.unit_price), 0)::float8
      FROM quote_items qi WHERE qi.quote_id = ${q}.id)`;

export const quoteTotalSql = (q: string) =>
  `ROUND((${quoteSubtotalSql(q)} - ${discountSql(q, quoteSubtotalSql(q))})::numeric, 2)::float8`;

// ── Órdenes ─────────────────────────────────────────────────────────────────

/** Una fila por orden: subtotal, costo, descuento y total ya descontado. */
export const ORDER_TOTALS_SQL = `(
  SELECT o2.id AS order_id,
         ROUND(COALESCE(s.subtotal, 0)::numeric, 2)::float8 AS subtotal,
         COALESCE(s.cost, 0)::float8 AS cost,
         ${discountSql("o2", "COALESCE(s.subtotal, 0)")} AS discount,
         ROUND((COALESCE(s.subtotal, 0)
                - ${discountSql("o2", "COALESCE(s.subtotal, 0)")})::numeric, 2)::float8 AS total
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
 * Invariante: SUM(net) de una orden == total de esa orden. Puede diferir en
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
               THEN (oi.qty * oi.unit_price) * (ot.total / ot.subtotal)
               ELSE 0 END)::float8 AS net
    FROM order_items oi
    JOIN ${ORDER_TOTALS_SQL} ot ON ot.order_id = oi.order_id
)`;
