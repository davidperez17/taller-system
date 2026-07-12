import Link from "next/link";
import { Search, ChevronRight, UserPlus, Phone } from "lucide-react";
import { many } from "@/lib/db";
import { createClientAction } from "@/app/admin/actions";
import { PageTitle, card, btnPrimary, inputCls, labelCls } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clientes" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const like = `%${q.trim()}%`;
  const clients = await many<{ id: number; name: string; phone: string | null; vehicles: number }>(
    `SELECT c.id, c.name, c.phone, COUNT(v.id)::int AS vehicles
       FROM clients c LEFT JOIN vehicles v ON v.client_id = c.id
       WHERE c.name LIKE ? OR c.phone LIKE ?
       GROUP BY c.id ORDER BY c.name LIMIT 300`,
    [like, like]
  );

  return (
    <div className="space-y-5">
      <PageTitle title="CLIENTES" subtitle={`${clients.length} registrados`} />

      <div className="grid lg:grid-cols-3 gap-5 items-start *:min-w-0">
        <div className="lg:col-span-2 space-y-4">
          <form className="flex gap-2" action="/admin/clientes" method="GET">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nombre o teléfono…"
                aria-label="Buscar clientes"
                className={`${inputCls} pl-10`}
              />
            </div>
            <button type="submit" className={btnPrimary}>
              Buscar
            </button>
          </form>

          <section className={`${card} overflow-hidden`}>
            {clients.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">Sin resultados.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {clients.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/admin/clientes/${c.id}`}
                      className="flex items-center gap-3 px-4 lg:px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-full bg-sm-bg text-sm-red flex items-center justify-center font-semibold text-sm shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          {c.phone && (
                            <>
                              <Phone className="w-3 h-3" aria-hidden="true" /> {c.phone} ·
                            </>
                          )}
                          {c.vehicles} vehículo{c.vehicles === 1 ? "" : "s"}
                        </p>
                      </div>
                      <ChevronRight
                        className="w-4 h-4 text-slate-300 group-hover:text-sm-red shrink-0"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className={`${card} p-5`}>
          <h2 className="font-heading font-semibold text-slate-800 tracking-wide flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-sm-red" aria-hidden="true" /> NUEVO CLIENTE
          </h2>
          <form action={createClientAction} className="mt-3 space-y-3">
            <div>
              <label htmlFor="c-name" className={labelCls}>
                Nombre *
              </label>
              <input id="c-name" name="name" required className={inputCls} />
            </div>
            <div>
              <label htmlFor="c-phone" className={labelCls}>
                Teléfono
              </label>
              <input id="c-phone" name="phone" type="tel" inputMode="tel" className={inputCls} />
            </div>
            <div>
              <label htmlFor="c-email" className={labelCls}>
                Correo
              </label>
              <input id="c-email" name="email" type="email" className={inputCls} />
            </div>
            <div>
              <label htmlFor="c-address" className={labelCls}>
                Dirección
              </label>
              <input id="c-address" name="address" className={inputCls} />
            </div>
            <button type="submit" className={`${btnPrimary} w-full`}>
              Guardar cliente
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
