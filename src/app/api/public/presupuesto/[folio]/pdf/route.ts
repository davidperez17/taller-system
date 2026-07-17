import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { safeCodeEqual } from "@/lib/tracking";
import { loadQuoteDocData, buildOrderPdf } from "@/lib/pdf";
import { hitLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// PDF del presupuesto pre-orden para el cliente. Exige folio + código, con la
// misma respuesta para folio inexistente y código incorrecto (anti-enumeración).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ folio: string }> }
) {
  if (await hitLimit("quote-pdf", await clientIp(), 20, 10 * 60)) {
    return NextResponse.json({ error: "Demasiadas descargas" }, { status: 429 });
  }
  const { folio: rawFolio } = await params;
  const folio = decodeURIComponent(rawFolio).trim().toUpperCase();
  const code = req.nextUrl.searchParams.get("code") ?? "";

  const quote = await one<{ id: number; public_code: string }>(
    "SELECT id, public_code FROM quotes WHERE folio = ?",
    [folio]
  );
  if (!quote || !code || !safeCodeEqual(code.trim().toUpperCase(), quote.public_code)) {
    return NextResponse.json({ error: "Folio o código incorrectos" }, { status: 404 });
  }

  const data = await loadQuoteDocData(quote.id);
  if (!data) return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });

  const origin = `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("host") ?? ""}`;
  const pdf = await buildOrderPdf(data, "presupuesto", origin);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="presupuesto-${data.folio}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
