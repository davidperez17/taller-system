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

// Etapas en las que el cliente todavía puede aprobar o rechazar el presupuesto
// de su orden: hasta antes de que empiece la reparación. Después el trabajo ya
// se hizo y responder no tendría efecto. Aprobar lleva la orden a 'repuestos'
// (ninguna de estas etapas va más adelante, así que nunca retrocede).
export const CLIENT_DECISION_STATUSES: OrderStatus[] = [
  "recibido",
  "diagnostico",
  "aprobacion",
  "repuestos",
];

export function canClientDecide(status: string): boolean {
  return CLIENT_DECISION_STATUSES.includes(status as OrderStatus);
}

// Ciclo de vida de un presupuesto pre-orden (módulo Presupuestos). No confundir
// con orders.approval_status: aquí el presupuesto existe ANTES de la orden y al
// aprobarse la genera. 'cancelado' sustituye al borrado (historial permanente).
export type QuoteStatus = "pendiente" | "aprobado" | "rechazado" | "cancelado";
export const QUOTE_STATUS_META: Record<QuoteStatus, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "amber" },
  aprobado: { label: "Aprobado", color: "green" },
  rechazado: { label: "Rechazado", color: "red" },
  cancelado: { label: "Cancelado", color: "slate" },
};

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

// Reclamos: pérdidas por repuesto defectuoso del proveedor, trabajo mal hecho,
// queja del cliente/garantía u otro. El costo del repuesto ORIGINAL ya vive en
// order_items.unit_cost; el monto del reclamo es solo la pérdida NUEVA (reposición,
// reembolso, retrabajo), para no doble-contar en la ganancia neta de reportes.
export const CLAIM_TYPES: Record<string, string> = {
  repuesto_defectuoso: "Repuesto defectuoso",
  trabajo_mal_hecho: "Trabajo mal hecho",
  queja_cliente: "Queja del cliente / garantía",
  otro: "Otro",
};

export type ClaimStatus = "abierto" | "en_proceso" | "resuelto" | "rechazado";
// abierto → en_proceso → resuelto | rechazado. 'rechazado' = no procedió / sin
// pérdida. Los colores reusan el mapa `tones` de StatusBadge (ui.tsx).
export const CLAIM_STATUS_META: Record<ClaimStatus, { label: string; color: string }> = {
  abierto: { label: "Abierto", color: "amber" },
  en_proceso: { label: "En proceso", color: "blue" },
  resuelto: { label: "Resuelto", color: "green" },
  rechazado: { label: "Rechazado", color: "slate" },
};

// Responsable de la pérdida: responde "quién me está costando dinero".
export const CLAIM_RESPONSIBLE: Record<string, string> = {
  proveedor: "Proveedor",
  taller: "Taller",
  mecanico: "Mecánico",
  cliente: "Cliente",
};

// Semáforo de satisfacción post-entrega (v18). El cliente califica su servicio
// desde /seguimiento/[placa] cuando la orden queda en 'entregado'.
//
// Los valores van de 4 (mejor) a 1 (peor) para que el promedio se lea como una
// nota y el orden numérico sea el mismo orden visual (arriba lo bueno). Esta es
// la whitelist: la tabla order_feedback no lleva CHECK (ver v18 en schema.ts).
export type CsatRating = 1 | 2 | 3 | 4;

export const CSAT_LEVELS: Record<
  CsatRating,
  { label: string; description: string; stars: number }
> = {
  // Las descripciones son cortas a propósito: en la fila del semáforo tienen una
  // columna de ~20 caracteres y si envuelven a dos líneas la escalera queda
  // despareja y deja de leerse de un vistazo.
  4: { label: "Excelente", description: "Todo perfecto", stars: 4 },
  3: { label: "Bueno", description: "Bien atendido", stars: 3 },
  2: { label: "Regular", description: "Se puede mejorar", stars: 2 },
  1: { label: "Malo", description: "No quedé conforme", stars: 1 },
};

// De mejor a peor: el orden en que se pintan las filas del semáforo.
export const CSAT_ORDER: CsatRating[] = [4, 3, 2, 1];

// Desde aquí hacia abajo se le piden motivos al cliente y se avisa al equipo.
export const CSAT_LOW_MAX: CsatRating = 2;

export function isCsatRating(n: unknown): n is CsatRating {
  return n === 1 || n === 2 || n === 3 || n === 4;
}

export function isLowCsat(rating: number): boolean {
  return rating <= CSAT_LOW_MAX;
}

// Motivos que se ofrecen SOLO cuando la calificación es Regular o Malo: sirven
// para saber dónde falló sin obligar a escribir. Multi-selección; se guardan
// como slugs separados por comas en order_feedback.reasons.
export const CSAT_REASONS: Record<string, string> = {
  atencion: "La atención",
  tiempo: "El tiempo de entrega",
  precio: "El precio",
  calidad: "La calidad del trabajo",
  otro: "Otro",
};

/** Parsea la columna reasons (CSV de slugs) descartando basura y duplicados. */
export function parseCsatReasons(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => s in CSAT_REASONS))];
}

/** Los motivos en texto legible, listos para un mensaje o un detalle. */
export function csatReasonLabels(raw: string | null | undefined): string[] {
  return parseCsatReasons(raw).map((r) => CSAT_REASONS[r]);
}

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
