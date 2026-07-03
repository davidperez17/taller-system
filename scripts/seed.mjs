// Crea el esquema, el usuario administrador inicial y (opcional) datos demo
// sobre Neon Postgres.
//
// Uso:  DATABASE_URL="postgres://..." node scripts/seed.mjs [--demo]
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ Falta DATABASE_URL. Corre: DATABASE_URL=... node scripts/seed.mjs --demo");
  process.exit(1);
}
const sql = neon(url);

const SCHEMA = [
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
     phone TEXT, email TEXT, address TEXT, notes TEXT,
     created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
   )`,
  `CREATE TABLE IF NOT EXISTS vehicles (
     id SERIAL PRIMARY KEY,
     client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
     plate TEXT NOT NULL UNIQUE,
     type TEXT NOT NULL DEFAULT 'auto' CHECK (type IN ('auto','moto','camion','otro')),
     brand TEXT, model TEXT, year TEXT, color TEXT, notes TEXT,
     created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
   )`,
  `CREATE TABLE IF NOT EXISTS orders (
     id SERIAL PRIMARY KEY,
     folio TEXT NOT NULL UNIQUE,
     tracking_code TEXT NOT NULL,
     vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
     status TEXT NOT NULL DEFAULT 'recibido',
     description TEXT NOT NULL DEFAULT '',
     diagnosis TEXT, km TEXT, fuel_level TEXT,
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

async function main() {
  for (const stmt of SCHEMA) await sql(stmt);

  const admins = await sql("SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin'");
  if (admins[0].n === 0) {
    await sql(
      "INSERT INTO users (name, username, password_hash, role) VALUES ($1, $2, $3, 'admin')",
      ["Administrador", "admin", bcrypt.hashSync("sanmiguel96", 10)]
    );
    console.log("✔ Usuario creado → usuario: admin · contraseña: sanmiguel96 (cámbiala al entrar)");
  } else {
    console.log("• Ya existe un administrador, no se crea otro.");
  }

  if (process.argv.includes("--demo")) {
    const has = await sql("SELECT COUNT(*)::int AS n FROM clients");
    if (has[0].n > 0) {
      console.log("• Ya hay clientes, no se cargan datos demo.");
    } else {
      const admin = (await sql("SELECT id FROM users WHERE username = 'admin'"))[0];

      const c1 = (
        await sql("INSERT INTO clients (name, phone) VALUES ($1, $2) RETURNING id", [
          "Juan Pérez",
          "5555-1234",
        ])
      )[0].id;
      const c2 = (
        await sql("INSERT INTO clients (name, phone) VALUES ($1, $2) RETURNING id", [
          "María García",
          "4444-9876",
        ])
      )[0].id;

      const v1 = (
        await sql(
          `INSERT INTO vehicles (client_id, plate, type, brand, model, year, color)
           VALUES ($1, 'ABC1234', 'auto', 'Nissan', 'Versa', '2019', 'Rojo') RETURNING id`,
          [c1]
        )
      )[0].id;
      const v2 = (
        await sql(
          `INSERT INTO vehicles (client_id, plate, type, brand, model, year, color)
           VALUES ($1, 'XYZ987', 'moto', 'Italika', 'FT150', '2022', 'Negra') RETURNING id`,
          [c2]
        )
      )[0].id;

      const o1 = (
        await sql(
          `INSERT INTO orders (folio, tracking_code, vehicle_id, status, description, km, fuel_level, created_by)
           VALUES ('OT-0001', 'K7PM', $1, 'reparacion', 'No enciende, revisar sistema eléctrico', '84500', '1/2', $2)
           RETURNING id`,
          [v1, admin.id]
        )
      )[0].id;
      await sql(
        `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by)
         VALUES ($1, 'estado', 'Vehículo recibido en el taller', 'No enciende, revisar sistema eléctrico', 1, $2)`,
        [o1, admin.id]
      );
      await sql(
        `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by)
         VALUES ($1, 'estado', 'En reparación', 'Se encontró falla en el alternador. Ya tenemos el repuesto y estamos trabajando.', 1, $2)`,
        [o1, admin.id]
      );
      await sql(
        `INSERT INTO order_items (order_id, kind, description, qty, unit_price) VALUES
         ($1, 'repuesto', 'Alternador remanufacturado', 1, 2800),
         ($1, 'servicio', 'Diagnóstico eléctrico', 1, 450),
         ($1, 'servicio', 'Mano de obra instalación', 1, 900)`,
        [o1]
      );

      const o2 = (
        await sql(
          `INSERT INTO orders (folio, tracking_code, vehicle_id, status, description, created_by)
           VALUES ('OT-0002', 'W3RT', $1, 'diagnostico', 'Ruido en el motor al acelerar', $2)
           RETURNING id`,
          [v2, admin.id]
        )
      )[0].id;
      await sql(
        `INSERT INTO order_events (order_id, type, title, is_public, created_by)
         VALUES ($1, 'estado', 'Vehículo recibido en el taller', 1, $2)`,
        [o2, admin.id]
      );

      console.log("✔ Datos demo: placas ABC1234 (código K7PM) y XYZ987 (código W3RT)");
    }
  }

  console.log("Listo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
