import { NextRequest, NextResponse } from "next/server";
import { getTracking } from "@/lib/tracking";
import { hitLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ placa: string }> }
) {
  // Generoso porque el seguimiento sondea cada ~25 s y varios clientes pueden
  // compartir IP (CGNAT móvil); aún así frena la fuerza bruta de códigos.
  if (await hitLimit("track", await clientIp(), 120, 10 * 60)) {
    return NextResponse.json({ error: "Demasiadas consultas" }, { status: 429 });
  }
  const { placa } = await params;
  const code = req.nextUrl.searchParams.get("code");
  const result = await getTracking(placa, code);
  return NextResponse.json(result, {
    status: result.found ? 200 : 404,
    headers: { "Cache-Control": "no-store" },
  });
}
