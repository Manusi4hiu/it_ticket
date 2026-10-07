/** Web Push subscription client — subscribe/unsubscribe via PushManager. */

import { urlBase64ToUint8Array } from "~/utils/vapid";
import { apiRequest } from "./api.service";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime: number | null;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function subscribePush(): Promise<boolean> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return false;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  const subJson = sub.toJSON();
  const payload: PushSubscriptionJSON = {
    endpoint: sub.endpoint,
    keys: subJson.keys as { p256dh: string; auth: string },
    expirationTime: sub.expirationTime,
  };

  await apiRequest("/notifications/subscribe", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return true;
}

export async function unsubscribePush(): Promise<void> {
  if (!isPushSupported()) return;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
    await apiRequest("/notifications/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  }
}
