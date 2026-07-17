import { NextRequest, NextResponse } from "next/server";
import { many } from "@/lib/db";
import { sendPushToStaff } from "@/lib/push";
import { STAFF_NOTIFS } from "@/lib/notifications";
import { FOLLOWUP_DUE_SQL } from "@/lib/quotes";

export const dynamic = "force-dynamic";

// Cron diario (vercel.json, 13:00 UTC = 7:00 Guatemala): dos avisos al equipo,
// los recordatorios de servicio vencidos y las cotizaciones que el cliente dejó
// sin responder. Protegido con CRON_SECRET (Vercel lo manda como Bearer en sus
// invocaciones de cron).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const overdue = await many<{ plate: string; reason: string; days: number }>(
    `SELECT v.plate, r.reason,
            (current_date - r.due_date::date)::int AS days
       FROM service_reminders r
       JOIN vehicles v ON v.id = r.vehicle_id
      WHERE r.done = 0 AND r.due_date::date < current_date
      ORDER BY r.due_date
      LIMIT 20`
  );

  // Un solo push resumen (no uno por recordatorio, para no inundar al equipo).
  if (overdue.length === 1) {
    const r = overdue[0];
    await sendPushToStaff({
      ...STAFF_NOTIFS.recordatorio({ placa: r.plate, motivo: r.reason, dias: r.days }),
      url: "/admin/recordatorios",
    });
  } else if (overdue.length > 1) {
    await sendPushToStaff({
      title: "Recordatorios de servicio vencidos",
      body: `Hay ${overdue.length} recordatorios vencidos (${overdue
        .slice(0, 3)
        .map((r) => r.plate)
        .join(", ")}${overdue.length > 3 ? "…" : ""}). Contactar a los clientes.`,
      url: "/admin/recordatorios",
    });
  }

  // Cotizaciones en el aire: enviadas hace más de un día, sin decisión del
  // cliente y sin que nadie del equipo las haya perseguido. Al dar seguimiento
  // desde el panel se apagan (followed_up_at), así que no vuelven mañana.
  const stale = await many<{ folio: string; plate: string; days: number }>(
    `SELECT q.folio, q.plate, GREATEST(1, current_date - q.sent_at::date) AS days
       FROM quotes q
      WHERE ${FOLLOWUP_DUE_SQL}
      ORDER BY q.sent_at
      LIMIT 20`
  );

  if (stale.length === 1) {
    const s = stale[0];
    await sendPushToStaff({
      ...STAFF_NOTIFS.presupuesto_sin_respuesta({ folio: s.folio, placa: s.plate, dias: s.days }),
      url: "/admin/presupuestos?estado=sin_respuesta",
    });
  } else if (stale.length > 1) {
    await sendPushToStaff({
      title: "Cotizaciones sin respuesta",
      body: `Hay ${stale.length} cotizaciones enviadas que el cliente no ha contestado (${stale
        .slice(0, 3)
        .map((s) => s.folio)
        .join(", ")}${stale.length > 3 ? "…" : ""}). Pregúntales qué les parecieron.`,
      url: "/admin/presupuestos?estado=sin_respuesta",
    });
  }

  return NextResponse.json({ ok: true, overdue: overdue.length, sinRespuesta: stale.length });
}
