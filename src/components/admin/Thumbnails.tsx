// Miniaturas de un array JSON de URLs de Vercel Blob (photo_urls). Se usa en las
// fotos de anotaciones y de reclamos. Tolerante a JSON corrupto: no revienta el
// render, solo no muestra nada.
export default function Thumbnails({ raw, alt = "Foto" }: { raw: string | null; alt?: string }) {
  if (!raw) return null;
  let urls: string[] = [];
  try {
    urls = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(urls) || urls.length === 0) return null;
  return (
    <div className="mt-2 flex gap-2 flex-wrap">
      {urls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noopener">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            loading="lazy"
            className="w-20 h-20 object-cover rounded-lg border border-slate-200 hover:opacity-90 transition-opacity"
          />
        </a>
      ))}
    </div>
  );
}
