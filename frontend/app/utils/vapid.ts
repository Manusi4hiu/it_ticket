/** VAPID public key → Uint8Array for PushManager.subscribe(). */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData.split("").map((c) => c.charCodeAt(0)));
}

// Self-check — fail early in dev if base64 decode is broken.
if (import.meta.env.DEV) {
  const test = "dGVzdA=="; // 'test'
  const decoded = urlBase64ToUint8Array(test);
  console.assert(
    decoded.length === 4 && decoded[0] === 116,
    "urlBase64ToUint8Array self-check failed",
  );
}
