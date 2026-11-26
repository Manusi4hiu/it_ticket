/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />

import type { WorkboxPlugin } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, NetworkOnly } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

const API_CACHE_NAMES = ["api-tickets-sw", "api-users-sw"] as const;
const LEGACY_PAGES_CACHE = "pages-cache";

const getScopePath = () => {
  try {
    return new URL(self.registration.scope).pathname.replace(/\/?$/, "/");
  } catch {
    return "/";
  }
};

const resolveNotificationUrl = (rawUrl?: string): string => {
  const scopePath = getScopePath();
  if (!rawUrl || !rawUrl.trim()) {
    return new URL(`${scopePath}dashboard`, self.location.origin).href;
  }
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  // Strip legacy hardcoded production prefix when running under a different scope (e.g. dev root '/')
  const cleaned = trimmed.startsWith("/it_ticket/frontend/") && scopePath !== "/it_ticket/frontend/"
    ? trimmed.slice("/it_ticket/frontend/".length)
    : trimmed;
  if (cleaned.startsWith(scopePath)) {
    return new URL(cleaned, self.location.origin).href;
  }
  const relative = cleaned.replace(/^\/+/, "");
  return new URL(`${scopePath}${relative}`, self.location.origin).href;
};

// Only persist valid 200 OK API payloads so 401/403/500 responses are never cached.
const cacheOkOnlyPlugin: WorkboxPlugin = {
  cacheWillUpdate: async ({ response }) => (response && response.status === 200 ? response : null),
};

async function clearSessionCaches(): Promise<void> {
  await Promise.all([
    ...API_CACHE_NAMES.map((name) => caches.delete(name)),
    caches.delete(LEGACY_PAGES_CACHE),
  ]);
}

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// Purge legacy SSR page caches left by earlier SW versions on activation.
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(caches.delete(LEGACY_PAGES_CACHE));
});

// Allow Update Prompt and Logout cleanup to message the active Service Worker.
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
  if (event.data?.type === "CLEAR_API_CACHES") {
    event.waitUntil(clearSessionCaches());
  }
});

// ── Navigation requests: NEVER cache authenticated SSR HTML (contains session/token) ──
const navigationStrategy = new NetworkOnly();

registerRoute(
  ({ request }: { request: Request }) => request.mode === "navigate",
  async (params) => {
    try {
      const response = await navigationStrategy.handle(params);
      if (response) return response;
    } catch {
      // Offline or unreachable — fall back to static offline shell
    }
    const offlineUrl = `${getScopePath()}offline.html`;
    const cachedOffline = await caches.match(offlineUrl);
    return cachedOffline || Response.error();
  },
);

// ── Runtime cache: live web app first (NetworkFirst), offline read fallback ──────────
registerRoute(
  ({ url, request }: { url: URL; request: Request }) =>
    url.pathname.startsWith("/api/tickets") && request.method === "GET",
  new NetworkFirst({
    cacheName: "api-tickets-sw",
    networkTimeoutSeconds: 6,
    plugins: [cacheOkOnlyPlugin],
  }),
);

registerRoute(
  ({ url, request }: { url: URL; request: Request }) =>
    url.pathname.startsWith("/api/users") && request.method === "GET",
  new NetworkFirst({
    cacheName: "api-users-sw",
    networkTimeoutSeconds: 6,
    plugins: [cacheOkOnlyPlugin],
  }),
);

registerRoute(
  ({ url }: { url: URL; request: Request }) => url.pathname.startsWith("/api/auth"),
  new NetworkOnly(),
);

registerRoute(
  ({ url }: { url: URL; request: Request }) => url.pathname.startsWith("/api/notifications"),
  new NetworkOnly(),
);

// React Router v7 client navigation data requests — never cache authenticated session data across users
registerRoute(
  ({ url }: { url: URL; request: Request }) => url.pathname.endsWith(".data"),
  new NetworkOnly(),
);

// ── Push notifications ───────────────────────────────────────────────────────────────
self.addEventListener("push", (event: PushEvent) => {
  const scopePath = getScopePath();
  let payload: {
    title: string;
    body: string;
    type?: string;
    tag?: string;
    url?: string;
  } = {
    title: "IT Aero",
    body: "New notification",
    tag: "it-aero",
    url: `${scopePath}dashboard`,
  };
  try {
    payload = { ...payload, ...(event.data?.json() ?? {}) };
  } catch {
    const rawText = event.data?.text();
    if (rawText) payload.body = rawText;
  }
  const targetUrl = resolveNotificationUrl(payload.url);
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: `${scopePath}icon-192.png`,
      badge: `${scopePath}icon-192.png`,
      tag: payload.tag || "it-aero",
      renotify: Boolean(payload.tag),
      requireInteraction: payload.type === "sla_breached",
      data: { url: targetUrl },
    } as NotificationOptions),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = resolveNotificationUrl((event.notification.data as { url?: string })?.url);
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList: readonly WindowClient[]) => {
        const win = clientList.find((w) => {
          try {
            return new URL(w.url).origin === self.location.origin;
          } catch {
            return w.url.includes(self.location.origin);
          }
        });
        if (win) {
          return win
            .focus()
            .then(() => (typeof win.navigate === "function" ? win.navigate(targetUrl) : self.clients.openWindow(targetUrl)))
            .catch(() => self.clients.openWindow(targetUrl));
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
