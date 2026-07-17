"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { one, run, normalizePlate, newTrackingCode, withFolioRetry } from "@/lib/db";
import {
  approveQuoteAndCreateOrder, rejectQuote, materializeOrderFromQuote,
} from "@/lib/quotes";
import {
  checkPassword, hashPassword, setSession, clearSession, getSessionUser, requireUser,
} from "@/lib/auth";
import { sendPushToPlate, sendPushToStaff } from "@/lib/push";
import { hitLimit, clientIp } from "@/lib/rate-limit";
import { str, strOrNull } from "@/lib/validate";
import {
  STATUS_META, RECEPTION_EVENT_TITLE, EXPENSE_CATEGORIES, VEHICLE_TYPES, formatMoney,
  type OrderStatus,
} from "@/lib/status";
import { CLIENT_PRESETS, STAFF_NOTIFS } from "@/lib/notifications";
import { logActivity, markNotifsSeen } from "@/lib/activity";

// Marca de tiempo en UTC con el mismo formato que datetime('now') de SQLite.
const NOW_SQL = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')";

/* ---------------- Autenticación ---------------- */

export async function loginAction(_prev: { error?: string } | null, formData: FormData) {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/admin");
  if (!username || !password) return { error: "Ingresa usuario y contraseña." };

  if (await hitLimit("login", `${username}:${await clientIp()}`, 5, 15 * 60)) {
    return { error: "Demasiados intentos. Espera unos minutos e intenta de nuevo." };
  }

  const user = await one<{
    id: number;
    password_hash: string;
    active: number;
    token_version: number;
  }>(
    "SELECT id, password_hash, active, token_version FROM users WHERE username = ?",
    [username]
  );

  if (!user || !user.active || !checkPassword(password, user.password_hash)) {
    return { error: "Usuario o contraseña incorrectos." };
  }
  await setSession(user.id, user.token_version);
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction() {
  await clearSession();
  redirect("/admin/login");
}

/* ---------------- Clientes ---------------- */

export async function createClientAction(formData: FormData) {
  await requireUser();
  const name = str(formData, "name");
  if (!name) return;
  const info = await run(
    "INSERT INTO clients (name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?) RETURNING id",
    [
      name,
      strOrNull(formData, "phone"),
      strOrNull(formData, "email"),
      strOrNull(formData, "address"),
      strOrNull(formData, "notes", { max: 2000 }),
    ]
  );
  revalidatePath("/admin/clientes");
  redirect(`/admin/clientes/${info.lastInsertRowid}`);
}

export async function updateClientAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  const name = str(formData, "name");
  if (!id || !name) return;
  await run(
    "UPDATE clients SET name = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ?",
    [
      name,
      strOrNull(formData, "phone"),
      strOrNull(formData, "email"),
      strOrNull(formData, "address"),
      strOrNull(formData, "notes", { max: 2000 }),
      id,
    ]
  );
  revalidatePath(`/admin/clientes/${id}`);
  revalidatePath("/admin/clientes");
}

export async function deleteClientAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const id = Number(formData.get("id"));
  if (!id) return;
  // El CASCADE borraría también los pagos (contabilidad): bloquear si existen.
  const paid = await one<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM payments p
       JOIN orders o ON o.id = p.order_id
       JOIN vehicles v ON v.id = o.vehicle_id
      WHERE v.client_id = ?`,
    [id]
  );
  if ((paid?.n ?? 0) > 0) return;
  await run("DELETE FROM clients WHERE id = ?", [id]);
  revalidatePath("/admin/clientes");
  redirect("/admin/clientes");
}

/* ---------------- Vehículos ---------------- */

export async function createVehicleAction(formData: FormData) {
  await requireUser();
  const clientId = Number(formData.get("client_id"));
  const plate = normalizePlate(String(formData.get("plate") || ""));
  if (!clientId || !plate) return;
  try {
    await run(
      `INSERT INTO vehicles (client_id, plate, type, brand, model, year, color, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        plate,
        String(formData.get("type") || "auto"),
        strOrNull(formData, "brand"),
        strOrNull(formData, "model"),
        strOrNull(formData, "year"),
        strOrNull(formData, "color"),
        strOrNull(formData, "notes", { max: 2000 }),
      ]
    );
  } catch {
    /* placa duplicada: se ignora el alta */
  }
  revalidatePath(`/admin/clientes/${clientId}`);
  revalidatePath("/admin/vehiculos");
}

export async function updateVehicleAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  const plate = normalizePlate(String(formData.get("plate") || ""));
  if (!id || !plate) return;
  try {
    await run(
      `UPDATE vehicles SET plate = ?, type = ?, brand = ?, model = ?, year = ?, color = ?, notes = ?
       WHERE id = ?`,
      [
        plate,
        String(formData.get("type") || "auto"),
        strOrNull(formData, "brand"),
        strOrNull(formData, "model"),
        strOrNull(formData, "year"),
        strOrNull(formData, "color"),
        strOrNull(formData, "notes", { max: 2000 }),
        id,
      ]
    );
  } catch {
    /* placa duplicada */
  }
  revalidatePath("/admin/vehiculos");
}

/* ---------------- Órdenes de trabajo ---------------- */

