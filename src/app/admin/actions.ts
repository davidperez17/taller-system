"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, normalizePlate, nextFolio, newTrackingCode } from "@/lib/db";
import {
  checkPassword, hashPassword, setSession, clearSession, getSessionUser, requireUser,
} from "@/lib/auth";
import { sendPushToPlate } from "@/lib/push";
import { emitPlateUpdate } from "@/lib/events";
import { STATUS_META, type OrderStatus } from "@/lib/status";

/* ---------------- Autenticación ---------------- */

export async function loginAction(_prev: { error?: string } | null, formData: FormData) {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/admin");
  if (!username || !password) return { error: "Ingresa usuario y contraseña." };

  const db = getDb();
  const user = db
    .prepare("SELECT id, password_hash, active FROM users WHERE username = ?")
    .get(username) as { id: number; password_hash: string; active: number } | undefined;

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
  const db = getDb();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const info = db
    .prepare("INSERT INTO clients (name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?)")
    .run(
      name,
      String(formData.get("phone") || "").trim() || null,
      String(formData.get("email") || "").trim() || null,
      String(formData.get("address") || "").trim() || null,
      String(formData.get("notes") || "").trim() || null
    );
  revalidatePath("/admin/clientes");
  redirect(`/admin/clientes/${info.lastInsertRowid}`);
}

export async function updateClientAction(formData: FormData) {
  await requireUser();
  const db = getDb();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  db.prepare(
    "UPDATE clients SET name = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ?"
  ).run(
    name,
    String(formData.get("phone") || "").trim() || null,
    String(formData.get("email") || "").trim() || null,
    String(formData.get("address") || "").trim() || null,
    String(formData.get("notes") || "").trim() || null,
    id
  );
  revalidatePath(`/admin/clientes/${id}`);
  revalidatePath("/admin/clientes");
}

export async function deleteClientAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const id = Number(formData.get("id"));
  if (!id) return;
  getDb().prepare("DELETE FROM clients WHERE id = ?").run(id);
  revalidatePath("/admin/clientes");
  redirect("/admin/clientes");
}

/* ---------------- Vehículos ---------------- */

export async function createVehicleAction(formData: FormData) {
  await requireUser();
  const db = getDb();
  const clientId = Number(formData.get("client_id"));
  const plate = normalizePlate(String(formData.get("plate") || ""));
  if (!clientId || !plate) return;
  try {
    db.prepare(
      `INSERT INTO vehicles (client_id, plate, type, brand, model, year, color, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      clientId,
      plate,
      String(formData.get("type") || "auto"),
      String(formData.get("brand") || "").trim() || null,
      String(formData.get("model") || "").trim() || null,
      String(formData.get("year") || "").trim() || null,
      String(formData.get("color") || "").trim() || null,
      String(formData.get("notes") || "").trim() || null
    );
  } catch {
    /* placa duplicada: se ignora el alta */
  }
  revalidatePath(`/admin/clientes/${clientId}`);
  revalidatePath("/admin/vehiculos");
}

export async function updateVehicleAction(formData: FormData) {
  await requireUser();
  const db = getDb();
  const id = Number(formData.get("id"));
  const plate = normalizePlate(String(formData.get("plate") || ""));
  if (!id || !plate) return;
  try {
    db.prepare(
      `UPDATE vehicles SET plate = ?, type = ?, brand = ?, model = ?, year = ?, color = ?, notes = ?
       WHERE id = ?`
    ).run(
      plate,
      String(formData.get("type") || "auto"),
      String(formData.get("brand") || "").trim() || null,
      String(formData.get("model") || "").trim() || null,
      String(formData.get("year") || "").trim() || null,
      String(formData.get("color") || "").trim() || null,
      String(formData.get("notes") || "").trim() || null,
      id
    );
  } catch {
    /* placa duplicada */
  }
  revalidatePath("/admin/vehiculos");
}

/* ---------------- Órdenes de trabajo ---------------- */

export async function createOrderAction(formData: FormData) {
  const user = await requireUser();
  const db = getDb();

  let vehicleId = Number(formData.get("vehicle_id")) || 0;

  // Alta rápida: cliente y vehículo nuevos en el mismo formulario.
  if (!vehicleId) {
    const plate = normalizePlate(String(formData.get("new_plate") || ""));
    if (!plate) return;
    const existing = db.prepare("SELECT id FROM vehicles WHERE plate = ?").get(plate) as
      | { id: number }
      | undefined;
    if (existing) {
      vehicleId = existing.id;
    } else {
      let clientId = Number(formData.get("client_id")) || 0;
      if (!clientId) {
        const clientName = String(formData.get("new_client_name") || "").trim();
        if (!clientName) return;
        clientId = Number(
          db
            .prepare("INSERT INTO clients (name, phone) VALUES (?, ?)")
            .run(clientName, String(formData.get("new_client_phone") || "").trim() || null)
            .lastInsertRowid
        );
      }
      vehicleId = Number(
        db
          .prepare(
            `INSERT INTO vehicles (client_id, plate, type, brand, model, year, color)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            clientId,
            plate,
            String(formData.get("new_type") || "auto"),
            String(formData.get("new_brand") || "").trim() || null,
            String(formData.get("new_model") || "").trim() || null,
            String(formData.get("new_year") || "").trim() || null,
            String(formData.get("new_color") || "").trim() || null
          ).lastInsertRowid
      );
    }
  }

  const folio = nextFolio();
  const code = newTrackingCode();
  const description = String(formData.get("description") || "").trim();
  const info = db
    .prepare(
      `INSERT INTO orders (folio, tracking_code, vehicle_id, status, description, km, fuel_level, estimated_delivery, created_by)
       VALUES (?, ?, ?, 'recibido', ?, ?, ?, ?, ?)`
    )
    .run(
      folio,
      code,
      vehicleId,
      description,
      String(formData.get("km") || "").trim() || null,
      String(formData.get("fuel_level") || "").trim() || null,
      String(formData.get("estimated_delivery") || "").trim() || null,
      user.id
    );
  const orderId = Number(info.lastInsertRowid);

  db.prepare(
    `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by)
     VALUES (?, 'estado', ?, ?, 1, ?)`
  ).run(
    orderId,
    "Vehículo recibido en el taller",
    description || null,
    user.id
  );

  const plate = (
    db.prepare("SELECT plate FROM vehicles WHERE id = ?").get(vehicleId) as { plate: string }
  ).plate;
  emitPlateUpdate(plate);

  revalidatePath("/admin");
  revalidatePath("/admin/ordenes");
  redirect(`/admin/ordenes/${orderId}`);
}

