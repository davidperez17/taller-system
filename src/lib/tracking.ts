import { createHash, timingSafeEqual } from "crypto";
import { one, many, normalizePlate } from "./db";
import { STATUS_FLOW, type OrderStatus, type OrderModality } from "./status";

export type PublicEvent = {
  id: number;
  type: string;
  title: string;
  detail: string | null;
  created_at: string;
  photos?: string[];
};

export type PublicItem = {
  kind: string;
  description: string;
  qty: number;
  unit_price: number;
};

export type TrackingResult = {
  found: boolean;
  plate: string;
  // Categoría del vehículo (auto/moto/camion/otro) para pintar el icono. No
  // identifica al vehículo, así que se expone también en modo básico; los datos
  // identificatorios (marca/modelo/año/color) siguen solo en `vehicle` detallado.
  vehicleType?: string;
  // Solo con código válido (detailed): el modo básico se limita al estado del
  // proceso para no filtrar datos del vehículo ni eventos a quien solo
  // conoce/adivina la placa (anti-enumeración).
  vehicle?: {
    type: string;
    brand: string | null;
    model: string | null;
    year: string | null;
    color: string | null;
  };
  order?: {
    folio: string;
    status: OrderStatus;
    statusIndex: number;
    description?: string;
    diagnosis?: string | null;
    estimated_delivery: string | null;
    created_at: string;
    updated_at: string;
    modality?: OrderModality;
    approval_status?: "pendiente" | "aprobado" | "rechazado";
    approval_at?: string | null;
    approval_total?: number | null;
  };
  events?: PublicEvent[];
  detailed?: boolean;
  items?: PublicItem[];
  total?: number;
  paid?: number;
  history?: { folio: string; status: OrderStatus; description: string; created_at: string }[];
};

// Comparación en tiempo constante sobre hashes (neutraliza también la
// diferencia de longitud entre códigos de 4 y 8 caracteres).
export function safeCodeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function getTracking(rawPlate: string, code?: string | null): Promise<TrackingResult> {
  const plate = normalizePlate(rawPlate);
  if (!plate) return { found: false, plate };

  const vehicle = await one<
    { id: number; type: string; brand: string | null; model: string | null; year: string | null; color: string | null }
  >("SELECT id, type, brand, model, year, color FROM vehicles WHERE plate = ?", [plate]);
  if (!vehicle) return { found: false, plate };

  type OrderRow = {
    id: number;
    folio: string;
    tracking_code: string;
    status: OrderStatus;
    description: string;
    diagnosis: string | null;
    estimated_delivery: string | null;
    created_at: string;
    updated_at: string;
    modality: string;
    approval_status: "pendiente" | "aprobado" | "rechazado";
    approval_at: string | null;
    approval_total: number | null;
  };

  // Orden activa = la más reciente no entregada/cancelada; si no hay, la última.
  const order =
    (await one<OrderRow>(
      `SELECT * FROM orders WHERE vehicle_id = ? AND status NOT IN ('entregado','cancelado')
       ORDER BY created_at DESC LIMIT 1`,
      [vehicle.id]
    )) ??
    (await one<OrderRow>(
      "SELECT * FROM orders WHERE vehicle_id = ? ORDER BY created_at DESC LIMIT 1",
      [vehicle.id]
    ));

  if (!order) return { found: false, plate };

  const detailed = !!code && safeCodeEqual(code.trim().toUpperCase(), order.tracking_code);

  // Modo básico: solo el estado del proceso. El folio es inocuo (no identifica
  // al vehículo) y el cliente lo reconoce de su orden impresa.
  if (!detailed) {
    return {
      found: true,
      plate,
      vehicleType: vehicle.type,
      order: {
        folio: order.folio,
        status: order.status,
        statusIndex: Math.max(0, STATUS_FLOW.indexOf(order.status)),
        estimated_delivery: order.estimated_delivery,
        created_at: order.created_at,
        updated_at: order.updated_at,
      },
      detailed: false,
    };
  }

  const eventRows = await many<PublicEvent & { photo_urls: string | null }>(
    `SELECT id, type, title, detail, created_at, photo_urls FROM order_events
       WHERE order_id = ? AND is_public = 1 ORDER BY created_at DESC, id DESC`,
    [order.id]
  );
  const events: PublicEvent[] = eventRows.map(({ photo_urls, ...ev }) => {
    let photos: string[] | undefined;
    try {
      const parsed = photo_urls ? JSON.parse(photo_urls) : null;
      if (Array.isArray(parsed) && parsed.length > 0) photos = parsed;
    } catch {
      /* photo_urls corrupto: se ignora */
    }
    return { ...ev, photos };
  });

  const items = await many<PublicItem>(
    "SELECT kind, description, qty, unit_price FROM order_items WHERE order_id = ? ORDER BY id",
    [order.id]
  );

  return {
    found: true,
    plate,
    vehicleType: vehicle.type,
    vehicle: {
      type: vehicle.type,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
    },
    order: {
      folio: order.folio,
      status: order.status,
      statusIndex: Math.max(0, STATUS_FLOW.indexOf(order.status)),
      description: order.description,
      diagnosis: order.diagnosis,
      estimated_delivery: order.estimated_delivery,
      created_at: order.created_at,
      updated_at: order.updated_at,
      modality: order.modality === "domicilio" ? "domicilio" : "taller",
      approval_status: order.approval_status,
      approval_at: order.approval_at,
      approval_total: order.approval_total,
    },
    events,
    detailed: true,
    items,
    total: items.reduce((sum, i) => sum + i.qty * i.unit_price, 0),
    paid:
      (
        await one<{ paid: number }>(
          "SELECT COALESCE(SUM(amount), 0)::float8 AS paid FROM payments WHERE order_id = ?",
          [order.id]
        )
      )?.paid ?? 0,
    history: await many<NonNullable<TrackingResult["history"]>[number]>(
      `SELECT folio, status, description, created_at FROM orders
         WHERE vehicle_id = ? AND id != ? ORDER BY created_at DESC LIMIT 10`,
      [vehicle.id, order.id]
    ),
  };
}

/** Valida placa+código contra la orden vigente; para endpoints públicos (suscripción push, aprobación).
 *  Mismo fallback que getTracking: si no hay orden activa vale la última cerrada
 *  (un cliente con su orden entregada puede seguir suscrito a avisos de su placa;
 *  la aprobación re-verifica el estado por su cuenta). */
export async function verifyPlateCode(
  rawPlate: string,
  code: string
): Promise<{ orderId: number; status: OrderStatus } | null> {
  const plate = normalizePlate(rawPlate);
  if (!plate || !code) return null;
  const row =
    (await one<{ id: number; status: OrderStatus; tracking_code: string }>(
      `SELECT o.id, o.status, o.tracking_code FROM orders o
         JOIN vehicles v ON v.id = o.vehicle_id
        WHERE v.plate = ? AND o.status NOT IN ('entregado','cancelado')
        ORDER BY o.created_at DESC LIMIT 1`,
      [plate]
    )) ??
    (await one<{ id: number; status: OrderStatus; tracking_code: string }>(
      `SELECT o.id, o.status, o.tracking_code FROM orders o
         JOIN vehicles v ON v.id = o.vehicle_id
        WHERE v.plate = ? ORDER BY o.created_at DESC LIMIT 1`,
      [plate]
    ));
  if (!row) return null;
  if (!safeCodeEqual(code.trim().toUpperCase(), row.tracking_code)) return null;
  return { orderId: row.id, status: row.status };
}
