import { NextRequest, NextResponse } from "next/server";
import { one, run } from "@/lib/db";
import { verifyPlateCode } from "@/lib/tracking";
import { sendPushToStaff } from "@/lib/push";
import { STAFF_NOTIFS } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { formatMoney } from "@/lib/status";
import { ORDER_TOTALS_SQL } from "@/lib/totals";
import { hitLimit, clientIp } from "@/lib/rate-limit";

const NOW_SQL = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')";

// El cliente aprueba o rechaza el presupuesto de su orden, autenticado con el
// tracking_code impreso. Aprobación avanza la orden a 'repuestos'; el rechazo
// la deja en 'aprobacion' para que el taller decida (re-cotizar o cancelar).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ placa: string }> }
) {
  if (await hitLimit("approve", await clientIp(), 10, 60 * 60)) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  let body: { code?: string; decision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const { placa } = await params;
  const decision = body.decision === "aprobado" ? "aprobado" : body.decision === "rechazado" ? "rechazado" : null;
  if (!decision || !body.code) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const match = await verifyPlateCode(placa, body.code);
  if (!match) return NextResponse.json({ error: "Código inválido" }, { status: 403 });

  const order = await one<{ id: number; folio: string; status: string; approval_status: string }>(
    "SELECT id, folio, status, approval_status FROM orders WHERE id = ?",
    [match.orderId]
  );
  if (!order || order.status !== "aprobacion") {
    return NextResponse.json({ error: "La orden no está en etapa de aprobación" }, { status: 409 });
  }
  if (order.approval_status !== "pendiente") {
    return NextResponse.json({ error: "El presupuesto ya fue respondido" }, { status: 409 });
  }

  const totalRow = await one<{ total: number }>(
    `SELECT total FROM ${ORDER_TOTALS_SQL} t WHERE t.order_id = ?`,
    [order.id]
  );
  const total = totalRow?.total ?? 0;

  if (decision === "aprobado") {
    // RETURNING id + chequeo: si otra petición concurrente ya respondió, el
    // UPDATE no toca filas y NO se duplican evento ni push.
    const updated = await run(
      `UPDATE orders SET approval_status = 'aprobado', approval_at = ${NOW_SQL},
         approval_total = ?, status = 'repuestos', updated_at = ${NOW_SQL}
       WHERE id = ? AND approval_status = 'pendiente' RETURNING id`,
      [total, order.id]
    );
    if (updated.rowCount === 0) {
      return NextResponse.json({ error: "El presupuesto ya fue respondido" }, { status: 409 });
    }
    await run(
      `INSERT INTO order_events (order_id, type, title, detail, is_public)
       VALUES (?, 'sistema', ?, ?, 1)`,
      [
        order.id,
        "El cliente aprobó el presupuesto",
        `Presupuesto de ${formatMoney(total)} aprobado desde la app de seguimiento.`,
      ]
    );
    await sendPushToStaff({
      ...STAFF_NOTIFS.aprobado({ folio: order.folio, total: formatMoney(total) }),
      url: `/admin/ordenes/${order.id}`,
    });
    await logActivity({
      type: "aprobacion",
      title: `Cliente aprobó ${order.folio}`,
      detail: `Presupuesto de ${formatMoney(total)}. Orden pasó a repuestos.`,
      actorName: "Cliente",
      orderId: order.id,
      url: `/admin/ordenes/${order.id}`,
    });
  } else {
    const updated = await run(
      `UPDATE orders SET approval_status = 'rechazado', approval_at = ${NOW_SQL},
         approval_total = ?, updated_at = ${NOW_SQL}
       WHERE id = ? AND approval_status = 'pendiente' RETURNING id`,
      [total, order.id]
    );
    if (updated.rowCount === 0) {
      return NextResponse.json({ error: "El presupuesto ya fue respondido" }, { status: 409 });
    }
    await run(
      `INSERT INTO order_events (order_id, type, title, detail, is_public)
       VALUES (?, 'sistema', ?, ?, 1)`,
      [
        order.id,
        "El cliente rechazó el presupuesto",
        "El taller se pondrá en contacto para acordar cómo continuar.",
      ]
    );
    await sendPushToStaff({
      ...STAFF_NOTIFS.rechazado({ folio: order.folio }),
      url: `/admin/ordenes/${order.id}`,
    });
    await logActivity({
      type: "rechazo",
      title: `Cliente rechazó ${order.folio}`,
      detail: "El taller debe contactar al cliente para acordar cómo seguir.",
      actorName: "Cliente",
      orderId: order.id,
      url: `/admin/ordenes/${order.id}`,
    });
  }

  return NextResponse.json({ ok: true, decision });
}
