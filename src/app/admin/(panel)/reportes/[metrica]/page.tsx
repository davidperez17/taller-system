import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Info } from "lucide-react";
import { formatMoney } from "@/lib/status";
import { isReportMetric, loadMetricDetail, resolveRange } from "@/lib/reports";
import ReportRangeFilter from "@/components/admin/ReportRangeFilter";
import { PageTitle, card } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detalle del reporte" };

// Historial detrás de cada tarjeta de Reportes: de dónde sale el número. Los
// totales los calcula lib/reports.ts con los mismos SUM que la tarjeta, así el
// detalle nunca contradice al resumen que lo abrió.
export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ metrica: string }>;
  searchParams: Promise<{ r?: string; desde?: string; hasta?: string }>;
}) {
  const { metrica } = await params;
  if (!isReportMetric(metrica)) notFound();

  const range = resolveRange(await searchParams);
  const detail = await loadMetricDetail(metrica, range);
  const basePath = `/admin/reportes/${metrica}`;

  return (
    <div className="space-y-5">
      <PageTitle
        title={detail.label.toUpperCase()}
        subtitle={detail.description}
        action={
          <Link href={`/admin/reportes?${range.query}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 text-sm font-semibold transition-colors">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Reportes
          </Link>
        }
      />

      <ReportRangeFilter basePath={basePath} range={range} />

      {/* Total del período + desglose de cabecera */}
      <section className={`${card} p-5`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Total del período
        </p>
        <p
          className={`text-3xl font-bold tabular-nums font-heading tracking-wide mt-1 ${
            detail.total >= 0 ? "text-slate-900" : "text-red-600"
          }`}
        >
          {formatMoney(detail.total)}
        </p>
        <p className="text-xs text-slate-400 mt-1">{detail.countLabel}</p>
        {detail.summary.length > 0 && (
          <dl className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-3 *:min-w-0">
            {detail.summary.map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-slate-400">{s.label}</dt>
                <dd className="text-sm font-semibold text-slate-700 tabular-nums truncate">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {/* Historial */}
      <section className={`${card} overflow-hidden`}>
        {detail.rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">{detail.emptyText}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {detail.rows.map((row) => {
              const inner = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{row.title}</p>
                    {row.subtitle && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{row.subtitle}</p>
                    )}
                    {row.extra && (
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{row.extra}</p>
                    )}
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums shrink-0 ${
                      row.amount < 0 ? "text-red-600" : "text-slate-800"
                    }`}
                  >
                    {row.amount < 0 ? "−" : ""}
                    {formatMoney(Math.abs(row.amount))}
                  </span>
                  {row.href && (
                    <ChevronRight
                      className="w-4 h-4 text-slate-300 group-hover:text-sm-red shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </>
              );
              const cls = "flex items-center gap-3 px-4 lg:px-5 py-3.5";
              return (
                <li key={row.key}>
                  {row.href ? (
                    <Link href={row.href} className={`${cls} hover:bg-slate-50 transition-colors group`}>
                      {inner}
                    </Link>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {detail.truncated > 0 && (
          <p className="px-4 lg:px-5 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
            Se listan las {detail.rows.length} más recientes; faltan {detail.truncated} del
            período. El total de arriba sí las incluye todas — acota el período para verlas.
          </p>
        )}
      </section>

      {detail.note && (
        <p className="flex items-start gap-2 text-xs text-slate-400">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          {detail.note}
        </p>
      )}
    </div>
  );
}
