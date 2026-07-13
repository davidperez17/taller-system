"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

// Botón de envío que se deshabilita mientras el server action del <form> está en
// vuelo, para evitar envíos duplicados por taps rápidos (regla loading-buttons).
// useFormStatus lee el estado del formulario contenedor, así que este componente
// DEBE renderizarse dentro del <form> cuyo action queremos vigilar.
//
// - Con `pendingText`: muestra spinner + texto (botones con etiqueta).
// - Sin `pendingText`: muestra solo el spinner (botones de ícono, p. ej. toggles).
export default function SubmitButton({
  children,
  className,
  pendingText,
  ariaLabel,
  title,
}: {
  children: React.ReactNode;
  className: string;
  pendingText?: string;
  ariaLabel?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-label={ariaLabel}
      title={title}
      className={className}
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
