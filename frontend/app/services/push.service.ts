/** Web Push subscription client — subscribe/unsubscribe/sync via PushManager. */

import { urlBase64ToUint8Array } from "~/utils/vapid";
import { apiRequest, getAuthToken, notificationsApi } from "./api.service";

const ENV_VAPID_PUBLIC_KEY = ((import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || "").trim();
const SESSION_CACHE_NAMES = ["api-tickets-sw", "api-users-sw", "pages-cache"] as const;

let cachedVapidPublicKey: string | null = ENV_VAPID_PUBLIC_KEY || null;

interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime: number | null;
}

export interface SubscribePushResult {
  ok: boolean;
  reason?: "unsupported" | "missing_vapid" | "permission_denied" | "sw_unavailable" | "api_error" | "error";
  message?: string;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/** Resolve active VAPID public key from Vite env or backend fallback endpoint. */
export async function resolveVapidPublicKey(): Promise<string | null> {
  if (cachedVapidPublicKey) return cachedVapidPublicKey;
  if (typeof window === "undefined") return null;
  const res = await notificationsApi.getVapidPublicKey();
  const key = res.data?.publicKey?.trim();
  if (res.success && key) {
    cachedVapidPublicKey = key;
    return key;
  }
  return null;
}

/** Wait for an active Service Worker registration with a bounded timeout so mobile doesn't hang. */
async function getReadyRegistration(timeoutMs: number = 4000): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (!existing) return null;
    if (existing.active) return existing;
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch {
    return null;
  }
}

async function postSubscriptionToBackend(
  sub: PushSubscription,
  tokenOverride?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const subJson = sub.toJSON();
  const keys = subJson.keys as { p256dh?: string; auth?: string } | undefined;
  if (!keys?.p256dh || !keys?.auth) {
    return { success: false, error: "Browser did not return valid push encryption keys." };
  }
  const payload: PushSubscriptionJSON = {
    endpoint: sub.endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    expirationTime: sub.expirationTime,
  };
  return apiRequest("/notifications/subscribe", {
    method: "POST",
    token: tokenOverride,
    body: JSON.stringify(payload),
  });
}

export async function getPushStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
}> {
  if (!isPushSupported()) {
    return { supported: false, permission: "unsupported", subscribed: false };
  }
  const permission = typeof Notification !== "undefined" ? Notification.permission : "default";
  if (permission !== "granted") {
    return { supported: true, permission, subscribed: false };
  }
  const reg = await getReadyRegistration(2000);
  if (!reg) {
    return { supported: true, permission, subscribed: false };
  }
  const sub = await reg.pushManager.getSubscription().catch(() => null);
  return { supported: true, permission, subscribed: Boolean(sub) };
}

/** If notification permission is already granted, ensure this device is subscribed on the backend. */
export async function syncExistingPushSubscription(): Promise<boolean> {
  if (!isPushSupported() || typeof Notification === "undefined" || Notification.permission !== "granted") {
    return false;
  }
  if (!getAuthToken()) return false;

  const reg = await getReadyRegistration();
  if (!reg) return false;

  const vapidKey = await resolveVapidPublicKey();
  if (!vapidKey) return false;

  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
    }
    const res = await postSubscriptionToBackend(sub);
    return res.success;
  } catch {
    return false;
  }
}

export async function subscribePushDetailed(): Promise<SubscribePushResult> {
  if (!isPushSupported()) {
    return { ok: false, reason: "unsupported", message: "Browser atau mode ini belum mendukung Web Push." };
  }

  const vapidKey = await resolveVapidPublicKey();
  if (!vapidKey) {
    return { ok: false, reason: "missing_vapid", message: "VAPID public key belum terkonfigurasi di server." };
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      return {
        ok: false,
        reason: "permission_denied",
        message: "Izin notifikasi ditolak browser. Aktifkan izin notifikasi di pengaturan situs.",
      };
    }

    const reg = await getReadyRegistration();
    if (!reg) {
      return {
        ok: false,
        reason: "sw_unavailable",
        message: "Service Worker belum siap. Muat ulang halaman lalu coba lagi.",
      };
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
    }

    const res = await postSubscriptionToBackend(sub);
    if (!res.success) {
      return {
        ok: false,
        reason: "api_error",
        message: res.error || "Gagal menyimpan subscription ke server.",
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : "Terjadi kesalahan saat mengaktifkan notifikasi.",
    };
  }
}

export async function subscribePush(): Promise<boolean> {
  const result = await subscribePushDetailed();
  return result.ok;
}

export async function unsubscribePush(authTokenSnapshot?: string | null): Promise<void> {
  if (!isPushSupported()) return;

  const token = authTokenSnapshot ?? getAuthToken();
  const reg = await getReadyRegistration(1500);
  if (!reg) return;

  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    await apiRequest("/notifications/unsubscribe", {
      method: "POST",
      token,
      body: JSON.stringify({ endpoint }),
    });
  }
}

/**
 * Best-effort client cleanup used by both manual logout and auto-idle logout:
 * unsubscribes Web Push (using a synchronous token snapshot so subsequent
 * clearAuthToken() calls don't drop the header) and purges SW session caches.
 */
export async function cleanupClientOnLogout(authTokenSnapshot?: string | null): Promise<void> {
  if (typeof window === "undefined") return;

  const token = authTokenSnapshot ?? getAuthToken();

  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "CLEAR_API_CACHES" });
  }
  if ("caches" in window) {
    void Promise.all(SESSION_CACHE_NAMES.map((name) => caches.delete(name))).catch(() => {});
  }

  await unsubscribePush(token).catch(() => {});
}
