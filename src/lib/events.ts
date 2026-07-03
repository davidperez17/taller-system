// Emisor en memoria para actualizaciones en vivo (SSE) por placa.
type Listener = (data: string) => void;

const globalForEvents = globalThis as unknown as {
  __listeners?: Map<string, Set<Listener>>;
};

function listeners(): Map<string, Set<Listener>> {
  if (!globalForEvents.__listeners) globalForEvents.__listeners = new Map();
  return globalForEvents.__listeners;
}

export function subscribePlate(plate: string, fn: Listener): () => void {
  const map = listeners();
  if (!map.has(plate)) map.set(plate, new Set());
  map.get(plate)!.add(fn);
  return () => {
    map.get(plate)?.delete(fn);
    if (map.get(plate)?.size === 0) map.delete(plate);
  };
}

export function emitPlateUpdate(plate: string) {
  const set = listeners().get(plate);
  if (!set) return;
  const data = JSON.stringify({ type: "update", at: Date.now() });
  for (const fn of set) {
    try {
      fn(data);
    } catch {
      /* listener cerrado */
    }
  }
}
