/** Reload prompt for PWA updates — shows a toast when new SW is waiting. */

import { toast } from "sonner";

export function setupPWAUpdatePrompt() {
  if (!("serviceWorker" in navigator)) return;

  // periodic check for SW updates — every hour
  setInterval(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) reg.update();
  }, 60 * 60 * 1000);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    toast.info("Update available", {
      description: "A new version is available.",
      action: {
        label: "Refresh",
        onClick: () => window.location.reload(),
      },
      duration: Infinity,
    });
  });
}
