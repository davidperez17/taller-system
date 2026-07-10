"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { changeOwnPasswordAction } from "@/app/admin/actions";
import { btnPrimary, inputCls, labelCls } from "@/components/admin/ui";

export default function PasswordForm() {
  const [state, formAction, pending] = useActionState(changeOwnPasswordAction, null);

  return (
    <form action={formAction} className="mt-3 space-y-3 max-w-sm">
      <div>
        <label htmlFor="pw-current" className={labelCls}>
          Contraseña actual *
        </label>
        <input
          id="pw-current"
          name="current"
          type="password"
          required
          autoComplete="current-password"
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="pw-new" className={labelCls}>
          Contraseña nueva * (mín. 8)
        </label>
        <input
          id="pw-new"
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          className={inputCls}
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-accent-600">Contraseña actualizada.</p>}
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        <KeyRound className="w-4 h-4" aria-hidden="true" />
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
