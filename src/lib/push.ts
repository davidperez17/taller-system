import webpush from "web-push";
import { getDb, normalizePlate } from "./db";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:contacto@sanmiguel96.com", pub, priv);
  configured = true;
  return true;
}

export async function sendPushToPlate(
  plate: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!ensureConfigured()) return;
  const db = getDb();
  const normalized = normalizePlate(plate);
  const subs = db
    .prepare("SELECT id, subscription FROM push_subs WHERE plate = ?")
    .all(normalized) as { id: number; subscription: string }[];

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
          db.prepare("DELETE FROM push_subs WHERE id = ?").run(s.id);
        }
      }
    })
  );
}
