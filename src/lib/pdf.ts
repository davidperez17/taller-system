import type PDFDocumentType from "pdfkit";
import { one, many } from "./db";
import {
  VEHICLE_TYPES, RECEPTION_EVENT_TITLE, formatMoney, formatDate, formatDateShort, formatDay,
  type OrderStatus, type QuoteStatus,
} from "./status";
import brand from "./brand.json";

// Build standalone: trae las métricas de fuente embebidas (el build normal las
// lee del filesystem con fs y se rompe al empaquetar para serverless).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument: typeof PDFDocumentType = require("pdfkit/js/pdfkit.standalone.js");

export type OrderDocData = {
  id: number;
  folio: string;
  tracking_code: string;
  status: OrderStatus;
  description: string;
  diagnosis: string | null;
  km: string | null;
  fuel_level: string | null;
  estimated_delivery: string | null;
  created_at: string;
  delivered_at: string | null;
  approval_status: "pendiente" | "aprobado" | "rechazado";
  approval_at: string | null;
  plate: string;
  type: string;
  brand: string | null;
  model: string | null;
  year: string | null;
  color: string | null;
  client_name: string;
  client_phone: string | null;
  mechanic: string | null;
  items: { kind: string; description: string; qty: number; unit_price: number }[];
  events: { title: string; detail: string | null; created_at: string; has_photos: boolean }[];
  paid: number;
  reception: string | null;
  // Solo para kind "presupuesto" (pre-orden): vigencia y estado real del quote.
  valid_until?: string | null;
  quote_status?: QuoteStatus;
};

export async function loadOrderDocData(orderId: number): Promise<OrderDocData | null> {
  const order = await one<Omit<OrderDocData, "items" | "events" | "paid" | "reception">>(
    `SELECT o.id, o.folio, o.tracking_code, o.status, o.description, o.diagnosis,
            o.km, o.fuel_level, o.estimated_delivery, o.created_at, o.delivered_at,
            o.approval_status, o.approval_at,
            v.plate, v.type, v.brand, v.model, v.year, v.color,
            c.name AS client_name, c.phone AS client_phone,
            u.name AS mechanic
       FROM orders o
       JOIN vehicles v ON v.id = o.vehicle_id
       JOIN clients c ON c.id = v.client_id
       LEFT JOIN users u ON u.id = o.assigned_to
      WHERE o.id = ?`,
    [orderId]
  );
  if (!order) return null;

  const items = await many<OrderDocData["items"][number]>(
    "SELECT kind, description, qty, unit_price FROM order_items WHERE order_id = ? ORDER BY id",
    [orderId]
  );
  // Solo eventos públicos: estos documentos son para entregar al cliente.
  const events = await many<{
    title: string; detail: string | null; created_at: string; photo_urls: string | null;
  }>(
    `SELECT title, detail, created_at, photo_urls FROM order_events
      WHERE order_id = ? AND is_public = 1 ORDER BY created_at, id`,
    [orderId]
  );
  const paid =
    (
      await one<{ paid: number }>(
        "SELECT COALESCE(SUM(amount), 0)::float8 AS paid FROM payments WHERE order_id = ?",
        [orderId]
      )
    )?.paid ?? 0;

  const reception = events.find((e) => e.title === RECEPTION_EVENT_TITLE)?.detail ?? null;

  return {
    ...order,
    items,
    events: events.map((e) => ({
      title: e.title,
      detail: e.detail,
      created_at: e.created_at,
      has_photos: !!e.photo_urls,
    })),
    paid,
    reception,
  };
}

