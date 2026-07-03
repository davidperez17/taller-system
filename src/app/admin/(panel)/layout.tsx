import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";

export const metadata = { title: "Panel del taller" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  return (
    <div className="min-h-dvh bg-slate-100 lg:flex">
      <AdminNav user={user} />
      <main className="flex-1 min-w-0 pb-20 lg:pb-6">
        <div className="max-w-6xl mx-auto px-4 pt-5 lg:px-8 lg:pt-8">{children}</div>
      </main>
    </div>
  );
}
