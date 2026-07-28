import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { CSAT_REASONS, formatDate, isLowCsat, parseCsatReasons } from "@/lib/status";
import { waLink } from "@/lib/whatsapp";
import CsatBadge from "@/components/admin/CsatBadge";
import { PlateBadge } from "@/components/admin/ui";

export type CsatListItem = {
  id: number;
  rating: number;
  reasons: string | null;
  comment: string | null;
  created_at: string;
  order_id: number;
  folio: string;
  plate: string;
  client: string;
  phone: string | null;
};

// Listado de calificaciones. Presentacional y sin hooks: sirve en server.
export default function CsatList({ items }: { items: CsatListItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-6 text-center">
        Todavía nadie ha calificado en este período. Al pasar una orden a «Entregado» el cliente
        recibe la invitación en su teléfono; también puedes pedírsela por WhatsApp desde la orden.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((f) => {
        const motivos = parseCsatReasons(f.reasons);
        // Al que calificó mal se le escribe; al que calificó bien no hace falta.
        const wa = isLowCsat(f.rating)
          ? waLink(
              f.phone,
              `Hola ${f.client.split(" ")[0]}, le saludamos del taller. Vimos su calificación del servicio ` +
                `de su vehículo placa ${f.plate} (${f.folio}) y queremos ayudarle a resolverlo. ` +
                `¿Nos cuenta qué podemos hacer?`
            )
          : null;
        return (
          <li key={f.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <CsatBadge rating={f.rating} />
              <div className="text-right shrink-0">
                <Link
                  href={`/admin/ordenes/${f.order_id}`}
                  className="text-sm font-semibold text-sm-red hover:text-sm-red-hover"
                >
                  {f.folio}
                </Link>
                <p className="text-xs text-slate-500 mt-0.5">{formatDate(f.created_at)}</p>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <PlateBadge plate={f.plate} />
              <span className="text-sm text-slate-600 truncate">{f.client}</span>
            </div>

            {motivos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {motivos.map((r) => (
                  <span
                    key={r}
                    className="text-[11px] font-medium bg-slate-100 text-slate-600 rounded-full px-2.5 py-1"
                  >
                    {CSAT_REASONS[r]}
                  </span>
                ))}
              </div>
            )}

            {f.comment && (
              <p className="mt-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 whitespace-pre-wrap">
                “{f.comment}”
              </p>
            )}

            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener"
                className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" /> Escribirle por WhatsApp
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
