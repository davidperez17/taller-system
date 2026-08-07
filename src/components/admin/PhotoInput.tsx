"use client";

import { useRef, useState } from "react";
import { Camera, X, AlertTriangle } from "lucide-react";
import {
  MAX_PHOTOS,
  MAX_PHOTOS_TOTAL_BYTES,
  photoRejectReason,
} from "@/lib/photos";

const MAX_EDGE = 1600; // px — reescala en el cliente para ahorrar datos móviles

async function downscale(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // formato no soportado por canvas (HEIC): se revisa abajo
  }
}

// Selector de fotos para anotaciones: cámara o galería, con miniaturas y
// reescalado client-side. Mantiene los File procesados en un input oculto
// para que viajen con el submit del formulario padre (server action).
export default function PhotoInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<{ url: string; name: string }[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setBusy(true);
    try {
      const processed = await Promise.all(picked.slice(0, MAX_PHOTOS).map(downscale));

      // Se filtra con las mismas reglas del servidor y se dice qué quedó fuera.
      // El caso típico: HEIC de iPhone que el canvas no pudo convertir.
      const accepted: File[] = [];
      const notes: string[] = [];
      let totalBytes = 0;
      for (const file of processed) {
        const reason = photoRejectReason(file);
        if (reason) {
          notes.push(`${file.name} (${reason})`);
          continue;
        }
        if (totalBytes + file.size > MAX_PHOTOS_TOTAL_BYTES) {
          notes.push(`${file.name} (el envío junto supera 7 MB)`);
          continue;
        }
        totalBytes += file.size;
        accepted.push(file);
      }
      if (picked.length > MAX_PHOTOS) {
        notes.push(`solo se toman las primeras ${MAX_PHOTOS} de ${picked.length}`);
      }

      const dt = new DataTransfer();
      accepted.forEach((f) => dt.items.add(f));
      if (inputRef.current) inputRef.current.files = dt.files;
      previews.forEach((p) => URL.revokeObjectURL(p.url));
      setPreviews(accepted.map((f) => ({ url: URL.createObjectURL(f), name: f.name })));
      setRejected(notes);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setPreviews([]);
    setRejected([]);
  }

  return (
    <div>
      {/* input real que viaja con el form */}
      <input ref={inputRef} type="file" name="photos" multiple hidden aria-hidden="true" tabIndex={-1} />
      {/* selector visible (no se envía: name vacío) */}
      <input
        ref={pickerRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={onPick}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => pickerRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-sm-red hover:text-sm-red-hover transition-colors cursor-pointer disabled:opacity-50"
        >
          <Camera className="w-4 h-4" aria-hidden="true" />
          {busy ? "Procesando…" : previews.length > 0 ? "Cambiar fotos" : "Agregar fotos"}
        </button>
        {(previews.length > 0 || rejected.length > 0) && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" /> Quitar
          </button>
        )}
        <span className="text-xs text-slate-500">Máx. {MAX_PHOTOS} · se comprimen antes de subir</span>
      </div>
      {rejected.length > 0 && (
        <div
          role="status"
          className="mt-2 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
          <div>
            <p className="font-medium">
              {previews.length > 0
                ? "Estas fotos no se van a subir:"
                : "Ninguna foto se va a subir:"}
            </p>
            <ul className="mt-0.5 space-y-0.5">
              {rejected.map((note) => (
                <li key={note}>· {note}</li>
              ))}
            </ul>
            <p className="mt-1">Tómalas con la cámara desde aquí o guárdalas como JPG.</p>
          </div>
        </div>
      )}
      {previews.length > 0 && (
        <div className="mt-2 flex gap-2 flex-wrap">
          {previews.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.url}
              src={p.url}
              alt={p.name}
              className="w-16 h-16 object-cover rounded-lg border border-slate-200"
            />
          ))}
        </div>
      )}
    </div>
  );
}
