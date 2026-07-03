import { NextRequest } from "next/server";
import { normalizePlate } from "@/lib/db";
import { subscribePlate } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ placa: string }> }
) {
  const { placa } = await params;
  const plate = normalizePlate(placa);
  const encoder = new TextEncoder();

  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          /* stream cerrado */
        }
      };
      send(JSON.stringify({ type: "connected" }));
      const unsubscribe = subscribePlate(plate, send);
      const ping = setInterval(() => send(JSON.stringify({ type: "ping" })), 25000);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
