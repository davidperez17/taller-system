"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

// Botón de envío con confirmación previa, para acciones destructivas (eliminar,
// quitar). Es type="button": no envía por sí solo. Al confirmar, hace
// requestSubmit() sobre su <form> contenedor, así el server action y los
// inputs ocultos existentes siguen igual. Para formularios con varias acciones
// (un botón con formAction distinto al del form), pasar `submitAction`.
export default function ConfirmSubmitButton({
  children,
  className,
  ariaLabel,
  confirmTitle = "¿Eliminar?",
  confirmMessage = "Esta acción no se puede deshacer.",
  confirmLabel = "Eliminar",
  submitAction,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  confirmTitle?: string;
  confirmMessage?: string;
  confirmLabel?: string;
  submitAction?: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  function confirm() {
    setOpen(false);
    const form = triggerRef.current?.closest("form");
    if (!form) return;
    if (submitAction && submitRef.current) form.requestSubmit(submitRef.current);
    else form.requestSubmit();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>

      {/* Submit oculto que lleva el formAction específico (forms multi-acción). */}
      {submitAction && (
        <button
          ref={submitRef}
          type="submit"
          formAction={submitAction}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {open && mounted &&
        createPortal(
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={confirmTitle}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          >
            <button
              type="button"
              aria-label="Cancelar"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-slate-900/40"
            />
            <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm p-5 animate-slide-up">
              <div className="flex gap-3">
                <span className="shrink-0 rounded-xl bg-red-100 text-red-600 p-2 h-fit" aria-hidden="true">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-heading font-semibold text-lg text-slate-800">{confirmTitle}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{confirmMessage}</p>
                </div>
              </div>
              <div className="mt-5 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  autoFocus
                  className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer"
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
