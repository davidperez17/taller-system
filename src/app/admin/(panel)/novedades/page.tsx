import { redirect } from "next/navigation";
import { Megaphone, Eye, EyeOff, Trash2, Pencil } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { many } from "@/lib/db";
import { formatDay } from "@/lib/status";
import { ANNOUNCEMENT_TONES, type Announcement, type AnnouncementTone } from "@/lib/announcements";
import {
  createAnnouncementAction, updateAnnouncementAction,
  toggleAnnouncementAction, deleteAnnouncementAction,
} from "@/app/admin/actions";
import {
  PageTitle, card, btnPrimary, btnSecondary, inputCls, labelCls,
} from "@/components/admin/ui";
import ConfirmSubmitButton from "@/components/admin/ConfirmSubmitButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novedades" };

const TONE_CLASS: Record<AnnouncementTone, string> = {
  info: "bg-primary-100 text-primary-700",
  promo: "bg-accent-100 text-accent-700",
  aviso: "bg-amber-100 text-amber-800",
};

function ToneField({ defaultValue = "info" }: { defaultValue?: string }) {
  return (
    <select name="tone" defaultValue={defaultValue} className={inputCls}>
      {(Object.entries(ANNOUNCEMENT_TONES) as [AnnouncementTone, string][]).map(([k, label]) => (
        <option key={k} value={k}>
          {label}
        </option>
      ))}
    </select>
  );
}

export default async function AnnouncementsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (user.role === "mecanico") redirect("/admin");

  const items = await many<Announcement>(
    `SELECT id, title, body, tone, active, starts_on, ends_on, created_at
       FROM announcements ORDER BY active DESC, created_at DESC, id DESC`
  );
  const activeCount = items.filter((a) => a.active).length;

  return (
    <div className="space-y-5">
      <PageTitle
        title="NOVEDADES PARA CLIENTES"
        subtitle="Avisos que ven todos los clientes en su app de seguimiento"
      />

      {/* Crear */}
      <section className={`${card} p-5`}>
        <h2 className="font-heading font-semibold text-slate-800 tracking-wide flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary-600" aria-hidden="true" /> NUEVA NOVEDAD
        </h2>
        <form action={createAnnouncementAction} className="mt-3 space-y-3">
          <div>
            <label htmlFor="title" className={labelCls}>
              Título *
            </label>
            <input
              id="title"
              name="title"
              required
              maxLength={120}
              placeholder="Ej. Ahora ves fotos de tu reparación en vivo"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="body" className={labelCls}>
              Mensaje *
            </label>
            <textarea
              id="body"
              name="body"
              required
              rows={3}
              maxLength={2000}
              placeholder="Cuéntale a tus clientes la novedad, promoción o aviso."
              className={inputCls}
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="tone" className={labelCls}>
                Tipo
              </label>
              <ToneField />
            </div>
            <div>
              <label htmlFor="starts_on" className={labelCls}>
                Desde (opcional)
              </label>
              <input id="starts_on" name="starts_on" type="date" className={inputCls} />
            </div>
            <div>
              <label htmlFor="ends_on" className={labelCls}>
                Hasta (opcional)
              </label>
              <input id="ends_on" name="ends_on" type="date" className={inputCls} />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Sin fechas, la novedad se muestra hasta que la ocultes. Con fechas, solo dentro del rango.
          </p>
          <button type="submit" className={btnPrimary}>
            Publicar novedad
          </button>
        </form>
      </section>

      {/* Lista */}
      <section className="space-y-3">
        <h2 className="font-heading font-semibold text-slate-800 tracking-wide px-1">
          PUBLICADAS <span className="text-sm font-normal text-slate-400">({activeCount} activas)</span>
        </h2>

        {items.length === 0 ? (
          <p className={`${card} p-8 text-center text-sm text-slate-400`}>
            Aún no hay novedades. Crea la primera arriba.
          </p>
        ) : (
          items.map((a) => (
            <article
              key={a.id}
              className={`${card} p-5 ${a.active ? "" : "opacity-70"}`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[a.tone]}`}>
                      {ANNOUNCEMENT_TONES[a.tone]}
                    </span>
                    {a.active ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-accent-700">
                        <Eye className="w-3 h-3" aria-hidden="true" /> Visible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        <EyeOff className="w-3 h-3" aria-hidden="true" /> Oculta
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-800 mt-2">{a.title}</h3>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                  {(a.starts_on || a.ends_on) && (
                    <p className="text-xs text-slate-400 mt-2">
                      Vigencia: {a.starts_on ? formatDay(a.starts_on) : "siempre"} →{" "}
                      {a.ends_on ? formatDay(a.ends_on) : "sin fin"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <form action={toggleAnnouncementAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button
                      type="submit"
                      className={btnSecondary}
                      aria-label={a.active ? "Ocultar novedad" : "Publicar novedad"}
                    >
                      {a.active ? (
                        <>
                          <EyeOff className="w-4 h-4" aria-hidden="true" /> Ocultar
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" aria-hidden="true" /> Publicar
                        </>
                      )}
                    </button>
                  </form>
                  <form action={deleteAnnouncementAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <ConfirmSubmitButton
                      ariaLabel={`Eliminar novedad ${a.title}`}
                      className="p-2.5 text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                      confirmTitle="¿Eliminar novedad?"
                      confirmMessage={`Se elimina "${a.title}" para los clientes. No se puede deshacer.`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>

              {/* Editar (disclosure nativo, sin JS) */}
              <details className="mt-3 group">
                <summary className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-500 cursor-pointer list-none">
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Editar
                </summary>
                <form action={updateAnnouncementAction} className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                  <input type="hidden" name="id" value={a.id} />
                  <div>
                    <label className={labelCls}>Título *</label>
                    <input name="title" required maxLength={120} defaultValue={a.title} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Mensaje *</label>
                    <textarea name="body" required rows={3} maxLength={2000} defaultValue={a.body} className={inputCls} />
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Tipo</label>
                      <ToneField defaultValue={a.tone} />
                    </div>
                    <div>
                      <label className={labelCls}>Desde</label>
                      <input name="starts_on" type="date" defaultValue={a.starts_on ?? ""} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Hasta</label>
                      <input name="ends_on" type="date" defaultValue={a.ends_on ?? ""} className={inputCls} />
                    </div>
                  </div>
                  <button type="submit" className={`${btnPrimary} w-full sm:w-auto`}>
                    Guardar cambios
                  </button>
                </form>
              </details>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
