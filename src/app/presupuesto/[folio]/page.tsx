import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, KeyRound, HelpCircle, LockKeyhole, CheckCircle2, XCircle, Ban,
  CalendarClock, FileDown, ExternalLink, ShieldAlert,
} from "lucide-react";
import { getPublicQuote, type PublicQuote } from "@/lib/quotes";
import { hitLimit, clientIp } from "@/lib/rate-limit";
import { formatMoney, formatDay, formatDateShort } from "@/lib/status";
import QuoteApprovalClient from "@/components/public/QuoteApprovalClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ folio: string }>;
  searchParams: Promise<{ code?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { folio } = await params;
  return { title: `Presupuesto ${decodeURIComponent(folio).toUpperCase()}` };
}

// Página pública del presupuesto pre-orden. A diferencia del seguimiento NO hay
// modo básico: sin el código correcto no se revela nada (ni la existencia del
// folio) porque el presupuesto contiene precios. Folio inexistente y código
// incorrecto rinden exactamente la misma pantalla.
export default async function PublicQuotePage({ params, searchParams }: Props) {
  const { folio: rawFolio } = await params;
  const { code } = await searchParams;
  const folio = decodeURIComponent(rawFolio).trim().toUpperCase();

  let quote: PublicQuote | null = null;
  let limited = false;
  if (code) {
    limited = await hitLimit("quote-view", await clientIp(), 30, 10 * 60);
    if (!limited) quote = await getPublicQuote(folio, code);
  }

  return (
    <div className="pub min-h-dvh bg-sm-bg flex flex-col">
      <header className="bg-sm-graphite text-white sticky top-0 z-50 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-2.5">
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="grid place-items-center w-9 h-9 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <img
            src="/logo/logo-mts96.png"
            alt="Multiservicios San Miguel 96"
            width={1458}
            height={381}
            className="h-7 sm:h-8 w-auto shrink-0 select-none"
            draggable={false}
          />
          <div className="flex-1 min-w-0">
            <p className="font-heading font-semibold text-[15px] tracking-wide uppercase leading-none truncate">
              Presupuesto
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-5 space-y-5">
        {limited ? (
          <section className="bg-white border border-sm-border rounded-2xl p-6 text-center">
            <ShieldAlert className="w-10 h-10 text-sm-warn mx-auto" aria-hidden="true" />
            <h1 className="font-heading font-bold text-xl text-sm-graphite mt-3 tracking-wide">
              DEMASIADOS INTENTOS
            </h1>
            <p className="text-sm text-sm-muted mt-2">
              Espera unos minutos e intenta de nuevo con el código impreso en tu presupuesto.
            </p>
          </section>
        ) : quote ? (
          <QuoteView quote={quote} code={code!} />
        ) : (
          <CodeGate folio={folio} hadCode={!!code} />
        )}
      </main>

      <footer className="text-center text-xs text-sm-faint pb-6">
        Presupuesto: <span className="font-semibold">{folio}</span>
      </footer>
    </div>
  );
}

// Formulario de código (GET a la misma URL). No revela si el folio existe.
function CodeGate({ folio, hadCode }: { folio: string; hadCode: boolean }) {
  return (
    <section className="bg-sm-bg border border-sm-border rounded-2xl p-5">
      <h1 className="font-heading font-semibold text-lg text-sm-graphite tracking-wide flex items-center gap-2">
        <LockKeyhole className="w-5 h-5" aria-hidden="true" /> REVISA TU PRESUPUESTO
      </h1>
      <p className="text-sm text-sm-muted mt-1">
        Ingresa el código de acceso que te compartió el taller para ver los conceptos, el total
        y aprobar en línea.
      </p>
      <form method="GET" action={`/presupuesto/${folio}`} className="mt-3 flex gap-2">
        <label htmlFor="quote-code" className="sr-only">
          Código de acceso
        </label>
        <input
          id="quote-code"
          name="code"
          placeholder="Ej. K7M2"
          maxLength={8}
          autoComplete="off"
          autoCapitalize="characters"
          className="plate-badge flex-1 min-w-0 bg-white border border-sm-border-strong rounded-xl px-4 py-2.5 text-center text-lg text-sm-graphite placeholder:text-sm-faint focus:outline-none focus:ring-2 focus:ring-sm-red uppercase"
        />
        <button
          type="submit"
          className="bg-sm-red hover:bg-sm-red-hover active:bg-sm-red-active text-white rounded-xl px-4 font-semibold text-sm transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <KeyRound className="w-4 h-4" aria-hidden="true" /> Ver
        </button>
      </form>
      {hadCode && (
        <p className="text-sm text-sm-red mt-2">
          No encontramos un presupuesto con esos datos. Revisa el folio y el código.
        </p>
      )}
      <p className="flex items-start gap-1.5 text-xs text-sm-faint mt-3">
        <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        El código viene en el mensaje o PDF que te envió el taller. Si lo perdiste, pídelo de
        nuevo.
      </p>
    </section>
  );
}