// Quita un vehículo y, en cascada, sus órdenes, historial, fotos, pagos y
// recordatorios. Bloqueado si tiene una orden activa: primero se cancela o
// se entrega (evita borrar trabajo en curso por accidente).
export async function deleteVehicleAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const id = Number(formData.get("id"));
  const clientId = Number(formData.get("client_id"));
  if (!id) return;
  const active = await one<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM orders
      WHERE vehicle_id = ? AND status NOT IN ('entregado','cancelado')`,
    [id]
  );
  if ((active?.n ?? 0) > 0) return;
  await run("DELETE FROM vehicles WHERE id = ?", [id]);
  revalidatePath("/admin/vehiculos");
  if (clientId) revalidatePath(`/admin/clientes/${clientId}`);
  revalidatePath("/admin");
}

export async function createOrderAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const user = await requireUser();

  let vehicleId = Number(formData.get("vehicle_id")) || 0;

  // Alta rápida: cliente y vehículo nuevos en el mismo formulario.
  if (!vehicleId) {
    const plate = normalizePlate(String(formData.get("new_plate") || ""));
    if (!plate) {
      return { error: "Ingresa la placa del vehículo o elige uno ya registrado." };
    }
    const existing = await one<{ id: number }>(
      "SELECT id FROM vehicles WHERE plate = ?",
      [plate]
    );
    if (existing) {
      vehicleId = existing.id;
    } else {
      let clientId = Number(formData.get("client_id")) || 0;
      if (!clientId) {
        const clientName = str(formData, "new_client_name");
        if (!clientName) {
          return { error: "Elige un cliente existente o escribe el nombre del cliente nuevo." };
        }
        const c = await run(
          "INSERT INTO clients (name, phone) VALUES (?, ?) RETURNING id",
          [clientName, strOrNull(formData, "new_client_phone")]
        );
        clientId = Number(c.lastInsertRowid);
      }
      const v = await run(
        `INSERT INTO vehicles (client_id, plate, type, brand, model, year, color)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          clientId,
          plate,
          String(formData.get("new_type") || "auto"),
          strOrNull(formData, "new_brand"),
          strOrNull(formData, "new_model"),
          strOrNull(formData, "new_year"),
          strOrNull(formData, "new_color"),
        ]
      );
      vehicleId = Number(v.lastInsertRowid);
    }
  }

  const description = str(formData, "description", { max: 2000 });
  // Modalidad del servicio: en el taller (default) o a domicilio (el equipo va
  // al cliente). La ubicación solo aplica a domicilio.
  const modality = formData.get("modality") === "domicilio" ? "domicilio" : "taller";
  const serviceLocation =
    modality === "domicilio" ? strOrNull(formData, "service_location") : null;
  // Dos reintentos anidados sobre UNIQUEs distintos: el de folio (withFolioRetry,
  // recalcula el MAX) y el de tracking_code (improbable con 40 bits, pero posible
  // frente a códigos legados de 4 caracteres).
  const { folio, value: orderId } = await withFolioRetry("orders", async (folio) => {
    let id = 0;
    for (let attempt = 0; attempt < 3 && !id; attempt++) {
      try {
        const info = await run(
          `INSERT INTO orders (folio, tracking_code, vehicle_id, status, description, km, fuel_level, estimated_delivery, created_by, modality, service_location)
           VALUES (?, ?, ?, 'recibido', ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
          [
            folio,
            newTrackingCode(),
            vehicleId,
            description,
            strOrNull(formData, "km"),
            strOrNull(formData, "fuel_level"),
            strOrNull(formData, "estimated_delivery"),
            user.id,
            modality,
            serviceLocation,
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
    `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by)
     VALUES (?, 'estado', ?, ?, 1, ?)`,
    [
      orderId,
      modality === "domicilio" ? "Servicio a domicilio registrado" : "Vehículo recibido en el taller",
      description || null,
      user.id,
    ]
  );

  // Recepción documentada: estado del vehículo al ingreso (fotos + observaciones).
  // Protege a ambas partes ante reclamos ("ese rayón ya estaba").
  const receptionNotes = str(formData, "reception_notes", { max: 2000 });
  const receptionPhotos = await uploadOrderPhotos(orderId, formData);
  if (receptionNotes || receptionPhotos.length > 0) {
    await run(
      `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by, photo_urls)
       VALUES (?, 'nota', ?, ?, 1, ?, ?)`,
      [
        orderId,
        RECEPTION_EVENT_TITLE,
        receptionNotes || null,
        user.id,
        receptionPhotos.length > 0 ? JSON.stringify(receptionPhotos) : null,
      ]
    );
  }

  const veh = await one<{ plate: string; brand: string | null; model: string | null }>(
    "SELECT plate, brand, model FROM vehicles WHERE id = ?",
    [vehicleId]
  );
  if (veh) {
    await sendPushToStaff({
      ...STAFF_NOTIFS.nueva_orden({
        folio,
        placa: veh.plate,
        vehiculo: [veh.brand, veh.model].filter(Boolean).join(" ") || null,
      }),
      url: `/admin/ordenes/${orderId}`,
    });
  }

  await logActivity({
    type: "orden_nueva",
    title: `Nueva orden ${folio}`,
    detail: veh ? `${veh.plate}${veh.brand || veh.model ? ` · ${[veh.brand, veh.model].filter(Boolean).join(" ")}` : ""}` : null,
    actorId: user.id,
    actorName: user.name,
    orderId,
    url: `/admin/ordenes/${orderId}`,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/ordenes");
  redirect(`/admin/ordenes/${orderId}`);
}

export async function updateOrderStatusAction(formData: FormData) {
  const user = await requireUser();
  const orderId = Number(formData.get("order_id"));
  const status = String(formData.get("status")) as OrderStatus;
  const note = str(formData, "note", { max: 2000 });
  if (!orderId || !STATUS_META[status]) return;
  // Cancelar exige motivo: se registra en la línea de tiempo y se notifica.
  if (status === "cancelado" && !note) return;

  const order = await one<{ id: number; status: string; folio: string; plate: string }>(
    `SELECT o.id, o.status, o.folio, v.plate FROM orders o
       JOIN vehicles v ON v.id = o.vehicle_id WHERE o.id = ?`,
    [orderId]
  );
  if (!order || order.status === status) return;

  await run(
    `UPDATE orders SET status = ?, updated_at = ${NOW_SQL},
     delivered_at = CASE WHEN ? = 'entregado' THEN ${NOW_SQL} ELSE delivered_at END
     WHERE id = ?`,
    [status, status, orderId]
  );

  const meta = STATUS_META[status];
  await run(
    `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by)
     VALUES (?, 'estado', ?, ?, 1, ?)`,
    [orderId, meta.client, note || meta.description, user.id]
  );

  await sendPushToPlate(order.plate, {
    title: `${order.plate}: ${meta.client}`,
    body: note || meta.description,
  });

  if (status === "listo") {
    await sendPushToStaff({
      ...STAFF_NOTIFS.listo_admin({ folio: order.folio, placa: order.plate }),
      url: `/admin/ordenes/${orderId}`,
    });
  }

  await logActivity({
    type: status === "cancelado" ? "cancelacion" : "estado",
    title:
      status === "cancelado"
        ? `Canceló ${order.folio}`
        : `${order.folio}: ${meta.label}`,
    detail: status === "cancelado" ? note || null : `${order.plate} → ${meta.label}`,
    actorId: user.id,
    actorName: user.name,
    orderId,
    url: `/admin/ordenes/${orderId}`,
  });

  revalidatePath(`/admin/ordenes/${orderId}`);
  revalidatePath("/admin/ordenes");
  revalidatePath("/admin");
}

// Fotos: hasta 4, jpeg/png/webp, 4 MB c/u, a Vercel Blob (requiere
// BLOB_READ_WRITE_TOKEN; sin token se guarda el evento sin fotos).
async function uploadOrderPhotos(orderId: number, formData: FormData): Promise<string[]> {
  const photoUrls: string[] = [];
  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, 4);
  if (photos.length > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    for (const photo of photos) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) continue;
      if (photo.size > 4 * 1024 * 1024) continue;
      const blob = await put(`orders/${orderId}/${photo.name || "foto.jpg"}`, photo, {
        access: "public",
        addRandomSuffix: true,
      });
      photoUrls.push(blob.url);
    }
  }
  return photoUrls;
}

export async function addOrderNoteAction(formData: FormData) {
  const user = await requireUser();
  const orderId = Number(formData.get("order_id"));
  const title = str(formData, "title");
  const detail = str(formData, "detail", { max: 2000 });
  const isPublic = formData.get("is_public") === "on";
  if (!orderId || !title) return;

  const photoUrls = await uploadOrderPhotos(orderId, formData);

  await run(
    `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by, photo_urls)
     VALUES (?, 'nota', ?, ?, ?, ?, ?)`,
    [
      orderId,
      title,
      detail || null,
      isPublic ? 1 : 0,
      user.id,
      photoUrls.length > 0 ? JSON.stringify(photoUrls) : null,
    ]
  );

  if (isPublic) {
    const row = await one<{ plate: string }>(
      "SELECT v.plate FROM orders o JOIN vehicles v ON v.id = o.vehicle_id WHERE o.id = ?",
      [orderId]
    );
    if (row) {
      await sendPushToPlate(row.plate, {
        title: `${row.plate}: nueva anotación del taller`,
        body: title,
      });
    }
  }
  revalidatePath(`/admin/ordenes/${orderId}`);
}

// Quita una anotación (por si se escribió mal o por error). Solo borra eventos
// de tipo 'nota'; nunca los de 'estado' o 'sistema', que son el historial de la
// orden. También limpia las fotos del blob para no dejar archivos huérfanos.
export async function deleteOrderNoteAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  const orderId = Number(formData.get("order_id"));
  if (!id || !orderId) return;

  const note = await one<{ photo_urls: string | null }>(
    "SELECT photo_urls FROM order_events WHERE id = ? AND order_id = ? AND type = 'nota'",
    [id, orderId]
  );
  if (!note) return;

  await run("DELETE FROM order_events WHERE id = ? AND order_id = ? AND type = 'nota'", [
    id,
    orderId,
  ]);

  if (note.photo_urls) {
    try {
      const urls = JSON.parse(note.photo_urls);
      if (Array.isArray(urls) && urls.length > 0) {
        const { del } = await import("@vercel/blob");
        await del(urls);
      }
    } catch {
      /* photo_urls corrupto o del falla: el borrado de la anotación ya está hecho */
    }
  }

  revalidatePath(`/admin/ordenes/${orderId}`);
}

// Corrige el mensaje de un cambio de estado (por si se escribió mal). Solo toca
// el `detail` de eventos 'estado'; nunca su título (que es la etapa) ni los
// eventos 'nota'/'sistema'. No re-notifica: es una corrección, no un aviso nuevo.
export async function updateOrderEventDetailAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  const orderId = Number(formData.get("order_id"));
  if (!id || !orderId) return;
  const detail = str(formData, "detail", { max: 2000 });
  await run(
    "UPDATE order_events SET detail = ? WHERE id = ? AND order_id = ? AND type = 'estado'",
    [detail || null, id, orderId]
  );
  revalidatePath(`/admin/ordenes/${orderId}`);
}

export async function updateOrderInfoAction(formData: FormData) {
  const user = await requireUser();
  const orderId = Number(formData.get("order_id"));
  if (!orderId) return;

  // Estado previo: para saber QUÉ cambió y avisar al equipo con el detalle.
  const before = await one<{
    folio: string;
    plate: string;
    description: string;
    diagnosis: string | null;
    km: string | null;
    fuel_level: string | null;
    estimated_delivery: string | null;
    assigned_to: number | null;
  }>(
    `SELECT o.folio, v.plate, o.description, o.diagnosis, o.km, o.fuel_level,
            o.estimated_delivery, o.assigned_to
       FROM orders o JOIN vehicles v ON v.id = o.vehicle_id WHERE o.id = ?`,
    [orderId]
  );
  if (!before) return;

  const next = {
    description: str(formData, "description", { max: 2000 }),
    diagnosis: strOrNull(formData, "diagnosis", { max: 2000 }),
    km: strOrNull(formData, "km"),
    fuel_level: strOrNull(formData, "fuel_level"),
    estimated_delivery: strOrNull(formData, "estimated_delivery"),
    assigned_to: Number(formData.get("assigned_to")) || null,
  };

  await run(
    `UPDATE orders SET description = ?, diagnosis = ?, km = ?, fuel_level = ?,
     estimated_delivery = ?, assigned_to = ?, updated_at = ${NOW_SQL} WHERE id = ?`,
    [
      next.description,
      next.diagnosis,
      next.km,
      next.fuel_level,
      next.estimated_delivery,
      next.assigned_to,
      orderId,
    ]
  );
  revalidatePath(`/admin/ordenes/${orderId}`);

  // Diff campo a campo, en lenguaje del equipo. Solo se avisa si algo cambió
  // de verdad (re-guardar sin cambios no genera ruido).
  const LABELS: Record<string, string> = {
    description: "trabajo solicitado",
    diagnosis: "diagnóstico",
    km: "kilometraje",
    fuel_level: "combustible",
    estimated_delivery: "entrega estimada",
    assigned_to: "técnico asignado",
  };
  const beforeVals: Record<string, string | number | null> = {
    description: before.description,
    diagnosis: before.diagnosis,
    km: before.km,
    fuel_level: before.fuel_level,
    estimated_delivery: before.estimated_delivery,
    assigned_to: before.assigned_to,
  };
  const nextVals = next as Record<string, string | number | null>;
  const changed = Object.keys(LABELS).filter(
    (k) => String(beforeVals[k] ?? "") !== String(nextVals[k] ?? "")
  );
  if (changed.length === 0) return;

  const cambios = changed.map((k) => LABELS[k]).join(", ");
  // Push a todo el equipo (incluye mecánicos: un cambio de trabajo/diagnóstico
  // les afecta directo), menos a quien editó.
  await sendPushToStaff(
    {
      ...STAFF_NOTIFS.orden_modificada({
        folio: before.folio,
        placa: before.plate,
        autor: user.name,
        cambios,
      }),
      url: `/admin/ordenes/${orderId}`,
    },
    ["admin", "asesor", "mecanico"],
    user.id
  );
  // Rastro persistente en el feed/campana del panel.
  await logActivity({
    type: "orden_editada",
    title: `Orden ${before.folio} modificada`,
    detail: `${cambios} · ${before.plate}`,
    actorId: user.id,
    actorName: user.name,
    orderId,
    url: `/admin/ordenes/${orderId}`,
  });
}

// Agrega un ítem al presupuesto. Tres orígenes:
//  - part_id: repuesto de inventario → snapshot de costo/precio y descuento de
//    stock automático (con aviso al staff si cruza el mínimo).
//  - service_id: servicio del catálogo → snapshot de costo estimado/precio.
//  - libre: descripción manual, costo opcional.
export async function addOrderItemAction(formData: FormData) {
  const user = await requireUser();
  const orderId = Number(formData.get("order_id"));
  const partId = Number(formData.get("part_id")) || null;
  const serviceId = Number(formData.get("service_id")) || null;
  const qty = Number(formData.get("qty")) || 1;
  if (!orderId || qty <= 0) return;

  let kind = String(formData.get("kind") || "servicio");
  let description = str(formData, "description", { max: 2000 });
  let unitPrice = Number(formData.get("unit_price")) || 0;
  // El costo real solo lo captura el admin; para el resto del equipo se toma
  // del catálogo/inventario y nunca del formulario (rentabilidad = solo admin).
  const canCost = user.role === "admin";
  let unitCost = canCost ? Number(formData.get("unit_cost")) || 0 : 0;

  if (partId) {
    const part = await one<{
      name: string; unit_price: number; cost: number; stock: number; min_stock: number;
    }>(
      "SELECT name, unit_price, cost, stock, min_stock FROM parts WHERE id = ? AND active = 1",
      [partId]
    );
    if (!part) return;
    // No dejar el stock en negativo (la UI ya deshabilita repuestos sin
    // existencias; esto cubre el caso qty > stock). Ajuste manual de
    // inventario como vía de escape si el conteo físico difiere.
    if (part.stock < qty) return;
    kind = "repuesto";
    description = description || part.name;
    if (!Number(formData.get("unit_price"))) unitPrice = part.unit_price;
    if (!unitCost) unitCost = part.cost; // costo del inventario si no se fijó a mano
  } else if (serviceId) {
    const service = await one<{ name: string; price: number; est_cost: number }>(
      "SELECT name, price, est_cost FROM services WHERE id = ? AND active = 1",
      [serviceId]
    );
    if (!service) return;
    kind = "servicio";
    description = description || service.name;
    if (!Number(formData.get("unit_price"))) unitPrice = service.price;
    if (!unitCost) unitCost = service.est_cost; // costo del catálogo si no se fijó a mano
  }
  if (!description) return;
  if (!["servicio", "repuesto"].includes(kind)) kind = "servicio";

  await run(
    `INSERT INTO order_items (order_id, kind, description, qty, unit_price, unit_cost, part_id, service_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, kind, description, qty, unitPrice, unitCost, partId, serviceId]
  );

  // Descuento de stock (sin transacción en Neon HTTP: si algo falla, el ajuste
  // manual de inventario es el respaldo).
  if (partId) {
    const updated = await one<{ name: string; stock: number; min_stock: number }>(
      `UPDATE parts SET stock = stock - ?, updated_at = ${NOW_SQL}
        WHERE id = ? RETURNING name, stock, min_stock`,
      [qty, partId]
    );
    if (
      updated &&
      updated.min_stock > 0 &&
      updated.stock <= updated.min_stock &&
      updated.stock + qty > updated.min_stock // solo al CRUZAR el mínimo, no en cada venta
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
    revalidatePath("/admin/inventario");
  }

  revalidatePath(`/admin/ordenes/${orderId}`);
}

