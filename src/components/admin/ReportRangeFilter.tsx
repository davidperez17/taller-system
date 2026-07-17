import Link from "next/link";
import type { ResolvedRange } from "@/lib/reports";
import { card } from "@/components/admin/ui";

// Filtro de período de reportes. Compartido entre /admin/reportes y el detalle
// de cada métrica: `basePath` decide a dónde apuntan los presets, así el
// período se conserva al cambiarlo dentro de un detalle en vez de devolverte al
// resumen.
export default function ReportRangeFilter({
  basePath,
  range,
}: {
  basePath: string;
  range: ResolvedRange;
}) {
  const { presets, presetKey, custom, desde, hasta, today } = range;

  const chip = (active: boolean) =>
    `inline-flex items-center rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
      active
        ? "bg-sm-red text-white"
        : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"
    }`;

  const fmtDay = (s: string) =>
    new Date(`${s}T12:00:00Z`).toLocaleDateString("es-GT", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

  return (
    <section className={`${card} p-4`}>
      <div className="flex flex-wrap gap-2">
        {Object.entries(presets).map(([k, p]) => (
          <Link key={k} href={`${basePath}?r=${k}`} className={chip(presetKey === k)}>
            {p.label}
          </Link>
        ))}
        {custom && <span className={chip(true)}>Personalizado</span>}
      </div>
      <form method="GET" action={basePath} className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="desde" className="block text-xs font-medium text-slate-500 mb-1">
            Desde
          </label>
          <input
            id="desde"
            name="desde"
            type="date"
            defaultValue={desde}
            max={today}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="hasta" className="block text-xs font-medium text-slate-500 mb-1">
            Hasta
          </label>
          <input
            id="hasta"
            name="hasta"
            type="date"
            defaultValue={hasta}
            max={today}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl px-4 py-2 text-sm font-semibold transition-colors cursor-pointer"
        >
          Aplicar
        </button>
        <p className="text-xs text-slate-400 ml-auto">
          Mostrando: <b>{fmtDay(desde)}</b> — <b>{fmtDay(hasta)}</b>
        </p>
      </form>
    </section>
  );
}
