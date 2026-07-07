// Catálogo de notificaciones de muestra para el "Probador de notificaciones".
// Se usa tanto en el server action (envío real de push al cliente) como en el
// componente del panel (mockups y toasts de demostración).

export type NotifAudience = "cliente" | "admin";
export type NotifTone = "blue" | "amber" | "green" | "violet" | "red" | "slate";
export type NotifIcon =
  | "search"
  | "wrench"
  | "check"
  | "note"
  | "clipboard"
  | "package"
  | "bell"
  | "banknote";

export type NotifPreset = {
  id: string;
  audience: NotifAudience;
  label: string; // nombre corto en el probador
  title: string; // título de la notificación (usa {placa} en avisos de cliente)
  body: string;
  icon: NotifIcon;
  tone: NotifTone;
};

// Avisos que más se envían al cliente (reflejan los cambios de etapa y las
// anotaciones públicas que dispara el panel).
export const CLIENT_PRESETS: NotifPreset[] = [
  {
    id: "diagnostico",
    audience: "cliente",
    label: "En diagnóstico",
    title: "{placa}: En diagnóstico",
    body: "Nuestros técnicos están revisando tu vehículo para identificar el problema.",
    icon: "search",
    tone: "blue",
  },
  {
    id: "aprobacion",
    audience: "cliente",
    label: "Presupuesto listo",
    title: "{placa}: Esperando tu aprobación",
    body: "El presupuesto está listo. Apruébalo para que continuemos con la reparación.",
    icon: "banknote",
    tone: "amber",
  },
  {
    id: "reparacion",
    audience: "cliente",
    label: "En reparación",
    title: "{placa}: En reparación",
    body: "¡Manos a la obra! El equipo ya está trabajando en tu vehículo.",
    icon: "wrench",
    tone: "blue",
  },
  {
    id: "listo",
    audience: "cliente",
    label: "Listo para recoger",
    title: "{placa}: ¡Listo para recoger!",
    body: "Tu vehículo está listo. Puedes pasar a recogerlo en horario de atención.",
    icon: "check",
    tone: "green",
  },
  {
    id: "nota",
    audience: "cliente",
    label: "Nueva anotación",
    title: "{placa}: Nueva anotación del taller",
    body: "El taller agregó una actualización a tu orden. Toca para ver el detalle.",
    icon: "note",
    tone: "violet",
  },
];

// Avisos internos que ve el equipo del taller en el panel.
export const ADMIN_PRESETS: NotifPreset[] = [
  {
    id: "nueva_orden",
    audience: "admin",
    label: "Nueva orden",
    title: "Nueva orden recibida",
    body: "OT-0042 · ABC1234 (Nissan Versa) ingresó al taller.",
    icon: "clipboard",
    tone: "blue",
  },
  {
    id: "stock_bajo",
    audience: "admin",
    label: "Stock bajo",
    title: "Repuesto por agotarse",
    body: "Pastillas de freno delanteras: quedan 2 (mínimo 8). Conviene reponer.",
    icon: "package",
    tone: "red",
  },
  {
    id: "recordatorio",
    audience: "admin",
    label: "Recordatorio vencido",
    title: "Recordatorio de servicio",
    body: "XYZ987 — cambio de aceite vencido hace 3 días. Contactar al cliente.",
    icon: "bell",
    tone: "amber",
  },
  {
    id: "aprobado",
    audience: "admin",
    label: "Presupuesto aprobado",
    title: "Presupuesto aprobado por el cliente",
    body: "El cliente aprobó el presupuesto de OT-0039. Puedes iniciar la reparación.",
    icon: "check",
    tone: "green",
  },
  {
    id: "listo_admin",
    audience: "admin",
    label: "Orden lista",
    title: "Orden lista para entrega",
    body: "GTM145 pasó el control de calidad y está lista para entrega.",
    icon: "clipboard",
    tone: "violet",
  },
];

export const NOTIF_PRESETS: NotifPreset[] = [...CLIENT_PRESETS, ...ADMIN_PRESETS];
