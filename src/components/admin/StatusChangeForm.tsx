"use client";

import { useState } from "react";
import { updateOrderStatusAction } from "@/app/admin/actions";
import { STATUS_META, STATUS_FLOW, type OrderStatus } from "@/lib/status";
import { inputCls, labelCls, btnPrimary } from "@/components/admin/ui";
import SubmitButton from "@/components/admin/SubmitButton";

// Formulario de cambio de estado. Cuando se elige "Cancelar orden" el mensaje
// se convierte en "Motivo de cancelación" y pasa a ser obligatorio (el server
// action lo exige también como respaldo).
export default function StatusChangeForm({
  orderId,
  currentStatus,
}: {
  orderId: number;
  currentStatus: OrderStatus;
}) {
  const [status, setStatus] = useState<OrderStatus | "">("");
  const isCancel = status === "cancelado";
  const nextStatuses = STATUS_FLOW.filter((s) => s !== currentStatus);

  return (
    <form action={updateOrderStatusAction} className="mt-4 space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="status" className={labelCls}>
            Cambiar a
          </label>
          <select
            id="status"
            name="status"
            className={inputCls}
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus)}
          >
            <option value="" disabled>
              Selecciona nueva etapa…
            </option>
            {nextStatuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
            <option value="cancelado">Cancelar orden</option>
          </select>
        </div>
        <div>
          <label htmlFor="status-note" className={labelCls}>
            {isCancel ? "Motivo de cancelación *" : "Mensaje para el cliente (opcional)"}
          </label>
          <input
            id="status-note"
            name="note"
            required={isCancel}
            placeholder={
              isCancel
                ? "Ej. El cliente desistió de la reparación."
                : "Ej. Encontramos la falla en el alternador."
            }
            className={inputCls}
          />
        </div>
      </div>
      <SubmitButton
        className={
          isCancel
            ? "inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
            : btnPrimary
        }
        pendingText={isCancel ? "Cancelando…" : "Actualizando…"}
      >
        {isCancel ? "Cancelar orden" : "Actualizar estado y notificar"}
      </SubmitButton>
      <p className="text-xs text-slate-500">
        {isCancel
          ? "El motivo queda registrado en la línea de tiempo y se notifica al cliente."
          : "Al cambiar la etapa se envía una notificación push al cliente y se registra en su línea de tiempo."}
      </p>
    </form>
  );
}
