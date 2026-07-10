"use client";

import { Printer } from "lucide-react";
import { btnPrimary } from "@/components/admin/ui";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className={btnPrimary}>
      <Printer className="w-4 h-4" aria-hidden="true" /> Imprimir
    </button>
  );
}
