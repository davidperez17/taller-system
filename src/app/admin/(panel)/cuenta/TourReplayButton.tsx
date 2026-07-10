"use client";

import { PlayCircle } from "lucide-react";
import { btnSecondary } from "@/components/admin/ui";
import { TOUR_EVENT } from "@/components/admin/AdminTour";

export default function TourReplayButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}
      className={`${btnSecondary} mt-3`}
    >
      <PlayCircle className="w-4 h-4" aria-hidden="true" />
      Ver tutorial de nuevo
    </button>
  );
}
