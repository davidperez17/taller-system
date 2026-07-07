"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { one, run, normalizePlate, nextFolio, newTrackingCode } from "@/lib/db";
import {
  checkPassword, hashPassword, setSession, clearSession, getSessionUser, requireUser,
} from "@/lib/auth";
import { sendPushToPlate } from "@/lib/push";
import { emitPlateUpdate } from "@/lib/events";
import { STATUS_META, type OrderStatus } from "@/lib/status";
import { CLIENT_PRESETS } from "@/lib/notifications";

// Marca de tiempo en UTC con el mismo formato que datetime('now') de SQLite.
const NOW_SQL = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')";

/* ---------------- Autenticación ---------------- */

export async function loginAction(_prev: { error?: string } | null, formData: FormData) {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/admin");
  if (!username || !password) return { error: "Ingresa usuario y contraseña." };

  const user = await one<{ id: number; password_hash: string; active: number }>(
    "SELECT id, password_hash, active FROM users WHERE username = ?",
    [username]
  );

  if (!user || !user.active || !checkPassword(password, user.password_hash)) {
    return { error: "Usuario o contraseña incorrectos." };
  }
  await setSession(user.id);
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction() {
  await clearSession();
  redirect("/admin/login");
}

/* ---------------- Clientes ---------------- */

export async function createClientAction(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const info = await run(
    "INSERT INTO clients (name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?) RETURNING id",
    [
      name,
      String(formData.get("phone") || "").trim() || null,
      String(formData.get("email") || "").trim() || null,
      String(formData.get("address") || "").trim() || null,
      String(formData.get("notes") || "").trim() || null,
    ]
  );
  revalidatePath("/admin/clientes");
  redirect(`/admin/clientes/${info.lastInsertRowid}`);
}

export async function updateClientAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  await run(
    "UPDATE clients SET name = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ?",
    [
      name,
      String(formData.get("phone") || "").trim() || null,
      String(formData.get("email") || "").trim() || null,
      String(formData.get("address") || "").trim() || null,
      String(formData.get("notes") || "").trim() || null,
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
        String(formData.get("brand") || "").trim() || null,
        String(formData.get("model") || "").trim() || null,
        String(formData.get("year") || "").trim() || null,
        String(formData.get("color") || "").trim() || null,
        String(formData.get("notes") || "").trim() || null,
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
        String(formData.get("brand") || "").trim() || null,
        String(formData.get("model") || "").trim() || null,
        String(formData.get("year") || "").trim() || null,
        String(formData.get("color") || "").trim() || null,
        String(formData.get("notes") || "").trim() || null,
        id,
      ]
    );
  } catch {
    /* placa duplicada */
  }
  revalidatePath("/admin/vehiculos");
}

/* ---------------- Órdenes de trabajo ---------------- */

export async function createOrderAction(formData: FormData) {
  const user = await requireUser();

  let vehicleId = Number(formData.get("vehicle_id")) || 0;

  // Alta rápida: cliente y vehículo nuevos en el mismo formulario.
  if (!vehicleId) {
    const plate = normalizePlate(String(formData.get("new_plate") || ""));
    if (!plate) return;
    const existing = await one<{ id: number }>(
      "SELECT id FROM vehicles WHERE plate = ?",
      [plate]
    );
    if (existing) {
      vehicleId = existing.id;
    } else {
      let clientId = Number(formData.get("client_id")) || 0;
      if (!clientId) {
        const clientName = String(formData.get("new_client_name") || "").trim();
        if (!clientName) return;
        const c = await run(
          "INSERT INTO clients (name, phone) VALUES (?, ?) RETURNING id",
          [clientName, String(formData.get("new_client_phone") || "").trim() || null]
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
          String(formData.get("new_brand") || "").trim() || null,
          String(formData.get("new_model") || "").trim() || null,
          String(formData.get("new_year") || "").trim() || null,
          String(formData.get("new_color") || "").trim() || null,
        ]
      );
      vehicleId = Number(v.lastInsertRowid);
    }
  }

  const folio = await nextFolio();
  const code = newTrackingCode();
  const description = String(formData.get("description") || "").trim();
  const info = await run(
    `INSERT INTO orders (folio, tracking_code, vehicle_id, status, description, km, fuel_level, estimated_delivery, created_by)
     VALUES (?, ?, ?, 'recibido', ?, ?, ?, ?, ?) RETURNING id`,
    [
      folio,
      code,
      vehicleId,
      description,
      String(formData.get("km") || "").trim() || null,
      String(formData.get("fuel_level") || "").trim() || null,
      String(formData.get("estimated_delivery") || "").trim() || null,
      user.id,
    ]
  );
  const orderId = Number(info.lastInsertRowid);

  await run(
    `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by)
     VALUES (?, 'estado', ?, ?, 1, ?)`,
    [orderId, "Vehículo recibido en el taller", description || null, user.id]
  );

  const veh = await one<{ plate: string }>(
    "SELECT plate FROM vehicles WHERE id = ?",
    [vehicleId]
  );
  if (veh) emitPlateUpdate(veh.plate);

  revalidatePath("/admin");
  revalidatePath("/admin/ordenes");
  redirect(`/admin/ordenes/${orderId}`);
}

