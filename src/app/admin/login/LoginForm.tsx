"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { loginAction } from "../actions";
import InstallButton from "@/components/InstallButton";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-dvh bg-sm-graphite flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center text-white mb-8">
          <img
            src="/logo/logo-mts96.png"
            alt="Multiservicios San Miguel 96"
            width={1458}
            height={381}
            className="h-14 w-auto mx-auto select-none"
            draggable={false}
          />
          <p className="text-white/60 text-sm mt-3">Panel del taller</p>
        </div>

        <form
          action={formAction}
          className="bg-white rounded-2xl shadow-xl p-6 space-y-4 animate-slide-up"
        >
          <input type="hidden" name="next" value={searchParams.get("next") ?? "/admin"} />
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-sm-ink">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              required
              className="mt-1 w-full border border-sm-border rounded-xl px-3.5 py-2.5 text-sm-ink focus:outline-none focus:ring-2 focus:ring-sm-red focus:border-sm-red"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-sm-ink">
              Contraseña
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="w-full border border-sm-border rounded-xl px-3.5 py-2.5 pr-11 text-sm-ink focus:outline-none focus:ring-2 focus:ring-sm-red focus:border-sm-red"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm-faint hover:text-sm-muted cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {state?.error && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-sm-red hover:bg-sm-red-hover active:bg-sm-red-active disabled:opacity-60 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {pending ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="w-5 h-5" aria-hidden="true" />
            )}
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="mt-4">
          <InstallButton
            tone="onDark"
            appName="SM96 Admin"
            label="Instalar app del panel"
          />
        </div>
      </div>
    </div>
  );
}
