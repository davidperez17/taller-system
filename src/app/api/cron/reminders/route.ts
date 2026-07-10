import { NextRequest, NextResponse } from "next/server";
import { many } from "@/lib/db";
import { sendPushToStaff } from "@/lib/push";
import { STAFF_NOTIFS } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// Cron diario (vercel.json, 13:00 UTC = 7:00 Guatemala): avisa al staff de los
// recordatorios de servicio vencidos y sin atender. Protegido con CRON_SECRET
// (Vercel lo manda como Bearer en sus invocaciones de cron).
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

  return NextResponse.json({ ok: true, overdue: overdue.length });
}
