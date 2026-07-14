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
    id: 24,
    date: "2026-07-13",
    title: "Corregir el mensaje de un cambio de estado",
    description:
      "En la línea de tiempo de la orden, los cambios de estado (recibido, listo, etc.) tienen un lápiz para corregir su mensaje si se escribió mal, sin borrar el hito ni volver a notificar al cliente. La etapa en sí no cambia, solo el texto.",
  },
  {
    id: 23,
    date: "2026-07-13",
    title: "Quitar anotaciones de una orden",
    description:
      "Cada anotación de la orden ahora tiene un botón para quitarla, por si se escribió mal o por error. Pide confirmar y también borra sus fotos. Los cambios de estado y los eventos del sistema (historial) no se pueden borrar.",
  },
  {
    id: 22,
    date: "2026-07-13",
    title: "Botón para enviar el acceso al cliente por WhatsApp",
    description:
      "En la orden, dentro de «Acceso del cliente», hay un botón verde de WhatsApp que abre un mensaje listo con el código de acceso resaltado y el link de seguimiento, para entregarle el acceso al cliente de una vez apenas se registra la orden.",
  },
  {
    id: 21,
    date: "2026-07-13",
    title: "El aviso de nueva versión aparece solo, sin recargar",
    description:
      "El pop de «Actualización disponible» ahora se detecta cada minuto y al volver a la pestaña o la ventana, así que aparece solo poco después de cada deploy sin tener que recargar la página a mano.",
  },
  {
    id: 20,
    date: "2026-07-13",
    title: "Al avisar «vehículo listo» se manda el link y el total",
    description:
      "El mensaje de WhatsApp de «Vehículo listo» ahora incluye el link de seguimiento con el código de acceso resaltado y el total del servicio, para que el cliente entre desde su teléfono y vea el detalle de cuánto le salió todo.",
  },
  {
    id: 19,
    date: "2026-07-13",
    title: "Ubicación por GPS en servicios a domicilio",
    description:
      "Al crear una orden «A domicilio» ya no hace falta escribir toda la dirección: con el botón «Usar mi ubicación (GPS)» se captura la ubicación del celular y se guarda como un enlace a Maps. En la orden, el técnico ve «Abrir en Maps» para llegar directo. Igual puedes escribir o ajustar la dirección a mano.",
  },
  {
    id: 18,
    date: "2026-07-13",
    title: "Aviso para activar notificaciones en el seguimiento",
    description:
      "Cuando el cliente abre el seguimiento de su vehículo con su código, aparece un aviso para activar las notificaciones y enterarse apenas cambie el estado de su reparación. Se puede descartar y no vuelve a molestar.",
  },
  {
    id: 17,
    date: "2026-07-13",
    title: "Aviso al equipo cuando se edita una orden",
    description:
      "Si alguien cambia el trabajo solicitado, el diagnóstico, el kilometraje, la entrega estimada, el combustible o el técnico asignado de una orden, al resto del equipo le llega un aviso (push + campana) diciendo qué se cambió y en qué orden. Quien hizo el cambio no se auto-notifica.",
  },
  {
    id: 16,
    date: "2026-07-13",
    title: "Código de acceso más corto (4 caracteres)",
    description:
      "Las órdenes nuevas usan un código de acceso de 4 caracteres, más fácil de dictar y teclear. Los códigos ya entregados a clientes siguen funcionando igual.",
  },
  {
    id: 15,
    date: "2026-07-13",
    title: "Servicios a domicilio",
    description:
      "Al crear una orden puedes marcarla «A domicilio» y anotar la ubicación de la visita. El costo de ir se cotiza como un concepto más, y Reportes ahora separa el facturado y la ganancia de taller vs domicilio.",
  },
  {
    id: 14,
    date: "2026-07-13",
    title: "Sin registros duplicados por doble toque",
    description:
      "Los botones de guardar/agregar (presupuesto, pagos, anotaciones, inventario, clientes, servicios y más) se desactivan y muestran «Guardando…» mientras procesan, para que tocar rápido ya no cree el mismo registro dos veces.",
  },
  {
    id: 13,
    date: "2026-07-13",
    title: "Costo y ganancia por orden (solo admin)",
    description:
      "Al cotizar, el admin anota el costo real de cada concepto además del precio de venta, y ve la ganancia y el margen de la orden en la sección Pagos. El cliente sigue viendo solo el precio de venta.",
  },
  {
    id: 12,
    date: "2026-07-11",
    title: "Confirmación antes de eliminar",
    description:
      "Eliminar o quitar (clientes, vehículos, pagos, gastos, servicios, repuestos, recordatorios y novedades) ahora pide confirmar, para evitar borrados por error.",
  },
  {
    id: 11,
    date: "2026-07-11",
    title: "Contador de notificaciones en vivo",
    description:
      "La campana suma las notificaciones nuevas del equipo automáticamente, sin recargar, y avisa con un número.",
  },
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
