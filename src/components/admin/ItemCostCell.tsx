"use client";

import { useState, useTransition } from "react";
import { Check, X, Pencil, Plus } from "lucide-react";
import { updateOrderItemCostAction } from "@/app/admin/actions";
import { formatMoney } from "@/lib/status";

// Costo unitario editable en línea dentro de la tabla de presupuesto (solo admin).
// Muestra el costo como texto; al pulsar se convierte en un mini-formulario que
// guarda con el server action. Enter guarda, Escape cancela. Un costo en 0 se
// muestra como invitación "+ costo" para corregir ítems que entraron sin costo.
export default function ItemCostCell({
  itemId,
  orderId,
  cost,
  label,
}: {
  itemId: number;
  orderId: number;
  cost: number;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(cost || ""));
  const [pending, start] = useTransition();

  function save() {
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) return;
    const fd = new FormData();
    fd.set("id", String(itemId));
    fd.set("order_id", String(orderId));
    fd.set("unit_cost", String(next));
    start(async () => {
      await updateOrderItemCostAction(fd);
      setEditing(false);
    });
  }

  function cancel() {
    setValue(String(cost || ""));
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Editar costo de ${label}`}
        className={
          cost > 0
            ? "group inline-flex items-center gap-1 tabular-nums text-slate-500 hover:text-sm-red transition-colors cursor-pointer"
            : "group inline-flex items-center gap-1 rounded-md border border-dashed border-sm-border px-1.5 py-0.5 text-xs font-medium text-sm-red/80 hover:text-sm-red hover:border-sm-red/50 transition-colors cursor-pointer"
        }
      >
        {cost > 0 ? (
          <>
            {formatMoney(cost)}
            <Pencil
              className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
            />
          </>
        ) : (
          <>
            <Plus className="w-3 h-3" aria-hidden="true" /> costo
          </>
        )}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input
        autoFocus
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={value}
        disabled={pending}
        aria-label={`Costo de ${label}`}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className="w-20 rounded-md border border-sm-red/50 bg-white px-2 py-1 text-right text-sm tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-sm-red"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        aria-label="Guardar costo"
        className="p-1.5 rounded-md text-white bg-sm-ok hover:bg-sm-ok-hover transition-colors cursor-pointer disabled:opacity-60"
      >
        <Check className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={pending}
        aria-label="Cancelar"
        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-60"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
