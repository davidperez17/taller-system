// Reglas de las fotos, compartidas por el selector del asesor (PhotoInput) y la
// subida a Blob (uploadPhotos). En un solo lugar para que lo que el servidor
// descarta sea exactamente lo que el aviso del asesor anuncia: antes el
// servidor las tiraba en silencio y la anotación se guardaba sin fotos.
export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// El body de las server actions está topado en 8 MB (next.config.ts). Se avisa
// un poco antes para dejar aire al resto del formulario: pasarse no descarta
// una foto, revienta el envío completo y se perdería la anotación entera.
export const MAX_PHOTOS_TOTAL_BYTES = 7 * 1024 * 1024;

// Motivo por el que el servidor rechazaría la foto, o null si pasa. Redactado
// para leerse tal cual en el aviso: "IMG_1.HEIC (formato no soportado)".
export function photoRejectReason(file: { type: string; size: number }): string | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) return "formato no soportado";
  if (file.size > MAX_PHOTO_BYTES) return "pesa más de 4 MB";
  return null;
}
