"use client";

import { useState } from "react";
import { Ban, X } from "lucide-react";
import { updateOrderStatusAction } from "@/app/admin/actions";
import { inputCls, labelCls, btnSecondary } from "@/components/admin/ui";

// Botón de cancelación rápida desde la lista de órdenes. Abre un diálogo que
// pide el motivo (obligatorio) y reusa updateOrderStatusAction: registra el
// evento, notifica al cliente y saca la orden del filtro "Activas".
export default function CancelOrderButton({
  orderId,
  label,
}: {
  orderId: number;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onCancel(formData: FormData) {
    setPending(true);
    try {
      await updateOrderStatusAction(formData);
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Cancelar orden ${label}`}
        title="Cancelar orden"
        className="shrink-0 p-2 mr-1 text-slate-300 hover:text-red-600 transition-colors cursor-pointer"
      >
        <Ban className="w-4 h-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cancelar orden"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => !pending && setOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading font-semibold text-lg text-slate-800">
                  Cancelar orden
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">{label}</p>
              </div>
              <button
                type="button"
                onClick={() => !pending && setOpen(false)}
                aria-label="Cerrar"
                className="p-1 text-slate-500 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form action={onCancel} className="mt-4 space-y-3">
              <input type="hidden" name="order_id" value={orderId} />
              <input type="hidden" name="status" value="cancelado" />
              <div>
                <label htmlFor={`cancel-note-${orderId}`} className={labelCls}>
                  Motivo de cancelación *
                </label>
                <textarea
                  id={`cancel-note-${orderId}`}
                  name="note"
                  rows={3}
                  required
                  autoFocus
                  placeholder="Ej. El cliente desistió de la reparación."
                  className={inputCls}
                />
              </div>
              <p className="text-xs text-slate-500">
                El motivo queda en la línea de tiempo y se notifica al cliente.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className={btnSecondary}
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {pending ? "Cancelando…" : "Cancelar orden"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
