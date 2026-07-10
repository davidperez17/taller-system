import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { loadOrderDocData, buildOrderPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";

// PDF para el taller: cotización o informe de servicio de una orden.
// A diferencia del endpoint público, el informe está disponible en cualquier
// etapa (refleja el avance a la fecha).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const kind = req.nextUrl.searchParams.get("doc") === "informe" ? "informe" : "cotizacion";
  const data = await loadOrderDocData(Number(id));
  if (!data) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

  const origin = `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("host") ?? ""}`;
  const pdf = await buildOrderPdf(data, kind, origin);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${kind}-${data.folio}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
