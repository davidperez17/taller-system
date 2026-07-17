import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { safeCodeEqual } from "@/lib/tracking";
import { approveQuoteAndCreateOrder, rejectQuote } from "@/lib/quotes";
import { hitLimit, clientIp } from "@/lib/rate-limit";

// El cliente aprueba o rechaza su presupuesto pre-orden, autenticado con el
// código compartido por el taller. Aprobar GENERA la orden de trabajo (ver
// src/lib/quotes.ts); rechazar lo deja en el historial. Respuestas 403
// idénticas para folio inexistente y código incorrecto (anti-enumeración).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ folio: string }> }
) {
  if (await hitLimit("quote-approve", await clientIp(), 10, 60 * 60)) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  let body: { code?: string; decision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const { folio: rawFolio } = await params;
  const folio = decodeURIComponent(rawFolio).trim().toUpperCase();
  const decision =
    body.decision === "aprobado" ? "aprobado" : body.decision === "rechazado" ? "rechazado" : null;
  if (!decision || !body.code) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const quote = await one<{
    id: number; status: string; public_code: string; expired: boolean; items: number;
  }>(
    `SELECT q.id, q.status, q.public_code,
            (q.valid_until IS NOT NULL AND q.valid_until < to_char(now(),'YYYY-MM-DD')) AS expired,
            (SELECT COUNT(*)::int FROM quote_items i WHERE i.quote_id = q.id) AS items
       FROM quotes q WHERE q.folio = ?`,
    [folio]
  );
  if (!quote || !safeCodeEqual(body.code.trim().toUpperCase(), quote.public_code)) {
    return NextResponse.json({ error: "Código inválido" }, { status: 403 });
  }
  if (quote.status !== "pendiente") {
    return NextResponse.json({ error: "El presupuesto ya fue respondido" }, { status: 409 });
  }
  if (quote.expired) {
    return NextResponse.json(
      { error: "El presupuesto venció. Contacta al taller para actualizarlo." },
      { status: 409 }
    );
  }
  if (quote.items === 0) {
    return NextResponse.json({ error: "El presupuesto aún no tiene conceptos" }, { status: 409 });
  }

  if (decision === "aprobado") {
    const result = await approveQuoteAndCreateOrder(quote.id, "cliente");
    if (!result.ok) {
      // Otra petición concurrente ganó el flip: mismo trato que "ya respondido".
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    // El cliente ya se autenticó con el código del presupuesto; compartirle el
    // código de seguimiento de SU orden recién creada es seguro.
    return NextResponse.json({ ok: true, decision, tracking: result.tracking });
  }

  const result = await rejectQuote(quote.id, "cliente");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true, decision });
}