// Mapea un presupuesto pre-orden (quotes/quote_items) al shape del documento.
// tracking_code lleva el public_code del quote; el bloque de acceso del PDF de
// presupuesto imprime folio+código hacia /presupuesto/{folio}.
export async function loadQuoteDocData(quoteId: number): Promise<OrderDocData | null> {
  const q = await one<{
    id: number; folio: string; public_code: string; status: QuoteStatus; plate: string;
    vehicle_type: string; vehicle_brand: string | null; vehicle_model: string | null;
    vehicle_year: string | null; vehicle_color: string | null; description: string;
    valid_until: string | null; decided_at: string | null; created_at: string;
    client_name: string | null; client_phone: string | null;
  }>(
    `SELECT q.id, q.folio, q.public_code, q.status, q.plate, q.vehicle_type,
            q.vehicle_brand, q.vehicle_model, q.vehicle_year, q.vehicle_color,
            q.description, q.valid_until, q.decided_at, q.created_at,
            COALESCE(c.name, q.client_name) AS client_name,
            COALESCE(c.phone, q.client_phone) AS client_phone
       FROM quotes q LEFT JOIN clients c ON c.id = q.client_id
      WHERE q.id = ?`,
    [quoteId]
  );
  if (!q) return null;

  const items = await many<OrderDocData["items"][number]>(
    "SELECT kind, description, qty, unit_price FROM quote_items WHERE quote_id = ? ORDER BY id",
    [quoteId]
  );

  return {
    id: q.id,
    folio: q.folio,
    tracking_code: q.public_code,
    status: "aprobacion",
    description: q.description,
    diagnosis: null,
    km: null,
    fuel_level: null,
    estimated_delivery: null,
    created_at: q.created_at,
    delivered_at: null,
    approval_status:
      q.status === "aprobado" ? "aprobado" : q.status === "rechazado" ? "rechazado" : "pendiente",
    approval_at: q.decided_at,
    plate: q.plate,
    type: q.vehicle_type,
    brand: q.vehicle_brand,
    model: q.vehicle_model,
    year: q.vehicle_year,
    color: q.vehicle_color,
    client_name: q.client_name ?? "—",
    client_phone: q.client_phone,
    mechanic: null,
    items,
    events: [],
    paid: 0,
    reception: null,
    valid_until: q.valid_until,
    quote_status: q.status,
  };
}

/* ---------------- Maquetación ---------------- */

const INK = "#18181b"; // zinc-900 (neutro, sin tinte azul)
const MUTED = "#52525b"; // sm-muted (~7:1)
const FAINT = "#71717a"; // sm-faint (~4.8:1)
const LINE = "#e4e4e7"; // sm-border
const HEAD = "#1c1c20"; // grafito de la marca
const GREEN = "#137a41"; // sm-ok (éxito/dinero)
const AMBER = "#b45309"; // sm-warn
const RED = "#c8102e"; // sm-red (acción/marca · montos negativos)

const M = 48; // margen
const PAGE_W = 612; // carta
const PAGE_H = 792;
const W = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 64;