export async function updateOrderStatusAction(formData: FormData) {
  const user = await requireUser();
  const orderId = Number(formData.get("order_id"));
  const status = String(formData.get("status")) as OrderStatus;
  const note = String(formData.get("note") || "").trim();
  if (!orderId || !STATUS_META[status]) return;

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

  emitPlateUpdate(order.plate);
  await sendPushToPlate(order.plate, {
    title: `${order.plate}: ${meta.client}`,
    body: note || meta.description,
  });

  revalidatePath(`/admin/ordenes/${orderId}`);
  revalidatePath("/admin/ordenes");
  revalidatePath("/admin");
}

export async function addOrderNoteAction(formData: FormData) {
  const user = await requireUser();
  const orderId = Number(formData.get("order_id"));
  const title = String(formData.get("title") || "").trim();
  const detail = String(formData.get("detail") || "").trim();
  const isPublic = formData.get("is_public") === "on";
  if (!orderId || !title) return;

  await run(
    `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by)
     VALUES (?, 'nota', ?, ?, ?, ?)`,
    [orderId, title, detail || null, isPublic ? 1 : 0, user.id]
  );

  if (isPublic) {
    const row = await one<{ plate: string }>(
      "SELECT v.plate FROM orders o JOIN vehicles v ON v.id = o.vehicle_id WHERE o.id = ?",
      [orderId]
    );
    if (row) {
      emitPlateUpdate(row.plate);
      await sendPushToPlate(row.plate, {
        title: `${row.plate}: nueva anotación del taller`,
        body: title,
      });
    }
  }
  revalidatePath(`/admin/ordenes/${orderId}`);
}

export async function updateOrderInfoAction(formData: FormData) {
  await requireUser();
  const orderId = Number(formData.get("order_id"));
  if (!orderId) return;
  await run(
    `UPDATE orders SET description = ?, diagnosis = ?, km = ?, fuel_level = ?,
     estimated_delivery = ?, assigned_to = ?, updated_at = ${NOW_SQL} WHERE id = ?`,
    [
      String(formData.get("description") || "").trim(),
      String(formData.get("diagnosis") || "").trim() || null,
      String(formData.get("km") || "").trim() || null,
      String(formData.get("fuel_level") || "").trim() || null,
      String(formData.get("estimated_delivery") || "").trim() || null,
      Number(formData.get("assigned_to")) || null,
      orderId,
    ]
  );
  const row = await one<{ plate: string }>(
    "SELECT v.plate FROM orders o JOIN vehicles v ON v.id = o.vehicle_id WHERE o.id = ?",
    [orderId]
  );
  if (row) emitPlateUpdate(row.plate);
  revalidatePath(`/admin/ordenes/${orderId}`);
}

export async function addOrderItemAction(formData: FormData) {
  await requireUser();
  const orderId = Number(formData.get("order_id"));
  const description = String(formData.get("description") || "").trim();
  if (!orderId || !description) return;
  await run(
    "INSERT INTO order_items (order_id, kind, description, qty, unit_price) VALUES (?, ?, ?, ?, ?)",
    [
      orderId,
      String(formData.get("kind") || "servicio"),
      description,
      Number(formData.get("qty")) || 1,
      Number(formData.get("unit_price")) || 0,
    ]
  );
  const row = await one<{ plate: string }>(
    "SELECT v.plate FROM orders o JOIN vehicles v ON v.id = o.vehicle_id WHERE o.id = ?",
    [orderId]
  );
  if (row) emitPlateUpdate(row.plate);
  revalidatePath(`/admin/ordenes/${orderId}`);
}

export async function deleteOrderItemAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  const orderId = Number(formData.get("order_id"));
  if (!id) return;
  await run("DELETE FROM order_items WHERE id = ?", [id]);
  revalidatePath(`/admin/ordenes/${orderId}`);
}

/* ---------------- Usuarios ---------------- */

export async function createUserAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "mecanico");
  if (!name || !username || password.length < 6) return;
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
  if (!id || password.length < 6) return;
  await run("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(password), id]);
  revalidatePath("/admin/usuarios");
}

/* ---------------- Inventario (repuestos) ---------------- */

export async function createPartAction(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await run(
    `INSERT INTO parts (sku, name, category, stock, min_stock, unit_price, cost, location, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(formData.get("sku") || "").trim() || null,
      name,
      String(formData.get("category") || "").trim() || null,
      Number(formData.get("stock")) || 0,
      Number(formData.get("min_stock")) || 0,
      Number(formData.get("unit_price")) || 0,
      Number(formData.get("cost")) || 0,
      String(formData.get("location") || "").trim() || null,
      String(formData.get("notes") || "").trim() || null,
    ]
  );
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
}

export async function updatePartAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  await run(
    `UPDATE parts SET sku = ?, name = ?, category = ?, min_stock = ?, unit_price = ?, cost = ?,
     location = ?, notes = ?, updated_at = ${NOW_SQL} WHERE id = ?`,
    [
      String(formData.get("sku") || "").trim() || null,
      name,
      String(formData.get("category") || "").trim() || null,
      Number(formData.get("min_stock")) || 0,
      Number(formData.get("unit_price")) || 0,
      Number(formData.get("cost")) || 0,
      String(formData.get("location") || "").trim() || null,
      String(formData.get("notes") || "").trim() || null,
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
  const dueDate = String(formData.get("due_date") || "").trim();
  if (!vehicleId || !dueDate) return;
  await run(
    `INSERT INTO service_reminders (vehicle_id, due_date, reason, notes, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [
      vehicleId,
      dueDate,
      String(formData.get("reason") || "").trim() || "Servicio programado",
      String(formData.get("notes") || "").trim() || null,
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
