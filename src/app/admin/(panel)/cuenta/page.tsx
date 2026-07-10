import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ROLES } from "@/lib/status";
import { PageTitle, card } from "@/components/admin/ui";
import PasswordForm from "./PasswordForm";
import TourReplayButton from "./TourReplayButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const me = await getSessionUser();
  if (!me) redirect("/admin/login");

  return (
    <div className="space-y-5">
      <PageTitle title="MI CUENTA" subtitle={`@${me.username} · ${ROLES[me.role]}`} />
      <section className={`${card} p-5`}>
        <h2 className="font-heading font-semibold text-slate-800 tracking-wide">
          CAMBIAR MI CONTRASEÑA
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Al cambiarla se cierran tus sesiones en otros dispositivos.
        </p>
        <PasswordForm />
      </section>
      <section className={`${card} p-5`}>
        <h2 className="font-heading font-semibold text-slate-800 tracking-wide">
          TUTORIAL DEL PANEL
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Repasa el recorrido por las secciones esenciales del panel.
        </p>
        <TourReplayButton />
      </section>
    </div>
  );
}
