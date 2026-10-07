/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />

import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, NetworkOnly } from "workbox-strategies";

// Precache build assets (app shell)
declare const self: ServiceWorkerGlobalScope;
precacheAndRoute(self.__WB_MANIFEST || []);

// ── Runtime cache: offline read ──────────────────────────────────────────────
registerRoute(
  ({ url, request }: { url: URL; request: Request }) =>
    url.pathname.startsWith("/api/tickets") && request.method === "GET",
  new StaleWhileRevalidate({ cacheName: "api-tickets-sw" }),
);
registerRoute(
  ({ url, request }: { url: URL; request: Request }) =>
    url.pathname.startsWith("/api/users") && request.method === "GET",
  new StaleWhileRevalidate({ cacheName: "api-users-sw" }),
);
registerRoute(
  ({ url }: { url: URL; request: Request }) => url.pathname.startsWith("/api/auth"),
  new NetworkOnly(),
);
registerRoute(
  ({ url }: { url: URL; request: Request }) => url.pathname.startsWith("/api/notifications"),
  new NetworkOnly(),
);

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (event: PushEvent) => {
  let payload: {
    title: string;
    body: string;
    tag?: string;
    url?: string;
  } = { title: "IT Aero", body: "New notification", tag: "it-aero", url: "/it_ticket/frontend/dashboard" };
  try {
    payload = event.data?.json() ?? payload;
  } catch {
    // keep defaults
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/it_ticket/frontend/icon-192.png",
      badge: "/it_ticket/frontend/icon-192.png",
      tag: payload.tag || "it-aero",
      data: { url: payload.url || "/it_ticket/frontend/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url || "/it_ticket/frontend/dashboard";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList: readonly WindowClient[]) => {
        const win = clientList.find((w) => w.url.includes("it_ticket"));
        if (win) {
          win.focus();
          return win.navigate?.(url) ?? Promise.resolve();
        }
        return self.clients.openWindow(url);
      }),
  );
});
