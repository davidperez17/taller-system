"use client";

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import type { PublicAnnouncement, AnnouncementTone } from "@/lib/announcements";

const STORE_KEY = "sm96_novedades_vistas";

const TONE: Record<AnnouncementTone, { wrap: string; icon: string }> = {
  info: { wrap: "bg-primary-50 border-primary-100", icon: "text-primary-600" },
  promo: { wrap: "bg-accent-50 border-accent-200", icon: "text-accent-700" },
  aviso: { wrap: "bg-amber-50 border-amber-200", icon: "text-amber-600" },
};

// Banner de novedades del taller en la app del cliente. Cada aviso se puede
// descartar; los descartados se recuerdan en el dispositivo (localStorage) para
// no repetirlos. No usa red: las novedades llegan como prop del servidor.
export default function Novedades({ items }: { items: PublicAnnouncement[] }) {
  const [dismissed, setDismissed] = useState<number[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setDismissed(JSON.parse(raw));
    } catch {
      /* localStorage no disponible: se muestran todas */
    }
  }, []);

  function dismiss(id: number) {
    setDismissed((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {
        /* ignorar */
      }
      return next;
    });
  }

  const visible = items.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <section aria-label="Novedades del taller" className="space-y-2 animate-slide-up">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 px-1">
        <Megaphone className="w-4 h-4" aria-hidden="true" /> Novedades del taller
      </h2>
      {visible.map((a) => {
        const tone = TONE[a.tone] ?? TONE.info;
        return (
          <div
            key={a.id}
            className={`relative rounded-2xl border p-4 pr-10 shadow-sm ${tone.wrap}`}
          >
            <button
              type="button"
              onClick={() => dismiss(a.id)}
              aria-label="Descartar novedad"
              className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            <div className="flex gap-3">
              <Megaphone className={`w-5 h-5 shrink-0 mt-0.5 ${tone.icon}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{a.title}</p>
                <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-wrap">{a.body}</p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
