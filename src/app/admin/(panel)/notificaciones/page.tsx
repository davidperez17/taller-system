import { many } from "@/lib/db";
import { PageTitle, card } from "@/components/admin/ui";
import NotifTester from "@/components/admin/NotifTester";
import AdminPushToggle from "@/components/admin/AdminPushToggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notificaciones" };

export default async function NotificationsPage() {
  const subPlates = await many<{ plate: string; n: number }>(
    `SELECT plate, COUNT(*)::int AS n FROM push_subs GROUP BY plate ORDER BY n DESC, plate LIMIT 50`
  );

  return (
    <div className="space-y-5">
      <PageTitle
        title="NOTIFICACIONES"
        subtitle="Avisos del panel para el equipo y probador de avisos al cliente"
      />
      <section className={`${card} p-5`}>
        <h2 className="font-heading font-semibold text-slate-800 tracking-wide">
          AVISOS DEL PANEL EN ESTE DISPOSITIVO
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Recibe push cuando entra una orden nueva, el cliente responde un presupuesto,
          una orden queda lista o un repuesto baja del mínimo.
        </p>
        <div className="mt-3">
          <AdminPushToggle />
        </div>
      </section>
      <NotifTester subPlates={subPlates} />
    </div>
  );
}
