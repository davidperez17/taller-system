// Validación mínima de formularios en server actions: recorta, limita longitud
// y normaliza vacíos a null. Sin dependencias (no zod) — los formularios son
// internos y el objetivo es evitar payloads desmedidos, no tipado exhaustivo.

const DEFAULT_MAX = 500;

export function str(
  formData: FormData,
  name: string,
  opts: { max?: number; required?: boolean } = {}
): string {
  const value = String(formData.get(name) || "")
    .trim()
    .slice(0, opts.max ?? DEFAULT_MAX);
  if (opts.required && !value) throw new Error(`Falta el campo ${name}`);
  return value;
}

/** Como str(), pero devuelve null si queda vacío (para columnas opcionales). */
export function strOrNull(
  formData: FormData,
  name: string,
  opts: { max?: number } = {}
): string | null {
  return str(formData, name, opts) || null;
}

export function num(
  formData: FormData,
  name: string,
  opts: { min?: number; max?: number; fallback?: number } = {}
): number {
  let n = Number(formData.get(name));
  if (!Number.isFinite(n)) n = opts.fallback ?? 0;
  if (opts.min !== undefined && n < opts.min) n = opts.min;
  if (opts.max !== undefined && n > opts.max) n = opts.max;
  return n;
}