export async function updateOrderStatusAction(formData: FormData) {
  const user = await requireUser();
  const db = getDb();
  const orderId = Number(formData.get("order_id"));
  const status = String(formData.get("status")) as OrderStatus;
  const note = String(formData.get("note") || "").trim();
  if (!orderId || !STATUS_META[status]) return;

  const order = db
    .prepare(
      `SELECT o.id, o.status, o.folio, v.plate FROM orders o
       JOIN vehicles v ON v.id = o.vehicle_id WHERE o.id = ?`
    )
    .get(orderId) as { id: number; status: string; folio: string; plate: string } | undefined;
  if (!order || order.status === status) return;

  db.prepare(
    `UPDATE orders SET status = ?, updated_at = datetime('now'),
     delivered_at = CASE WHEN ? = 'entregado' THEN datetime('now') ELSE delivered_at END
     WHERE id = ?`
  ).run(status, status, orderId);

  const meta = STATUS_META[status];
  db.prepare(
    `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by)
     VALUES (?, 'estado', ?, ?, 1, ?)`
  ).run(orderId, meta.client, note || meta.description, user.id);

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
  const db = getDb();
  const orderId = Number(formData.get("order_id"));
  const title = String(formData.get("title") || "").trim();
  const detail = String(formData.get("detail") || "").trim();
  const isPublic = formData.get("is_public") === "on";
  if (!orderId || !title) return;

  db.prepare(
    `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by)
     VALUES (?, 'nota', ?, ?, ?, ?)`
  ).run(orderId, title, detail || null, isPublic ? 1 : 0, user.id);

  if (isPublic) {
    const row = db
      .prepare("SELECT v.plate FROM orders o JOIN vehicles v ON v.id = o.vehicle_id WHERE o.id = ?")
      .get(orderId) as { plate: string } | undefined;
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
  const db = getDb();
  const orderId = Number(formData.get("order_id"));
  if (!orderId) return;
  db.prepare(
    `UPDATE orders SET description = ?, diagnosis = ?, km = ?, fuel_level = ?,
     estimated_delivery = ?, assigned_to = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    String(formData.get("description") || "").trim(),
    String(formData.get("diagnosis") || "").trim() || null,
    String(formData.get("km") || "").trim() || null,
    String(formData.get("fuel_level") || "").trim() || null,
    String(formData.get("estimated_delivery") || "").trim() || null,
    Number(formData.get("assigned_to")) || null,
    orderId
  );
  const row = db
    .prepare("SELECT v.plate FROM orders o JOIN vehicles v ON v.id = o.vehicle_id WHERE o.id = ?")
    .get(orderId) as { plate: string } | undefined;
  if (row) emitPlateUpdate(row.plate);
  revalidatePath(`/admin/ordenes/${orderId}`);
}

export async function addOrderItemAction(formData: FormData) {
  await requireUser();
  const db = getDb();
  const orderId = Number(formData.get("order_id"));
  const description = String(formData.get("description") || "").trim();
  if (!orderId || !description) return;
  db.prepare(
    "INSERT INTO order_items (order_id, kind, description, qty, unit_price) VALUES (?, ?, ?, ?, ?)"
  ).run(
    orderId,
    String(formData.get("kind") || "servicio"),
    description,
    Number(formData.get("qty")) || 1,
    Number(formData.get("unit_price")) || 0
  );
  const row = db
    .prepare("SELECT v.plate FROM orders o JOIN vehicles v ON v.id = o.vehicle_id WHERE o.id = ?")
    .get(orderId) as { plate: string } | undefined;
  if (row) emitPlateUpdate(row.plate);
  revalidatePath(`/admin/ordenes/${orderId}`);
}

export async function deleteOrderItemAction(formData: FormData) {
  await requireUser();
  const db = getDb();
  const id = Number(formData.get("id"));
  const orderId = Number(formData.get("order_id"));
  if (!id) return;
  db.prepare("DELETE FROM order_items WHERE id = ?").run(id);
  revalidatePath(`/admin/ordenes/${orderId}`);
}

/* ---------------- Usuarios ---------------- */

export async function createUserAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const db = getDb();
  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "mecanico");
  if (!name || !username || password.length < 6) return;
  try {
    db.prepare(
      "INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)"
    ).run(name, username, hashPassword(password), role);
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
  getDb().prepare("UPDATE users SET active = 1 - active WHERE id = ?").run(id);
  revalidatePath("/admin/usuarios");
}

export async function resetPasswordAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") return;
  const id = Number(formData.get("id"));
  const password = String(formData.get("password") || "");
  if (!id || password.length < 6) return;
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), id);
  revalidatePath("/admin/usuarios");
}

export async function getCurrentUser() {
  return getSessionUser();
}