export async function deleteOrderItemAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  const orderId = Number(formData.get("order_id"));
  if (!id) return;
  const item = await one<{ part_id: number | null; qty: number }>(
    "SELECT part_id, qty FROM order_items WHERE id = ?",
    [id]
  );
  await run("DELETE FROM order_items WHERE id = ?", [id]);
  // Restituye el stock si el ítem venía de inventario.
  if (item?.part_id) {
    await run(`UPDATE parts SET stock = stock + ?, updated_at = ${NOW_SQL} WHERE id = ?`, [
      item.qty,
      item.part_id,
    ]);
    revalidatePath("/admin/inventario");
  }
  revalidatePath(`/admin/ordenes/${orderId}`);
}

// Corregir un ítem ya cotizado: concepto, cantidad y precio de venta; el costo
// real solo lo toca el admin (la rentabilidad es su vista). Si el ítem vino de
// inventario, la diferencia de cantidad se descuenta o se devuelve al stock para
// que las existencias sigan cuadrando.
export async function updateOrderItemAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const orderId = Number(formData.get("order_id"));
  if (!id || !orderId) return;

  const before = await one<{ part_id: number | null; qty: number }>(
    "SELECT part_id, qty FROM order_items WHERE id = ? AND order_id = ?",
    [id, orderId]
  );
  if (!before) return;

  const description = str(formData, "description", { max: 2000 });
  const qty = Number(formData.get("qty"));
  const unitPrice = Number(formData.get("unit_price") || 0);
  if (!description) return;
  if (!Number.isFinite(qty) || qty <= 0) return;
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return;

  const canCost = user.role === "admin";
  const unitCost = Number(formData.get("unit_cost") || 0);
  if (canCost && (!Number.isFinite(unitCost) || unitCost < 0)) return;

  // delta > 0 = el ítem consume más piezas que antes; delta < 0 = devuelve.
  const delta = qty - before.qty;
  if (before.part_id && delta > 0) {
    const part = await one<{ stock: number }>("SELECT stock FROM parts WHERE id = ?", [
      before.part_id,
    ]);
    if (!part || part.stock < delta) return; // no dejar el stock en negativo
  }

  if (canCost) {
    await run(
      "UPDATE order_items SET description = ?, qty = ?, unit_price = ?, unit_cost = ? WHERE id = ?",
      [description, qty, unitPrice, unitCost, id]
    );
  } else {
    await run("UPDATE order_items SET description = ?, qty = ?, unit_price = ? WHERE id = ?", [
      description,
      qty,
      unitPrice,
      id,
    ]);
  }

  if (before.part_id && delta !== 0) {
    const updated = await one<{ name: string; stock: number; min_stock: number }>(
      `UPDATE parts SET stock = stock - ?, updated_at = ${NOW_SQL}
        WHERE id = ? RETURNING name, stock, min_stock`,
      [delta, before.part_id]
    );
    if (
      updated &&
      updated.min_stock > 0 &&
      updated.stock <= updated.min_stock &&
      updated.stock + delta > updated.min_stock // solo al CRUZAR el mínimo
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
    revalidatePath("/admin/inventario");
  }

  revalidatePath(`/admin/ordenes/${orderId}`);
}

