import { randomInt } from "crypto";
import { neon } from "@neondatabase/serverless";
import { SCHEMA, MIGRATIONS } from "./schema";

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


// Crea el esquema base si falta y aplica MIGRATIONS pendientes, una sola vez
// por proceso. Sentencias idempotentes: un fallo parcial se reintenta sin daño.
// El registro de versiones vive en schema_migrations; ON CONFLICT tolera que
// dos instancias serverless migren a la vez.
let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const rows = (await sql(
        "SELECT to_regclass('public.service_reminders') IS NOT NULL AS ready"
      )) as { ready: boolean }[];
      if (!rows[0]?.ready) {
        for (const stmt of SCHEMA) await sql(stmt);
      }
      await sql(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           version INTEGER PRIMARY KEY,
           applied_at TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS')
         )`
      );
      const applied = (await sql("SELECT version FROM schema_migrations")) as {
        version: number;
      }[];
      const done = new Set(applied.map((r) => r.version));
      for (let i = 0; i < MIGRATIONS.length; i++) {
        const version = i + 1;
        if (done.has(version)) continue;
        for (const stmt of MIGRATIONS[i]) await sql(stmt);
        await sql(
          "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
          [version]
        );
      }
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
  // MAX y no COUNT: si se borra una orden, COUNT repetiría un folio ya usado
  // y chocaría con el UNIQUE.
  const row = await one<{ n: number }>(
    "SELECT COALESCE(MAX(substring(folio from 4)::int), 0) AS n FROM orders"
  );
  return "OT-" + String((row?.n ?? 0) + 1).padStart(4, "0");
}

// 4 caracteres de un alfabeto de 32 sin ambiguos (I/O/0/1 fuera), ~20 bits con
// CSPRNG. Más corto para que el cliente lo dicte/teclee fácil. Los códigos de 8
// caracteres emitidos en el interín (y los de 4 originales) siguen válidos: la
// comparación hashea con SHA-256, así que el largo no importa al validar, y el
// input público acepta hasta 8. Con el UNIQUE de tracking_code y el reintento
// en createOrderAction, la colisión (32^4 ≈ 1M) es despreciable a esta escala.
export function newTrackingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[randomInt(chars.length)];
  return code;
}
