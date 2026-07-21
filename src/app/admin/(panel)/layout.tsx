import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { getNotifCenter } from "@/lib/activity";
import { FOLLOWUP_DUE_SQL } from "@/lib/quotes";
import AdminNav from "@/components/admin/AdminNav";
import AdminTour from "@/components/admin/AdminTour";
import UpdatePrompt from "@/components/UpdatePrompt";

export const metadata = { title: "Panel del taller" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  const lowStock = (await one<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM parts WHERE active = 1 AND min_stock > 0 AND stock <= min_stock`
  ))?.n ?? 0;
  const dueReminders = (await one<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM service_reminders
     WHERE done = 0 AND substr(due_date, 1, 10) <= to_char(now(), 'YYYY-MM-DD')`
  ))?.n ?? 0;
  // Cotizaciones en el aire. El mecánico no ve el apartado Presupuestos, así
  // que tampoco se paga el COUNT en cada carga de su panel.
  const staleQuotes =
    user.role === "mecanico"
      ? 0
      : ((
          await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM quotes q WHERE ${FOLLOWUP_DUE_SQL}`)
        )?.n ?? 0);
  // Reclamos abiertos/en proceso. El mecánico no ve el apartado, así que tampoco
  // se paga el COUNT en su panel.
  const openClaims =
    user.role === "mecanico"
      ? 0
      : ((
          await one<{ n: number }>(
            `SELECT COUNT(*)::int AS n FROM claims WHERE status IN ('abierto','en_proceso')`
          )
        )?.n ?? 0);
  const notif = await getNotifCenter(user.id);

  return (
    <div className="min-h-dvh bg-sm-bg lg:flex">
      <AdminNav
        user={user}
        alerts={{
          inventario: lowStock,
          recordatorios: dueReminders,
          presupuestos: staleQuotes,
          reclamos: openClaims,
        }}
        notif={notif}
      />
      <main className="flex-1 min-w-0 overflow-x-clip pb-20 lg:pb-6">
        <div className="max-w-6xl mx-auto px-4 pt-5 lg:px-8 lg:pt-8">{children}</div>
      </main>
      <AdminTour autoStart={!user.tour_done_at} role={user.role} />
      <UpdatePrompt />
    </div>
  );
}