/* ---------------- Usuarios ---------------- */

export async function createUserAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const name = str(formData, "name");
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "mecanico");
  if (!["admin", "asesor", "mecanico"].includes(role)) return;
  if (!name || !username || password.length < 8) return;
  try {
    await run(
      "INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)",
      [name, username, hashPassword(password), role]
    );
  } catch {
    /* usuario duplicado */
  }
  revalidatePath("/admin/usuarios");
}

export async function toggleUserAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const id = Number(formData.get("id"));
  if (!id || id === user.id) return;
  await run("UPDATE users SET active = 1 - active WHERE id = ?", [id]);
  revalidatePath("/admin/usuarios");
}

export async function resetPasswordAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const id = Number(formData.get("id"));
  const password = String(formData.get("password") || "");
  if (!id || password.length < 8) return;
  // token_version + 1 revoca las sesiones vigentes de ese usuario.
  await run(
    "UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?",
    [hashPassword(password), id]
  );
  revalidatePath("/admin/usuarios");
}

export async function changeOwnPasswordAction(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData
) {
  const user = await requireUser();
  const current = String(formData.get("current") || "");
  const password = String(formData.get("password") || "");
  if (password.length < 8) {
    return { error: "La contraseña nueva debe tener al menos 8 caracteres." };
  }
  const row = await one<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = ?",
    [user.id]
  );
  if (!row || !checkPassword(current, row.password_hash)) {
    return { error: "La contraseña actual no es correcta." };
  }
  const updated = await one<{ token_version: number }>(
    "UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ? RETURNING token_version",
    [hashPassword(password), user.id]
  );
  // Re-emite la propia sesión para no quedar deslogueado por el bump.
  await setSession(user.id, updated?.token_version ?? 0);
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function completeTourAction() {
  const user = await requireUser();
  await run(`UPDATE users SET tour_done_at = ${NOW_SQL} WHERE id = ?`, [user.id]);
}

/* ---------------- Gastos y costo del equipo ---------------- */

