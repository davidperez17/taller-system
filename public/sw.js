// Sube VERSION solo en actualizaciones que valga la pena anunciar: al cambiar
// los bytes de este archivo el navegador detecta un SW nuevo, que queda en
// espera (no llamamos skipWaiting aquí) hasta que el usuario toca "Aplicar"
// en el pop de la app. Ese botón envía SKIP_WAITING (ver listener de abajo).
const VERSION = "sm96-v5";
const CACHE = VERSION;
const OFFLINE_ASSETS = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  // Sin skipWaiting: el SW nuevo espera a que el usuario acepte la actualización.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_ASSETS)));
});

// La app pide activar la versión en espera cuando el usuario toca "Aplicar".
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero, caché como respaldo (solo GET de páginas/estáticos).
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.url.includes("/api/")) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && new URL(request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Multiservicios San Miguel 96", body: "Hay novedades de tu vehículo.", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch (e) {
    /* payload no JSON */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url },
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
