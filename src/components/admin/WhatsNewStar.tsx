"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Star, X, Sparkles } from "lucide-react";
import { CHANGELOG, LATEST_CHANGELOG_ID } from "@/lib/changelog";

const KEY = "sm96_whatsnew_seen";
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmt(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

// Estrella junto a la campana: historial de mejoras del panel ("novedades").
// El indicador cuenta las entradas con id mayor al último visto, guardado por
// dispositivo en localStorage. Al abrir marca todo como visto.
export default function WhatsNewStar({ placement }: { placement: "bar" | "sidebar" }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [seenId, setSeenId] = useState<number | null>(null); // null hasta montar (evita mismatch)

  useEffect(() => {
    setMounted(true);
    const raw = Number(localStorage.getItem(KEY));
    setSeenId(Number.isFinite(raw) ? raw : 0);
  }, []);

  const unseen = seenId === null ? 0 : CHANGELOG.filter((e) => e.id > seenId).length;

  function openPanel() {
    setOpen(true);
    if (seenId !== LATEST_CHANGELOG_ID) {
      setSeenId(LATEST_CHANGELOG_ID);
      try {
        localStorage.setItem(KEY, String(LATEST_CHANGELOG_ID));
      } catch {
        /* modo privado: el badge vuelve, no es crítico */
      }
    }
  }

  const panelPos =
    placement === "bar"
      ? "inset-x-0 bottom-0 max-h-[80dvh] rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
      : "top-16 left-[17rem] w-[22rem] max-h-[70vh] rounded-2xl";

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label={`Novedades de la app${unseen > 0 ? ` (${unseen} sin ver)` : ""}`}
        className="relative p-2 rounded-lg text-primary-100 hover:bg-primary-900 hover:text-white transition-colors cursor-pointer"
      >
        <Star className="w-5 h-5" aria-hidden="true" />
        {unseen > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-amber-400 text-primary-950 text-[10px] font-bold tabular-nums">
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label="Novedades de la app"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/30"
          />
          <div className={`absolute bg-white shadow-2xl border border-slate-200 flex flex-col ${panelPos}`}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
              <h2 className="font-heading font-semibold text-slate-800 tracking-wide flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" aria-hidden="true" /> NOVEDADES DE LA APP
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0">
              <ul className="divide-y divide-slate-50">
                {CHANGELOG.map((e) => (
                  <li key={e.id} className="flex gap-3 px-4 py-3.5">
                    <span
                      className="rounded-xl p-2 h-fit shrink-0 bg-amber-100 text-amber-700"
                      aria-hidden="true"
                    >
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">{e.title}</p>
                        <span className="text-xs text-slate-400 shrink-0 mt-0.5">{fmt(e.date)}</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{e.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
