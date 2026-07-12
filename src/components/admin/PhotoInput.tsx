"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";

const MAX_PHOTOS = 4;
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
    return file; // formato no soportado por canvas: se sube tal cual
  }
}

// Selector de fotos para anotaciones: cámara o galería, con miniaturas y
// reescalado client-side. Mantiene los File procesados en un input oculto
// para que viajen con el submit del formulario padre (server action).
export default function PhotoInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<{ url: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS);
    if (files.length === 0) return;
    setBusy(true);
    try {
      const processed = await Promise.all(files.map(downscale));
      const dt = new DataTransfer();
      processed.slice(0, MAX_PHOTOS).forEach((f) => dt.items.add(f));
      if (inputRef.current) inputRef.current.files = dt.files;
      previews.forEach((p) => URL.revokeObjectURL(p.url));
      setPreviews(processed.map((f) => ({ url: URL.createObjectURL(f), name: f.name })));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setPreviews([]);
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
        {previews.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" /> Quitar
          </button>
        )}
        <span className="text-xs text-slate-400">Máx. {MAX_PHOTOS} · se comprimen antes de subir</span>
      </div>
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
