import { redirect } from "next/navigation";
import { UserPlus, ShieldCheck, ShieldOff } from "lucide-react";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { createUserAction, toggleUserAction, resetPasswordAction } from "@/app/admin/actions";
import { ROLES, formatDate } from "@/lib/status";
import { PageTitle, card, btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipo" };

export default async function UsersPage() {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") redirect("/admin");

  const users = getDb()
    .prepare("SELECT id, name, username, role, active, created_at FROM users ORDER BY name")
    .all() as {
    id: number; name: string; username: string; role: string; active: number; created_at: string;
  }[];

  return (
    <div className="space-y-5">
      <PageTitle title="EQUIPO" subtitle="Usuarios con acceso al panel del taller" />

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <section className={`${card} overflow-hidden lg:col-span-2`}>
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="px-4 lg:px-5 py-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${
                      u.active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      {u.name}
                      {u.id === me.id && (
                        <span className="ml-2 text-[11px] font-semibold bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">
                          Tú
                        </span>
                      )}
                      {!u.active && (
                        <span className="ml-2 text-[11px] font-semibold bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                          Desactivado
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      @{u.username} · {ROLES[u.role]} · desde {formatDate(u.created_at)}
                    </p>
                  </div>
                  {u.id !== me.id && (
                    <form action={toggleUserAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <button
                        type="submit"
                        className={btnSecondary}
                        aria-label={u.active ? `Desactivar a ${u.name}` : `Activar a ${u.name}`}
                      >
                        {u.active ? (
                          <>
                            <ShieldOff className="w-4 h-4" aria-hidden="true" /> Desactivar
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Activar
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
                {u.id !== me.id && (
                  <details className="mt-2 ml-12">
                    <summary className="text-xs font-medium text-blue-600 cursor-pointer">
                      Restablecer contraseña
                    </summary>
                    <form action={resetPasswordAction} className="mt-2 flex gap-2 max-w-sm">
                      <input type="hidden" name="id" value={u.id} />
                      <label htmlFor={`pw-${u.id}`} className="sr-only">
                        Nueva contraseña para {u.name}
                      </label>
                      <input
                        id={`pw-${u.id}`}
                        name="password"
                        type="password"
                        minLength={6}
                        required
                        placeholder="Nueva contraseña (mín. 6)"
                        className={inputCls}
                      />
                      <button type="submit" className={btnPrimary}>
                        Cambiar
                      </button>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className={`${card} p-5`}>
          <h2 className="font-heading font-semibold text-slate-800 tracking-wide flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-600" aria-hidden="true" /> NUEVO USUARIO
          </h2>
          <form action={createUserAction} className="mt-3 space-y-3">
            <div>
              <label htmlFor="u-name" className={labelCls}>
                Nombre *
              </label>
              <input id="u-name" name="name" required className={inputCls} />
            </div>
            <div>
              <label htmlFor="u-username" className={labelCls}>
                Usuario *
              </label>
              <input
                id="u-username"
                name="username"
                required
                autoCapitalize="none"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="u-password" className={labelCls}>
                Contraseña * (mín. 6)
              </label>
              <input
                id="u-password"
                name="password"
                type="password"
                minLength={6}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="u-role" className={labelCls}>
                Rol
              </label>
              <select id="u-role" name="role" className={inputCls}>
                {Object.entries(ROLES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={`${btnPrimary} w-full`}>
              Crear usuario
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
