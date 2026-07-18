import { one, many, run, newTrackingCode, withFolioRetry } from "./db";
import { safeCodeEqual } from "./tracking";
import { sendPushToStaff } from "./push";
import { STAFF_NOTIFS } from "./notifications";
import { logActivity } from "./activity";
import { formatMoney, type QuoteStatus } from "./status";
import { totalsOf, quoteTotalSql, type DiscountType } from "./totals";

const NOW_SQL = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')";

// ─────────────────────────────────────────────────────────────────────────────
// Presupuestos pre-orden (módulo Presupuestos). El presupuesto existe ANTES de
// la orden: guarda un snapshot del cliente/vehículo (las FKs son SET NULL) y al
// aprobarse —desde la página pública o por el staff— genera la orden con los
// conceptos copiados. Vive en lib/ porque lo consumen las server actions del
// panel Y el route público de aprobación.
// ─────────────────────────────────────────────────────────────────────────────

export type QuoteRow = {
  id: number;
  folio: string;
  public_code: string;
  status: QuoteStatus;
  client_id: number | null;
  vehicle_id: number | null;
  client_name: string | null;
  client_phone: string | null;
  plate: string;
  vehicle_type: string;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  vehicle_color: string | null;
  description: string;
  notes: string | null;
  valid_until: string | null;
  sent_at: string | null;
  followed_up_at: string | null;
  decided_at: string | null;
  decided_via: "cliente" | "staff" | null;
  decided_by: number | null;
  decision_total: number | null;
  discount_type: DiscountType | null;
  discount_value: number;
  order_id: number | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type QuoteItemRow = {
  id: number;
  kind: string;
  description: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
  part_id: number | null;
  service_id: number | null;
};

// Fila enriquecida para el panel: nombre/teléfono vivos del cliente si sigue
// registrado (si no, el snapshot), quién decidió y el folio de la orden generada.
export type QuoteDetail = QuoteRow & {
  display_client_name: string | null;
  display_client_phone: string | null;
  decided_by_name: string | null;
  order_folio: string | null;
  expired: boolean;
  followup_due: boolean;
};

// Vigencia comparada como texto YYYY-MM-DD contra la fecha UTC, igual que las
// ventanas de announcements (el corrimiento de ≤6 h en el borde del día no
// importa para una vigencia comercial).
// Exportado para que el PDF (lib/pdf.ts) decida la vigencia con este mismo
// criterio y no contradiga a la página pública ni a la API de aprobación.
export const EXPIRED_SQL = `(q.valid_until IS NOT NULL AND q.status = 'pendiente'
  AND q.valid_until < to_char(now(),'YYYY-MM-DD'))`;

// Horas que un presupuesto puede quedarse "en el aire" antes de que el sistema
// pida seguimiento. Un solo aviso por envío (no una cadena): es más fácil sumar
// insistencia después que quitarla cuando el equipo ya aprendió a ignorarla.
export const FOLLOWUP_HOURS = 24;

// Cotización enviada que el cliente dejó sin responder y que nadie del equipo
// ha perseguido. El vencimiento de la vigencia NO la excluye: una cotización
// que nunca tuvo respuesta es justo la que hay que llamar (y el chip "Vencido"
// ya avisa por su lado que toca duplicarla en vez de esperar la aprobación).
//
// La comparación es en TEXTO contra el mismo to_char que estampa sent_at (igual
// que EXPIRED_SQL): mezclar timestamp y timestamptz haría depender el corte del
// TimeZone de la sesión de Neon.
export const FOLLOWUP_DUE_SQL = `(q.status = 'pendiente' AND q.sent_at IS NOT NULL
  AND q.followed_up_at IS NULL
  AND q.sent_at < to_char(now() - interval '${FOLLOWUP_HOURS} hours','YYYY-MM-DD HH24:MI:SS'))`;

export async function getQuoteWithItems(
  id: number
): Promise<{
  quote: QuoteDetail;
  items: QuoteItemRow[];
  subtotal: number;
  discount: number;
  total: number;
} | null> {
  const quote = await one<QuoteDetail>(
    `SELECT q.*,
            COALESCE(c.name, q.client_name) AS display_client_name,
            COALESCE(c.phone, q.client_phone) AS display_client_phone,
            u.name AS decided_by_name,
            o.folio AS order_folio,
            ${EXPIRED_SQL} AS expired,
            ${FOLLOWUP_DUE_SQL} AS followup_due
       FROM quotes q
       LEFT JOIN clients c ON c.id = q.client_id
       LEFT JOIN users u ON u.id = q.decided_by
       LEFT JOIN orders o ON o.id = q.order_id
      WHERE q.id = ?`,
    [id]
  );
  if (!quote) return null;
  const items = await many<QuoteItemRow>(
    `SELECT id, kind, description, qty, unit_price, unit_cost, part_id, service_id
       FROM quote_items WHERE quote_id = ? ORDER BY id`,
    [id]
  );
  const { subtotal, discount, total } = totalsOf(
    items,
    quote.discount_type,
    quote.discount_value
  );
  return { quote, items, subtotal, discount, total };
}

// ---------- Vista pública ----------

export type PublicQuoteItem = {
  kind: string;
  description: string;
  qty: number;
  unit_price: number;
};

export type PublicQuote = {
  folio: string;
  status: QuoteStatus;
  clientName: string | null;
  plate: string;
  vehicleType: string;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleYear: string | null;
  vehicleColor: string | null;
  description: string;
  validUntil: string | null;
  expired: boolean;
  createdAt: string;
  decidedAt: string | null;
  decisionTotal: number | null;
  items: PublicQuoteItem[];
  // El descuento SÍ es información del cliente (a diferencia de unit_cost y las
  // notas internas): ve Subtotal / Descuento / Total para que la suma de los
  // conceptos cuadre con lo que se le cobra.
  subtotal: number;
  discount: number;
  discountType: DiscountType | null;
  discountValue: number;
  total: number;
  // Solo si está aprobado y la orden ya existe: para enlazar al seguimiento.
  tracking?: { plate: string; code: string };
};

// null tanto si el folio no existe como si el código no coincide: la página
// pública no debe revelar ni la existencia del presupuesto (contiene precios,
// no hay "modo básico" como en el seguimiento). Nunca expone unit_cost ni notas
// internas.
export async function getPublicQuote(
  folioRaw: string,
  code: string | null | undefined
): Promise<PublicQuote | null> {
  const folio = (folioRaw || "").trim().toUpperCase();
  if (!folio || !code) return null;

  const q = await one<
    QuoteRow & {
      display_client_name: string | null;
      expired: boolean;
      order_tracking_code: string | null;
    }
  >(
    `SELECT q.*,
            COALESCE(c.name, q.client_name) AS display_client_name,
            ${EXPIRED_SQL} AS expired,
            o.tracking_code AS order_tracking_code
       FROM quotes q
       LEFT JOIN clients c ON c.id = q.client_id
       LEFT JOIN orders o ON o.id = q.order_id
      WHERE q.folio = ?`,
    [folio]
  );
  if (!q) return null;
  if (!safeCodeEqual(code.trim().toUpperCase(), q.public_code)) return null;

  const items = await many<PublicQuoteItem>(
    "SELECT kind, description, qty, unit_price FROM quote_items WHERE quote_id = ? ORDER BY id",
    [q.id]
  );

  return {
    folio: q.folio,
    status: q.status,
    clientName: q.display_client_name,
    plate: q.plate,
    vehicleType: q.vehicle_type,
    vehicleBrand: q.vehicle_brand,
    vehicleModel: q.vehicle_model,
    vehicleYear: q.vehicle_year,
    vehicleColor: q.vehicle_color,
    description: q.description,
    validUntil: q.valid_until,
    expired: q.expired,
    createdAt: q.created_at,
    decidedAt: q.decided_at,
    decisionTotal: q.decision_total,
    items,
    ...totalsOf(items, q.discount_type, q.discount_value),
    discountType: q.discount_type,
    discountValue: q.discount_value,
    tracking:
      q.status === "aprobado" && q.order_tracking_code
        ? { plate: q.plate, code: q.order_tracking_code }
        : undefined,
  };
}

// ---------- Envío y seguimiento ----------

type Actor = { id: number; name: string };

// 'link' = se le manda la cotización; 'seguimiento' = se le pregunta qué le
// pareció pasadas las FOLLOWUP_HOURS.
export type QuoteSendKind = "link" | "seguimiento";

// Deja constancia de que la cotización salió hacia el cliente. Acotado a
// 'pendiente' (un presupuesto ya decidido no necesita seguimiento) y
// best-effort: el llamador abre WhatsApp gane o pierda el sello.
//
// Reenviar el enlace limpia followed_up_at: volver a mandarlo es volver a
// dejarlo en el aire, así que el reloj de 24 h arranca de nuevo. Dar
// seguimiento solo apaga el aviso, sin reiniciar nada.
//
// El self-join contra `old` lee el valor previo de sent_at en la MISMA query
// (el FROM ve la fila de antes del UPDATE): sin él haría falta un SELECT aparte
// —check-then-act— solo para saber si este es el primer envío.
export async function markQuoteSent(
  quoteId: number,
  kind: QuoteSendKind,
  actor: Actor
): Promise<void> {
  const row = await one<{ folio: string; plate: string; prev_sent_at: string | null }>(
    kind === "link"
      ? `UPDATE quotes q SET sent_at = ${NOW_SQL}, followed_up_at = NULL, updated_at = ${NOW_SQL}
           FROM quotes old
          WHERE old.id = q.id AND q.id = ? AND q.status = 'pendiente'
          RETURNING q.folio, q.plate, old.sent_at AS prev_sent_at`
      : `UPDATE quotes q SET followed_up_at = ${NOW_SQL}, updated_at = ${NOW_SQL}
           FROM quotes old
          WHERE old.id = q.id AND q.id = ? AND q.status = 'pendiente'
          RETURNING q.folio, q.plate, old.sent_at AS prev_sent_at`,
    [quoteId]
  );
  if (!row) return;

  // Los reenvíos no entran en la bitácora: reabrir el chat del cliente es
  // rutina y llenaría la campana de ruido. El primer envío sí es un hito.
  if (kind === "link" && row.prev_sent_at) return;

  await logActivity({
    type: kind === "link" ? "presupuesto_enviado" : "presupuesto_seguimiento",
    title:
      kind === "link"
        ? `Presupuesto ${row.folio} enviado al cliente`
        : `Seguimiento del presupuesto ${row.folio}`,
    detail:
      kind === "link"
        ? `${row.plate} · enviado por WhatsApp.`
        : `${row.plate} · se le preguntó al cliente qué le pareció.`,
    actorId: actor.id,
    actorName: actor.name,
    url: `/admin/presupuestos/${quoteId}`,
  });
}

// ---------- Decisión ----------

// Marca el rechazo con guard de idempotencia y congela el total. El push y la
// bitácora solo corren si el flip ganó (una petición concurrente pierde).
export async function rejectQuote(
  quoteId: number,
  via: "cliente" | "staff",
  actor?: Actor
): Promise<{ ok: boolean; error?: string }> {
  const flipped = await one<{ id: number; folio: string }>(
    `UPDATE quotes SET status = 'rechazado', decided_at = ${NOW_SQL}, decided_via = ?,
        decided_by = ?, updated_at = ${NOW_SQL},
        decision_total = ${quoteTotalSql("quotes")}
      WHERE id = ? AND status = 'pendiente' RETURNING id, folio`,
    [via, actor?.id ?? null, quoteId]
  );
  if (!flipped) return { ok: false, error: "El presupuesto ya fue respondido." };

  await sendPushToStaff(
    {
      ...STAFF_NOTIFS.presupuesto_rechazado({ folio: flipped.folio }),
      url: `/admin/presupuestos/${quoteId}`,
    },
    undefined,
    via === "staff" ? actor?.id : undefined
  );
  await logActivity({
    type: "presupuesto_rechazado",
    title: `Presupuesto ${flipped.folio} rechazado`,
    detail:
      via === "cliente"
        ? "El cliente lo rechazó desde el enlace público."
        : "Registrado por el equipo (el cliente respondió en persona o por llamada).",
    actorId: via === "staff" ? (actor?.id ?? null) : null,
    actorName: via === "cliente" ? "Cliente" : (actor?.name ?? null),
    url: `/admin/presupuestos/${quoteId}`,
  });
  return { ok: true };
}

export type ApproveResult =
  | {
      ok: true;
      orderId: number | null;
      orderFolio: string | null;
      tracking: { plate: string; code: string } | null;
    }
  | { ok: false; error: string };

// Aprobación (ambas vías convergen aquí): flip idempotente + generación de la
// orden. Si la materialización falla a media (Neon HTTP no tiene transacciones)
// el presupuesto queda aprobado sin orden y el panel ofrece "Generar orden"
// para reintentar; la aprobación del cliente nunca se pierde.
export async function approveQuoteAndCreateOrder(
  quoteId: number,
  via: "cliente" | "staff",
  actor?: Actor
): Promise<ApproveResult> {
  const count = await one<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM quote_items WHERE quote_id = ?",
    [quoteId]
  );
  if (!count?.n) return { ok: false, error: "El presupuesto no tiene conceptos." };

  const flipped = await one<{ id: number; folio: string; decision_total: number }>(
    `UPDATE quotes SET status = 'aprobado', decided_at = ${NOW_SQL}, decided_via = ?,
        decided_by = ?, updated_at = ${NOW_SQL},
        decision_total = ${quoteTotalSql("quotes")}
      WHERE id = ? AND status = 'pendiente' RETURNING id, folio, decision_total`,
    [via, actor?.id ?? null, quoteId]
  );
  if (!flipped) return { ok: false, error: "El presupuesto ya fue respondido." };

  let order: MaterializeResult | null = null;
  try {
    order = await materializeOrderFromQuote(quoteId, via === "staff" ? actor?.id : undefined);
  } catch {
    /* aprobado sin orden: el panel ofrece "Generar orden" como reintento */
  }

  const totalStr = formatMoney(flipped.decision_total ?? 0);
  await sendPushToStaff(
    {
      ...STAFF_NOTIFS.presupuesto_aprobado({
        folio: flipped.folio,
        total: totalStr,
        orden: order?.orderFolio ?? null,
      }),
      url: order ? `/admin/ordenes/${order.orderId}` : `/admin/presupuestos/${quoteId}`,
    },
    undefined,
    via === "staff" ? actor?.id : undefined
  );
  await logActivity({
    type: "presupuesto_aprobado",
    title: `Presupuesto ${flipped.folio} aprobado`,
    detail: `Total ${totalStr}.${
      order ? ` Se creó la orden ${order.orderFolio}.` : " Falta generar la orden."
    }${via === "staff" ? " Registrado por el equipo." : ""}`,
    actorId: via === "staff" ? (actor?.id ?? null) : null,
    actorName: via === "cliente" ? "Cliente" : (actor?.name ?? null),
    orderId: order?.orderId ?? null,
    url: order ? `/admin/ordenes/${order.orderId}` : `/admin/presupuestos/${quoteId}`,
  });

  return {
    ok: true,
    orderId: order?.orderId ?? null,
    orderFolio: order?.orderFolio ?? null,
    tracking: order ? { plate: order.plate, code: order.trackingCode } : null,
  };
}

