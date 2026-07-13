// Metadatos de presentación de la actividad interna. Archivo puro (sin imports
// de servidor) para que los componentes cliente lo importen sin arrastrar la
// capa de datos. El icono es una clave; el componente la mapea a un icono real.

export type ActivityType =
  | "orden_nueva"
  | "orden_editada"
  | "estado"
  | "cancelacion"
  | "pago"
  | "aprobacion"
  | "rechazo";

export type ActivityTone = "blue" | "green" | "amber" | "red" | "violet" | "slate";

export type ActivityItem = {
  id: number;
  type: string;
  title: string;
  detail: string | null;
  actor_name: string | null;
  url: string | null;
  created_at: string;
};

export const ACTIVITY_META: Record<
  ActivityType,
  { label: string; tone: ActivityTone; icon: string }
> = {
  orden_nueva: { label: "Nueva orden", tone: "blue", icon: "clipboard" },
  orden_editada: { label: "Orden modificada", tone: "amber", icon: "pencil" },
  estado: { label: "Cambio de estado", tone: "violet", icon: "wrench" },
  cancelacion: { label: "Cancelación", tone: "red", icon: "ban" },
  pago: { label: "Pago registrado", tone: "green", icon: "wallet" },
  aprobacion: { label: "Presupuesto aprobado", tone: "green", icon: "check" },
  rechazo: { label: "Presupuesto rechazado", tone: "amber", icon: "x" },
};

// Fallback para tipos desconocidos (compatibilidad hacia adelante).
export const ACTIVITY_FALLBACK = { label: "Actividad", tone: "slate" as ActivityTone, icon: "bell" };

export function activityMeta(type: string) {
  return ACTIVITY_META[type as ActivityType] ?? ACTIVITY_FALLBACK;
}

// Clases Tailwind del punto/icono por tono. Estáticas (no interpoladas) para
// que el JIT de Tailwind las conserve.
export const ACTIVITY_TONE_CLASS: Record<ActivityTone, string> = {
  blue: "bg-primary-50 text-primary-600",
  green: "bg-accent-50 text-accent-700",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-slate-100 text-slate-500",
};

// Tiempo relativo corto en español ("hace 5 min", "ayer"). created_at viene en
// UTC con formato 'YYYY-MM-DD HH24:MI:SS'; se le añade la Z al parsear.
export function timeAgo(iso: string): string {
  const then = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  const w = Math.floor(d / 7);
  if (w < 5) return `hace ${w} sem`;
  const mo = Math.floor(d / 30);
  return `hace ${mo} mes${mo === 1 ? "" : "es"}`;
}
