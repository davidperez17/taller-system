import Link from "next/link";
import { Trash2, Settings2 } from "lucide-react";
import {
  CLAIM_TYPES, CLAIM_STATUS_META, CLAIM_RESPONSIBLE, formatMoney, formatDay,
} from "@/lib/status";
import { updateClaimAction, deleteClaimAction } from "@/app/admin/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmSubmitButton from "@/components/admin/ConfirmSubmitButton";
import Thumbnails from "@/components/admin/Thumbnails";
import { ClaimStatusBadge, PlateBadge, btnPrimary, inputCls, labelCls } from "@/components/admin/ui";

export type ClaimListItem = {
  id: number;
  claimed_on: string;
  type: string;
  status: string;
  responsible: string;
  amount: number;
  description: string;
  resolution: string | null;
  order_id: number | null;
  photo_urls: string | null;
  folio?: string | null;
  plate?: string | null;
  author?: string | null;
};

// Lista de reclamos con gestión opcional (solo admin: valorar la pérdida, cambiar
// estado, resolver y borrar). La comparten el apartado Reclamos y el detalle de
// una orden. `showOrder` muestra el carro ligado (folio+placa); en el detalle de
// una orden se apaga porque ya es obvio de qué carro se trata.
export default function ClaimList({
  claims,
  isAdmin,
  showOrder = true,
}: {
  claims: ClaimListItem[];
  isAdmin: boolean;
  showOrder?: boolean;
}) {
  return (
    <ul className="divide-y divide-slate-50">
      {claims.map((c) => (
        <li key={c.id} className="py-3.5 first:pt-0">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-800">
                  {CLAIM_TYPES[c.type] ?? c.type}
                </span>
                <ClaimStatusBadge status={c.status} />
                <span className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                  {CLAIM_RESPONSIBLE[c.responsible] ?? c.responsible}
                </span>
                {showOrder && c.folio && c.order_id && (
                  <Link
                    href={`/admin/ordenes/${c.order_id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-sm-red hover:text-sm-red-hover"
                  >
                    {c.folio}
                    {c.plate ? <PlateBadge plate={c.plate} /> : null}
                  </Link>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{c.description}</p>
              {c.resolution && (
                <p className="text-xs text-slate-500 mt-1">
                  <b className="font-semibold text-slate-600">Resolución:</b> {c.resolution}
                </p>
              )}
              <Thumbnails raw={c.photo_urls} alt="Foto del reclamo" />
              <p className="text-xs text-slate-500 mt-1">
                {formatDay(c.claimed_on)}
                {c.author ? ` · ${c.author}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {isAdmin ? (
                <span className="font-semibold text-slate-900 tabular-nums">
                  {c.amount > 0 ? formatMoney(c.amount) : "—"}
                </span>
              ) : (
                <span className="text-[11px] text-slate-500">Sin valorar</span>
              )}
            </div>
          </div>

          {/* Gestión: solo admin (valorar monto, cambiar estado, resolver, borrar) */}
          {isAdmin && (
            <details className="mt-2">
              <summary className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-sm-red cursor-pointer list-none">
                <Settings2 className="w-3.5 h-3.5" aria-hidden="true" /> Gestionar
              </summary>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <form action={updateClaimAction} className="space-y-2.5">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="order_id" value={c.order_id ?? ""} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className={labelCls}>Estado</label>
                      <select name="status" defaultValue={c.status} className={inputCls}>
                        {Object.entries(CLAIM_STATUS_META).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Pérdida (Q)</label>
                      <input
                        name="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={c.amount}
                        inputMode="decimal"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Resolución (opcional)</label>
                    <input
                      name="resolution"
                      defaultValue={c.resolution ?? ""}
                      placeholder="Ej. El proveedor repuso la pieza sin costo."
                      className={inputCls}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <SubmitButton className={`${btnPrimary} py-2`} pendingText="Guardando…">
                      Guardar
                    </SubmitButton>
                    <ConfirmSubmitButton
                      submitAction={deleteClaimAction}
                      ariaLabel="Quitar reclamo"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
                      confirmTitle="¿Quitar reclamo?"
                      confirmMessage="Se elimina el reclamo y sus fotos. Deja de contar en reportes. No se puede deshacer."
                      confirmLabel="Quitar"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" /> Quitar
                    </ConfirmSubmitButton>
                  </div>
                </form>
              </div>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
