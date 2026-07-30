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
    id: 40,
    date: "2026-07-29",
    title: "Historial: el archivo de las órdenes cerradas, la ficha de cada placa y lo que ha gastado cada cliente",
    description:
      "La lista de órdenes está hecha para el trabajo del día: abre en «Activas» y solo trae 200 filas, así que lo entregado hace meses quedaba fuera de alcance y para saber qué se le hizo antes a un carro tocaba adivinar el folio. Ahora hay tres lugares nuevos. Uno: «Historial» (en el menú y en un botón arriba de Órdenes) lista las órdenes entregadas y canceladas, con período —desde «Todo» hasta un rango de fechas que tú pones—, búsqueda por placa, cliente o folio, y páginas para seguir hacia atrás sin tope; arriba salen las cerradas del filtro, lo facturado, el ticket promedio y el saldo que quedó sin cobrar, y cada orden entregada muestra si está pagada o cuánto debe, más la carita con la que el cliente calificó. Dos: toca una placa en Vehículos y ahora se abre su ficha, con sus visitas, su gasto histórico, el último kilometraje anotado, todas sus órdenes y la lista de servicios y repuestos que se le han puesto con fecha —esa fecha es la que sirve para pelear una garantía— y sus recordatorios abiertos. Tres: la ficha del cliente ahora dice cuántas visitas trae, cuánto ha gastado y su ticket promedio, con el monto de cada orden en el historial. Dos detalles: la fecha del historial es la del cierre (la entrega en las entregadas, la última actualización en las canceladas), y al mecánico se le siguen ocultando los montos, igual que en caja y en el descuento de la orden.",
  },
  {
    id: 39,
    date: "2026-07-29",
    title: "Pedir la calificación a un toque, desde la orden o desde la lista",
    description:
      "El botón «Pedir calificación» solo salía si la orden estaba en «Entregado» y el cliente todavía no había calificado; si ya había calificado, o si querías mandarle la encuesta el día que lo entregaste pero desde otra etapa, tocaba armar el mensaje a mano. Ahora en cada orden hay un botón fijo, «Pedir calificación por WhatsApp», en el bloque «Acceso del cliente», junto al de enviar el acceso: abre WhatsApp con el mensaje ya escrito y el enlace que deja al cliente parado en las caritas, sin importar la etapa ni si ya había calificado. Y en la lista de órdenes, cada orden entregada trae una carita al lado del botón de cancelar: un toque y se abre el mismo mensaje, sin entrar a la orden, para perseguir varias entregas del día de un jalón. Ojo con una cosa: la tarjeta para calificar solo se le muestra al cliente cuando la orden ya está en «Entregado», así que mandar el enlace antes lo lleva a su seguimiento normal.",
  },
  {
    id: 38,
    date: "2026-07-28",
    title: "Reportes: el ticket promedio, y cuánto de él es mano de obra o repuestos",
    description:
      "En Reportes hay una tarjeta nueva, «Ticket promedio», junto a Facturado, Margen y las demás: cuánto deja en promedio cada orden entregada del período. Abajo trae los dos promedios que antes no existían en ningún lado —cuánto es de servicios (mano de obra) y cuánto de repuestos— así se ve de un vistazo si el taller vive del trabajo o de la venta de piezas. Se puede tocar para abrir el historial, con las órdenes entregadas ordenadas de mayor a menor ticket y, en cada una, cuánto fue servicio y cuánto repuesto: sirve para ver qué trabajos son los que de verdad levantan el promedio. Un detalle para leerlo bien: una orden que llevó servicios Y repuestos cuenta en los dos promedios, así que sumarlos no da el ticket general; cada uno responde «cuando vendo esto, ¿de cuánto es la venta?». La tarjeta de Facturado ya no repite el ticket, solo dice cuántas órdenes se entregaron.",
  },
  {
    id: 37,
    date: "2026-07-28",
    title: "El cliente califica el servicio y el taller ve qué opinan",
    description:
      "Cuando pasas una orden a «Entregado», al cliente le aparece en su página de seguimiento una tarjeta para calificar cómo lo atendimos: cuatro caritas de colores —Excelente, Bueno, Regular y Malo— con sus estrellas, toca una y listo. Si califica Regular o Malo se le pregunta qué falló (la atención, el tiempo de entrega, el precio, la calidad del trabajo u otro) y puede escribir un comentario; si califica bien, el comentario es opcional. Solo se puede calificar una vez y hace falta el código de acceso, así que la opinión es de verdad del dueño del carro. En cuanto entregas, al cliente le llega al teléfono la invitación a calificar con el enlace ya listo, y en la orden hay un botón nuevo «Pedir calificación» que abre WhatsApp con el mensaje escrito por si prefieres pedírselo tú. Del lado del taller hay un apartado nuevo, «Satisfacción», con el promedio, cuántos respondieron de las entregas del período, el porcentaje de excelentes, cómo se reparten los cuatro niveles y el listado de cada respuesta con su comentario y un botón para escribirle al cliente; el filtro de fechas es el mismo de Reportes. En Inicio aparece el promedio de los últimos 30 días y un aviso rojo si alguien calificó Regular o Malo, y en cada orden se ve la calificación de ese cliente con lo que escribió. Además, si alguien califica Regular o Malo, al administrador y al asesor les llega un aviso al teléfono para llamarlo el mismo día. Lo ven el administrador y el asesor; el mecánico no, igual que con Reclamos.",
  },
  {
    id: 36,
    date: "2026-07-27",
    title: "El cliente siempre puede aprobar, rechazar o hablar con un asesor",
    description:
      "Antes los botones de «Aprobar / Rechazar» solo salían si la orden estaba justo en la etapa «Esperando tu aprobación»: si el presupuesto se cargaba estando en recibido, diagnóstico o repuestos, el cliente lo veía pero no podía responder y no quedaba registro de nada. Ahora los botones aparecen en cualquier etapa previa a la reparación, y al aprobar la orden avanza sola a «Esperando repuestos», con su aviso al equipo y su línea en la bitácora. Desde reparación en adelante ya no se muestran: el trabajo ya se hizo. En los presupuestos pre-orden pasa lo mismo con los vencidos: antes se quedaban sin botones, ahora el cliente puede responderlos igual (se le avisa que el precio puede haber cambiado y que el taller se lo confirma). Rechazar ahora pide DOS confirmaciones, la segunda con la advertencia de que el taller detiene el trabajo, para que nadie rechace por error de un toque. Y debajo de las dos opciones hay un tercer camino, «Hablar con asesor»: abre WhatsApp con el mensaje ya escrito (placa, orden o folio y el monto) para que quien duda de un repuesto o del precio pregunte en vez de rechazar. Sigue visible durante las confirmaciones, que es justo cuando el cliente se arrepiente.",
  },
  {
    id: 35,
    date: "2026-07-27",
    title: "Instalar la app también desde el seguimiento",
    description:
      "El botón «Instalar la app» ya no está solo en la página de inicio: ahora también aparece en la pantalla de seguimiento, que es a la que el cliente vuelve una y otra vez mientras su carro está en el taller. En Android instala de una; en iPhone abre los pasos (Compartir → Agregar a inicio). Se oculta solo cuando el cliente ya la tiene instalada.",
  },
  {
    id: 34,
    date: "2026-07-27",
    title: "Avisos del cliente: el ofrecimiento vuelve, no se pierde",
    description:
      "En la página de seguimiento, cuando al cliente le aparece el aviso «Activa los avisos de tu vehículo» y toca «Ahora no», antes desaparecía para siempre en ese teléfono y ya no se le volvía a ofrecer. Ahora solo se pospone: al día siguiente vuelve a aparecer. Y si el cliente le dio «No permitir» al navegador —ahí el navegador ya no deja volver a preguntar desde la página—, el seguimiento se lo dice claro y le muestra los pasos para reactivarlo en iPhone y en Android/computadora, en vez del mensaje suelto de antes. El botón «Avisarme de cambios» sigue siempre a la mano.",
  },
  {
    id: 33,
    date: "2026-07-20",
    title: "Reclamos: lleva el control de repuestos malos y trabajos rehechos",
    description:
      "Hay un apartado nuevo, «Reclamos», para registrar lo que cuesta dinero y antes no aparecía en ningún lado: repuestos que el proveedor mandó defectuosos, trabajos que hubo que rehacer y quejas del cliente. Cada reclamo lleva su tipo, el responsable (proveedor, taller, mecánico o cliente), una descripción y hasta fotos de evidencia, y se puede ligar al carro/orden que afectó. La pérdida en quetzales que absorbió el taller (la pieza de reposición, un reembolso o el retrabajo) resta en Reportes como una línea propia: la Ganancia neta ahora es facturado − costo − gastos − planilla − reclamos, con su tarjeta y su historial igual que las demás. En el detalle de cada orden aparece «Reclamos de este carro» y una «Ganancia después de reclamos», para que la cuenta de cada vehículo sea la real. Importante para no contar doble: el monto del reclamo es solo la pérdida NUEVA; el costo del repuesto original ya se descuenta en su orden. Lo pueden abrir el administrador y el asesor (el asesor lo registra y el administrador le pone el monto); el mecánico no ve el apartado. El menú marca en rojo cuántos reclamos siguen sin cerrar.",
  },
  {
    id: 32,
    date: "2026-07-18",
    title: "Reportes: la ganancia de los carros que aún están en el taller",
    description:
      "Abajo del desglose «Del facturado a la ganancia» aparece un recuadro nuevo con los carros que siguen en el taller, cuánta ganancia dejarán al entregarse y cuánto de eso ya cobraste, más la «Proyectada si se entrega todo». Antes ese trabajo no aparecía por ningún lado hasta la entrega, y como el taller cobra por adelantado se veía la caja llena con la ganancia en cero o en rojo. Se puede tocar para ver carro por carro cuánto deja cada uno. Va aparte de la Ganancia neta a propósito: esa sigue contando solo lo ya entregado, que es lo comparable entre meses; si se mezclaran, la misma orden contaría dos veces —una al recibirla y otra al entregarla— y ningún mes cuadraría contra otro. También se aclararon las tarjetas de arriba: «Cobrado» ahora dice cuánto de lo cobrado es de trabajo sin entregar, y «Ganancia neta» avisa que no es la caja.",
  },
  {
    id: 31,
    date: "2026-07-18",
    title: "Descuentos: rebaja el total sin tocar los precios",
    description:
      "Ahora puedes aplicar un descuento sobre el total de un presupuesto o de una orden, en porcentaje («10%») o en monto fijo («Q500»), con el botón «Aplicar descuento» debajo de los conceptos. Antes la única forma de rebajar era poner el precio de un concepto en 0, lo que ensuciaba el costeo y no dejaba rastro de la negociación. El cliente lo ve desglosado —Subtotal, Descuento, Total— en el enlace público, en el PDF y en el seguimiento, así que la suma de los conceptos siempre cuadra con lo que se le cobra. El descuento viaja solo del presupuesto a la orden al aprobarse, y se descuenta también de Caja, Reportes e Inicio: lo facturado es lo que de verdad se cobró. No se puede dejar el total por debajo de lo que el cliente ya pagó, y en una orden ya aprobada el aviso de «el total cambió» ahora distingue si subió (hay que confirmárselo antes de cobrar) o si bajó (paga menos de lo acordado). Los mecánicos no pueden aplicar descuentos.",
  },
  {
    id: 30,
    date: "2026-07-17",
    title: "«Nuevo presupuesto» a un toque desde Inicio",
    description:
      "En Inicio, junto a «Nueva orden», ahora hay un botón «Nuevo presupuesto» que lleva directo al formulario. Antes había que entrar a Presupuestos y buscar el botón adentro. Los mecánicos no lo ven, igual que no ven el apartado.",
  },
  {
    id: 29,
    date: "2026-07-17",
    title: "Reportes: toca cualquier tarjeta y mira de dónde sale el número",
    description:
      "Las seis tarjetas de Reportes (Facturado, Cobrado, Margen bruto, Gastos, Planilla y Ganancia neta) ahora se tocan y abren su historial. Facturado y Margen listan orden por orden lo que se cobró, lo que costó y lo que dejó; Cobrado, cada pago con su método y quién lo registró; Gastos, cada gasto con su categoría; Planilla, quién compone el costo del equipo; y Ganancia neta muestra la resta completa con un enlace a cada parte. Desde cada renglón se salta a la orden o al gasto que lo originó, y el período que tengas puesto se conserva al entrar y al volver, así que ya no hay que reconstruir a mano de dónde salió un total.",
  },
  {
    id: 28,
    date: "2026-07-17",
    title: "Que ninguna cotización quede en el aire",
    description:
      "Ahora el sistema sabe cuándo le mandaste un presupuesto a un cliente: el botón «Enviar por WhatsApp» deja constancia de la fecha antes de abrir el chat. Si pasa un día y el cliente no responde, el presupuesto se marca con «Sin respuesta», aparece un contador rojo junto a Presupuestos en el menú y a las 7 de la mañana te llega un aviso al teléfono. Para destrabarlo hay un botón «Dar seguimiento» que abre WhatsApp con el mensaje ya escrito preguntándole al cliente qué le pareció; al usarlo, el aviso se apaga. También hay un filtro nuevo «Sin respuesta» para ver de un vistazo a quién toca llamar hoy. El aviso es uno solo por envío, no una cadena: si reenvías la cotización, el día vuelve a empezar.",
  },
  {
    id: 27,
    date: "2026-07-17",
    title: "Presupuestos: precios de cortesía, buscador de repuestos y PDF vencido",
    description:
      "Si pones 0 en el precio de un concepto —una cortesía— ahora se guarda en 0: antes el sistema lo entendía como «vacío» y le ponía el precio del inventario, así que al cliente se le terminaba cobrando lo que le habías regalado. En la pestaña «Inventario», buscar un repuesto después de haberlo elegido ya no cambia la selección: antes el buscador podía dejar seleccionado un repuesto distinto del que veías y agregarlo sin avisar. El PDF de un presupuesto vencido ya no invita a aprobarlo en línea —la página pública ya no lo permitía—: ahora avisa que venció y pide contactar al taller. Y se cerraron dos huecos raros: que dos aprobaciones al mismo tiempo dejaran un presupuesto aprobado pero sin su orden de trabajo, y que un cambio hecho justo en el momento en que el cliente aprobaba se colara en un presupuesto ya decidido.",
  },
  {
    id: 26,
    date: "2026-07-16",
    title: "Presupuestos: cotiza sin abrir una orden y deja que el cliente apruebe en línea",
    description:
      "Nuevo apartado «Presupuestos» en el menú. Cotiza a cualquier cliente aunque su vehículo no haya entrado al taller: agrega servicios, repuestos e items libres, y envíale el enlace por WhatsApp (o el PDF). El cliente revisa los conceptos desde su teléfono con un código de acceso y aprueba o rechaza con un toque; si aprueba, la orden de trabajo se crea sola con todo el presupuesto cargado y el stock descontado. Todos los presupuestos quedan en el historial —pendientes, aprobados, rechazados y cancelados— con filtros, vigencia opcional y duplicado en un toque para re-cotizar.",
  },
  {
    id: 25,
    date: "2026-07-15",
    title: "Editar cualquier dato del presupuesto (y verlo bien en el teléfono)",
    description:
      "Cada concepto del presupuesto tiene un botón «Editar» para corregir todo: concepto, cantidad, costo y precio de venta, sin tener que borrarlo y volver a agregarlo. Si el concepto salió del inventario, la diferencia de cantidad se descuenta o se devuelve al stock sola, y no deja pedir más piezas de las que hay. Además, en el teléfono el presupuesto ya no se ve como una tabla cortada que obliga a arrastrar de lado: ahora es una tarjeta por concepto con todo a la vista.",
  },
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
