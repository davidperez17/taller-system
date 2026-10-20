import { CreditCard } from "lucide-react";
import { setOrderSurchargeAction, setQuoteSurchargeAction } from "@/app/admin/actions";
import { DEBIT_SURCHARGE_PCT } from "@/lib/totals";
import SubmitButton from "@/components/admin/SubmitButton";

// Recargo por pagar con tarjeta de débito: un interruptor de un toque. Lo monta
// OrderItemsEditor junto al descuento, así que presupuestos y órdenes lo
// comparten por el prop `mode`.
//
// El form solo manda surcharge=1/0; la tasa la decide el server
// (DEBIT_SURCHARGE_PCT) y queda congelada en la fila. `pct` es la tasa ya
// guardada: puede no ser la actual si se cambió después de aplicarla.
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
  const on = pct > 0;
  const isQuote = mode === "quote";

  return (
    <form
      action={isQuote ? setQuoteSurchargeAction : setOrderSurchargeAction}
      className="mt-3 flex justify-end"
    >
      <input type="hidden" name={isQuote ? "quote_id" : "order_id"} value={id} />
      <input type="hidden" name="surcharge" value={on ? "0" : "1"} />
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
  );
}
