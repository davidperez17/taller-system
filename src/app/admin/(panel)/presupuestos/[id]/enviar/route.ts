import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getQuoteWithItems, markQuoteSent, type QuoteSendKind } from "@/lib/quotes";
import { waLink, WA_TEMPLATES } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// Abre WhatsApp con el presupuesto y deja constancia del envío. Los botones del
// panel apuntan aquí en vez de a wa.me directo: sin este paso nada registraba
// que la cotización salió, y el recordatorio de seguimiento no tendría desde
// cuándo contar.
//
// ?tipo=seguimiento manda la pregunta de "¿qué le pareció?" y apaga el aviso;
// sin parámetro manda (o reenvía) la cotización y reinicia el reloj de 24 h.
//
// Es un GET con efecto porque el destino es una app externa y el enlace abre en
// pestaña nueva: el <a target="_blank"> deja el panel intacto detrás y Next no
// prefetchea anchors sueltos. Mecánico sin acceso, igual que el resto del módulo.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.role === "mecanico") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const data = await getQuoteWithItems(Number(id));
  if (!data) return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  const { quote, total } = data;

  const kind: QuoteSendKind =
    req.nextUrl.searchParams.get("tipo") === "seguimiento" ? "seguimiento" : "link";
  const origin = `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("host") ?? ""}`;
  const nombre = (quote.display_client_name ?? "").split(" ")[0] || "cliente";
  const href = waLink(
    quote.display_client_phone,
    kind === "seguimiento"
      ? WA_TEMPLATES.presupuesto_seguimiento({
          nombre,
          folio: quote.folio,
          code: quote.public_code,
          origin,
        })
      : WA_TEMPLATES.presupuesto_link({
          nombre,
          folio: quote.folio,
          total,
          code: quote.public_code,
          origin,
        })
  );

  // Sin teléfono utilizable no hay envío que sellar (el panel ya oculta los
  // botones en ese caso; esto cubre la URL escrita a mano).
  if (!href) {
    return NextResponse.redirect(new URL(`/admin/presupuestos/${quote.id}`, req.url));
  }

  await markQuoteSent(quote.id, kind, { id: user.id, name: user.name });
  return NextResponse.redirect(href);
}
