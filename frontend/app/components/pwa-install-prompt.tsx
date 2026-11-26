import { useState, useEffect } from "react";
import { Download, Smartphone, Share, MoreVertical, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import { Button } from "~/components/ui/button/button";
import { usePWAInstall } from "~/hooks/use-pwa-install";
import { publicAsset } from "~/utils/asset";
import styles from "./pwa-install-prompt.module.css";

const DISMISS_STORAGE_KEY = "it_aero_pwa_banner_dismissed_at";
const DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // Re-show after 3 days if dismissed

interface PwaInstallGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: "ios" | "android" | "desktop";
  isInsecureOrigin: boolean;
}

export function PwaInstallGuideDialog({
  open,
  onOpenChange,
  platform,
  isInsecureOrigin,
}: PwaInstallGuideDialogProps) {
  const isIos = platform === "ios";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.guideDialog}>
        <DialogHeader>
          <div className={styles.guideHeader}>
            <div className={styles.guideIcon}>
              <Smartphone size={22} />
            </div>
            <div>
              <DialogTitle>Install IT Aero Mobile App</DialogTitle>
              <DialogDescription style={{ color: "#9ca3af", marginTop: "4px" }}>
                Pasang ke layar utama HP agar langsung terbuka seperti aplikasi mobile tanpa bar browser.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isIos ? (
          <ol className={styles.stepsList}>
            <li className={styles.stepItem}>
              <span className={styles.stepNumber}>1</span>
              <span>
                Buka halaman ini menggunakan browser <strong>Safari</strong> di iPhone/iPad Anda.
              </span>
            </li>
            <li className={styles.stepItem}>
              <span className={styles.stepNumber}>2</span>
              <span>
                Ketuk ikon <strong>Share</strong>{" "}
                <Share size={14} style={{ display: "inline", verticalAlign: "text-bottom" }} /> di bilah bawah/atas Safari.
              </span>
            </li>
            <li className={styles.stepItem}>
              <span className={styles.stepNumber}>3</span>
              <span>
                Pilih <strong>&ldquo;Add to Home Screen&rdquo;</strong> lalu ketuk <strong>Add</strong>.
              </span>
            </li>
          </ol>
        ) : (
          <ol className={styles.stepsList}>
            <li className={styles.stepItem}>
              <span className={styles.stepNumber}>1</span>
              <span>
                Buka menu browser di pojok kanan atas{" "}
                <MoreVertical size={14} style={{ display: "inline", verticalAlign: "text-bottom" }} /> (disarankan Chrome / Edge).
              </span>
            </li>
            <li className={styles.stepItem}>
              <span className={styles.stepNumber}>2</span>
              <span>
                Pilih <strong>&ldquo;Install app&rdquo;</strong> atau <strong>&ldquo;Add to Home screen&rdquo;</strong>.
              </span>
            </li>
            <li className={styles.stepItem}>
              <span className={styles.stepNumber}>3</span>
              <span>
                Konfirmasi <strong>Install</strong> — ikon <strong>IT Aero</strong> akan muncul di daftar aplikasi HP Anda.
              </span>
            </li>
          </ol>
        )}

        {isInsecureOrigin && (
          <div className={styles.httpsWarning}>
            <strong>Catatan koneksi lokal (HTTP):</strong> Instalasi otomatis satu klik pada browser mobile memerlukan
            akses melalui <strong>HTTPS</strong> (atau <code>localhost</code>). Di server produksi HTTPS, popup install
            akan muncul otomatis saat tombol Download ditekan.
          </div>
        )}

        <DialogFooter style={{ marginTop: "14px" }}>
          <Button type="button" onClick={() => onOpenChange(false)} style={{ width: "100%" }}>
            Mengerti
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PwaInstallButtonProps {
  className?: string;
  variant?: "default" | "outline" | "ghost";
  label?: string;
  iconOnly?: boolean;
}

/**
 * Reusable "Download App" CTA button.
 * Automatically hidden when already running inside the installed PWA (standalone mode).
 */
export function PwaInstallButton({
  className,
  variant = "outline",
  label = "Download App",
  iconOnly = false,
}: PwaInstallButtonProps) {
  const { isStandalone, platform, isInsecureOrigin, showGuide, setShowGuide, triggerInstall } =
    usePWAInstall();

  if (isStandalone) return null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={() => void triggerInstall()}
        aria-label={label}
        title={label}
      >
        <Download size={iconOnly ? 20 : 18} />
        {!iconOnly && label}
      </Button>

      <PwaInstallGuideDialog
        open={showGuide}
        onOpenChange={setShowGuide}
        platform={platform}
        isInsecureOrigin={isInsecureOrigin}
      />
    </>
  );
}

/**
 * Floating bottom mobile smart-banner (like top-up websites).
 * Visible only on mobile viewports when opened in a regular browser (not installed yet).
 * Desktop browsers never see this banner so desktop UX stays untouched.
 */
export function PwaDownloadBanner() {
  const {
    isStandalone,
    isMobile,
    platform,
    isInsecureOrigin,
    showGuide,
    setShowGuide,
    triggerInstall,
  } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (!raw) {
        setDismissed(false);
        return;
      }
      const elapsed = Date.now() - Number(raw);
      setDismissed(Number.isFinite(elapsed) && elapsed < DISMISS_COOLDOWN_MS);
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore storage quota errors
    }
  };

  const isBannerVisible = !isStandalone && isMobile && !dismissed;

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isBannerVisible) {
      document.documentElement.setAttribute("data-pwa-banner", "visible");
    } else {
      document.documentElement.removeAttribute("data-pwa-banner");
    }
    return () => {
      document.documentElement.removeAttribute("data-pwa-banner");
    };
  }, [isBannerVisible]);

  if (!isBannerVisible) {
    return (
      <PwaInstallGuideDialog
        open={showGuide}
        onOpenChange={setShowGuide}
        platform={platform}
        isInsecureOrigin={isInsecureOrigin}
      />
    );
  }

  return (
    <>
      <aside className={styles.banner} aria-label="Download IT Aero Mobile App">
        <div className={styles.bannerLeft}>
          <img
            src={publicAsset("icon-192.png")}
            alt="IT Aero App"
            className={styles.appIcon}
          />
          <div className={styles.bannerText}>
            <span className={styles.bannerTitle}>IT Aero Mobile App</span>
            <span className={styles.bannerSubtitle}>Buka cepat &amp; full screen di HP</span>
          </div>
        </div>

        <div className={styles.bannerActions}>
          <button
            type="button"
            className={styles.downloadBtn}
            onClick={() => void triggerInstall()}
          >
            <Download size={14} />
            Download
          </button>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleDismiss}
            aria-label="Tutup banner download app"
          >
            <X size={15} />
          </button>
        </div>
      </aside>

      <PwaInstallGuideDialog
        open={showGuide}
        onOpenChange={setShowGuide}
        platform={platform}
        isInsecureOrigin={isInsecureOrigin}
      />
    </>
  );
}
