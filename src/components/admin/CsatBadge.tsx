import { Star } from "lucide-react";
import { CSAT_LEVELS, type CsatRating } from "@/lib/status";
import CsatFace, { CSAT_TONE } from "@/components/CsatFace";

const SIZES = {
  sm: { disc: "w-9 h-9", face: "w-6 h-6", label: "text-sm", star: "w-3 h-3" },
  md: { disc: "w-11 h-11", face: "w-7 h-7", label: "text-base", star: "w-3.5 h-3.5" },
  lg: { disc: "w-14 h-14", face: "w-9 h-9", label: "text-xl", star: "w-4 h-4" },
} as const;

/** Estrellas de un nivel. Decorativas: la etiqueta ya dice el nivel en texto. */
export function CsatStars({ n, className = "", size = "md" }: { n: number; className?: string; size?: keyof typeof SIZES }) {
  return (
    <span className={`flex gap-0.5 ${className}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <Star key={i} className={`${SIZES[size].star} fill-current`} />
      ))}
    </span>
  );
}

// Carita + etiqueta + estrellas de una calificación, para el panel. El color no
// es el único portador del significado: la etiqueta va siempre en texto.
export default function CsatBadge({
  rating,
  size = "md",
  className = "",
}: {
  rating: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const r = (rating as CsatRating) in CSAT_LEVELS ? (rating as CsatRating) : 3;
  const meta = CSAT_LEVELS[r];
  const tone = CSAT_TONE[r];
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`grid place-items-center rounded-full shrink-0 ${s.disc} ${tone.disc} ${tone.face}`}
        aria-hidden="true"
      >
        <CsatFace level={r} className={s.face} />
      </span>
      <span className="min-w-0">
        <span
          className={`block font-heading font-bold tracking-wide leading-none text-slate-800 ${s.label}`}
        >
          {meta.label}
        </span>
        <CsatStars n={meta.stars} size={size} className={`mt-1 ${tone.ink}`} />
      </span>
    </span>
  );
}
