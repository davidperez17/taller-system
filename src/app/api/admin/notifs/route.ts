import { getSessionUser } from "@/lib/auth";
import { getNotifCenter } from "@/lib/activity";

// Centro de notificaciones del usuario en sesión, para que la campana refresque
// el conteo en vivo (polling) sin recargar la página. Auth por cookie de sesión;
// no está bajo /admin, así que el middleware no lo cubre y lo validamos aquí.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ unread: 0, items: [] }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const data = await getNotifCenter(user.id);
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
