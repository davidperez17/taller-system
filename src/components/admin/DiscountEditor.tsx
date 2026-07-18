"use client";

import { useId, useState } from "react";
import { Percent, X } from "lucide-react";
import { setOrderDiscountAction, setQuoteDiscountAction } from "@/app/admin/actions";
import { formatMoney } from "@/lib/status";
import { type DiscountType } from "@/lib/totals";
import { btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/admin/ui";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmSubmitButton from "@/components/admin/ConfirmSubmitButton";

// Descuento sobre el total, en porcentaje o monto fijo. Lo monta
// OrderItemsEditor, así que presupuestos y órdenes lo comparten por el prop
// `mode` (igual que ItemPicker).
//
// El desglose Subtotal / Descuento / Total lo pinta OrderItemsEditor; aquí solo
// vive el formulario.
export default function DiscountEditor({
  id,
  mode,
  type,
  value,
  maxAmount,
}: {
  // Id de la orden o del presupuesto, según mode.
  id: number;
  mode: "order" | "quote";
  type: DiscountType | null;
  value: number;
  // Tope del monto fijo: el subtotal en presupuestos, subtotal − pagado en
  // órdenes (dejar el total bajo lo ya cobrado daría un saldo negativo).
  maxAmount: number;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>(type ?? "");
  const isQuote = mode === "quote";
  const action = isQuote ? setQuoteDiscountAction : setOrderDiscountAction;
  const idField = isQuote ? "quote_id" : "order_id";

  if (!open) {
    return (
      <div className="mt-3 flex items-center justify-end gap-2">
        {type && (
          <form action={action}>
            <input type="hidden" name={idField} value={id} />
            <input type="hidden" name="discount_type" value="" />
            <input type="hidden" name="discount_value" value="0" />
            <ConfirmSubmitButton
              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-sm-red cursor-pointer"
              confirmTitle="¿Quitar el descuento?"
              confirmMessage="El total vuelve a la suma de los conceptos."
              confirmLabel="Quitar"
            >
              Quitar descuento
            </ConfirmSubmitButton>
          </form>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-sm-red cursor-pointer"
        >
          <Percent className="h-3.5 w-3.5" aria-hidden="true" />
          {type ? "Cambiar descuento" : "Aplicar descuento"}
        </button>
      </div>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setOpen(false);
      }}
      className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3"
    >
      <input type="hidden" name={idField} value={id} />

      <div>
        <label htmlFor={`${uid}-type`} className={labelCls}>
          Tipo
        </label>
        <select
          id={`${uid}-type`}
          name="discount_type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className={inputCls}
        >
          <option value="">Sin descuento</option>
          <option value="porcentaje">Porcentaje (%)</option>
          <option value="monto">Monto fijo (Q)</option>
        </select>
      </div>

      <div>
        <label htmlFor={`${uid}-value`} className={labelCls}>
          {kind === "porcentaje" ? "Porcentaje" : "Monto"}
        </label>
        {/* El max lo impone también el server (readDiscount y el WHERE del
            UPDATE); aquí es UX: el navegador frena el caso imposible antes de
            gastar un round-trip. */}
        <input
          id={`${uid}-value`}
          name="discount_value"
          type="number"
          step="0.01"
          min="0"
          max={kind === "porcentaje" ? 100 : Math.round(maxAmount * 100) / 100}
          disabled={!kind}
          inputMode="decimal"
          defaultValue={value || ""}
          className={inputCls}
        />
        {kind === "monto" && (
          <p className="mt-1 text-xs text-slate-400">Máx. {formatMoney(maxAmount)}</p>
        )}
      </div>

      <div className="col-span-2 flex gap-2">
        <SubmitButton className={`${btnPrimary} flex-1`} pendingText="Guardando…">
          Aplicar
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>
          <X className="h-4 w-4" aria-hidden="true" /> Cancelar
        </button>
      </div>

      <p className="col-span-2 -mt-1 text-xs text-slate-400">
        Se aplica sobre el total, no sobre un concepto. El cliente lo ve desglosado.
      </p>
    </form>
  );
}
