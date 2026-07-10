import { NextRequest, NextResponse } from "next/server";
import { one, run } from "@/lib/db";
import { verifyPlateCode } from "@/lib/tracking";
import { sendPushToStaff } from "@/lib/push";
import { STAFF_NOTIFS } from "@/lib/notifications";
import { formatMoney } from "@/lib/status";
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
    "SELECT COALESCE(SUM(qty * unit_price), 0)::float8 AS total FROM order_items WHERE order_id = ?",
    [order.id]
  );
  const total = totalRow?.total ?? 0;

  if (decision === "aprobado") {
    await run(
      `UPDATE orders SET approval_status = 'aprobado', approval_at = ${NOW_SQL},
         approval_total = ?, status = 'repuestos', updated_at = ${NOW_SQL}
       WHERE id = ? AND approval_status = 'pendiente'`,
      [total, order.id]
    );
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
  } else {
    await run(
      `UPDATE orders SET approval_status = 'rechazado', approval_at = ${NOW_SQL},
         approval_total = ?, updated_at = ${NOW_SQL}
       WHERE id = ? AND approval_status = 'pendiente'`,
      [total, order.id]
    );
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
  }

  return NextResponse.json({ ok: true, decision });
}
