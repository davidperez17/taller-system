import brand from "./brand.json";
import { formatMoney } from "./status";

// Enlaces wa.me con mensaje prellenado (sin API de Meta). El teléfono se
// normaliza a formato Guatemala: 8 dígitos locales → prefijo 502; si ya trae
// código de país se respeta.
export function waPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return `502${digits}`;
  if (digits.length >= 10) return digits; // ya trae código de país
  return null;
}

export function waLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const normalized = waPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

const trackingUrl = (plate: string) => `/seguimiento/${plate}`;

// Plantillas de mensaje. `origin` = https://dominio (se antepone al link de
// seguimiento); pásalo desde el server con los headers de la request.
export const WA_TEMPLATES = {
  estado: (v: { nombre: string; placa: string; estado: string; origin: string }) =>
    `Hola ${v.nombre}, le saludamos de ${brand.name}. Su vehículo placa ${v.placa} está: ${v.estado}. ` +
    `Siga el avance en vivo aquí: ${v.origin}${trackingUrl(v.placa)}`,
  acceso: (v: { nombre: string; placa: string; code: string; origin: string }) =>
    `Hola ${v.nombre}, le saludamos de ${brand.name}. Registramos su vehículo placa ${v.placa}. ` +
    `Puede seguir el avance de su servicio en tiempo real con su código de acceso *${v.code}* aquí: ` +
    `${v.origin}${trackingUrl(v.placa)}?code=${v.code}`,
  presupuesto: (v: { nombre: string; placa: string; total: number; code: string; origin: string }) =>
    `Hola ${v.nombre}, le saludamos de ${brand.name}. El presupuesto de su vehículo placa ${v.placa} ` +
    `está listo por ${formatMoney(v.total)}. Puede verlo y aprobarlo con su código ${v.code} aquí: ` +
    `${v.origin}${trackingUrl(v.placa)}?code=${v.code}`,
  listo: (v: { nombre: string; placa: string; total: number; code: string; origin: string }) =>
    `Hola ${v.nombre}, le saludamos de ${brand.name}. ¡Su vehículo placa ${v.placa} está listo! ` +
    (v.total > 0 ? `El total de su servicio fue ${formatMoney(v.total)}. ` : "") +
    `Vea el detalle con su código *${v.code}* aquí: ${v.origin}${trackingUrl(v.placa)}?code=${v.code} ` +
    `Puede pasar a recogerlo en horario de atención.`,
  saldo: (v: { nombre: string; placa: string; saldo: number }) =>
    `Hola ${v.nombre}, le saludamos de ${brand.name}. Le recordamos que su vehículo placa ${v.placa} ` +
    `tiene un saldo pendiente de ${formatMoney(v.saldo)}. Quedamos atentos.`,
  recordatorio: (v: { nombre: string; placa: string; motivo: string }) =>
    `Hola ${v.nombre}, le saludamos de ${brand.name}. Le recordamos que su vehículo placa ${v.placa} ` +
    `tiene pendiente: ${v.motivo}. ¿Desea agendar una cita?`,
} as const;
