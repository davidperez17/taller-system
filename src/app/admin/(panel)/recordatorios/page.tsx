import { BellPlus, BellRing, Check, RotateCcw, Trash2, Phone, MessageCircle } from "lucide-react";
import { waLink, WA_TEMPLATES } from "@/lib/whatsapp";
import { many } from "@/lib/db";
import {
  createReminderAction,
  toggleReminderAction,
  deleteReminderAction,
} from "@/app/admin/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { formatDay, daysUntil } from "@/lib/status";
import {
  PageTitle,
  card,
  btnPrimary,
  inputCls,
  labelCls,
  PlateBadge,
} from "@/components/admin/ui";
import ConfirmSubmitButton from "@/components/admin/ConfirmSubmitButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recordatorios" };

type Reminder = {
  id: number;
  due_date: string;
  reason: string;
  notes: string | null;
  done: number;
  plate: string;
  brand: string | null;
  model: string | null;
  client: string;
  phone: string | null;
};

export default async function RemindersPage() {
  const reminders = await many<Reminder>(
    `SELECT r.id, r.due_date, r.reason, r.notes, r.done,
            v.plate, v.brand, v.model, c.name AS client, c.phone
     FROM service_reminders r
     JOIN vehicles v ON v.id = r.vehicle_id
     JOIN clients c ON c.id = v.client_id
     ORDER BY r.done ASC, r.due_date ASC
     LIMIT 500`
  );

  const vehicles = await many<{ id: number; plate: string; client: string }>(
    `SELECT v.id, v.plate, c.name AS client
     FROM vehicles v JOIN clients c ON c.id = v.client_id
     ORDER BY v.created_at DESC LIMIT 500`
  );

  const pending = reminders.filter((r) => !r.done);
  const overdue = pending.filter((r) => daysUntil(r.due_date) < 0);
  const soon = pending.filter((r) => {
    const d = daysUntil(r.due_date);
    return d >= 0 && d <= 14;
  });
  const later = pending.filter((r) => daysUntil(r.due_date) > 14);
  const done = reminders.filter((r) => r.done);

  const todayIso = new Date().toISOString().slice(0, 10);

  function Row({ r }: { r: Reminder }) {
    const d = daysUntil(r.due_date);
    const tone =
      r.done
        ? "text-slate-400"
        : d < 0
          ? "text-red-600"
          : d <= 14
            ? "text-amber-600"
            : "text-slate-500";
    const when = r.done
      ? "Hecho"
      : d < 0
        ? `Vencido hace ${Math.abs(d)} día${Math.abs(d) === 1 ? "" : "s"}`
        : d === 0
          ? "Hoy"
          : `En ${d} día${d === 1 ? "" : "s"}`;
    return (
      <li className="flex items-center gap-3 px-4 lg:px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <PlateBadge plate={r.plate} />
            <span className={`text-sm ${r.done ? "line-through text-slate-400" : "text-slate-700"}`}>
              {r.reason}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {r.client}
            {[r.brand, r.model].filter(Boolean).length > 0 &&
              ` · ${[r.brand, r.model].filter(Boolean).join(" ")}`}
            {" · "}
            {formatDay(r.due_date)} · <span className={tone}>{when}</span>
            {r.notes && ` · ${r.notes}`}
          </p>
        </div>
        {r.phone && !r.done && (
          <>
            {waLink(
              r.phone,
              WA_TEMPLATES.recordatorio({
                nombre: r.client.split(" ")[0],
                placa: r.plate,
                motivo: r.reason,
              })
            ) && (
              <a
                href={
                  waLink(
                    r.phone,
                    WA_TEMPLATES.recordatorio({
                      nombre: r.client.split(" ")[0],
                      placa: r.plate,
                      motivo: r.reason,
                    })
                  )!
                }
                target="_blank"
                rel="noopener"
                className="p-2 rounded-lg text-slate-400 hover:bg-accent-50 hover:text-accent-600 transition-colors shrink-0"
                aria-label={`WhatsApp a ${r.client}`}
                title="Enviar WhatsApp"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
              </a>
            )}
            <a
              href={`tel:${r.phone}`}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-sm-red transition-colors shrink-0"
              aria-label={`Llamar a ${r.client}`}
              title={r.phone}
            >
              <Phone className="w-4 h-4" aria-hidden="true" />
            </a>
          </>
        )}
        <form action={toggleReminderAction}>
          <input type="hidden" name="id" value={r.id} />
          <SubmitButton
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-accent-600 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
            ariaLabel={r.done ? "Marcar como pendiente" : "Marcar como hecho"}
            title={r.done ? "Reabrir" : "Marcar hecho"}
          >
            {r.done ? <RotateCcw className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          </SubmitButton>
        </form>
        <form action={deleteReminderAction}>
          <input type="hidden" name="id" value={r.id} />
          <ConfirmSubmitButton
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-colors cursor-pointer shrink-0"
            ariaLabel="Eliminar recordatorio"
            confirmTitle="¿Eliminar recordatorio?"
            confirmMessage="Se elimina este recordatorio. No se puede deshacer."
          >
            <Trash2 className="w-4 h-4" />
          </ConfirmSubmitButton>
        </form>
      </li>
    );
  }

  const groups: { title: string; items: Reminder[]; accent: string }[] = [
    { title: "VENCIDOS", items: overdue, accent: "text-red-600" },
    { title: "PRÓXIMOS 14 DÍAS", items: soon, accent: "text-amber-600" },
    { title: "MÁS ADELANTE", items: later, accent: "text-slate-500" },
  ];

  return (
    <div className="space-y-5">
      <PageTitle
        title="RECORDATORIOS"
        subtitle="Avisos de próximo servicio para tus clientes"
      />

      <div className="grid grid-cols-3 gap-3">
        <div className={`${card} p-4`}>
          <p className="text-2xl font-bold text-red-600 tabular-nums font-heading">{overdue.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Vencidos</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-2xl font-bold text-amber-600 tabular-nums font-heading">{soon.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Próximos 14 días</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-2xl font-bold text-slate-800 tabular-nums font-heading">{pending.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Pendientes en total</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start *:min-w-0">
        <div className="lg:col-span-2 min-w-0 space-y-5">
          {pending.length === 0 && (
            <section className={`${card} p-8 text-center`}>
              <BellRing className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="mt-2 text-sm text-slate-400">
                Sin recordatorios pendientes. Agrega uno con el formulario.
              </p>
            </section>
          )}

          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.title} className={`${card} overflow-hidden`}>
                <div className="px-5 pt-4 pb-2">
                  <h2 className={`font-heading font-semibold tracking-wide ${g.accent}`}>
                    {g.title}
                    <span className="text-slate-400 font-sans font-normal text-sm ml-2">
                      {g.items.length}
                    </span>
                  </h2>
                </div>
                <ul className="divide-y divide-slate-100">
                  {g.items.map((r) => (
                    <Row key={r.id} r={r} />
                  ))}
                </ul>
              </section>
            ))}

          {done.length > 0 && (
            <details className={`${card} overflow-hidden`}>
              <summary className="px-5 py-4 cursor-pointer font-heading font-semibold tracking-wide text-slate-500">
                COMPLETADOS
                <span className="text-slate-400 font-sans font-normal text-sm ml-2">
                  {done.length}
                </span>
              </summary>
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {done.map((r) => (
                  <Row key={r.id} r={r} />
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* Nuevo recordatorio */}
        <section className={`${card} p-5 min-w-0`}>
          <h2 className="font-heading font-semibold text-slate-800 tracking-wide flex items-center gap-2">
            <BellPlus className="w-4 h-4 text-sm-red" aria-hidden="true" /> NUEVO RECORDATORIO
          </h2>
          {vehicles.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              Registra un vehículo primero para programar recordatorios.
            </p>
          ) : (
            <form action={createReminderAction} className="mt-3 space-y-3">
              <div>
                <label htmlFor="r-vehicle" className={labelCls}>
                  Vehículo *
                </label>
                <select id="r-vehicle" name="vehicle_id" required className={inputCls}>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} — {v.client}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="r-reason" className={labelCls}>
                  Motivo
                </label>
                <input
                  id="r-reason"
                  name="reason"
                  defaultValue="Servicio programado"
                  placeholder="Ej. Cambio de aceite"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="r-date" className={labelCls}>
                  Fecha del recordatorio *
                </label>
                <input
                  id="r-date"
                  name="due_date"
                  type="date"
                  required
                  defaultValue={todayIso}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="r-notes" className={labelCls}>
                  Nota (opcional)
                </label>
                <input id="r-notes" name="notes" className={inputCls} />
              </div>
              <SubmitButton className={`${btnPrimary} w-full`} pendingText="Programando…">
                Programar recordatorio
              </SubmitButton>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
