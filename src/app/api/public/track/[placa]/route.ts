import { NextRequest, NextResponse } from "next/server";
import { getTracking } from "@/lib/tracking";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ placa: string }> }
) {
  const { placa } = await params;
  const code = req.nextUrl.searchParams.get("code");
  const result = await getTracking(placa, code);
  return NextResponse.json(result, {
    status: result.found ? 200 : 404,
    headers: { "Cache-Control": "no-store" },
  });
}
