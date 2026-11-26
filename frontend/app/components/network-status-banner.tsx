import { useEffect, useRef, useState } from "react";
import { RefreshCw, Wifi, WifiOff, X } from "lucide-react";
import styles from "./network-status-banner.module.css";

const RECONNECTED_HIDE_MS = 3500;

/**
 * Global Mobile PWA Online / Offline status indicator.
 * - SSR-safe (initializes as online on server, syncs navigator.onLine on client mount)
 * - Displays persistent top banner while offline with retry check button
 * - Displays brief "back online" confirmation banner when connection is restored
 */
export function NetworkStatusBanner() {
  const [status, setStatus] = useState<"online" | "offline" | "reconnected">("online");
  const [dismissedOffline, setDismissedOffline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const wasOfflineRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const clearHideTimer = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const handleOffline = () => {
      clearHideTimer();
      wasOfflineRef.current = true;
      setDismissedOffline(false);
      setStatus("offline");
    };

    const handleOnline = () => {
      setDismissedOffline(false);
      if (wasOfflineRef.current) {
        clearHideTimer();
        wasOfflineRef.current = false;
        setStatus("reconnected");
        hideTimerRef.current = setTimeout(() => {
          setStatus("online");
          hideTimerRef.current = null;
        }, RECONNECTED_HIDE_MS);
      }
    };

    if (!navigator.onLine) {
      handleOffline();
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      clearHideTimer();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const handleRetryConnection = async () => {
    setIsChecking(true);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }
      // Lightweight same-origin connectivity check (no-store so SW cache is bypassed)
      const res = await fetch(window.location.origin, {
        method: "HEAD",
        cache: "no-store",
      });
      if (res.ok || res.status < 500) {
        wasOfflineRef.current = false;
        setStatus("reconnected");
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setStatus("online");
          hideTimerRef.current = null;
        }, RECONNECTED_HIDE_MS);
      }
    } catch {
      // Still unreachable — keep offline banner visible
    } finally {
      setIsChecking(false);
    }
  };

  if (status === "online" || (status === "offline" && dismissedOffline)) {
    return null;
  }

  const isOffline = status === "offline";

  return (
    <div
      className={`${styles.banner} ${isOffline ? styles.offline : styles.reconnected}`}
      role="status"
      aria-live={isOffline ? "assertive" : "polite"}
      data-network-status={status}
    >
      <div className={styles.content}>
        <span className={styles.iconWrap} aria-hidden="true">
          {isOffline ? <WifiOff size={16} /> : <Wifi size={16} />}
        </span>
        <div className={styles.textGroup}>
          <span className={styles.title}>
            {isOffline ? "Offline — Koneksi terputus" : "Koneksi kembali tersambung"}
          </span>
          <span className={styles.subtitle}>
            {isOffline
              ? "Menampilkan data terakhir. Periksa Wi-Fi atau data seluler."
              : "Aplikasi kembali online dan siap menyinkronkan data."}
          </span>
        </div>
      </div>

      <div className={styles.actions}>
        {isOffline ? (
          <>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => void handleRetryConnection()}
              disabled={isChecking}
            >
              <RefreshCw size={13} className={isChecking ? styles.spin : undefined} />
              <span>{isChecking ? "Cek..." : "Coba Lagi"}</span>
            </button>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setDismissedOffline(true)}
              aria-label="Sembunyikan banner status offline"
            >
              <X size={15} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setStatus("online")}
            aria-label="Tutup notifikasi koneksi"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
