import type { CsatRating } from "@/lib/status";

// Rasgos de la carita del semáforo de satisfacción, SIN el disco: el disco es un
// rounded-full con bg-csat-*, y estos trazos van en currentColor encima. Se dibuja
// a mano y no con lucide (Smile/Meh/Frown/Laugh/Angry) por dos razones: esos
// iconos dibujan su propio círculo de cabeza —sobre el disco quedaría un doble
// aro— y al ser fill="none" con un solo currentColor no permiten disco de un
// color y rasgos de otro, que es justo lo que exige el amarillo (rasgos en
// grafito para llegar a 9.34:1). Las bocas van graduadas: sonrisa abierta (4) →
// sonrisa (3) → recta (2) → ceño con cejas caídas (1).
export default function CsatFace({
  level,
  className = "w-8 h-8",
}: {
  level: CsatRating;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Los ojos son idénticos en los cuatro niveles: la única variable es la
          boca, igual que en la referencia. Nada de cejas —a este tamaño se
          empastan con los ojos y la cara triste parece enojada o tachada. */}
      <circle cx="9" cy="10" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1.15" fill="currentColor" stroke="none" />
      {level === 4 && <path d="M6.8 13.6c1.4 2.6 3.1 3.9 5.2 3.9s3.8-1.3 5.2-3.9" />}
      {level === 3 && <path d="M7.6 14.4c1.2 1.6 2.7 2.4 4.4 2.4s3.2-.8 4.4-2.4" />}
      {level === 2 && <path d="M8 15.8h8" />}
      {level === 1 && <path d="M7.8 17.2c1.2-1.7 2.6-2.6 4.2-2.6s3 .9 4.2 2.6" />}
    </svg>
  );
}

// Clases estáticas por nivel del semáforo. Nunca se interpolan (`bg-csat-${x}`
// no lo vería el JIT de Tailwind), mismo criterio que ACTIVITY_TONE_CLASS en
// lib/activity-meta.ts. `disc` es el disco de color, `face` el color de los
// rasgos encima —blanco salvo en el amarillo, que va en grafito— e `ink` el tono
// legible sobre blanco para estrellas, barras y bordes.
export const CSAT_TONE: Record<CsatRating, { disc: string; face: string; ink: string }> = {
  4: { disc: "bg-csat-exc", face: "text-white", ink: "text-csat-exc" },
  3: { disc: "bg-csat-bien", face: "text-white", ink: "text-csat-bien" },
  2: { disc: "bg-csat-reg ring-1 ring-csat-reg-ink/50", face: "text-sm-graphite", ink: "text-csat-reg-ink" },
  1: { disc: "bg-csat-mal", face: "text-white", ink: "text-csat-mal" },
};

// Relleno de las barras de distribución (panel), mismo criterio de clases fijas.
export const CSAT_BAR: Record<CsatRating, string> = {
  4: "bg-csat-exc",
  3: "bg-csat-bien",
  2: "bg-csat-reg",
  1: "bg-csat-mal",
};
