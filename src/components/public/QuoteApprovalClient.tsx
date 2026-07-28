"use client";

import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/status";
import { waAdvisorLink } from "@/lib/whatsapp";
import ApprovalDecision, { type Decision } from "./ApprovalDecision";

// Aprobar/rechazar un presupuesto pre-orden. La UI de la decisión vive en
// ApprovalDecision (compartida con el seguimiento); aquí basta router.refresh():
// el server component re-renderiza al estado decidido (aprobado muestra el
// enlace de seguimiento).
export default function QuoteApprovalClient({
  folio,
  code,
  total,
  expired = false,
}: {
  folio: string;
  code: string;
  total: number;
  expired?: boolean;
}) {
  const router = useRouter();

  async function decide(decision: Decision): Promise<string | null> {
    try {
      const res = await fetch(`/api/public/presupuesto/${folio}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, decision }),
      });
      if (res.ok) {
        router.refresh();
        return null;
      }
      const json = await res.json().catch(() => ({}));
      return json.error || "No se pudo enviar tu respuesta. Intenta de nuevo.";
    } catch {
      return "Sin conexión. Intenta de nuevo.";
    }
  }

  return (
    <ApprovalDecision
      total={total}
      question={`¿Autorizas este trabajo por ${formatMoney(total)}?`}
      hint={
        expired
          ? "Este presupuesto ya venció: si lo apruebas, el taller confirmará contigo si el precio sigue vigente antes de empezar."
          : "Al aprobar, el taller abre tu orden de trabajo y te comparte un enlace para seguir la reparación en vivo."
      }
      rejectWarning="el taller no abrirá la orden de trabajo y se pondrá en contacto contigo para acordar cómo seguir."
      advisorHref={waAdvisorLink(`el presupuesto ${folio}`, total)}
      onDecide={decide}
    />
  );
}
