import type { Metadata } from "next";
import { getTracking } from "@/lib/tracking";
import { getActiveAnnouncements } from "@/lib/announcements";
import TrackingClient from "@/components/public/TrackingClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ placa: string }>;
  searchParams: Promise<{ code?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { placa } = await params;
  return { title: `Seguimiento ${placa.toUpperCase()}` };
}

export default async function TrackingPage({ params, searchParams }: Props) {
  const { placa } = await params;
  const { code } = await searchParams;
  const [initial, announcements] = await Promise.all([
    getTracking(placa, code ?? null),
    getActiveAnnouncements(),
  ]);
  return (
    <TrackingClient initial={initial} initialCode={code ?? ""} announcements={announcements} />
  );
}
