import { Car, Bike, Truck, Wrench } from "lucide-react";
import { STATUS_META, type OrderStatus } from "@/lib/status";

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as OrderStatus];
  if (!meta) return null;
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-primary-100 text-primary-700",
    amber: "bg-amber-100 text-amber-800",
    violet: "bg-violet-100 text-violet-700",
    green: "bg-accent-100 text-accent-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[meta.color]}`}
    >
      {meta.label}
    </span>
  );
}

export function VehicleTypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? "w-5 h-5";
  switch (type) {
    case "moto":
      return <Bike className={cls} aria-label="Moto" />;
    case "camion":
      return <Truck className={cls} aria-label="Camión" />;
    case "otro":
      return <Wrench className={cls} aria-label="Otro vehículo" />;
    default:
      return <Car className={cls} aria-label="Auto" />;
  }
}

export function PlateBadge({ plate }: { plate: string }) {
  return (
    <span className="plate-badge inline-block bg-slate-100 border border-slate-300 rounded-md px-2 py-0.5 text-sm text-slate-800">
      {plate}
    </span>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 className="font-heading text-2xl lg:text-3xl font-bold text-slate-900 tracking-wide">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export const inputCls =
  "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500";
export const labelCls = "block text-sm font-medium text-slate-700 mb-1";
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500 active:bg-primary-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer";
export const card = "bg-white rounded-2xl border border-slate-200 shadow-sm";
