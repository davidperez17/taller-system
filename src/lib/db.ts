import { neon } from "@neondatabase/serverless";

// ─────────────────────────────────────────────────────────────────────────────
// Capa de datos sobre Neon Postgres (@neondatabase/serverless, HTTP).
//
// Reemplaza el better-sqlite3 síncrono original. Helpers async con placeholders
// estilo SQLite (`?`) que se convierten a Postgres (`$1..$n`), para que el SQL
// de los call-sites cambie lo mínimo. Los INSERT que necesitan el id agregan
// `RETURNING id` y lo leen desde `lastInsertRowid`.
// ─────────────────────────────────────────────────────────────────────────────

// Init perezoso: no leer DATABASE_URL hasta la primera query, así `next build`
// no falla sin env (igual que el Proxy de la tienda principal).
let _sql: ReturnType<typeof neon> | null = null;
function sql(text: string, params?: unknown[]) {
  if (!_sql) _sql = neon(process.env.DATABASE_URL || "");
  return _sql(text, params as unknown[]);
}

// Convierte `?` (SQLite) a `$1..$n` (Postgres), en orden.
function toPg(text: string): string {
  let i = 0;
  return text.replace(/\?/g, () => `$${++i}`);
}

// DDL idempotente. Fechas como TEXT en UTC ("YYYY-MM-DD HH24:MI:SS") para que
// el formateo (status.ts) funcione igual que con datetime('now') de SQLite.
const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     username TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     role TEXT NOT NULL DEFAULT 'mecanico' CHECK (role IN ('admin','asesor','mecanico')),
     active INTEGER NOT NULL DEFAULT 1,
     created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
   )`,
  `CREATE TABLE IF NOT EXISTS clients (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     phone TEXT,
     email TEXT,
     address TEXT,
     notes TEXT,
     created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
   )`,
  `CREATE TABLE IF NOT EXISTS vehicles (
     id SERIAL PRIMARY KEY,
     client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
     plate TEXT NOT NULL UNIQUE,
     type TEXT NOT NULL DEFAULT 'auto' CHECK (type IN ('auto','moto','camion','otro')),
     brand TEXT,
     model TEXT,
     year TEXT,
     color TEXT,
     notes TEXT,
     created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
   )`,
  `CREATE TABLE IF NOT EXISTS orders (
     id SERIAL PRIMARY KEY,
     folio TEXT NOT NULL UNIQUE,
     tracking_code TEXT NOT NULL,
     vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
     status TEXT NOT NULL DEFAULT 'recibido',
     description TEXT NOT NULL DEFAULT '',
     diagnosis TEXT,
     km TEXT,
     fuel_level TEXT,
     assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
     estimated_delivery TEXT,
     created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
     created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
     updated_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
     delivered_at TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS order_items (
     id SERIAL PRIMARY KEY,
     order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
     kind TEXT NOT NULL DEFAULT 'servicio' CHECK (kind IN ('servicio','repuesto')),
     description TEXT NOT NULL,
     qty DOUBLE PRECISION NOT NULL DEFAULT 1,
     unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
   )`,
  `CREATE TABLE IF NOT EXISTS order_events (
     id SERIAL PRIMARY KEY,
     order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
     type TEXT NOT NULL DEFAULT 'nota' CHECK (type IN ('nota','estado','sistema')),
     title TEXT NOT NULL,
     detail TEXT,
     is_public INTEGER NOT NULL DEFAULT 1,
     created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
     created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
   )`,
  `CREATE TABLE IF NOT EXISTS push_subs (
     id SERIAL PRIMARY KEY,
     plate TEXT NOT NULL,
     endpoint TEXT NOT NULL,
     subscription TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
     UNIQUE (plate, endpoint)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_vehicle ON orders(vehicle_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
  `CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_push_plate ON push_subs(plate)`,
];

// Crea el esquema una sola vez por proceso (idempotente). Si las tablas ya
// existen no hace nada; si falló, permite reintento en el próximo query.
let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const rows = (await sql(
        "SELECT to_regclass('public.users') IS NOT NULL AS ready"
      )) as { ready: boolean }[];
      if (rows[0]?.ready) return;
      for (const stmt of SCHEMA) await sql(stmt);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

export async function many<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  await ensureSchema();
  return (await sql(toPg(text), params)) as T[];
}

export async function one<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await many<T>(text, params);
  return rows[0];
}

// Para INSERT/UPDATE/DELETE. Si el SQL trae `RETURNING id`, expone
// `lastInsertRowid` (equivalente a better-sqlite3).
export async function run(
  text: string,
  params: unknown[] = []
): Promise<{ lastInsertRowid: number | undefined; rowCount: number }> {
  const rows = await many<{ id?: number }>(text, params);
  return { lastInsertRowid: rows[0]?.id, rowCount: rows.length };
}

export function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function nextFolio(): Promise<string> {
  const row = await one<{ n: number }>("SELECT COUNT(*)::int AS n FROM orders");
  return "OT-" + String((row?.n ?? 0) + 1).padStart(4, "0");
}

export function newTrackingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