export async function createExpenseAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const spentOn = str(formData, "spent_on");
  const category = str(formData, "category") || "otros";
  const amount = Number(formData.get("amount"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn) || !(amount > 0)) return;
  // hasOwnProperty y no `in`: `in` recorre la cadena de prototipos y dejaba pasar
  // "constructor", "toString", etc. como categoría de gasto.
  if (!Object.prototype.hasOwnProperty.call(EXPENSE_CATEGORIES, category)) return;
  await run(
    "INSERT INTO expenses (spent_on, category, amount, notes, created_by) VALUES (?, ?, ?, ?, ?)",
    [spentOn, category, amount, strOrNull(formData, "notes"), user.id]
  );
  revalidatePath("/admin/gastos");
  revalidatePath("/admin/reportes");
}

export async function deleteExpenseAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const id = Number(formData.get("id"));
  if (!id) return;
  await run("DELETE FROM expenses WHERE id = ?", [id]);
  revalidatePath("/admin/gastos");
  revalidatePath("/admin/reportes");
}

// Costo mensual (salario + prestaciones) por usuario: alimenta la planilla
// estimada de reportes. 0 = no registrado.
export async function setUserCostAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const id = Number(formData.get("id"));
  const cost = Number(formData.get("monthly_cost"));
  if (!id || !(cost >= 0)) return;
  await run("UPDATE users SET monthly_cost = ? WHERE id = ?", [cost, id]);
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/reportes");
}

/* ---------------- Inventario (repuestos) ---------------- */

export async function createPartAction(formData: FormData) {
  await requireUser();
  const name = str(formData, "name");
  if (!name) return;
  await run(
    `INSERT INTO parts (sku, name, category, stock, min_stock, unit_price, cost, location, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      strOrNull(formData, "sku"),
      name,
      strOrNull(formData, "category"),
      Number(formData.get("stock")) || 0,
      Number(formData.get("min_stock")) || 0,
      Number(formData.get("unit_price")) || 0,
      Number(formData.get("cost")) || 0,
      strOrNull(formData, "location"),
      strOrNull(formData, "notes", { max: 2000 }),
    ]
  );
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
}

export async function updatePartAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  const name = str(formData, "name");
  if (!id || !name) return;
  await run(
    `UPDATE parts SET sku = ?, name = ?, category = ?, min_stock = ?, unit_price = ?, cost = ?,
     location = ?, notes = ?, updated_at = ${NOW_SQL} WHERE id = ?`,
    [
      strOrNull(formData, "sku"),
      name,
      strOrNull(formData, "category"),
      Number(formData.get("min_stock")) || 0,
      Number(formData.get("unit_price")) || 0,
      Number(formData.get("cost")) || 0,
      strOrNull(formData, "location"),
      strOrNull(formData, "notes", { max: 2000 }),
      id,
    ]
  );
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
}

// Ajuste de stock: entrada (+), salida (-) o fijar cantidad exacta.
export async function adjustStockAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  const mode = String(formData.get("mode") || "in");
  const amount = Number(formData.get("amount")) || 0;
  if (!id) return;
  const part = await one<{ stock: number }>("SELECT stock FROM parts WHERE id = ?", [id]);
  if (!part) return;
  let next = part.stock;
  if (mode === "set") next = amount;
  else if (mode === "out") next = part.stock - amount;
  else next = part.stock + amount;
  if (next < 0) next = 0;
  await run(`UPDATE parts SET stock = ?, updated_at = ${NOW_SQL} WHERE id = ?`, [next, id]);
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
}

export async function deletePartAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const id = Number(formData.get("id"));
  if (!id) return;
  await run("UPDATE parts SET active = 0 WHERE id = ?", [id]);
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
}

/* ---------------- Recordatorios de servicio ---------------- */

export async function createReminderAction(formData: FormData) {
  const user = await requireUser();
  const vehicleId = Number(formData.get("vehicle_id"));
  const dueDate = str(formData, "due_date");
  if (!vehicleId || !dueDate) return;
  await run(
    `INSERT INTO service_reminders (vehicle_id, due_date, reason, notes, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [
      vehicleId,
      dueDate,
      str(formData, "reason") || "Servicio programado",
      strOrNull(formData, "notes", { max: 2000 }),
      user.id,
    ]
  );
  revalidatePath("/admin/recordatorios");
  revalidatePath("/admin");
}

export async function toggleReminderAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!id) return;
  await run("UPDATE service_reminders SET done = 1 - done WHERE id = ?", [id]);
  revalidatePath("/admin/recordatorios");
  revalidatePath("/admin");
}

export async function deleteReminderAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!id) return;
  await run("DELETE FROM service_reminders WHERE id = ?", [id]);
  revalidatePath("/admin/recordatorios");
  revalidatePath("/admin");
}

/* ---------------- Probador de notificaciones ---------------- */

// Envía una notificación push de PRUEBA a una placa, usando un preset de cliente.
// Devuelve cuántos dispositivos están suscritos (0 = nadie recibió aún).
export async function sendTestPushAction(
  plateRaw: string,
  presetId: string
): Promise<{ ok: boolean; sent: number; error?: string }> {
  await requireUser();
  const plate = normalizePlate(plateRaw);
  const preset = CLIENT_PRESETS.find((p) => p.id === presetId);
  if (!plate) return { ok: false, sent: 0, error: "Ingresa una placa." };
  if (!preset) return { ok: false, sent: 0, error: "Aviso no válido." };

  const subs = await one<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM push_subs WHERE plate = ?",
    [plate]
  );
  const sent = subs?.n ?? 0;

  await sendPushToPlate(plate, {
    title: preset.title.replace("{placa}", plate),
    body: preset.body,
    url: `/seguimiento/${plate}`,
  });

  return { ok: true, sent };
}

export async function getCurrentUser() {
  return getSessionUser();
}

/* ---------------- Catálogo de servicios ---------------- */

export async function createServiceAction(formData: FormData) {
  await requireUser();
  const name = str(formData, "name");
  if (!name) return;
  await run(
    "INSERT INTO services (name, category, price, est_cost) VALUES (?, ?, ?, ?)",
    [
      name,
      strOrNull(formData, "category"),
      Number(formData.get("price")) || 0,
      Number(formData.get("est_cost")) || 0,
    ]
  );
  revalidatePath("/admin/servicios");
}

export async function updateServiceAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  const name = str(formData, "name");
  if (!id || !name) return;
  await run(
    `UPDATE services SET name = ?, category = ?, price = ?, est_cost = ?, updated_at = ${NOW_SQL}
     WHERE id = ?`,
    [
      name,
      strOrNull(formData, "category"),
      Number(formData.get("price")) || 0,
      Number(formData.get("est_cost")) || 0,
      id,
    ]
  );
  revalidatePath("/admin/servicios");
}

export async function deleteServiceAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const id = Number(formData.get("id"));
  if (!id) return;
  // Borrado lógico: los items históricos conservan su service_id.
  await run("UPDATE services SET active = 0 WHERE id = ?", [id]);
  revalidatePath("/admin/servicios");
}

/* ---------------- Caja / pagos ---------------- */

