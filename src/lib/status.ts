export type OrderStatus =
  | "recibido"
  | "diagnostico"
  | "aprobacion"
  | "repuestos"
  | "reparacion"
  | "calidad"
  | "listo"
  | "entregado"
  | "cancelado";

export const STATUS_FLOW: OrderStatus[] = [
  "recibido",
  "diagnostico",
  "aprobacion",
  "repuestos",
  "reparacion",
  "calidad",
  "listo",
  "entregado",
];

export const STATUS_META: Record<
  OrderStatus,
  { label: string; client: string; color: string; description: string }
> = {
  recibido: {
    label: "Recibido",
    client: "Vehículo recibido",
    color: "slate",
    description: "El vehículo ingresó al taller y está en cola de revisión.",
  },
  diagnostico: {
    label: "En diagnóstico",
    client: "En diagnóstico",
    color: "blue",
    description: "Nuestros técnicos están revisando el vehículo para identificar el problema.",
  },
  aprobacion: {
    label: "Esperando aprobación",
    client: "Esperando tu aprobación",
    color: "amber",
    description: "El presupuesto está listo. Esperamos la aprobación del cliente para continuar.",
  },
  repuestos: {
    label: "Esperando repuestos",
    client: "Esperando repuestos",
    color: "amber",
    description: "Estamos consiguiendo las piezas necesarias para la reparación.",
  },
  reparacion: {
    label: "En reparación",
    client: "En reparación",
    color: "blue",
    description: "El equipo está trabajando en el vehículo.",
  },
  calidad: {
    label: "Control de calidad",
    client: "Control de calidad",
    color: "violet",
    description: "Reparación terminada. Realizamos pruebas finales de calidad.",
  },
  listo: {
    label: "Listo para entrega",
    client: "¡Listo para recoger!",
    color: "green",
    description: "El vehículo está listo. Puedes pasar a recogerlo en horario de atención.",
  },
  entregado: {
    label: "Entregado",
    client: "Entregado",
    color: "green",
    description: "El vehículo fue entregado al cliente. ¡Gracias por confiar en nosotros!",
  },
  cancelado: {
    label: "Cancelado",
    client: "Orden cancelada",
    color: "red",
    description: "La orden de trabajo fue cancelada.",
  },
};

export const VEHICLE_TYPES: Record<string, string> = {
  auto: "Auto",
  moto: "Moto",
  camion: "Camión",
  otro: "Otro",
};

export const ROLES: Record<string, string> = {
  admin: "Administrador",
  asesor: "Asesor de servicio",
  mecanico: "Mecánico",
};

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Guatemala",
  }).format(d);
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Guatemala",
  }).format(d);
}
