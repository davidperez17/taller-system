"use client";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function subscribeToPush(plate: string): Promise<boolean> {
  const reg = await registerSW();
  if (!reg || !("PushManager" in window)) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return false;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    }));
  const res = await fetch("/api/public/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plate, subscription: sub.toJSON() }),
  });
  return res.ok;
}

export type SavedVehicle = { plate: string; label: string; code?: string };

const KEY = "sm96_vehicles";

export function getSavedVehicles(): SavedVehicle[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveVehicle(v: SavedVehicle) {
  const list = getSavedVehicles().filter((x) => x.plate !== v.plate);
  list.unshift(v);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10)));
}

export function removeVehicle(plate: string) {
  localStorage.setItem(KEY, JSON.stringify(getSavedVehicles().filter((x) => x.plate !== plate)));
}
