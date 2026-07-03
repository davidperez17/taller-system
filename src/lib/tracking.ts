import { getDb, normalizePlate } from "./db";
import { STATUS_FLOW, type OrderStatus } from "./status";

export type PublicEvent = {
  id: number;
  type: string;
  title: string;
  detail: string | null;
  created_at: string;
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
    description: string;
    diagnosis: string | null;
    estimated_delivery: string | null;
    created_at: string;
    updated_at: string;
  };
  events?: PublicEvent[];
  detailed?: boolean;
  items?: PublicItem[];
  total?: number;
  history?: { folio: string; status: OrderStatus; description: string; created_at: string }[];
};

export function getTracking(rawPlate: string, code?: string | null): TrackingResult {
  const db = getDb();
  const plate = normalizePlate(rawPlate);
  if (!plate) return { found: false, plate };

  const vehicle = db
    .prepare("SELECT id, type, brand, model, year, color FROM vehicles WHERE plate = ?")
    .get(plate) as
    | { id: number; type: string; brand: string | null; model: string | null; year: string | null; color: string | null }
    | undefined;
  if (!vehicle) return { found: false, plate };

  // Orden activa = la más reciente no entregada/cancelada; si no hay, la última.
  const order = (db
    .prepare(
      `SELECT * FROM orders WHERE vehicle_id = ? AND status NOT IN ('entregado','cancelado')
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(vehicle.id) ??
    db
      .prepare("SELECT * FROM orders WHERE vehicle_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(vehicle.id)) as
    | {
        id: number;
        folio: string;
        tracking_code: string;
        status: OrderStatus;
        description: string;
        diagnosis: string | null;
        estimated_delivery: string | null;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!order) return { found: false, plate };

  const detailed = !!code && code.trim().toUpperCase() === order.tracking_code;

  const events = db
    .prepare(
      `SELECT id, type, title, detail, created_at FROM order_events
       WHERE order_id = ? AND is_public = 1 ORDER BY created_at DESC, id DESC`
    )
    .all(order.id) as PublicEvent[];

  const result: TrackingResult = {
    found: true,
    plate,
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
    },
    events,
    detailed,
  };

  if (detailed) {
    const items = db
      .prepare(
        "SELECT kind, description, qty, unit_price FROM order_items WHERE order_id = ? ORDER BY id"
      )
      .all(order.id) as PublicItem[];
    result.items = items;
    result.total = items.reduce((sum, i) => sum + i.qty * i.unit_price, 0);
    result.history = db
      .prepare(
        `SELECT folio, status, description, created_at FROM orders
         WHERE vehicle_id = ? AND id != ? ORDER BY created_at DESC LIMIT 10`
      )
      .all(vehicle.id, order.id) as TrackingResult["history"];
  }

  return result;
}
