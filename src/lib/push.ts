import webpush from "web-push";
import { many, run, normalizePlate } from "./db";
import brand from "./brand.json";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(`mailto:${brand.pushEmail}`, pub, priv);
  configured = true;
  return true;
}

// Push interno para el equipo del taller (suscripciones por usuario, no por
// placa). Por defecto avisa a admin+asesor; los mecánicos no reciben avisos
// de gestión salvo que se pida explícitamente.
export async function sendPushToStaff(
  payload: { title: string; body: string; url?: string },
  roles: string[] = ["admin", "asesor"],
  excludeUserId?: number
) {
  if (!ensureConfigured()) return;
  // excludeUserId: no avisar a quien originó el evento (p. ej. quien editó la
  // orden ya sabe que la editó). COALESCE(?, -1) neutraliza el filtro cuando no
  // se pasa (ningún user tiene id -1).
  const subs = await many<{ id: number; subscription: string }>(
    `SELECT s.id, s.subscription FROM admin_push_subs s
       JOIN users u ON u.id = s.user_id
      WHERE u.active = 1 AND u.role = ANY(?) AND u.id <> COALESCE(?, -1)`,
    [roles, excludeUserId ?? null]
  );

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/admin",
  });

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(JSON.parse(s.subscription), data);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await run("DELETE FROM admin_push_subs WHERE id = ?", [s.id]);
        }
      }
    })
  );
}

export async function sendPushToPlate(
  plate: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!ensureConfigured()) return;
  const normalized = normalizePlate(plate);
  const subs = await many<{ id: number; subscription: string }>(
    "SELECT id, subscription FROM push_subs WHERE plate = ?",
    [normalized]
  );

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? `/seguimiento/${normalized}`,
  });

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(JSON.parse(s.subscription), data);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await run("DELETE FROM push_subs WHERE id = ?", [s.id]);
        }
      }
    })
  );
}
