import { NextRequest, NextResponse } from "next/server";
import { run, normalizePlate } from "@/lib/db";
import { verifyPlateCode } from "@/lib/tracking";
import { hitLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    if (await hitLimit("subscribe", await clientIp(), 10, 60 * 60)) {
      return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
    }
    const { plate, code, subscription } = await req.json();
    if (!plate || !subscription?.endpoint) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    // Solo quien tiene el código impreso en la orden puede suscribirse a los
    // avisos de esa placa (evita interceptar push de vehículos ajenos).
    if (!code || !(await verifyPlateCode(plate, String(code)))) {
      return NextResponse.json({ error: "Código inválido" }, { status: 403 });
    }
    await run(
      `INSERT INTO push_subs (plate, endpoint, subscription) VALUES (?, ?, ?)
       ON CONFLICT (plate, endpoint) DO UPDATE SET subscription = excluded.subscription`,
      [normalizePlate(plate), subscription.endpoint, JSON.stringify(subscription)]
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { plate, endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: "Falta endpoint" }, { status: 400 });
    if (plate) {
      await run("DELETE FROM push_subs WHERE plate = ? AND endpoint = ?", [
        normalizePlate(plate),
        endpoint,
      ]);
    } else {
      await run("DELETE FROM push_subs WHERE endpoint = ?", [endpoint]);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
}
