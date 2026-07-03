import { one, many, normalizePlate } from "./db";
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

  const detailed = !!code && code.trim().toUpperCase() === order.tracking_code;

  const events = await many<PublicEvent>(
    `SELECT id, type, title, detail, created_at FROM order_events
       WHERE order_id = ? AND is_public = 1 ORDER BY created_at DESC, id DESC`,
    [order.id]
  );

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
    const items = await many<PublicItem>(
      "SELECT kind, description, qty, unit_price FROM order_items WHERE order_id = ? ORDER BY id",
      [order.id]
    );
    result.items = items;
    result.total = items.reduce((sum, i) => sum + i.qty * i.unit_price, 0);
    result.history = await many<NonNullable<TrackingResult["history"]>[number]>(
      `SELECT folio, status, description, created_at FROM orders
         WHERE vehicle_id = ? AND id != ? ORDER BY created_at DESC LIMIT 10`,
      [vehicle.id, order.id]
    );
  }

  return result;
}
