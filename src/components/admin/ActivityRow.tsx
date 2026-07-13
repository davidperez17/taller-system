import Link from "next/link";
import {
  ClipboardList, Wrench, Ban, Wallet, CheckCircle2, XCircle, Bell, Pencil,
} from "lucide-react";
import {
  activityMeta, ACTIVITY_TONE_CLASS, type ActivityItem,
} from "@/lib/activity-meta";

const ICONS: Record<string, typeof Bell> = {
  clipboard: ClipboardList,
  wrench: Wrench,
  ban: Ban,
  wallet: Wallet,
  check: CheckCircle2,
  x: XCircle,
  bell: Bell,
  pencil: Pencil,
};

// Fila de actividad reutilizable (dot de color + icono + título + autor·tiempo).
// Presentacional y sin hooks: sirve en server y client. El caller decide el
// texto de tiempo (relativo o absoluto) y el padding.
export default function ActivityRow({
  item,
  timeLabel,
  showType = false,
  className = "px-4 lg:px-5 py-3.5",
}: {
  item: ActivityItem;
  timeLabel: string;
  showType?: boolean;
  className?: string;
}) {
  const meta = activityMeta(item.type);
  const Icon = ICONS[meta.icon] ?? Bell;

  const inner = (
    <>
      <span
        className={`rounded-xl p-2 h-fit shrink-0 ${ACTIVITY_TONE_CLASS[meta.tone]}`}
        aria-hidden="true"
      >
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-800">{item.title}</p>
          {showType && (
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {meta.label}
            </span>
          )}
        </div>
        {item.detail && <p className="text-sm text-slate-500 mt-0.5">{item.detail}</p>}
        <p className="text-xs text-slate-400 mt-1">
          {item.actor_name ?? "Sistema"} · {timeLabel}
        </p>
      </div>
    </>
  );

  const base = `flex gap-3 ${className}`;
  return item.url ? (
    <Link href={item.url} className={`${base} hover:bg-slate-50 transition-colors`}>
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}
