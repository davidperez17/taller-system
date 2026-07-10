import { headers } from "next/headers";
import { one, run } from "./db";

// Rate limiting de ventana fija persistido en Postgres (tabla rate_limits,
// migración v2). Un solo upsert por chequeo: sirve en Vercel serverless donde
// no hay memoria compartida entre instancias. A la escala del taller, el
// roundtrip extra a Neon es aceptable.

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
}

/** true = límite excedido (rechazar la petición). */
export async function hitLimit(
  scope: string,
  id: string,
  max: number,
  windowSec: number
): Promise<boolean> {
  const key = `${scope}:${id}`;
  const row = await one<{ count: number }>(
    `INSERT INTO rate_limits (key, count, reset_at)
     VALUES (?, 1, extract(epoch from now())::bigint + ?)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.reset_at < extract(epoch from now())
                    THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at < extract(epoch from now())
                       THEN excluded.reset_at ELSE rate_limits.reset_at END
     RETURNING count::int AS count`,
    [key, windowSec]
  );
  // Limpieza oportunista de ventanas vencidas (~2% de las llamadas).
  if (Math.random() < 0.02) {
    run("DELETE FROM rate_limits WHERE reset_at < extract(epoch from now())").catch(() => {});
  }
  return (row?.count ?? 0) > max;
}