function QuoteView({ quote, code }: { quote: PublicQuote; code: string }) {
  const vehicle =
    [quote.vehicleBrand, quote.vehicleModel, quote.vehicleYear, quote.vehicleColor]
      .filter(Boolean)
      .join(" ") || "Vehículo";
  const pdfHref = `/api/public/presupuesto/${quote.folio}/pdf?code=${encodeURIComponent(code)}`;

  return (
    <>
      {/* Encabezado del presupuesto */}
      <section className="bg-white border border-sm-border rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {quote.clientName && (
              <p className="text-sm text-sm-muted">Hola {quote.clientName.split(" ")[0]},</p>
            )}
            <h1 className="font-heading font-bold text-xl text-sm-graphite tracking-wide mt-0.5">
              PRESUPUESTO {quote.folio}
            </h1>
            <p className="text-sm text-sm-muted mt-1">
              {vehicle} · Placa <span className="font-semibold">{quote.plate}</span>
            </p>
          </div>
        </div>
        {quote.description && (
          <p className="text-sm text-sm-graphite bg-sm-bg border border-sm-border rounded-xl px-3 py-2 mt-3 whitespace-pre-wrap">
            {quote.description}
          </p>
        )}
        <p className="flex items-center gap-1.5 text-xs text-sm-faint mt-3">
          <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
          Elaborado el {formatDateShort(quote.createdAt)}
          {quote.validUntil && <> · vigente hasta el {formatDay(quote.validUntil)}</>}
        </p>
      </section>

      {/* Estado ya decidido */}
      {quote.status === "aprobado" && (
        <section className="bg-white border border-sm-border rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-sm-ok shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-heading font-semibold text-sm-graphite tracking-wide">
                PRESUPUESTO APROBADO
              </h2>
              <p className="text-sm text-sm-muted mt-1">
                Aprobaste este presupuesto
                {quote.decidedAt && <> el {formatDateShort(quote.decidedAt)}</>} por{" "}
                <strong>{formatMoney(quote.decisionTotal ?? quote.total)}</strong>.
              </p>
              {quote.tracking ? (
                <a
                  href={`/seguimiento/${quote.tracking.plate}?code=${quote.tracking.code}`}
                  className="inline-flex items-center gap-2 mt-3 bg-sm-red hover:bg-sm-red-hover text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
                >
                  <ExternalLink className="w-4 h-4" aria-hidden="true" /> Seguir mi reparación en
                  vivo
                </a>
              ) : (
                <p className="text-sm text-sm-muted mt-2">
                  El taller está abriendo tu orden de trabajo; en breve te compartirá el enlace de
                  seguimiento.
                </p>
              )}
            </div>
          </div>
        </section>
      )}
      {quote.status === "rechazado" && (
        <section className="bg-white border border-sm-border rounded-2xl p-5 flex items-start gap-3">
          <XCircle className="w-6 h-6 text-sm-warn shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-heading font-semibold text-sm-graphite tracking-wide">
              PRESUPUESTO RECHAZADO
            </h2>
            <p className="text-sm text-sm-muted mt-1">
              Rechazaste este presupuesto
              {quote.decidedAt && <> el {formatDateShort(quote.decidedAt)}</>}. Si cambias de
              opinión, contacta al taller para una nueva cotización.
            </p>
          </div>
        </section>
      )}
      {quote.status === "cancelado" && (
        <section className="bg-white border border-sm-border rounded-2xl p-5 flex items-start gap-3">
          <Ban className="w-6 h-6 text-sm-faint shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-heading font-semibold text-sm-graphite tracking-wide">
              PRESUPUESTO NO DISPONIBLE
            </h2>
            <p className="text-sm text-sm-muted mt-1">
              Este presupuesto fue retirado por el taller. Contáctalos para una cotización
              actualizada.
            </p>
          </div>
        </section>
      )}

      {/* Conceptos y total */}
      <section className="bg-white border border-sm-border rounded-2xl p-5">
        <h2 className="font-heading font-semibold text-lg text-sm-graphite tracking-wide">
          CONCEPTOS
        </h2>
        {quote.items.length === 0 ? (
          <p className="text-sm text-sm-muted mt-2">
            El taller aún está preparando los conceptos de tu presupuesto. Vuelve a revisar en un
            rato.
          </p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-sm-border/60">
              {quote.items.map((it, idx) => (
                <li key={idx} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-sm-graphite break-words">
                      {it.description}
                    </p>
                    <p className="text-xs text-sm-faint mt-0.5 capitalize">
                      {it.kind} · {it.qty} × {formatMoney(it.unit_price)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-sm-graphite">
                    {formatMoney(it.qty * it.unit_price)}
                  </p>
                </li>
              ))}
            </ul>
            {/* Con descuento hay que mostrar el subtotal: si no, la suma de los
                importes de arriba no cuadra con el total y se lee como error. */}
            <div className="mt-3 pt-3 border-t border-sm-border space-y-1.5">
              {quote.discount > 0.009 && (
                <>
                  <div className="flex items-center justify-between text-sm text-sm-muted">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatMoney(quote.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-medium text-sm-ok">
                    <span>
                      {quote.discountType === "porcentaje"
                        ? `Descuento (${quote.discountValue}%)`
                        : "Descuento"}
                    </span>
                    <span className="tabular-nums">- {formatMoney(quote.discount)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm-graphite">Total</span>
                <span className="font-heading font-bold text-xl tabular-nums text-sm-graphite">
                  {formatMoney(quote.total)}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Decisión del cliente */}
        {quote.status === "pendiente" && quote.items.length > 0 && !quote.expired && (
          <QuoteApprovalClient folio={quote.folio} code={code} total={quote.total} />
        )}
        {quote.status === "pendiente" && quote.expired && (
          <p className="mt-4 text-sm text-sm-warn bg-sm-bg border border-sm-border rounded-xl px-3 py-2.5">
            Este presupuesto venció el {formatDay(quote.validUntil!)}. Contacta al taller para
            actualizarlo: los precios pueden haber cambiado.
          </p>
        )}

        {quote.items.length > 0 && (
          <a
            href={pdfHref}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sm-red hover:text-sm-red-hover"
          >
            <FileDown className="w-4 h-4" aria-hidden="true" /> Descargar PDF
          </a>
        )}
      </section>
    </>
  );
}
