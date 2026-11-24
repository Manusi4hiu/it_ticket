/** Reload prompt for PWA updates — shows a toast when a new SW version is ready. */

import { toast } from "sonner";

let updateToastShown = false;

function showUpdateToast(waitingWorker: ServiceWorker | null) {
  if (updateToastShown) return;
  updateToastShown = true;

  toast.info("Update tersedia", {
    description: "Versi terbaru IT Aero Support siap digunakan.",
    action: {
      label: "Muat Ulang",
      onClick: () => {
        if (waitingWorker) {
          waitingWorker.postMessage({ type: "SKIP_WAITING" });
        } else {
          window.location.reload();
        }
      },
    },
    duration: Infinity,
  });
}

export function setupPWAUpdatePrompt() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.getRegistration().then((reg) => {
    if (!reg) return;

    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdateToast(reg.waiting);
    }

    reg.addEventListener("updatefound", () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateToast(reg.waiting || installing);
        }
      });
    });
  }).catch(() => {});

  // Periodic check for SW updates — every hour
  setInterval(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.update();
  }, 60 * 60 * 1000);
}
