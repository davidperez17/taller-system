import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { loadQuoteDocData, buildOrderPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";

// PDF del presupuesto pre-orden para el taller (imprimirlo o compartirlo a
// mano). Mismo documento que descarga el cliente. Mecánico sin acceso, igual
// que el módulo Presupuestos.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.role === "mecanico") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const data = await loadQuoteDocData(Number(id));
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
