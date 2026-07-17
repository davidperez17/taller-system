import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { many } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { PageTitle, btnSecondary } from "@/components/admin/ui";
import NewQuoteForm from "@/components/admin/NewQuoteForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nuevo presupuesto" };

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ vehiculo?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (user.role === "mecanico") redirect("/admin");

  const { vehiculo } = await searchParams;
  const vehicles = await many<{ id: number; plate: string; brand: string | null; model: string | null; client: string }>(
    `SELECT v.id, v.plate, v.brand, v.model, c.name AS client
       FROM vehicles v JOIN clients c ON c.id = v.client_id ORDER BY v.created_at DESC LIMIT 500`
  );
  const clients = await many<{ id: number; name: string }>(
    "SELECT id, name FROM clients ORDER BY name LIMIT 1000"
  );

  return (
    <div className="space-y-5 max-w-2xl">
      <PageTitle
        title="NUEVO PRESUPUESTO"
        subtitle="Cotiza sin abrir una orden; si el cliente aprueba, la orden se crea sola"
        action={
          <Link href="/admin/presupuestos" className={btnSecondary}>
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver
          </Link>
        }
      />

      <NewQuoteForm vehicles={vehicles} clients={clients} preselect={vehiculo ?? ""} />
    </div>
  );
}
