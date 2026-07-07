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
  `CREATE TABLE IF NOT EXISTS parts (
     id SERIAL PRIMARY KEY,
     sku TEXT, name TEXT NOT NULL, category TEXT,
     stock DOUBLE PRECISION NOT NULL DEFAULT 0,
     min_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
     unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
     cost DOUBLE PRECISION NOT NULL DEFAULT 0,
     location TEXT, notes TEXT,
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

      // Mecánicos (para el reporte de desempeño).
      const mecPass = bcrypt.hashSync("taller123", 10);
      const mec1 = (
        await sql(
          "INSERT INTO users (name, username, password_hash, role) VALUES ($1, $2, $3, 'mecanico') RETURNING id",
          ["Carlos Méndez", "carlos", mecPass]
        )
      )[0].id;
      const mec2 = (
        await sql(
          "INSERT INTO users (name, username, password_hash, role) VALUES ($1, $2, $3, 'mecanico') RETURNING id",
          ["Luis Ramírez", "luis", mecPass]
        )
      )[0].id;
      await sql("UPDATE orders SET assigned_to = $1 WHERE id = $2", [mec1, o1]);

      // Órdenes entregadas en meses anteriores → alimentan Reportes.
      const delivered = [
        { plate: "GTM145", type: "auto", brand: "Toyota", model: "Corolla", client: "Sofía López", phone: "5567-1122", days: 8, mec: mec1, items: [["servicio", "Servicio mayor 40,000 km", 1, 850], ["repuesto", "Kit de frenos delanteros", 1, 620]] },
        { plate: "PQR332", type: "camion", brand: "Isuzu", model: "NPR", client: "Transportes El Roble", phone: "5590-8877", days: 20, mec: mec2, items: [["servicio", "Cambio de embrague", 1, 1800], ["repuesto", "Disco de embrague", 1, 1450]] },
        { plate: "MNO778", type: "moto", brand: "Yamaha", model: "FZ", client: "Diego Castro", phone: "4412-9090", days: 42, mec: mec1, items: [["servicio", "Afinamiento completo", 1, 380], ["repuesto", "Juego de bujías", 2, 45]] },
        { plate: "JKL201", type: "auto", brand: "Honda", model: "Civic", client: "Ana Beltrán", phone: "5533-4455", days: 55, mec: mec2, items: [["servicio", "Cambio de aceite y filtros", 1, 320], ["repuesto", "Filtro de aire", 1, 95]] },
        { plate: "STU990", type: "auto", brand: "Kia", model: "Sportage", client: "Roberto Díaz", phone: "4478-2211", days: 78, mec: mec1, items: [["servicio", "Reparación de suspensión", 1, 1250], ["repuesto", "Par de amortiguadores", 1, 980]] },
        { plate: "VWX456", type: "auto", brand: "Mazda", model: "3", client: "Carmen Solís", phone: "5501-7788", days: 96, mec: mec2, items: [["servicio", "Cambio de banda de tiempo", 1, 1100]] },
      ];
      let folioN = 3;
      for (const d of delivered) {
        const cid = (
          await sql("INSERT INTO clients (name, phone) VALUES ($1, $2) RETURNING id", [d.client, d.phone])
        )[0].id;
        const vid = (
          await sql(
            "INSERT INTO vehicles (client_id, plate, type, brand, model) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            [cid, d.plate, d.type, d.brand, d.model]
          )
        )[0].id;
        const folio = "OT-" + String(folioN++).padStart(4, "0");
        const oid = (
          await sql(
            `INSERT INTO orders (folio, tracking_code, vehicle_id, status, description, assigned_to, created_by,
               created_at, updated_at, delivered_at)
             VALUES ($1, 'DONE', $2, 'entregado', $3, $4, $5,
               to_char(now() - make_interval(days => $6), 'YYYY-MM-DD HH24:MI:SS'),
               to_char(now() - make_interval(days => $7), 'YYYY-MM-DD HH24:MI:SS'),
               to_char(now() - make_interval(days => $7), 'YYYY-MM-DD HH24:MI:SS'))
             RETURNING id`,
            [folio, vid, `${d.brand} ${d.model} — servicio`, d.mec, admin.id, d.days + 2, d.days]
          )
        )[0].id;
        for (const [kind, desc, qty, price] of d.items) {
          await sql(
            "INSERT INTO order_items (order_id, kind, description, qty, unit_price) VALUES ($1, $2, $3, $4, $5)",
            [oid, kind, desc, qty, price]
          );
        }
        await sql(
          `INSERT INTO order_events (order_id, type, title, is_public, created_by, created_at)
           VALUES ($1, 'estado', 'Entregado', 1, $2, to_char(now() - make_interval(days => $3), 'YYYY-MM-DD HH24:MI:SS'))`,
          [oid, admin.id, d.days]
        );
      }

      // Inventario de repuestos (algunos por debajo del mínimo → alertas).
      const parts = [
        ["ACE-5W30", "Aceite sintético 5W-30 (litro)", "Lubricantes", 6, 12, 85, 55, "Estante A-1"],
        ["FIL-OIL-01", "Filtro de aceite universal", "Filtros", 3, 10, 65, 32, "Estante A-2"],
        ["FIL-AIR-02", "Filtro de aire motor", "Filtros", 14, 6, 95, 48, "Estante A-2"],
        ["BUJ-NGK-04", "Bujía NGK iridio", "Eléctrico", 8, 12, 55, 28, "Gaveta B-3"],
        ["BAT-12V", "Batería 12V 60Ah", "Eléctrico", 2, 3, 750, 520, "Piso C-1"],
        ["FRE-PAD-D", "Pastillas de freno delanteras", "Frenos", 5, 8, 320, 180, "Estante D-1"],
        ["FRE-DISC", "Disco de freno ventilado", "Frenos", 4, 4, 480, 300, "Estante D-2"],
        ["AMO-DEL", "Amortiguador delantero", "Suspensión", 1, 4, 490, 310, "Estante E-1"],
        ["BAN-TIME", "Banda de tiempo", "Motor", 7, 5, 260, 140, "Gaveta B-1"],
        ["LLA-185", "Llanta 185/65 R15", "Llantas", 10, 8, 420, 280, "Bodega F"],
        ["REF-ANTI", "Refrigerante anticongelante (galón)", "Lubricantes", 3, 6, 120, 70, "Estante A-3"],
        ["LIM-PAR", "Juego de limpiaparabrisas", "Carrocería", 16, 5, 90, 40, "Gaveta B-4"],
      ];
      for (const p of parts) {
        await sql(
          `INSERT INTO parts (sku, name, category, stock, min_stock, unit_price, cost, location)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          p
        );
      }

      // Recordatorios de servicio (vencidos, próximos y futuros).
      const rem = [
        [v1, -12, "Próximo cambio de aceite", "Cliente frecuente, avisar por teléfono"],
        [v2, -3, "Revisión de cadena y frenos", null],
        [v1, 5, "Servicio de 90,000 km", null],
        [v2, 21, "Cambio de llantas", "Recomendado en última visita"],
      ];
      for (const [vid, offset, reason, notes] of rem) {
        await sql(
          `INSERT INTO service_reminders (vehicle_id, due_date, reason, notes, created_by)
           VALUES ($1, to_char(now() + make_interval(days => $2), 'YYYY-MM-DD'), $3, $4, $5)`,
          [vid, offset, reason, notes, admin.id]
        );
      }

      console.log("✔ Datos demo: ABC1234 (K7PM) y XYZ987 (W3RT), 6 entregadas, 12 repuestos, 4 recordatorios");
      console.log("  Mecánicos demo: carlos / luis (contraseña: taller123)");
    }
  }

  console.log("Listo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
