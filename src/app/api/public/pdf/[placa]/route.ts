import { NextRequest, NextResponse } from "next/server";
import { verifyPlateCode } from "@/lib/tracking";
import { loadOrderDocData, buildOrderPdf } from "@/lib/pdf";
import { hitLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// PDF descargable para el cliente: cotización (siempre) o informe de servicio
// (solo con la orden entregada). Exige placa + código de acceso, igual que el
// detalle del seguimiento.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ placa: string }> }
) {
  if (await hitLimit("pdf", await clientIp(), 20, 10 * 60)) {
    return NextResponse.json({ error: "Demasiadas descargas" }, { status: 429 });
  }
  const { placa } = await params;
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const kind = req.nextUrl.searchParams.get("doc") === "informe" ? "informe" : "cotizacion";

  const verified = await verifyPlateCode(placa, code);
  if (!verified) {
    return NextResponse.json({ error: "Placa o código incorrectos" }, { status: 404 });
  }
  if (kind === "informe" && verified.status !== "entregado") {
    return NextResponse.json(
      { error: "El informe de servicio está disponible cuando el vehículo se entrega." },
      { status: 409 }
    );
  }

  const data = await loadOrderDocData(verified.orderId);
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