type MaterializeResult = {
  orderId: number;
  orderFolio: string;
  plate: string;
  trackingCode: string;
};

// Crea la orden real a partir de un presupuesto YA aprobado. Idempotente hacia
// afuera: si la orden ya existe devuelve la existente. Materializa cliente y
// vehículo desde los snapshots si hace falta (misma semántica que el alta
// rápida de createOrderAction). El stock se descuenta aquí —no al cotizar— y
// puede quedar negativo a propósito: la aprobación del cliente es un
// compromiso; un stock negativo es la señal visible de que hay que reponer.
export async function materializeOrderFromQuote(
  quoteId: number,
  actorId?: number | null
): Promise<MaterializeResult> {
  const quote = await one<QuoteRow>("SELECT * FROM quotes WHERE id = ?", [quoteId]);
  if (!quote) throw new Error("Presupuesto no encontrado");
  if (quote.status !== "aprobado") throw new Error("El presupuesto no está aprobado");

  if (quote.order_id) {
    const existing = await one<{ id: number; folio: string; tracking_code: string }>(
      "SELECT id, folio, tracking_code FROM orders WHERE id = ?",
      [quote.order_id]
    );
    if (existing) {
      return {
        orderId: existing.id,
        orderFolio: existing.folio,
        plate: quote.plate,
        trackingCode: existing.tracking_code,
      };
    }
  }

  // Vehículo: la referencia si sigue viva; si no, por placa; si no, se crea
  // junto con el cliente desde los snapshots del presupuesto.
  let vehicleId = 0;
  if (quote.vehicle_id) {
    const v = await one<{ id: number }>("SELECT id FROM vehicles WHERE id = ?", [
      quote.vehicle_id,
    ]);
    if (v) vehicleId = v.id;
  }
  if (!vehicleId) {
    const v = await one<{ id: number }>("SELECT id FROM vehicles WHERE plate = ?", [
      quote.plate,
    ]);
    if (v) vehicleId = v.id;
  }
  if (!vehicleId) {
    let clientId = 0;
    if (quote.client_id) {
      const c = await one<{ id: number }>("SELECT id FROM clients WHERE id = ?", [
        quote.client_id,
      ]);
      if (c) clientId = c.id;
    }
    if (!clientId) {
      const c = await run("INSERT INTO clients (name, phone) VALUES (?, ?) RETURNING id", [
        quote.client_name || `Cliente ${quote.folio}`,
        quote.client_phone,
      ]);
      clientId = Number(c.lastInsertRowid);
    }
    const v = await run(
      `INSERT INTO vehicles (client_id, plate, type, brand, model, year, color)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        clientId,
        quote.plate,
        quote.vehicle_type || "auto",
        quote.vehicle_brand,
        quote.vehicle_model,
        quote.vehicle_year,
        quote.vehicle_color,
      ]
    );
    vehicleId = Number(v.lastInsertRowid);
  }

  let trackingCode = "";
  // Dos reintentos anidados sobre UNIQUEs distintos: el de folio (withFolioRetry;
  // sin él, dos aprobaciones simultáneas derivaban el mismo OT-00NN y la perdedora
  // reventaba dentro del catch{} de approveQuoteAndCreateOrder → presupuesto
  // aprobado sin orden, en silencio) y el de tracking_code (mismo patrón que
  // createOrderAction).
  const { folio, value: orderId } = await withFolioRetry("orders", async (folio) => {
    let id = 0;
    for (let attempt = 0; attempt < 3 && !id; attempt++) {
      try {
        trackingCode = newTrackingCode();
        const info = await run(
          // El descuento viaja a la orden: los conceptos se copian con su
          // unit_price íntegro (es de cabecera, no por línea), así que sin estas
          // dos columnas la orden recalcularía el total SIN descuento mientras
          // approval_total sí lo lleva — y el aviso de "el total ya no coincide
          // con el aprobado" saltaría en TODA orden convertida, para siempre.
          `INSERT INTO orders (folio, tracking_code, vehicle_id, status, description,
              created_by, modality, approval_status, approval_at, approval_total,
              discount_type, discount_value)
           VALUES (?, ?, ?, 'recibido', ?, ?, 'taller', 'aprobado', ${NOW_SQL}, ?, ?, ?) RETURNING id`,
          [
            folio,
            trackingCode,
            vehicleId,
            quote.description,
            actorId ?? quote.created_by,
            quote.decision_total ?? 0,
            quote.discount_type,
            quote.discount_value,
          ]
        );
        id = Number(info.lastInsertRowid);
      } catch (err) {
        const isUniqueCode =
          err instanceof Error && err.message.includes("idx_orders_tracking");
        if (!isUniqueCode || attempt === 2) throw err;
      }
    }
    return id;
  });

  await run(
    `INSERT INTO order_items (order_id, kind, description, qty, unit_price, unit_cost, part_id, service_id)
     SELECT ?, kind, description, qty, unit_price, unit_cost, part_id, service_id
       FROM quote_items WHERE quote_id = ? ORDER BY id`,
    [orderId, quoteId]
  );

  // Descuento de stock, permitiendo negativo (ver nota de arriba). El aviso de
  // stock bajo solo se dispara al CRUZAR el mínimo, igual que addOrderItemAction.
  const partItems = await many<{ part_id: number; qty: number }>(
    "SELECT part_id, qty FROM quote_items WHERE quote_id = ? AND part_id IS NOT NULL",
    [quoteId]
  );
  for (const it of partItems) {
    const updated = await one<{ name: string; stock: number; min_stock: number }>(
      `UPDATE parts SET stock = stock - ?, updated_at = ${NOW_SQL}
        WHERE id = ? RETURNING name, stock, min_stock`,
      [it.qty, it.part_id]
    );
    if (
      updated &&
      updated.min_stock > 0 &&
      updated.stock <= updated.min_stock &&
      updated.stock + it.qty > updated.min_stock
    ) {
      await sendPushToStaff({
        ...STAFF_NOTIFS.stock_bajo({
          nombre: updated.name,
          stock: updated.stock,
          minimo: updated.min_stock,
        }),
        url: "/admin/inventario",
      });
    }
  }

  await run(
    `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by)
     VALUES (?, 'estado', ?, ?, 1, ?)`,
    [
      orderId,
      `Orden creada por presupuesto ${quote.folio} aprobado`,
      quote.description || null,
      actorId ?? null,
    ]
  );

  // Enlace final con guard: si otra materialización concurrente ganó (doble
  // clic en "Generar orden"), se limpia la orden duplicada —recién creada, sin
  // pagos ni eventos ajenos; el CASCADE borra items/eventos— y se devuelve la
  // ganadora, restituyendo el stock que este intento descontó.
  const linked = await run(
    `UPDATE quotes SET order_id = ?, updated_at = ${NOW_SQL}
      WHERE id = ? AND order_id IS NULL RETURNING id`,
    [orderId, quoteId]
  );
  if (linked.rowCount === 0) {
    for (const it of partItems) {
      await run(`UPDATE parts SET stock = stock + ?, updated_at = ${NOW_SQL} WHERE id = ?`, [
        it.qty,
        it.part_id,
      ]);
    }
    await run("DELETE FROM orders WHERE id = ?", [orderId]);
    const winner = await one<{ id: number; folio: string; tracking_code: string }>(
      `SELECT o.id, o.folio, o.tracking_code FROM orders o
         JOIN quotes q ON q.order_id = o.id WHERE q.id = ?`,
      [quoteId]
    );
    if (!winner) throw new Error("No se pudo enlazar la orden generada");
    return {
      orderId: winner.id,
      orderFolio: winner.folio,
      plate: quote.plate,
      trackingCode: winner.tracking_code,
    };
  }

  return { orderId, orderFolio: folio, plate: quote.plate, trackingCode };
}
