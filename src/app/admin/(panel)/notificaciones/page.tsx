import { many } from "@/lib/db";
import { PageTitle } from "@/components/admin/ui";
import NotifTester from "@/components/admin/NotifTester";

export const dynamic = "force-dynamic";
export const metadata = { title: "Probador de notificaciones" };

export default async function NotificationsPage() {
  const subPlates = await many<{ plate: string; n: number }>(
    `SELECT plate, COUNT(*)::int AS n FROM push_subs GROUP BY plate ORDER BY n DESC, plate LIMIT 50`
  );

  return (
    <div className="space-y-5">
      <PageTitle
        title="PROBADOR DE NOTIFICACIONES"
        subtitle="Muestra cómo se ven los avisos, para el cliente y en el panel"
      />
      <NotifTester subPlates={subPlates} />
    </div>
  );
}
