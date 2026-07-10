// Definición del esquema y migraciones. Archivo puro (sin imports) para que
// tanto src/lib/db.ts como scripts/seed.mjs (Node ≥23.6, TS nativo) lo importen.
//
// SCHEMA: estado base congelado (BDs nuevas). Cambios posteriores van SIEMPRE
// en MIGRATIONS, nunca editando SCHEMA: las BDs existentes solo ejecutan
// MIGRATIONS pendientes (ver ensureSchema en db.ts).
//
// MIGRATIONS: lista ordenada; la versión es el índice + 1. Cada sentencia debe
// ser idempotente (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS) para que un fallo
// parcial se pueda reintentar sin daño.

export const SCHEMA: string[] = [
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
  `CREATE TABLE IF NOT EXISTS parts (
     id SERIAL PRIMARY KEY,
     sku TEXT,
     name TEXT NOT NULL,
     category TEXT,
     stock DOUBLE PRECISION NOT NULL DEFAULT 0,
     min_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
     unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
     cost DOUBLE PRECISION NOT NULL DEFAULT 0,
     location TEXT,
     notes TEXT,
     active INTEGER NOT NULL DEFAULT 1,
     created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
     updated_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
   )`,
  `CREATE TABLE IF NOT EXISTS service_reminders (
     id SERIAL PRIMARY KEY,
     vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
     due_date TEXT NOT NULL,
     reason TEXT NOT NULL DEFAULT 'Servicio programado',
     notes TEXT,
     done INTEGER NOT NULL DEFAULT 0,
     created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
     created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
   )`,
  `CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_vehicle ON orders(vehicle_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
  `CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_push_plate ON push_subs(plate)`,
  `CREATE INDEX IF NOT EXISTS idx_parts_active ON parts(active)`,
  `CREATE INDEX IF NOT EXISTS idx_reminders_due ON service_reminders(due_date)`,
];

export const MIGRATIONS: string[][] = [
  // v1 — revocación de sesión (F1.2)
  [`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`],
  // v2 — rate limiting persistido (F1.4)
  [
    `CREATE TABLE IF NOT EXISTS rate_limits (
       key TEXT PRIMARY KEY,
       count INTEGER NOT NULL DEFAULT 0,
       reset_at BIGINT NOT NULL
     )`,
  ],
  // v3 — tracking_code único (F1.5). Antes de crear el índice se regeneran
  // los códigos duplicados SOLO de órdenes cerradas (su papel impreso ya no
  // se usa); los códigos de órdenes activas no se tocan. random() se evalúa
  // por fila porque la expresión referencia o.id.
  [
    `UPDATE orders o SET tracking_code = upper(substr(md5(random()::text || o.id::text), 1, 8))
       WHERE o.status IN ('entregado','cancelado')
         AND EXISTS (SELECT 1 FROM orders o2
                      WHERE o2.tracking_code = o.tracking_code AND o2.id <> o.id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_code)`,
  ],
  // v4 — suscripciones push del equipo del taller (F3.1)
  [
    `CREATE TABLE IF NOT EXISTS admin_push_subs (
       id SERIAL PRIMARY KEY,
       user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       endpoint TEXT NOT NULL,
       subscription TEXT NOT NULL,
       created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
       UNIQUE (user_id, endpoint)
     )`,
  ],
  // v5 — aprobación de presupuesto por el cliente (F3.2)
  [
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pendiente'`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS approval_at TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS approval_total DOUBLE PRECISION`,
  ],
  // v6 — caja/pagos (F3.3)
  [
    `CREATE TABLE IF NOT EXISTS payments (
       id SERIAL PRIMARY KEY,
       order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
       amount DOUBLE PRECISION NOT NULL CHECK (amount > 0),
       method TEXT NOT NULL DEFAULT 'efectivo' CHECK (method IN ('efectivo','tarjeta','transferencia')),
       reference TEXT,
       notes TEXT,
       created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
       created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
     )`,
    `CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id)`,
    `CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at)`,
  ],
  // v7 — rentabilidad: catálogo de servicios y costos en items (F3.4).
  // unit_cost es snapshot al agregar el item (los cambios posteriores de costo
  // del repuesto/servicio no reescriben la historia).
  [
    `CREATE TABLE IF NOT EXISTS services (
       id SERIAL PRIMARY KEY,
       name TEXT NOT NULL,
       category TEXT,
       price DOUBLE PRECISION NOT NULL DEFAULT 0,
       est_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
       active INTEGER NOT NULL DEFAULT 1,
       created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
       updated_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
     )`,
    `CREATE INDEX IF NOT EXISTS idx_services_active ON services(active)`,
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_cost DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS part_id INTEGER REFERENCES parts(id) ON DELETE SET NULL`,
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES services(id) ON DELETE SET NULL`,
  ],
  // v8 — fotos en anotaciones: array JSON de URLs de Vercel Blob (F3.5)
  [`ALTER TABLE order_events ADD COLUMN IF NOT EXISTS photo_urls TEXT`],
];
