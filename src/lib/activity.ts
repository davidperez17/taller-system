import { one, many, run } from "./db";
import type { ActivityItem, ActivityType } from "./activity-meta";

const NOW_SQL = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')";

// Registra un hecho en la bitácora del equipo. Nunca debe tumbar la acción que
// lo dispara: si falla (p. ej. migración aún no aplicada), se traga el error.
export async function logActivity(a: {
  type: ActivityType;
  title: string;
  detail?: string | null;
  actorId?: number | null;
  actorName?: string | null;
  orderId?: number | null;
  url?: string | null;
}): Promise<void> {
  try {
    await run(
      `INSERT INTO activity_log (type, title, detail, actor_id, actor_name, order_id, url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        a.type,
        a.title,
        a.detail ?? null,
        a.actorId ?? null,
        a.actorName ?? null,
        a.orderId ?? null,
        a.url ?? null,
      ]
    );
  } catch {
    /* la bitácora es best-effort: no interrumpe el flujo principal */
  }
}

// Datos del centro de notificaciones para un usuario: las más recientes + el
// conteo de no leídas. No leído = posterior a su marca de agua y hecho por
// otra persona (las acciones propias no se notifican a uno mismo).
export async function getNotifCenter(
  userId: number
): Promise<{ unread: number; items: ActivityItem[] }> {
  try {
    const seen =
      (
        await one<{ notifs_seen_at: string | null }>(
          "SELECT notifs_seen_at FROM users WHERE id = ?",
          [userId]
        )
      )?.notifs_seen_at ?? null;

    const items = await many<ActivityItem>(
      `SELECT id, type, title, detail, actor_name, url, created_at
         FROM activity_log ORDER BY created_at DESC, id DESC LIMIT 20`
    );

    const unread =
      (
        await one<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM activity_log
             WHERE (?::text IS NULL OR created_at > ?)
               AND actor_id IS DISTINCT FROM ?`,
          [seen, seen, userId]
        )
      )?.n ?? 0;

    return { unread, items };
  } catch {
    return { unread: 0, items: [] };
  }
}

// Marca todo como leído para el usuario (mueve su marca de agua a ahora).
export async function markNotifsSeen(userId: number): Promise<void> {
  await run(`UPDATE users SET notifs_seen_at = ${NOW_SQL} WHERE id = ?`, [userId]);
}

// Historial completo, filtrable por autor y tipo, para la página de auditoría.
export async function getActivityHistory(filters: {
  actorId?: number | null;
  type?: string | null;
  limit?: number;
}): Promise<ActivityItem[]> {
  let where = "1=1";
  const args: (string | number)[] = [];
  if (filters.actorId) {
    where += " AND actor_id = ?";
    args.push(filters.actorId);
  }
  if (filters.type) {
    where += " AND type = ?";
    args.push(filters.type);
  }
  args.push(filters.limit ?? 200);
  return many<ActivityItem>(
    `SELECT id, type, title, detail, actor_name, url, created_at
       FROM activity_log WHERE ${where}
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    args
  );
}
