import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { many } from "@/lib/db";
import { PageTitle, btnSecondary } from "@/components/admin/ui";
import NewOrderForm from "@/components/admin/NewOrderForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nueva orden" };

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ vehiculo?: string }>;
}) {
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
        title="NUEVA ORDEN DE TRABAJO"
        subtitle="Registra el ingreso de un vehículo al taller"
        action={
          <Link href="/admin/ordenes" className={btnSecondary}>
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver
          </Link>
        }
      />

      <NewOrderForm vehicles={vehicles} clients={clients} preselect={vehiculo ?? ""} />
    </div>
  );
}
