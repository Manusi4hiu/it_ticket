import { useState, useEffect, useCallback } from "react";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

type Platform = "ios" | "android" | "desktop";

// Module-level store so `beforeinstallprompt` is captured once at app boot
// and shared across routes (Home, Login, Layout banner) without missing events.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listenersInitialized = false;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((fn) => fn());
}

/**
 * Registers global `beforeinstallprompt` and `appinstalled` listeners once in the browser.
 * Safe to call repeatedly or during SSR (no-op on server).
 */
export function captureInstallPrompt(): void {
  if (typeof window === "undefined" || listenersInitialized) return;
  listenersInitialized = true;

  window.addEventListener("beforeinstallprompt", (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifySubscribers();
  });
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const isIPadOS = /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || isIPadOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const displayStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  return iosStandalone || displayStandalone;
}

/**
 * Hook for PWA installation state, native Android/Chromium install prompting,
 * and platform-specific fallback guidance (iOS Safari / manual browser menu).
 */
export function usePWAInstall() {
  const [hasPrompt, setHasPrompt] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(false);
  const [isInsecureOrigin, setIsInsecureOrigin] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  useEffect(() => {
    captureInstallPrompt();

    const syncState = () => {
      setHasPrompt(deferredPrompt !== null);
      setIsStandalone(detectStandalone());
    };

    const detectedPlatform = detectPlatform();
    setPlatform(detectedPlatform);
    setIsMobileViewport(
      detectedPlatform !== "desktop" || window.matchMedia?.("(max-width: 860px)")?.matches === true,
    );
    setIsInsecureOrigin(
      window.location.protocol !== "https:" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1",
    );

    syncState();
    subscribers.add(syncState);

    const mediaQuery = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayModeChange = () => syncState();
    mediaQuery?.addEventListener?.("change", onDisplayModeChange);

    const viewportQuery = window.matchMedia?.("(max-width: 860px)");
    const onViewportChange = (e: MediaQueryListEvent) => {
      setIsMobileViewport(detectedPlatform !== "desktop" || e.matches);
    };
    viewportQuery?.addEventListener?.("change", onViewportChange);

    return () => {
      subscribers.delete(syncState);
      mediaQuery?.removeEventListener?.("change", onDisplayModeChange);
      viewportQuery?.removeEventListener?.("change", onViewportChange);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          deferredPrompt = null;
          notifySubscribers();
        }
        return;
      } catch {
        // Fall through to manual guide dialog if native prompt fails.
      }
    }
    setShowGuide(true);
  }, []);

  return {
    isStandalone,
    isMobile: isMobileViewport,
    platform,
    canNativeInstall: hasPrompt,
    isInsecureOrigin,
    showGuide,
    setShowGuide,
    triggerInstall,
  };
}
