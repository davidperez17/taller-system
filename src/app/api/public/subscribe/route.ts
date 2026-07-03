import { NextRequest, NextResponse } from "next/server";
import { getDb, normalizePlate } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { plate, subscription } = await req.json();
    if (!plate || !subscription?.endpoint) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    const db = getDb();
    db.prepare(
      `INSERT INTO push_subs (plate, endpoint, subscription) VALUES (?, ?, ?)
       ON CONFLICT (plate, endpoint) DO UPDATE SET subscription = excluded.subscription`
    ).run(normalizePlate(plate), subscription.endpoint, JSON.stringify(subscription));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { plate, endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: "Falta endpoint" }, { status: 400 });
    const db = getDb();
    if (plate) {
      db.prepare("DELETE FROM push_subs WHERE plate = ? AND endpoint = ?").run(
        normalizePlate(plate),
        endpoint
      );
    } else {
      db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(endpoint);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
}
