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

// Título del evento que documenta el estado del vehículo al recibirlo
// (fotos + observaciones). Lo crean createOrderAction y lo lee la orden impresa.
export const RECEPTION_EVENT_TITLE = "Estado del vehículo al ingreso";

// Categorías de gastos del taller. Los salarios NO van aquí: se registran
// como costo mensual por usuario (users.monthly_cost) para evitar doble
// conteo en la ganancia neta de reportes.
export const EXPENSE_CATEGORIES: Record<string, string> = {
  renta: "Renta",
  servicios_basicos: "Luz, agua e internet",
  herramientas: "Herramientas y equipo",
  insumos: "Insumos y consumibles",
  transporte: "Transporte",
  otros: "Otros",
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

// Modalidad del servicio: en el taller vs a domicilio (el equipo va al cliente).
export type OrderModality = "taller" | "domicilio";
export const ORDER_MODALITIES: Record<OrderModality, string> = {
  taller: "En taller",
  domicilio: "A domicilio",
};

export const PART_CATEGORIES: string[] = [
  "Motor",
  "Frenos",
  "Suspensión",
  "Eléctrico",
  "Lubricantes",
  "Filtros",
  "Llantas",
  "Carrocería",
  "Otro",
];

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(n);
}

// Parseo robusto de las fechas del backend. La BD las guarda como
// "YYYY-MM-DD HH:MM:SS" (espacio, sin zona) o "YYYY-MM-DD" (solo día). Safari
// (JavaScriptCore) es estricto: "2026-07-13Z" (una Z sin hora) le da Invalid
// Date, y formatear una fecha inválida con Intl TIRA RangeError en Safari
// (V8/Chrome solo devuelve "Invalid Date" sin tirar). Eso reventaba el
// seguimiento en iPhone al mostrar la entrega estimada (solo-día). Normalizamos
// las tres formas y devolvemos null si no parsea, para nunca formatear inválidas.
function parseDbDate(iso: string): Date | null {
  const norm =
    iso.length <= 10
      ? iso + "T12:00:00Z"
      : iso.includes("T")
        ? iso
        : iso.replace(" ", "T") + "Z";
  const d = new Date(norm);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseDbDate(iso);
  if (!d) return "—";
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
  const d = parseDbDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Guatemala",
  }).format(d);
}

// Para fechas sin hora (YYYY-MM-DD): parseDbDate ya fija mediodía UTC para
// evitar corrimiento de día.
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseDbDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Guatemala",
  }).format(d);
}

// Días entre hoy (fecha local del taller) y una fecha YYYY-MM-DD. Negativo = vencido.
export function daysUntil(dueDate: string): number {
  const today = new Date();
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, day] = dueDate.slice(0, 10).split("-").map(Number);
  const due = Date.UTC(y, (m || 1) - 1, day || 1);
  return Math.round((due - t) / 86400000);
}
