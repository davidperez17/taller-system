import { redirect } from "next/navigation";
import { ShieldAlert, Plus, Info } from "lucide-react";
import { many } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { CLAIM_TYPES, CLAIM_RESPONSIBLE, formatMoney } from "@/lib/status";
import { createClaimAction } from "@/app/admin/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import PhotoInput from "@/components/admin/PhotoInput";
import ClaimList, { type ClaimListItem } from "@/components/admin/ClaimList";
import { PageTitle, card, btnPrimary, inputCls, labelCls } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reclamos" };

// Día actual en Guatemala (UTC-6): filtro de mes y default del form.
function todayGT(): string {
  return new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
}

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  // Admin y asesor gestionan reclamos; el mecánico no ve nada. Los montos y la
  // gestión (valorar/resolver/borrar) son solo del admin.
  const me = await getSessionUser();
  if (!me || me.role === "mecanico") redirect("/admin");
  const isAdmin = me.role === "admin";

  const { mes } = await searchParams;
  const today = todayGT();
  const month = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : today.slice(0, 7);

  const claims = await many<ClaimListItem>(
    `SELECT c.id, c.claimed_on, c.type, c.status, c.responsible, c.amount, c.description,
            c.resolution, c.order_id, c.photo_urls, o.folio, v.plate, u.name AS author
       FROM claims c
       LEFT JOIN orders o ON o.id = c.order_id
       LEFT JOIN vehicles v ON v.id = o.vehicle_id
       LEFT JOIN users u ON u.id = c.created_by
      WHERE substr(c.claimed_on, 1, 7) = ?
      ORDER BY c.claimed_on DESC, c.id DESC`,
    [month]
  );

  const total = claims.reduce((s, c) => s + c.amount, 0);
  const openCount = claims.filter((c) => c.status === "abierto" || c.status === "en_proceso").length;

  const byResp = new Map<string, number>();
  for (const c of claims) if (c.amount > 0) byResp.set(c.responsible, (byResp.get(c.responsible) ?? 0) + c.amount);
  const resps = [...byResp.entries()].sort((a, b) => b[1] - a[1]);

  // Órdenes recientes para ligar el reclamo a un carro (opcional).
  const orders = await many<{ id: number; folio: string; plate: string }>(
    `SELECT o.id, o.folio, v.plate FROM orders o
       JOIN vehicles v ON v.id = o.vehicle_id
      WHERE o.status <> 'cancelado'
      ORDER BY o.created_at DESC, o.id DESC LIMIT 150`
  );

  const monthLabel = new Date(`${month}-15T12:00:00Z`).toLocaleDateString("es-GT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-5">
      <PageTitle
        title="RECLAMOS"
        subtitle="Repuestos malos, trabajos rehechos y quejas: pérdidas por carro y su control"
      />

      {/* Filtro de mes + resumen */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <form method="GET" className="flex items-end gap-2">
          <div>
            <label htmlFor="mes" className={labelCls}>
              Mes
            </label>
            <input id="mes" name="mes" type="month" defaultValue={month} className={inputCls} />
          </div>
          <button type="submit" className={`${btnPrimary} py-2.5`}>
            Ver
          </button>
        </form>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900 tabular-nums font-heading tracking-wide">
            {isAdmin ? formatMoney(total) : claims.length}
          </p>
          <p className="text-xs text-slate-500">
            {claims.length} reclamo{claims.length === 1 ? "" : "s"} en {monthLabel}
            {openCount > 0 ? ` · ${openCount} sin cerrar` : ""}
          </p>
        </div>
      </div>

      {isAdmin && resps.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {resps.map(([resp, amt]) => (
            <span
              key={resp}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-600"
            >
              {CLAIM_RESPONSIBLE[resp] ?? resp}
              <b className="tabular-nums text-slate-900">{formatMoney(amt)}</b>
            </span>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5 items-start *:min-w-0">
        {/* Lista del mes */}
        <section className={`${card} p-4 lg:p-5 lg:col-span-2`}>
          {claims.length === 0 ? (
            <p className="text-sm text-slate-400">
              Sin reclamos en este mes. Registra un repuesto que llegó mal, un trabajo que hubo que
              rehacer o una queja del cliente para llevar el control por carro.
            </p>
          ) : (
            <ClaimList claims={claims} isAdmin={isAdmin} showOrder />
          )}
        </section>

        {/* Nuevo reclamo */}
        <section className={`${card} p-5`}>
          <h2 className="font-heading font-semibold text-slate-800 tracking-wide flex items-center gap-2">
            <Plus className="w-4 h-4 text-sm-red" aria-hidden="true" /> NUEVO RECLAMO
          </h2>
          <form action={createClaimAction} className="mt-3 space-y-3">
            <div>
              <label htmlFor="claimed_on" className={labelCls}>
                Fecha *
              </label>
              <input
                id="claimed_on"
                name="claimed_on"
                type="date"
                required
                defaultValue={today}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="type" className={labelCls}>
                  Tipo
                </label>
                <select id="type" name="type" className={inputCls}>
                  {Object.entries(CLAIM_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="responsible" className={labelCls}>
                  Responsable
                </label>
                <select id="responsible" name="responsible" className={inputCls}>
                  {Object.entries(CLAIM_RESPONSIBLE).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="order_id" className={labelCls}>
                Carro / orden (opcional)
              </label>
              <select id="order_id" name="order_id" defaultValue="" className={inputCls}>
                <option value="">— Sin orden —</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.folio} · {o.plate}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="description" className={labelCls}>
                Descripción *
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                required
                placeholder="Ej. El kit de clutch llegó con la prensa dañada; se reportó al proveedor."
                className={inputCls}
              />
            </div>
            {isAdmin && (
              <div>
                <label htmlFor="amount" className={labelCls}>
                  Pérdida (Q)
                </label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                  inputMode="decimal"
                  className={inputCls}
                />
              </div>
            )}
            <PhotoInput />
            <SubmitButton className={`${btnPrimary} w-full`} pendingText="Registrando…">
              <ShieldAlert className="w-4 h-4" aria-hidden="true" /> Registrar reclamo
            </SubmitButton>
          </form>
          <p className="mt-3 text-xs text-slate-400 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            {isAdmin
              ? "La pérdida es solo lo NUEVO que cuesta el reclamo (la pieza de reposición, el reembolso o el retrabajo). El costo del repuesto original ya se descuenta en su orden: no lo pongas otra vez aquí o contaría doble."
              : "Registra el reclamo con lo que pasó y una foto. La pérdida en Q la valora el administrador después."}
          </p>
        </section>
      </div>
    </div>
  );
}
