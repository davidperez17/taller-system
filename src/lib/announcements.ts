import { many } from "./db";

export type AnnouncementTone = "info" | "promo" | "aviso";

// Lo que ve el cliente en la app de seguimiento (sin datos internos).
export type PublicAnnouncement = {
  id: number;
  title: string;
  body: string;
  tone: AnnouncementTone;
  created_at: string;
};

// Fila completa para la gestión en el panel.
export type Announcement = PublicAnnouncement & {
  active: number;
  starts_on: string | null;
  ends_on: string | null;
};

export const ANNOUNCEMENT_TONES: Record<AnnouncementTone, string> = {
  info: "Información",
  promo: "Promoción",
  aviso: "Aviso importante",
};

// Novedades activas y dentro de su ventana de vigencia (si la tienen), más
// recientes primero. Comparación por texto YYYY-MM-DD (orden lexicográfico).
export async function getActiveAnnouncements(): Promise<PublicAnnouncement[]> {
  try {
    return await many<PublicAnnouncement>(
      `SELECT id, title, body, tone, created_at FROM announcements
         WHERE active = 1
           AND (starts_on IS NULL OR starts_on <= to_char(now(),'YYYY-MM-DD'))
           AND (ends_on   IS NULL OR ends_on   >= to_char(now(),'YYYY-MM-DD'))
         ORDER BY created_at DESC, id DESC LIMIT 5`
    );
  } catch {
    return [];
  }
}
