import { redirect } from "next/navigation";
import Link from "next/link";
import { Smile, MessageSquareText, Star, ThumbsUp, AlertTriangle, X } from "lucide-react";
import { many, one } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { resolveRange } from "@/lib/reports";
import {
  CSAT_LEVELS,
  CSAT_ORDER,
  CSAT_REASONS,
  isCsatRating,
  type CsatRating,
} from "@/lib/status";
import { CSAT_BAR, CSAT_TONE } from "@/components/CsatFace";
import ReportRangeFilter from "@/components/admin/ReportRangeFilter";
import CsatList, { type CsatListItem } from "@/components/admin/CsatList";
import CsatBadge, { CsatStars } from "@/components/admin/CsatBadge";
import { PageTitle, card } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Satisfacción" };

export default async function SatisfaccionPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string; desde?: string; hasta?: string; nivel?: string }>;
}) {
  // Mismo gate que Reclamos (no el de Reportes): esto es voz del cliente
  // —comentarios, quejas, teléfonos para llamar—, no material financiero.
  const me = await getSessionUser();
  if (!me || me.role === "mecanico") redirect("/admin");

  const sp = await searchParams;
  const range = resolveRange(sp);
  const { desde, hasta } = range;
  const nivelNum = Number(sp.nivel);
  const nivel = isCsatRating(nivelNum) ? nivelNum : null;

  // KPIs del período (ancla: cuándo calificó el cliente). Todos los agregados
  // llevan cast: Neon devuelve numeric/bigint como string si no.
  const kpi = (await one<{ n: number; promedio: number; excelentes: number; bajas: number }>(
    `SELECT COUNT(*)::int AS n,
            COALESCE(AVG(rating), 0)::float8 AS promedio,
            COALESCE(SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END), 0)::int AS excelentes,
            COALESCE(SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END), 0)::int AS bajas
       FROM order_feedback
      WHERE substr(created_at, 1, 10) BETWEEN ? AND ?`,
    [desde, hasta]
  ))!;

  const dist = await many<{ rating: number; n: number }>(
    `SELECT rating, COUNT(*)::int AS n FROM order_feedback
      WHERE substr(created_at, 1, 10) BETWEEN ? AND ?
      GROUP BY rating`,
    [desde, hasta]
  );
  const byRating: Record<number, number> = Object.fromEntries(dist.map((d) => [d.rating, d.n]));

  // Tasa de respuesta anclada a las órdenes ENTREGADAS del período (no a las
  // calificaciones), para que numerador y denominador hablen del mismo universo.
  const resp = (await one<{ entregadas: number; calificadas: number }>(
    `SELECT COUNT(*)::int AS entregadas, COUNT(f.id)::int AS calificadas
       FROM orders o LEFT JOIN order_feedback f ON f.order_id = o.id
      WHERE o.status = 'entregado' AND substr(o.delivered_at, 1, 10) BETWEEN ? AND ?`,
    [desde, hasta]
  ))!;

  // Motivos: los slugs viven en un TEXT separado por comas; unnest los abre.
  const motivos = await many<{ reason: string; n: number }>(
    `SELECT m AS reason, COUNT(*)::int AS n
       FROM order_feedback f, unnest(string_to_array(f.reasons, ',')) AS m
      WHERE COALESCE(f.reasons, '') <> ''
        AND substr(f.created_at, 1, 10) BETWEEN ? AND ?
      GROUP BY m ORDER BY n DESC`,
    [desde, hasta]
  );

  const rows = await many<CsatListItem>(
    `SELECT f.id, f.rating, f.reasons, f.comment, f.created_at,
            o.id AS order_id, o.folio, v.plate, c.name AS client, c.phone
       FROM order_feedback f
       JOIN orders o ON o.id = f.order_id
       JOIN vehicles v ON v.id = o.vehicle_id
       JOIN clients c ON c.id = v.client_id
      WHERE substr(f.created_at, 1, 10) BETWEEN ? AND ?
        AND (?::int IS NULL OR f.rating = ?)
      ORDER BY f.created_at DESC, f.id DESC LIMIT 200`,
    [desde, hasta, nivel, nivel]
  );

  const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  // Math.max(1, …) blinda el caso sin respuestas (promedio 0 no es un nivel).
  const promedioRedondo = Math.max(1, Math.round(kpi.promedio)) as CsatRating;

  const kpis = [
    {
      label: "Promedio",
      value: kpi.n > 0 ? kpi.promedio.toFixed(1) : "—",
      hint: kpi.n > 0 ? `${CSAT_LEVELS[promedioRedondo].label} · de 4` : "Sin calificaciones aún",
      icon: Star,
      tone: "bg-amber-50 text-amber-600",
    },
    {
      label: "Respuestas",
      value: String(kpi.n),
      hint: `${resp.calificadas} de ${resp.entregadas} entregas · ${pct(
        resp.calificadas,
        resp.entregadas
      )}% respondió`,
      icon: MessageSquareText,
      tone: "bg-primary-50 text-primary-600",
    },
    {
      label: "Excelentes",
      value: `${pct(kpi.excelentes, kpi.n)}%`,
      hint: `${kpi.excelentes} de ${kpi.n} calificaciones`,
      icon: ThumbsUp,
      tone: "bg-accent-50 text-accent-700",
    },
    {
      label: "Regular o Malo",
      value: String(kpi.bajas),
      hint: kpi.bajas > 0 ? "clientes por llamar" : "nadie quedó disconforme",
      icon: AlertTriangle,
      tone: kpi.bajas > 0 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500",
    },
  ];

  return (
    <div className="space-y-5">
      <PageTitle
        title="SATISFACCIÓN"
        subtitle="Cómo califican los clientes el servicio que reciben"
      />

      <ReportRangeFilter basePath="/admin/satisfaccion" range={range} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 *:min-w-0">
        {kpis.map((k) => (
          <div key={k.label} className={`${card} p-4`}>
            <div className={`rounded-xl p-2 w-fit ${k.tone}`} aria-hidden="true">
              <k.icon className="w-5 h-5" />
            </div>
            <p className="text-xl lg:text-2xl font-bold text-slate-900 mt-2 tabular-nums font-heading tracking-wide">
              {k.value}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
            <p className="text-[11px] text-slate-500 mt-1">{k.hint}</p>
          </div>
        ))}
      </div>

      {/* Distribución: cada fila filtra el listado por ese nivel */}
      <section className={`${card} p-5`}>
        <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
          CÓMO NOS CALIFICAN
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Toca un nivel para ver solo esas respuestas
        </p>
        <ul className="mt-4 space-y-2">
          {CSAT_ORDER.map((lvl) => {
            const n = byRating[lvl] ?? 0;
            const p = pct(n, kpi.n);
            const activo = nivel === lvl;
            return (
              <li key={lvl}>
                <Link
                  href={`/admin/satisfaccion?${range.query}${activo ? "" : `&nivel=${lvl}`}`}
                  aria-current={activo ? "true" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-2 py-2 -mx-2 transition-colors ${
                    activo ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                >
                  <CsatBadge rating={lvl} size="sm" className="shrink-0 w-40" />
                  <span className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <span
                      className={`block h-full rounded-full ${CSAT_BAR[lvl]}`}
                      style={{ width: `${p}%` }}
                    />
                  </span>
                  <span className="shrink-0 text-sm text-slate-600 tabular-nums w-20 text-right">
                    {n} · {p}%
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {motivos.length > 0 && (
        <section className={`${card} p-5`}>
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
            QUÉ NOS SEÑALAN
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Lo que marcan quienes calificaron Regular o Malo
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {motivos.map((m) => (
              <span
                key={m.reason}
                className="inline-flex items-center gap-2 text-sm bg-slate-100 text-slate-700 rounded-full px-3 py-1.5"
              >
                {CSAT_REASONS[m.reason] ?? m.reason}
                <b className="tabular-nums">{m.n}</b>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className={`${card} p-5`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
            RESPUESTAS
          </h2>
          {nivel !== null && (
            <Link
              href={`/admin/satisfaccion?${range.query}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-1 transition-colors"
            >
              <span className={CSAT_TONE[nivel].ink}>
                <CsatStars n={CSAT_LEVELS[nivel].stars} size="sm" />
              </span>
              Solo {CSAT_LEVELS[nivel].label}
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
        <div className="mt-3">
          <CsatList items={rows} />
        </div>
      </section>

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <Smile className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
        El cliente califica desde su página de seguimiento cuando pasas la orden a «Entregado»:
        recibe la invitación en su teléfono y solo puede responder una vez, con su código de
        acceso. Si califica Regular o Malo les llega un aviso al administrador y al asesor.
      </p>
    </div>
  );
}