export async function buildOrderPdf(
  data: OrderDocData,
  kind: "cotizacion" | "informe" | "presupuesto",
  origin: string
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: M, left: M, right: M, bottom: 64 },
    bufferPages: true,
    info: {
      Title: `${
        kind === "informe" ? "Informe de servicio" : kind === "presupuesto" ? "Presupuesto" : "Cotización"
      } ${data.folio}`,
      Author: brand.name,
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const ensure = (space: number) => {
    if (doc.y + space > BOTTOM) doc.addPage();
  };
  const sectionTitle = (t: string) => {
    ensure(40);
    doc.moveDown(0.9);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(FAINT).text(t.toUpperCase(), { characterSpacing: 0.8 });
    doc.moveDown(0.35);
  };
  const para = (t: string) => {
    doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(t, { width: W, lineGap: 2 });
  };
  const hline = (yy: number) => {
    doc.save().moveTo(M, yy).lineTo(M + W, yy).lineWidth(0.7).strokeColor(LINE).stroke().restore();
  };

  /* Encabezado */
  const title =
    kind === "informe" ? "INFORME DE SERVICIO" : kind === "presupuesto" ? "PRESUPUESTO" : "COTIZACIÓN";
  doc.font("Helvetica-Bold").fontSize(15).fillColor(HEAD).text(brand.name.toUpperCase(), M, M, {
    width: W - 190,
  });
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(
    "Taller mecánico · Autos, motos y camiones",
    { width: W - 190 }
  );
  doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text(title, M + W - 180, M, {
    width: 180,
    align: "right",
  });
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(RED)
    .text(`${kind === "presupuesto" ? "Presupuesto" : "Orden"} ${data.folio}`, {
      width: 180,
      align: "right",
    });
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(
    `Emitido: ${formatDate(new Date().toISOString().slice(0, 19).replace("T", " "))}`,
    { width: 180, align: "right" }
  );
  doc.y = Math.max(doc.y, M + 44);
  doc.moveDown(0.6);
  hline(doc.y);

  /* Cliente y vehículo en dos columnas */
  const colW = W / 2 - 10;
  const row = (x: number, label: string, value: string) => {
    const yy = doc.y;
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(label, x, yy, { width: 110 });
    const afterLabel = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(value || "—", x + 112, yy, {
      width: colW - 112,
    });
    // Avanzar por el alto REAL de la fila. El valor puede envolver a 2 líneas
    // (p. ej. un vehículo con tipo · marca modelo año largo); con un salto fijo
    // de 14 esa 2ª línea se encimaba con la fila de abajo (Kilometraje).
    doc.y = Math.max(yy + 14, afterLabel, doc.y);
  };
  doc.moveDown(0.8);
  const metaTop = doc.y;
  row(M, "Cliente", data.client_name);
  row(M, "Teléfono", data.client_phone ?? "—");
  if (kind === "presupuesto") {
    row(M, "Elaborado", formatDate(data.created_at));
    row(M, "Vigente hasta", data.valid_until ? formatDay(data.valid_until) : "—");
  } else {
    row(M, "Recepción", formatDate(data.created_at));
    if (kind === "informe") {
      row(M, "Entrega", data.delivered_at ? formatDate(data.delivered_at) : "—");
      if (data.mechanic) row(M, "Atendido por", data.mechanic);
    } else {
      row(M, "Entrega estimada", formatDateShort(data.estimated_delivery));
    }
  }
  const leftBottom = doc.y;
  doc.y = metaTop;
  const x2 = M + W / 2 + 10;
  row(x2, "Placa", data.plate);
  row(
    x2,
    "Vehículo",
    [VEHICLE_TYPES[data.type] ?? data.type, [data.brand, data.model, data.year, data.color].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(" · ")
  );
  if (kind !== "presupuesto") {
    row(x2, "Kilometraje", data.km ?? "—");
    row(x2, "Combustible", data.fuel_level ?? "—");
  }
  doc.y = Math.max(leftBottom, doc.y);
  doc.x = M;

  /* Trabajo solicitado / diagnóstico / recepción */
  sectionTitle("Trabajo solicitado");
  para(data.description || "—");
  if (data.diagnosis) {
    sectionTitle("Diagnóstico del taller");
    para(data.diagnosis);
  }
  if (data.reception) {
    sectionTitle("Estado del vehículo al ingreso");
    para(data.reception);
  }

  /* Informe: historial del trabajo */
  if (kind === "informe" && data.events.length > 0) {
    sectionTitle("Trabajo realizado — historial");
    const anyPhotos = data.events.some((e) => e.has_photos);
    for (const ev of data.events) {
      const detail = ev.detail && ev.detail !== data.description ? ev.detail : null;
      const h =
        doc.heightOfString(ev.title, { width: W - 78 }) +
        (detail ? doc.heightOfString(detail, { width: W - 78 }) : 0) +
        10;
      ensure(h + 6);
      const yy = doc.y;
      doc.font("Helvetica").fontSize(8.5).fillColor(FAINT).text(formatDateShort(ev.created_at), M, yy, { width: 70 });
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(ev.title, M + 78, yy, { width: W - 78 });
      if (detail) {
        doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(detail, M + 78, doc.y + 1, {
          width: W - 78,
          lineGap: 1.5,
        });
      }
      doc.y += 7;
      doc.x = M;
    }
    if (anyPhotos) {
      doc.font("Helvetica").fontSize(8).fillColor(FAINT).text(
        "Las fotos de los avances están disponibles en tu seguimiento en línea.",
        M, doc.y, { width: W }
      );
    }
  }

  /* Tabla de conceptos */
  const C_DESC = M;
  const C_QTY = M + W - 210;
  const C_UNIT = M + W - 150;
  const C_AMT = M + W - 75;
  const tableHead = () => {
    ensure(26);
    const yy = doc.y;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(FAINT);
    doc.text("DESCRIPCIÓN", C_DESC, yy, { width: C_QTY - C_DESC - 8, characterSpacing: 0.5 });
    doc.text("CANT.", C_QTY, yy, { width: 52, align: "right", characterSpacing: 0.5 });
    doc.text("P. UNITARIO", C_UNIT, yy, { width: 68, align: "right", characterSpacing: 0.5 });
    doc.text("IMPORTE", C_AMT, yy, { width: 75, align: "right", characterSpacing: 0.5 });
    doc.y = yy + 13;
    hline(doc.y);
    doc.y += 5;
    doc.x = M;
  };

  sectionTitle(kind === "informe" ? "Trabajos y repuestos" : "Presupuesto");
  if (data.items.length === 0) {
    para("El presupuesto aún no tiene conceptos cargados.");
  } else {
    tableHead();
    const total = data.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
    for (const it of data.items) {
      const label = `${it.description}  ·  ${it.kind === "repuesto" ? "Repuesto" : it.kind === "servicio" ? "Servicio" : it.kind}`;
      const h = doc.heightOfString(label, { width: C_QTY - C_DESC - 8 }) + 8;
      if (doc.y + h > BOTTOM) {
        doc.addPage();
        tableHead();
      }
      const yy = doc.y;
      doc.font("Helvetica").fontSize(9).fillColor(INK).text(it.description, C_DESC, yy, {
        width: C_QTY - C_DESC - 8,
      });
      doc.font("Helvetica").fontSize(7.5).fillColor(FAINT).text(
        it.kind === "repuesto" ? "Repuesto" : "Servicio",
        C_DESC,
        doc.y + 0.5,
        { width: C_QTY - C_DESC - 8 }
      );
      const rowBottom = doc.y;
      doc.font("Helvetica").fontSize(9).fillColor(MUTED);
      doc.text(String(it.qty), C_QTY, yy, { width: 52, align: "right" });
      doc.text(formatMoney(it.unit_price), C_UNIT, yy, { width: 68, align: "right" });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INK);
      doc.text(formatMoney(it.qty * it.unit_price), C_AMT, yy, { width: 75, align: "right" });
      doc.y = Math.max(rowBottom, yy + 12) + 5;
      doc.x = M;
    }
    hline(doc.y);
    doc.y += 6;
    const totalRow = (label: string, value: string, opts?: { color?: string; big?: boolean }) => {
      ensure(18);
      const yy = doc.y;
      doc
        .font(opts?.big ? "Helvetica-Bold" : "Helvetica")
        .fontSize(opts?.big ? 11 : 9)
        .fillColor(opts?.big ? INK : MUTED)
        .text(label, C_UNIT - 120, yy, { width: 180, align: "right" });
      doc
        .font("Helvetica-Bold")
        .fontSize(opts?.big ? 11 : 9)
        .fillColor(opts?.color ?? INK)
        .text(value, C_AMT, yy, { width: 75, align: "right" });
      doc.y = yy + (opts?.big ? 17 : 14);
      doc.x = M;
    };
    totalRow("Total", formatMoney(total), { big: true });
    if (kind === "informe") {
      totalRow("Pagado", formatMoney(data.paid), { color: GREEN });
      const saldo = total - data.paid;
      totalRow("Saldo", formatMoney(saldo), { color: saldo > 0.009 ? AMBER : GREEN });
    }
    doc.font("Helvetica").fontSize(8).fillColor(FAINT).text(
      kind === "informe"
        ? "Precios en quetzales (Q), impuestos incluidos."
        : "Precios en quetzales (Q), impuestos incluidos. Presupuesto sujeto a diagnóstico: cualquier trabajo adicional se consulta antes con el cliente.",
      M,
      doc.y + 2,
      { width: W }
    );
  }

  /* Estado del presupuesto pre-orden */
  if (kind === "presupuesto" && data.items.length > 0) {
    doc.moveDown(0.8);
    ensure(30);
    const qs = data.quote_status ?? "pendiente";
    if (qs === "aprobado") {
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(GREEN).text(
        `Presupuesto aprobado por el cliente${data.approval_at ? ` el ${formatDate(data.approval_at)}` : ""}.`,
        M, doc.y, { width: W }
      );
    } else if (qs === "rechazado") {
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(RED).text(
        `Presupuesto rechazado por el cliente${data.approval_at ? ` el ${formatDate(data.approval_at)}` : ""}.`,
        M, doc.y, { width: W }
      );
    } else if (qs === "cancelado") {
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(FAINT).text(
        "Este presupuesto fue retirado por el taller.",
        M, doc.y, { width: W }
      );
    } else {
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(AMBER).text(
        "Pendiente de tu aprobación: revísalo y apruébalo en línea con tu código de acceso.",
        M, doc.y, { width: W }
      );
    }
  }

  /* Estado de aprobación (cotización) */
  if (kind === "cotizacion" && data.items.length > 0) {
    doc.moveDown(0.8);
    ensure(30);
    if (data.approval_status === "aprobado" && data.approval_at) {
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(GREEN).text(
        `Presupuesto aprobado por el cliente el ${formatDate(data.approval_at)}.`,
        M, doc.y, { width: W }
      );
    } else if (data.approval_status === "rechazado" && data.approval_at) {
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(RED).text(
        `Presupuesto rechazado por el cliente el ${formatDate(data.approval_at)}.`,
        M, doc.y, { width: W }
      );
    } else if (data.status === "aprobacion") {
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(AMBER).text(
        "Pendiente de tu aprobación: puedes aprobarlo desde tu seguimiento en línea.",
        M, doc.y, { width: W }
      );
    }
  }

  /* Acceso en línea: seguimiento (orden) o revisión/aprobación (presupuesto) */
  ensure(86);
  doc.moveDown(1.1);
  const boxY = doc.y;
  doc.save().roundedRect(M, boxY, W, 66, 8).lineWidth(1.2).strokeColor(INK).stroke().restore();
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(
    kind === "presupuesto" ? "REVISA Y APRUEBA TU PRESUPUESTO EN LÍNEA" : "SIGUE TU REPARACIÓN EN LÍNEA",
    M, boxY + 10, { width: W, align: "center", characterSpacing: 0.8 }
  );
  doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(
    kind === "presupuesto"
      ? `${origin}/presupuesto/${data.folio}`
      : `${origin}/seguimiento/${data.plate}`,
    M, boxY + 24, { width: W, align: "center" }
  );
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(
    kind === "presupuesto"
      ? `Folio: ${data.folio}      Código de acceso: ${data.tracking_code}`
      : `Placa: ${data.plate}      Código de acceso: ${data.tracking_code}`,
    M, boxY + 40, { width: W, align: "center" }
  );
  doc.y = boxY + 74;

  /* Condiciones */
  doc.moveDown(0.6);
  ensure(30);
  doc.font("Helvetica").fontSize(7.5).fillColor(FAINT).text(
    kind === "informe"
      ? "Revisa tu vehículo al recibirlo. Cualquier observación sobre el trabajo realizado debe reportarse al taller dentro de las 48 horas siguientes a la entrega."
      : "Esta cotización es informativa y puede ajustarse tras el diagnóstico. El taller no se hace responsable por objetos de valor no declarados al momento de la recepción.",
    M, doc.y, { width: W, align: "center" }
  );

  /* Pie de página con numeración */
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Sin esto, escribir bajo el margen inferior dispara un addPage automático.
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(7.5).fillColor(FAINT).text(
      `${brand.name} · ${title.charAt(0) + title.slice(1).toLowerCase()} ${data.folio} · Página ${i + 1} de ${range.count}`,
      M,
      PAGE_H - 42,
      { width: W, align: "center", lineBreak: false }
    );
  }

  doc.end();
  return done;
}
