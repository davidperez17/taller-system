export type ChangelogEntry = {
  id: number;
  date: string; // ISO YYYY-MM-DD
  title: string;
  description: string;
};

// Historial de mejoras del panel, de la más nueva a la más vieja. Al agregar
// una entrada nueva usa el id siguiente (más alto): la estrella compara el id
// más alto con el último visto (guardado por dispositivo en localStorage) para
// marcar cuántas novedades hay sin ver.
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: 10,
    date: "2026-07-11",
    title: "Aviso de actualización en la app",
    description:
      "Cuando publicamos una versión nueva, el panel muestra un aviso para aplicarla al instante, sin reinstalar nada.",
  },
  {
    id: 9,
    date: "2026-07-11",
    title: "Novedades de la app",
    description:
      "Esta estrella: aquí queda el historial de todas las mejoras del panel del taller.",
  },
  {
    id: 8,
    date: "2026-07-11",
    title: "Instalar la app en Android con un toque",
    description:
      "El botón «Instalar app» abre el instalador nativo de Android. En iPhone se mantienen las instrucciones de Safari.",
  },
  {
    id: 7,
    date: "2026-07-11",
    title: "Registrar ingreso sin perder lo escrito",
    description:
      "El formulario de nueva orden ya no se borra al enviarlo: te avisa si falta la placa o el cliente.",
  },
  {
    id: 6,
    date: "2026-07-11",
    title: "Actividad del equipo en el inicio",
    description:
      "El panel muestra las últimas acciones del equipo, con enlace al historial completo.",
  },
  {
    id: 5,
    date: "2026-07-11",
    title: "Menú de usuario y campana renovados",
    description:
      "Menú de usuario flotante y la campana de notificaciones en el encabezado del panel.",
  },
  {
    id: 4,
    date: "2026-07-11",
    title: "Cancelar orden con motivo",
    description:
      "Cancelar una orden ahora pide un motivo y se puede hacer rápido desde la lista de órdenes.",
  },
  {
    id: 3,
    date: "2026-07-10",
    title: "Quitar un vehículo desde el cliente",
    description:
      "Puedes eliminar un vehículo puntual desde el detalle del cliente, sin borrar al cliente.",
  },
  {
    id: 2,
    date: "2026-07-10",
    title: "Cotización e informe en PDF",
    description:
      "Descarga la cotización y el informe de servicio en PDF, listos para imprimir o enviar.",
  },
  {
    id: 1,
    date: "2026-07-10",
    title: "Reportes de finanzas",
    description:
      "Reportes por rango de fechas con gastos del taller y ganancia neta.",
  },
];

export const LATEST_CHANGELOG_ID = CHANGELOG[0].id;