export async function addPaymentAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "mecanico") return;
  const orderId = Number(formData.get("order_id"));
  const amount = Number(formData.get("amount"));
  const method = str(formData, "method") || "efectivo";
  if (!orderId || !Number.isFinite(amount) || amount <= 0) return;
  if (!["efectivo", "tarjeta", "transferencia"].includes(method)) return;

  // No cobrar de más: el pago no puede exceder el saldo pendiente.
  const row = await one<{ total: number; paid: number; folio: string }>(
    `SELECT o.folio,
       (SELECT COALESCE(SUM(qty * unit_price), 0) FROM order_items WHERE order_id = o.id)::float8 AS total,
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = o.id)::float8 AS paid
     FROM orders o WHERE o.id = ?`,
    [orderId]
  );
  if (!row) return;
  const saldo = row.total - row.paid;
  if (amount > saldo + 0.009) return;

  await run(
    `INSERT INTO payments (order_id, amount, method, reference, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      amount,
      method,
      strOrNull(formData, "reference"),
      strOrNull(formData, "notes"),
      user.id,
    ]
  );

  await logActivity({
    type: "pago",
    title: `Pago ${formatMoney(amount)} · ${row.folio}`,
    detail: `Método: ${method}`,
    actorId: user.id,
    actorName: user.name,
    orderId,
    url: `/admin/ordenes/${orderId}`,
  });

  revalidatePath(`/admin/ordenes/${orderId}`);
  revalidatePath("/admin/caja");
  revalidatePath("/admin/reportes");
}

export async function deletePaymentAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const id = Number(formData.get("id"));
  if (!id) return;
  const payment = await one<{ order_id: number; amount: number; method: string }>(
    "SELECT order_id, amount, method FROM payments WHERE id = ?",
    [id]
  );
  if (!payment) return;
  await run("DELETE FROM payments WHERE id = ?", [id]);
  // Rastro interno en la orden para auditar eliminaciones de cobros.
  await run(
    `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by)
     VALUES (?, 'sistema', ?, ?, 0, ?)`,
    [
      payment.order_id,
      "Pago eliminado",
      `Se eliminó un pago de ${payment.amount} (${payment.method}).`,
      user.id,
    ]
  );
  revalidatePath(`/admin/ordenes/${payment.order_id}`);
  revalidatePath("/admin/caja");
  revalidatePath("/admin/reportes");
}

/* ---------------- Push interno del staff ---------------- */

export async function subscribeAdminPushAction(subscription: {
  endpoint: string;
  [k: string]: unknown;
}): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!subscription?.endpoint) return { ok: false };
  await run(
    `INSERT INTO admin_push_subs (user_id, endpoint, subscription) VALUES (?, ?, ?)
     ON CONFLICT (user_id, endpoint) DO UPDATE SET subscription = excluded.subscription`,
    [user.id, String(subscription.endpoint), JSON.stringify(subscription)]
  );
  return { ok: true };
}

export async function unsubscribeAdminPushAction(endpoint: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!endpoint) return { ok: false };
  await run("DELETE FROM admin_push_subs WHERE user_id = ? AND endpoint = ?", [
    user.id,
    endpoint,
  ]);
  return { ok: true };
}

/* ---------------- Centro de notificaciones internas ---------------- */

// Marca todo lo visto: mueve la marca de agua del usuario a "ahora".
export async function markNotifsSeenAction(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await markNotifsSeen(user.id);
  return { ok: true };
}

/* ---------------- Novedades para clientes ---------------- */

const ANNOUNCEMENT_TONES = ["info", "promo", "aviso"] as const;

export async function createAnnouncementAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "mecanico") return;
  const title = str(formData, "title", { max: 120 });
  const body = str(formData, "body", { max: 2000 });
  if (!title || !body) return;
  const toneRaw = String(formData.get("tone") || "info");
  const tone = (ANNOUNCEMENT_TONES as readonly string[]).includes(toneRaw) ? toneRaw : "info";

  await run(
    `INSERT INTO announcements (title, body, tone, active, starts_on, ends_on, created_by)
     VALUES (?, ?, ?, 1, ?, ?, ?)`,
    [
      title,
      body,
      tone,
      strOrNull(formData, "starts_on"),
      strOrNull(formData, "ends_on"),
      user.id,
    ]
  );
  revalidatePath("/admin/novedades");
}

export async function updateAnnouncementAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "mecanico") return;
  const id = Number(formData.get("id"));
  const title = str(formData, "title", { max: 120 });
  const body = str(formData, "body", { max: 2000 });
  if (!id || !title || !body) return;
  const toneRaw = String(formData.get("tone") || "info");
  const tone = (ANNOUNCEMENT_TONES as readonly string[]).includes(toneRaw) ? toneRaw : "info";

  await run(
    `UPDATE announcements SET title = ?, body = ?, tone = ?, starts_on = ?, ends_on = ?,
       updated_at = ${NOW_SQL} WHERE id = ?`,
    [
      title,
      body,
      tone,
      strOrNull(formData, "starts_on"),
      strOrNull(formData, "ends_on"),
      id,
    ]
  );
  revalidatePath("/admin/novedades");
}

// Publica/oculta sin borrar: el cliente deja de verla cuando active = 0.
export async function toggleAnnouncementAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "mecanico") return;
  const id = Number(formData.get("id"));
  if (!id) return;
  await run(
    `UPDATE announcements SET active = 1 - active, updated_at = ${NOW_SQL} WHERE id = ?`,
    [id]
  );
  revalidatePath("/admin/novedades");
}

export async function deleteAnnouncementAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "mecanico") return;
  const id = Number(formData.get("id"));
  if (!id) return;
  await run("DELETE FROM announcements WHERE id = ?", [id]);
  revalidatePath("/admin/novedades");
}

/* ---------------- Presupuestos (cotizaciones pre-orden) ---------------- */
// Herramienta de venta: mecánico sin acceso (mismo gating que novedades). El
// presupuesto guarda snapshots del cliente/vehículo; nada se materializa en el
// CRM hasta que el cliente aprueba (ver src/lib/quotes.ts).

// Vigencia como YYYY-MM-DD (input date); cualquier otra cosa se descarta.
function validUntilOrNull(formData: FormData): string | null {
  const v = strOrNull(formData, "valid_until", { max: 10 });
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function createQuoteAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const user = await requireUser();
  if (user.role === "mecanico") return { error: "No tienes permiso para crear presupuestos." };

  const description = str(formData, "description", { max: 2000 });
  if (!description) return { error: "Describe el trabajo a cotizar." };

  // Snapshot del vehículo/cliente. Tres orígenes: vehículo registrado, placa
  // que resulta ya registrada, o datos sueltos (no se crea nada en el CRM).
  let vehicleId = Number(formData.get("vehicle_id")) || 0;
  let clientId = 0;
  let clientName: string | null = null;
  let clientPhone: string | null = null;
  let plate = "";
  let vType = "auto";
  let vBrand: string | null = null;
  let vModel: string | null = null;
  let vYear: string | null = null;
  let vColor: string | null = null;

  if (!vehicleId) {
    plate = normalizePlate(String(formData.get("new_plate") || ""));
    if (!plate) {
      return { error: "Ingresa la placa del vehículo o elige uno ya registrado." };
    }
    const existing = await one<{ id: number }>("SELECT id FROM vehicles WHERE plate = ?", [
      plate,
    ]);
    if (existing) vehicleId = existing.id;
  }

  if (vehicleId) {
    const v = await one<{
      plate: string; type: string; brand: string | null; model: string | null;
      year: string | null; color: string | null; client_id: number | null;
      client_name: string | null; client_phone: string | null;
    }>(
      `SELECT v.plate, v.type, v.brand, v.model, v.year, v.color, v.client_id,
              c.name AS client_name, c.phone AS client_phone
         FROM vehicles v LEFT JOIN clients c ON c.id = v.client_id
        WHERE v.id = ?`,
      [vehicleId]
    );
    if (!v) return { error: "El vehículo elegido ya no existe." };
    plate = v.plate;
    vType = v.type;
    vBrand = v.brand;
    vModel = v.model;
    vYear = v.year;
    vColor = v.color;
    clientId = v.client_id ?? 0;
    clientName = v.client_name;
    clientPhone = v.client_phone;
  } else {
    clientId = Number(formData.get("client_id")) || 0;
    if (clientId) {
      const c = await one<{ name: string; phone: string | null }>(
        "SELECT name, phone FROM clients WHERE id = ?",
        [clientId]
      );
      if (!c) return { error: "El cliente elegido ya no existe." };
      clientName = c.name;
      clientPhone = c.phone;
    } else {
      clientName = str(formData, "new_client_name");
      if (!clientName) {
        return { error: "Elige un cliente existente o escribe el nombre del cliente nuevo." };
      }
      clientPhone = strOrNull(formData, "new_client_phone");
    }
    vType = String(formData.get("new_type") || "auto");
    // hasOwnProperty y no VEHICLE_TYPES[vType]: el bracket resuelve por la cadena
    // de prototipos, así que "constructor" pasaba el filtro y se persistía. Al
    // aprobar reventaba el CHECK de vehicles.type dentro de un catch{} → el
    // presupuesto quedaba aprobado sin orden y sin forma de arreglarlo desde la UI.
    if (!Object.prototype.hasOwnProperty.call(VEHICLE_TYPES, vType)) vType = "auto";
    vBrand = strOrNull(formData, "new_brand");
    vModel = strOrNull(formData, "new_model");
    vYear = strOrNull(formData, "new_year");
    vColor = strOrNull(formData, "new_color");
  }

  const { folio, value: quoteId } = await withFolioRetry("quotes", async (folio) => {
    const info = await run(
      `INSERT INTO quotes (folio, public_code, client_id, vehicle_id, client_name, client_phone,
          plate, vehicle_type, vehicle_brand, vehicle_model, vehicle_year, vehicle_color,
          description, notes, valid_until, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        folio,
        newTrackingCode(),
        clientId || null,
        vehicleId || null,
        clientName,
        clientPhone,
        plate,
        vType,
        vBrand,
        vModel,
        vYear,
        vColor,
        description,
        strOrNull(formData, "notes", { max: 2000 }),
        validUntilOrNull(formData),
        user.id,
      ]
    );
    return Number(info.lastInsertRowid);
  });

  await logActivity({
    type: "presupuesto_nuevo",
    title: `Presupuesto ${folio} creado`,
    detail: `${plate}${clientName ? ` · ${clientName}` : ""}`,
    actorId: user.id,
    actorName: user.name,
    url: `/admin/presupuestos/${quoteId}`,
  });

  revalidatePath("/admin/presupuestos");
  redirect(`/admin/presupuestos/${quoteId}`);
}

