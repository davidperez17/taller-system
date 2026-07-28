import { NextRequest, NextResponse } from "next/server";
import { one, run } from "@/lib/db";
import { verifyPlateCode } from "@/lib/tracking";
import { sendPushToStaff } from "@/lib/push";
import { STAFF_NOTIFS } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { CSAT_LEVELS, CSAT_REASONS, isCsatRating, isLowCsat } from "@/lib/status";
import { hitLimit, clientIp } from "@/lib/rate-limit";

// El cliente califica el servicio en el semáforo de 4 niveles desde su página de
// seguimiento, autenticado con el tracking_code impreso en su orden. Solo con la
// orden ya ENTREGADA y una sola vez: la opinión no se corrige desde aquí.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ placa: string }> }
) {
  if (await hitLimit("feedback", await clientIp(), 10, 60 * 60)) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  let body: { code?: string; rating?: unknown; reasons?: unknown; comment?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const { placa } = await params;

  const rating = Number(body.rating);
  if (!body.code || !isCsatRating(rating)) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  // Sin zod: validación a mano sobre el JSON, mismo criterio que approve y
  // subscribe. Los motivos se filtran contra la whitelist de status.ts; vacío se
  // guarda como NULL (nunca "") para que el unnest de los reportes no cuente
  // cadenas vacías.
  const reasons =
    (Array.isArray(body.reasons)
      ? [
          ...new Set(
            body.reasons.filter((r): r is string => typeof r === "string" && r in CSAT_REASONS)
          ),
        ]
      : []
    ).join(",") || null;
  const comment = String(body.comment ?? "").trim().slice(0, 1000) || null;

  const match = await verifyPlateCode(placa, String(body.code));
  if (!match) return NextResponse.json({ error: "Código inválido" }, { status: 403 });

  const order = await one<{ id: number; folio: string; status: string }>(
    "SELECT id, folio, status FROM orders WHERE id = ?",
    [match.orderId]
  );
  if (!order || order.status !== "entregado") {
    return NextResponse.json(
      { error: "Podrás calificar cuando te entreguemos tu vehículo." },
      { status: 409 }
    );
  }

  // Una sola sentencia = atomicidad sin transacción (Neon por HTTP no las tiene):
  // el SELECT re-verifica el estado y el UNIQUE de order_id frena el doble envío.
  // Si no inserta, RETURNING no devuelve filas y rowCount queda en 0. Los casts
  // explícitos evitan que Postgres tenga que inferir el tipo de los parámetros
  // dentro del SELECT de un INSERT ... SELECT.
  const inserted = await run(
    `INSERT INTO order_feedback (order_id, rating, reasons, comment)
     SELECT o.id, ?::int, ?::text, ?::text FROM orders o
      WHERE o.id = ? AND o.status = 'entregado'
     ON CONFLICT (order_id) DO NOTHING
     RETURNING id`,
    [rating, reasons, comment, order.id]
  );
  if (inserted.rowCount === 0) {
    return NextResponse.json({ error: "Ya calificaste este servicio. ¡Gracias!" }, { status: 409 });
  }

  const meta = CSAT_LEVELS[rating];
  const motivos = reasons
    ? reasons.split(",").map((r) => CSAT_REASONS[r] ?? r).join(", ")
    : "";
  const detalle =
    [motivos && `Motivos: ${motivos}.`, comment && `“${comment}”`].filter(Boolean).join(" ") || null;

  // Evento INTERNO (is_public = 0): el cliente ya ve su calificación en la tarjeta
  // del seguimiento y no tiene por qué releerla en su línea de tiempo ni
  // encontrarla impresa en su informe de servicio (pdf.ts filtra is_public = 1).
  // type 'sistema' y no 'nota': deleteOrderNoteAction solo borra 'nota', así que
  // el registro no se puede quitar por error desde el panel.
  await run(
    `INSERT INTO order_events (order_id, type, title, detail, is_public)
     VALUES (?, 'sistema', ?, ?, 0)`,
    [order.id, `El cliente calificó el servicio: ${meta.label}`, detalle]
  );

  // Solo las calificaciones bajas interrumpen al equipo.
  if (isLowCsat(rating)) {
    await sendPushToStaff({
      ...STAFF_NOTIFS.calificacion_baja({
        folio: order.folio,
        nivel: meta.label,
        motivos: motivos || null,
      }),
      url: `/admin/ordenes/${order.id}`,
    });
  }

  await logActivity({
    type: isLowCsat(rating) ? "calificacion_baja" : "calificacion",
    title: `Cliente calificó ${order.folio}: ${meta.label}`,
    detail: detalle ?? `${meta.stars} de 4 estrellas.`,
    actorName: "Cliente",
    orderId: order.id,
    url: `/admin/ordenes/${order.id}`,
  });

  return NextResponse.json({ ok: true, rating });
}
