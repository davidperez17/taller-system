// Crea el usuario administrador inicial y datos de demostración.
// Uso: npm run seed
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "taller.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// El esquema lo crea la app; aquí lo replicamos por si se corre antes.
db.exec(fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));

const hasAdmin = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n > 0;
if (!hasAdmin) {
  db.prepare(
    "INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, 'admin')"
  ).run("Administrador", "admin", bcrypt.hashSync("sanmiguel96", 10));
  console.log("✔ Usuario creado → usuario: admin · contraseña: sanmiguel96 (cámbiala al entrar)");
} else {
  console.log("• Ya existe un administrador, no se crea otro.");
}

if (process.argv.includes("--demo")) {
  const hasData = db.prepare("SELECT COUNT(*) AS n FROM clients").get().n > 0;
  if (hasData) {
    console.log("• Ya hay clientes, no se cargan datos demo.");
  } else {
    const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
    const c1 = db
      .prepare("INSERT INTO clients (name, phone) VALUES (?, ?)")
      .run("Juan Pérez", "555-123-4567").lastInsertRowid;
    const c2 = db
      .prepare("INSERT INTO clients (name, phone) VALUES (?, ?)")
      .run("María García", "555-987-6543").lastInsertRowid;

    const v1 = db
      .prepare(
        "INSERT INTO vehicles (client_id, plate, type, brand, model, year, color) VALUES (?, 'ABC1234', 'auto', 'Nissan', 'Versa', '2019', 'Rojo')"
      )
      .run(c1).lastInsertRowid;
    const v2 = db
      .prepare(
        "INSERT INTO vehicles (client_id, plate, type, brand, model, year, color) VALUES (?, 'XYZ987', 'moto', 'Italika', 'FT150', '2022', 'Negra')"
      )
      .run(c2).lastInsertRowid;

    const o1 = db
      .prepare(
        `INSERT INTO orders (folio, tracking_code, vehicle_id, status, description, km, fuel_level, created_by)
         VALUES ('OT-0001', 'K7PM', ?, 'reparacion', 'No enciende, revisar sistema eléctrico', '84500', '1/2', ?)`
      )
      .run(v1, admin.id).lastInsertRowid;
    db.prepare(
      `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by) VALUES
       (?, 'estado', 'Vehículo recibido en el taller', 'No enciende, revisar sistema eléctrico', 1, ?)`
    ).run(o1, admin.id);
    db.prepare(
      `INSERT INTO order_events (order_id, type, title, detail, is_public, created_by) VALUES
       (?, 'estado', 'En reparación', 'Se encontró falla en el alternador. Ya tenemos el repuesto y estamos trabajando.', 1, ?)`
    ).run(o1, admin.id);
    db.prepare(
      `INSERT INTO order_items (order_id, kind, description, qty, unit_price) VALUES
       (?, 'repuesto', 'Alternador remanufacturado', 1, 2800),
       (?, 'servicio', 'Diagnóstico eléctrico', 1, 450),
       (?, 'servicio', 'Mano de obra instalación', 1, 900)`
    ).run(o1, o1, o1);

    const o2 = db
      .prepare(
        `INSERT INTO orders (folio, tracking_code, vehicle_id, status, description, created_by)
         VALUES ('OT-0002', 'W3RT', ?, 'diagnostico', 'Ruido en el motor al acelerar', ?)`
      )
      .run(v2, admin.id).lastInsertRowid;
    db.prepare(
      `INSERT INTO order_events (order_id, type, title, is_public, created_by) VALUES
       (?, 'estado', 'Vehículo recibido en el taller', 1, ?)`
    ).run(o2, admin.id);

    console.log("✔ Datos demo: placas ABC1234 (código K7PM) y XYZ987 (código W3RT)");
  }
}

console.log("Listo.");
