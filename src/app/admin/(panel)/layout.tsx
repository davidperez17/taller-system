import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { one } from "@/lib/db";
import AdminNav from "@/components/admin/AdminNav";

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

  return (
    <div className="min-h-dvh bg-slate-100 lg:flex">
      <AdminNav user={user} alerts={{ inventario: lowStock, recordatorios: dueReminders }} />
      <main className="flex-1 min-w-0 pb-20 lg:pb-6">
        <div className="max-w-6xl mx-auto px-4 pt-5 lg:px-8 lg:pt-8">{children}</div>
      </main>
    </div>
  );
}