// Solo mientras está pendiente: tras la decisión el presupuesto es historial.
//
// El guard va DENTRO del WHERE del propio write, no en un SELECT previo:
// comprobarlo aparte era check-then-act y entre las dos queries cabe la
// aprobación del cliente (son round-trips de Neon HTTP, ~100-300 ms, no
// microsegundos). El concepto aterrizaba en un presupuesto ya decidido y la
// orden nacía con ítems que no cuadraban con el decision_total ya congelado.
const PENDING_GUARD_SQL = "EXISTS (SELECT 1 FROM quotes WHERE id = ? AND status = 'pendiente')";

export async function updateQuoteInfoAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "mecanico") return;
  const quoteId = Number(formData.get("quote_id"));
  const description = str(formData, "description", { max: 2000 });
  if (!quoteId || !description) return;

  await run(
    `UPDATE quotes SET description = ?, notes = ?, valid_until = ?,
        client_name = ?, client_phone = ?, updated_at = ${NOW_SQL}
      WHERE id = ? AND status = 'pendiente'`,
    [
      description,
      strOrNull(formData, "notes", { max: 2000 }),
      validUntilOrNull(formData),
      strOrNull(formData, "client_name"),
      strOrNull(formData, "client_phone"),
      quoteId,
    ]
  );
  revalidatePath(`/admin/presupuestos/${quoteId}`);
  revalidatePath("/admin/presupuestos");
}

// Espejo de addOrderItemAction SIN tocar stock: cotizar no reserva piezas (el
// descuento ocurre al aprobar, cuando se genera la orden). Por eso tampoco se
// bloquean repuestos sin existencias.
export async function addQuoteItemAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "mecanico") return;
  const quoteId = Number(formData.get("quote_id"));
  const partId = Number(formData.get("part_id")) || null;
  const serviceId = Number(formData.get("service_id")) || null;
  const qty = Number(formData.get("qty")) || 1;
  if (!quoteId || qty <= 0) return;

  let kind = String(formData.get("kind") || "servicio");
  let description = str(formData, "description", { max: 2000 });
  const canCost = user.role === "admin";
  // Campo VACÍO = usar el del catálogo (es lo que promete el hint del ItemPicker);
  // un 0 escrito a propósito es un precio válido —una cortesía— y debe respetarse.
  // Con el falsy-check anterior, Number("0") === 0 era indistinguible de vacío y
  // el precio del catálogo pisaba la cortesía: al cliente se le cobraba lo regalado.
  const rawPrice = String(formData.get("unit_price") ?? "").trim();
  const rawCost = String(formData.get("unit_cost") ?? "").trim();
  let unitPrice = Number(rawPrice) || 0;
  let unitCost = canCost ? Number(rawCost) || 0 : 0;

  if (partId) {
    const part = await one<{ name: string; unit_price: number; cost: number }>(
      "SELECT name, unit_price, cost FROM parts WHERE id = ? AND active = 1",
      [partId]
    );
    if (!part) return;
    kind = "repuesto";
    description = description || part.name;
    if (!rawPrice) unitPrice = part.unit_price;
    // Sin permiso de costo el campo ni se envía: el del catálogo es el único dato.
    if (!canCost || !rawCost) unitCost = part.cost;
  } else if (serviceId) {
    const service = await one<{ name: string; price: number; est_cost: number }>(
      "SELECT name, price, est_cost FROM services WHERE id = ? AND active = 1",
      [serviceId]
    );
    if (!service) return;
    kind = "servicio";
    description = description || service.name;
    if (!rawPrice) unitPrice = service.price;
    if (!canCost || !rawCost) unitCost = service.est_cost;
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return;
  if (!Number.isFinite(unitCost) || unitCost < 0) return;
  if (!description) return;
  if (!["servicio", "repuesto"].includes(kind)) kind = "servicio";

  await run(
    `INSERT INTO quote_items (quote_id, kind, description, qty, unit_price, unit_cost, part_id, service_id)
     SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${PENDING_GUARD_SQL}`,
    [quoteId, kind, description, qty, unitPrice, unitCost, partId, serviceId, quoteId]
  );
  revalidatePath(`/admin/presupuestos/${quoteId}`);
}

