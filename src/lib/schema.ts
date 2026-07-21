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
  // v9 — tutorial de bienvenida del panel: NULL = aún no lo vio
  [`ALTER TABLE users ADD COLUMN IF NOT EXISTS tour_done_at TEXT`],
  // v10 — gastos del taller y costo mensual del equipo (ganancia neta en reportes)
  [
    `CREATE TABLE IF NOT EXISTS expenses (
       id SERIAL PRIMARY KEY,
       spent_on TEXT NOT NULL,
       category TEXT NOT NULL DEFAULT 'otros',
       amount DOUBLE PRECISION NOT NULL CHECK (amount > 0),
       notes TEXT,
       created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
       created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
     )`,
    `CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(spent_on)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_cost DOUBLE PRECISION NOT NULL DEFAULT 0`,
  ],
  // v11 — actividad interna del equipo (centro de notificaciones). Registra
  // quién hizo qué (crear orden, cambiar estado, cancelar, cobrar) y las
  // respuestas del cliente. El "no leído" por usuario se resuelve con una
  // marca de agua (users.notifs_seen_at): todo lo posterior cuenta como nuevo.
  [
    `CREATE TABLE IF NOT EXISTS activity_log (
       id SERIAL PRIMARY KEY,
       type TEXT NOT NULL,
       title TEXT NOT NULL,
       detail TEXT,
       actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
       actor_name TEXT,
       order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
       url TEXT,
       created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
     )`,
    `CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS notifs_seen_at TEXT`,
  ],
  // v12 — novedades globales para clientes (banner en la app de seguimiento).
  // Un solo mensaje lo ven todos los clientes; ventana opcional de vigencia.
  [
    `CREATE TABLE IF NOT EXISTS announcements (
       id SERIAL PRIMARY KEY,
       title TEXT NOT NULL,
       body TEXT NOT NULL,
       tone TEXT NOT NULL DEFAULT 'info' CHECK (tone IN ('info','promo','aviso')),
       active INTEGER NOT NULL DEFAULT 1,
       starts_on TEXT,
       ends_on TEXT,
       created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
       created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
       updated_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
     )`,
    `CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(active)`,
  ],
  // v13 — modalidad de la orden: 'taller' (por defecto) vs 'domicilio'. Reusa
  // toda la lógica de cotización/pagos/ganancia; solo separa el canal en reportes.
  // service_location guarda dónde fue la visita (opcional, solo domicilio). Se
  // pre-carga un servicio "Visita a domicilio" para cotizar el traslado en un
  // toque; el taller edita su precio/costo cuando quiera.
  [
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS modality TEXT NOT NULL DEFAULT 'taller'`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_location TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_orders_modality ON orders(modality)`,
    `INSERT INTO services (name, category, price, est_cost)
       SELECT 'Visita a domicilio', 'Domicilio', 0, 0
        WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Visita a domicilio')`,
  ],
  // v14 — presupuestos pre-orden (cotizaciones antes de que el vehículo ingrese).
  // El presupuesto es historial permanente (nunca se borra: 'cancelado' en vez de
  // DELETE). Cliente/vehículo se materializan al APROBAR, no al cotizar, para no
  // ensuciar el CRM con consultas que no cierran; por eso las FKs van SET NULL y
  // los datos del vehículo/cliente se snapshotean en columnas propias (la placa
  // normalizada es obligatoria: garantiza poder generar la orden siempre).
  // public_code sin UNIQUE: el lookup público es siempre folio+código, así que
  // el código está scopeado a su folio (a diferencia de orders.tracking_code).
  [
    `CREATE TABLE IF NOT EXISTS quotes (
       id SERIAL PRIMARY KEY,
       folio TEXT NOT NULL UNIQUE,
       public_code TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'pendiente'
         CHECK (status IN ('pendiente','aprobado','rechazado','cancelado')),
       client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
       vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
       client_name TEXT,
       client_phone TEXT,
       plate TEXT NOT NULL,
       vehicle_type TEXT NOT NULL DEFAULT 'auto',
       vehicle_brand TEXT,
       vehicle_model TEXT,
       vehicle_year TEXT,
       vehicle_color TEXT,
       description TEXT NOT NULL DEFAULT '',
       notes TEXT,
       valid_until TEXT,
       decided_at TEXT,
       decided_via TEXT CHECK (decided_via IN ('cliente','staff')),
       decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
       decision_total DOUBLE PRECISION,
       order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
       created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
       created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
       updated_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
     )`,
    `CREATE TABLE IF NOT EXISTS quote_items (
       id SERIAL PRIMARY KEY,
       quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
       kind TEXT NOT NULL DEFAULT 'servicio' CHECK (kind IN ('servicio','repuesto')),
       description TEXT NOT NULL,
       qty DOUBLE PRECISION NOT NULL DEFAULT 1,
       unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
       unit_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
       part_id INTEGER REFERENCES parts(id) ON DELETE SET NULL,
       service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
       created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
     )`,
    `CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status)`,
    `CREATE INDEX IF NOT EXISTS idx_quotes_order ON quotes(order_id)`,
    `CREATE INDEX IF NOT EXISTS idx_quotes_created ON quotes(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id)`,
  ],
  // v15 — seguimiento del envío. Hasta aquí "enviar por WhatsApp" era un enlace
  // wa.me suelto que no tocaba la BD: el taller no sabía si una cotización había
  // salido ni cuánto llevaba en el aire. sent_at es el ancla del recordatorio
  // (24 h sin respuesta) y followed_up_at lo apaga: un aviso por envío, no una
  // cadena. Reenviar reinicia ambos (ver markQuoteSent en lib/quotes.ts).
  [
    `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_at TEXT`,
    `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS followed_up_at TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_quotes_sent ON quotes(sent_at)`,
  ],
  // v16 — descuento sobre el TOTAL del presupuesto/orden, no por concepto. Hasta
  // aquí la única forma de rebajar era poner unit_price = 0 en un concepto
  // ("cortesía"), lo que ensucia el costeo y no deja rastro de la negociación.
  //
  // Dos modalidades: 'porcentaje' (0-100) o 'monto' (Q fijos, topado al
  // subtotal). NULL + 0 es la ÚNICA representación de "sin descuento": así todo
  // CASE cae al ELSE 0 y no hay ambigüedad entre ('monto',0) y (NULL,0).
  //
  // Sin CHECK a propósito: ADD CONSTRAINT no tiene IF NOT EXISTS y rompería la
  // idempotencia que exige la cabecera de este archivo (mismo criterio que
  // orders.modality en v13). La whitelist vive en readDiscount, en actions.ts.
  //
  // El índice de order_items(order_id) faltaba y ahora pesa: las expresiones de
  // lib/totals.ts agregan por order_id en cada reporte.
  [
    `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_type TEXT`,
    `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_value DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_value DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`,
  ],
  // v17 — reclamos: pérdidas por repuesto defectuoso del proveedor, trabajo mal
  // hecho, queja del cliente/garantía u otro. Cuenta como una resta propia en la
  // ganancia neta de reportes (análogo a expenses), anclada a claimed_on.
  //
  // amount es la pérdida NETA e INCREMENTAL que el taller absorbe (0 = se registra
  // el hecho sin impacto económico, p. ej. el proveedor repuso sin costo); NUNCA
  // re-declara el costo del repuesto original, que ya vive en order_items.unit_cost
  // y ya se descuenta del margen de su orden. Por eso el monto lo teclea el admin,
  // no se deriva de los conceptos: así no se cuenta dos veces.
  //
  // Todas las FK van SET NULL (no CASCADE como payments/order_events): un reclamo
  // es historia financiera del período —lo cuenta claimed_on, no la orden—, así que
  // si la orden, el ítem, el repuesto o el usuario desaparecieran, la pérdida ya
  // ocurrió y debe sobrevivir para no reescribir un período ya cerrado.
  //
  // Sin CHECK en type/status/responsible (mismo criterio que orders.modality en v13
  // y los descuentos en v16): ADD CONSTRAINT no es idempotente. La whitelist vive en
  // status.ts (CLAIM_TYPES / CLAIM_STATUS_META / CLAIM_RESPONSIBLE) y en actions.ts.
  [
    `CREATE TABLE IF NOT EXISTS claims (
       id SERIAL PRIMARY KEY,
       claimed_on TEXT NOT NULL,
       type TEXT NOT NULL DEFAULT 'repuesto_defectuoso',
       status TEXT NOT NULL DEFAULT 'abierto',
       responsible TEXT NOT NULL DEFAULT 'proveedor',
       amount DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (amount >= 0),
       description TEXT NOT NULL,
       resolution TEXT,
       order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
       order_item_id INTEGER REFERENCES order_items(id) ON DELETE SET NULL,
       part_id INTEGER REFERENCES parts(id) ON DELETE SET NULL,
       responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
       photo_urls TEXT,
       resolved_at TEXT,
       created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
       created_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'),
       updated_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
     )`,
    `CREATE INDEX IF NOT EXISTS idx_claims_date ON claims(claimed_on)`,
    `CREATE INDEX IF NOT EXISTS idx_claims_order ON claims(order_id)`,
    `CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)`,
  ],
];
