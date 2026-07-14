"use client";

import { useState, useTransition } from "react";
import { Check, X, Pencil } from "lucide-react";
import { updateOrderEventDetailAction } from "@/app/admin/actions";

// Mensaje editable de un cambio de estado en la línea de tiempo. Muestra el
// texto con un lápiz al lado; al pulsarlo se convierte en un mini-editor que
// guarda con el server action (corrige errores sin borrar el hito). Escape
// cancela. El lápiz queda siempre visible (la app es táctil, no hay hover).
export default function EventDetailEditor({
  eventId,
  orderId,
  detail,
}: {
  eventId: number;
  orderId: number;
  detail: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(detail ?? "");
  const [pending, start] = useTransition();

  function save() {
    const fd = new FormData();
    fd.set("id", String(eventId));
    fd.set("order_id", String(orderId));
    fd.set("detail", value);
    start(async () => {
      await updateOrderEventDetailAction(fd);
      setEditing(false);
    });
  }

  function cancel() {
    setValue(detail ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="mt-1">
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <textarea
          autoFocus
          rows={2}
          value={value}
          disabled={pending}
          aria-label="Mensaje del cambio de estado"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className="w-full rounded-lg border border-sm-red/50 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sm-red"
        />
        <div className="mt-1.5 flex gap-1.5">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg text-white bg-sm-ok hover:bg-sm-ok-hover px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
          >
            <Check className="w-3.5 h-3.5" aria-hidden="true" /> Guardar
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" /> Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1.5 mt-0.5">
      {detail ? (
        <p className="flex-1 text-sm text-slate-600 whitespace-pre-wrap">{detail}</p>
      ) : (
        <p className="flex-1 text-sm text-slate-300 italic">Sin mensaje</p>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Editar mensaje"
        className="shrink-0 p-1 rounded text-slate-300 hover:text-sm-red hover:bg-sm-bg transition-colors cursor-pointer"
      >
        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