export async function updateQuoteItemAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "mecanico") return;
  const id = Number(formData.get("id"));
  const quoteId = Number(formData.get("quote_id"));
  if (!id || !quoteId) return;

  const description = str(formData, "description", { max: 2000 });
  const qty = Number(formData.get("qty"));
  const unitPrice = Number(formData.get("unit_price") || 0);
  if (!description) return;
  if (!Number.isFinite(qty) || qty <= 0) return;
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return;

  const canCost = user.role === "admin";
  const unitCost = Number(formData.get("unit_cost") || 0);
  if (canCost && (!Number.isFinite(unitCost) || unitCost < 0)) return;

  // El quote_id va en el WHERE (antes solo se comprobaba en un SELECT aparte),
  // así que el write queda acotado al presupuesto y a que siga pendiente.
  if (canCost) {
    await run(
      `UPDATE quote_items SET description = ?, qty = ?, unit_price = ?, unit_cost = ?
        WHERE id = ? AND quote_id = ? AND ${PENDING_GUARD_SQL}`,
      [description, qty, unitPrice, unitCost, id, quoteId, quoteId]
    );
  } else {
    await run(
      `UPDATE quote_items SET description = ?, qty = ?, unit_price = ?
        WHERE id = ? AND quote_id = ? AND ${PENDING_GUARD_SQL}`,
      [description, qty, unitPrice, id, quoteId, quoteId]
    );
  }
  revalidatePath(`/admin/presupuestos/${quoteId}`);
}

export async function deleteQuoteItemAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "mecanico") return;
  const id = Number(formData.get("id"));
  const quoteId = Number(formData.get("quote_id"));
  if (!id || !quoteId) return;
  await run(`DELETE FROM quote_items WHERE id = ? AND quote_id = ? AND ${PENDING_GUARD_SQL}`, [
    id,
    quoteId,
    quoteId,
  ]);
  revalidatePath(`/admin/presupuestos/${quoteId}`);
}

// El staff registra la decisión que el cliente dio en persona o por llamada.
// Converge en la misma lógica que la aprobación pública (src/lib/quotes.ts):
// aprobar genera la orden y redirige a ella.
export async function decideQuoteAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "mecanico") return;
  const quoteId = Number(formData.get("quote_id"));
  const decision = String(formData.get("decision"));
  if (!quoteId || !["aprobado", "rechazado"].includes(decision)) return;

  const actor = { id: user.id, name: user.name };
  const result =
    decision === "aprobado"
      ? await approveQuoteAndCreateOrder(quoteId, "staff", actor)
      : await rejectQuote(quoteId, "staff", actor);

  revalidatePath("/admin/presupuestos");
  revalidatePath(`/admin/presupuestos/${quoteId}`);
  revalidatePath("/admin/ordenes");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");

  if (decision === "aprobado" && result.ok && "orderId" in result && result.orderId) {
    redirect(`/admin/ordenes/${result.orderId}`);
  }
}

// Reintento de la generación de orden cuando la aprobación quedó a medias
// (aprobado sin order_id por un fallo parcial; Neon HTTP no tiene transacciones).
export async function generateOrderFromQuoteAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "mecanico") return;
  const quoteId = Number(formData.get("quote_id"));
  if (!quoteId) return;

  let orderId = 0;
  try {
    const r = await materializeOrderFromQuote(quoteId, user.id);
    orderId = r.orderId;
  } catch {
    return;
  }
  revalidatePath("/admin/presupuestos");
  revalidatePath(`/admin/presupuestos/${quoteId}`);
  revalidatePath("/admin/ordenes");
  revalidatePath("/admin/inventario");
  redirect(`/admin/ordenes/${orderId}`);
}

// Cancelar en vez de borrar: el historial de presupuestos es permanente.
export async function cancelQuoteAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "mecanico") return;
  const quoteId = Number(formData.get("quote_id"));
  if (!quoteId) return;
  await run(
    `UPDATE quotes SET status = 'cancelado', decided_at = ${NOW_SQL}, decided_via = 'staff',
        decided_by = ?, updated_at = ${NOW_SQL}
      WHERE id = ? AND status = 'pendiente'`,
    [user.id, quoteId]
  );
  revalidatePath(`/admin/presupuestos/${quoteId}`);
  revalidatePath("/admin/presupuestos");
}

// Re-cotizar tras un rechazo o vencimiento: copia encabezado y conceptos a un
// presupuesto nuevo pendiente (folio y código nuevos; la vigencia no se copia).
export async function duplicateQuoteAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "mecanico") return;
  const quoteId = Number(formData.get("quote_id"));
  if (!quoteId) return;

  const src = await one<{
    client_id: number | null; vehicle_id: number | null; client_name: string | null;
    client_phone: string | null; plate: string; vehicle_type: string;
    vehicle_brand: string | null; vehicle_model: string | null; vehicle_year: string | null;
    vehicle_color: string | null; description: string; notes: string | null; folio: string;
  }>("SELECT * FROM quotes WHERE id = ?", [quoteId]);
  if (!src) return;

  const { folio, value: newId } = await withFolioRetry("quotes", async (folio) => {
    const info = await run(
      `INSERT INTO quotes (folio, public_code, client_id, vehicle_id, client_name, client_phone,
          plate, vehicle_type, vehicle_brand, vehicle_model, vehicle_year, vehicle_color,
          description, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        folio,
        newTrackingCode(),
        src.client_id,
        src.vehicle_id,
        src.client_name,
        src.client_phone,
        src.plate,
        src.vehicle_type,
        src.vehicle_brand,
        src.vehicle_model,
        src.vehicle_year,
        src.vehicle_color,
        src.description,
        src.notes,
        user.id,
      ]
    );
    return Number(info.lastInsertRowid);
  });
  await run(
    `INSERT INTO quote_items (quote_id, kind, description, qty, unit_price, unit_cost, part_id, service_id)
     SELECT ?, kind, description, qty, unit_price, unit_cost, part_id, service_id
       FROM quote_items WHERE quote_id = ? ORDER BY id`,
    [newId, quoteId]
  );

  await logActivity({
    type: "presupuesto_nuevo",
    title: `Presupuesto ${folio} creado`,
    detail: `Duplicado de ${src.folio} · ${src.plate}`,
    actorId: user.id,
    actorName: user.name,
    url: `/admin/presupuestos/${newId}`,
  });

  revalidatePath("/admin/presupuestos");
  redirect(`/admin/presupuestos/${newId}`);
}
