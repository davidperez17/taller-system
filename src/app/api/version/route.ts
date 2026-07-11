// Devuelve el id del build en curso (SHA del commit desplegado en Vercel). El
// cliente lo compara contra el NEXT_PUBLIC_BUILD_ID con el que se cargó; si
// difiere, hubo un deploy nuevo y muestra el pop de actualización.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { build: process.env.VERCEL_GIT_COMMIT_SHA || "dev" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
