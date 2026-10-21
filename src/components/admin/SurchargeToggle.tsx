"use client";

import { useId, useState } from "react";
import { CreditCard, X } from "lucide-react";
import { setOrderSurchargeAction, setQuoteSurchargeAction } from "@/app/admin/actions";
import { DEBIT_SURCHARGE_PCT, MAX_SURCHARGE_PCT } from "@/lib/totals";
import { btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/admin/ui";
import SubmitButton from "@/components/admin/SubmitButton";

// Recargo por pagar con tarjeta de débito. Lo monta OrderItemsEditor junto al
// descuento, así que presupuestos y órdenes lo comparten por el prop `mode`.
//
// El botón principal sigue siendo de un toque (aplica DEBIT_SURCHARGE_PCT o lo
// quita); «Cambiar %» abre un campo para otra tasa, por si el banco cobra
// distinto. El server la topa en MAX_SURCHARGE_PCT y la congela en la fila.
// `pct` es la tasa ya guardada (0 = sin recargo).
export default function SurchargeToggle({
  id,
  mode,
  pct,
}: {
  // Id de la orden o del presupuesto, según mode.
  id: number;
  mode: "order" | "quote";
  pct: number;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const on = pct > 0;
  const isQuote = mode === "quote";
  const action = isQuote ? setQuoteSurchargeAction : setOrderSurchargeAction;
  const idField = isQuote ? "quote_id" : "order_id";

  if (open) {
    return (
      <form
        action={async (fd) => {
          await action(fd);
          setOpen(false);
        }}
        className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3"
      >
        <input type="hidden" name={idField} value={id} />

        <div className="col-span-2">
          <label htmlFor={`${uid}-pct`} className={labelCls}>
            Recargo por tarjeta de débito (%)
          </label>
          {/* El tope lo impone también el server (readSurcharge); aquí es UX. */}
          <input
            id={`${uid}-pct`}
            name="surcharge_pct"
            type="number"
            step="0.01"
            min="0.01"
            max={MAX_SURCHARGE_PCT}
            required
            inputMode="decimal"
            defaultValue={on ? pct : DEBIT_SURCHARGE_PCT}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-slate-500">
            Máx. {MAX_SURCHARGE_PCT}%. Se calcula sobre el total ya con descuento.
          </p>
        </div>

        <div className="col-span-2 flex gap-2">
          <SubmitButton className={`${btnPrimary} flex-1`} pendingText="Guardando…">
            Aplicar
          </SubmitButton>
          <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>
            <X className="h-4 w-4" aria-hidden="true" /> Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-sm-red cursor-pointer"
      >
        Cambiar %
      </button>
      <form action={action}>
        <input type="hidden" name={idField} value={id} />
        <input type="hidden" name="surcharge_pct" value={on ? 0 : DEBIT_SURCHARGE_PCT} />
        <SubmitButton
          pendingText="Guardando…"
          title={on ? "Quitar el recargo del total" : "Sumar el recargo al total"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors cursor-pointer disabled:opacity-60 ${
            on
              ? "border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100"
              : "border-slate-200 text-slate-600 hover:border-sm-red/40 hover:text-sm-red"
          }`}
        >
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          {on
            ? `Paga con débito (+${pct}%) · Quitar`
            : `Paga con tarjeta de débito (+${DEBIT_SURCHARGE_PCT}%)`}
        </SubmitButton>
      </form>
    </div>
  );
}
