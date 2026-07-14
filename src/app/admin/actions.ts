"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { one, run, normalizePlate, nextFolio, newTrackingCode } from "@/lib/db";
import {
  checkPassword, hashPassword, setSession, clearSession, getSessionUser, requireUser,
} from "@/lib/auth";
import { sendPushToPlate, sendPushToStaff } from "@/lib/push";
import { hitLimit, clientIp } from "@/lib/rate-limit";
import { str, strOrNull } from "@/lib/validate";
import {
  STATUS_META, RECEPTION_EVENT_TITLE, EXPENSE_CATEGORIES, formatMoney, type OrderStatus,
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

  const folio = await nextFolio();
  const description = str(formData, "description", { max: 2000 });
  // Modalidad del servicio: en el taller (default) o a domicilio (el equipo va
  // al cliente). La ubicación solo aplica a domicilio.
  const modality = formData.get("modality") === "domicilio" ? "domicilio" : "taller";
  const serviceLocation =
    modality === "domicilio" ? strOrNull(formData, "service_location") : null;
  // Reintento por si el tracking_code choca con el índice UNIQUE (improbable
  // con 40 bits, pero posible frente a códigos legados de 4 caracteres).
  let orderId = 0;
  for (let attempt = 0; attempt < 3 && !orderId; attempt++) {
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
      orderId = Number(info.lastInsertRowid);
    } catch (err) {
      const isUniqueCode =
        err instanceof Error && err.message.includes("idx_orders_tracking");
      if (!isUniqueCode || attempt === 2) throw err;
    }
  }

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

// Corregir el costo real de un ítem ya cotizado (p. ej. un ítem "libre" que un
// asesor agregó con costo 0). Solo admin: la rentabilidad es su vista.
export async function updateOrderItemCostAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const id = Number(formData.get("id"));
  const orderId = Number(formData.get("order_id"));
  const cost = Number(formData.get("unit_cost"));
  if (!id || !orderId || !Number.isFinite(cost) || cost < 0) return;
  await run("UPDATE order_items SET unit_cost = ? WHERE id = ?", [cost, id]);
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
  if (!(category in EXPENSE_CATEGORIES)) return;
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
