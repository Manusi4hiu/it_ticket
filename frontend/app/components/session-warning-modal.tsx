import { Clock } from 'lucide-react';
import styles from './session-warning-modal.module.css';

interface SessionWarningModalProps {
  secondsLeft: number;
  totalSeconds: number;
  onExtend: () => void;
  onLogout: () => void;
}

/**
 * Modal yang muncul sebelum idle-timeout untuk memberi user
 * kesempatan melanjutkan sesi atau logout secara sadar.
 */
export function SessionWarningModal({
  secondsLeft,
  totalSeconds,
  onExtend,
  onLogout,
}: SessionWarningModalProps) {
  // ── Countdown ring (SVG circle) ──────────────────────────────────────
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = secondsLeft / totalSeconds; // 1 = penuh, 0 = habis
  const dashOffset = circumference * (1 - progress);

  // Format tampilan waktu
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeDisplay =
    minutes > 0
      ? `${minutes}:${String(seconds).padStart(2, '0')}`
      : String(secondsLeft);
  const timeLabel = minutes > 0 ? 'menit' : 'detik';

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="session-warning-title">
      <div className={styles.modal}>
        {/* Icon */}
        <div className={styles.iconWrap}>
          <Clock className={styles.icon} />
        </div>

        {/* Text */}
        <h2 id="session-warning-title" className={styles.title}>
          Sesi Hampir Berakhir
        </h2>
        <p className={styles.subtitle}>
          Anda tidak aktif dalam beberapa waktu. Sesi akan otomatis berakhir jika tidak ada tindakan.
        </p>

        {/* Countdown ring */}
        <div className={styles.countdownWrap}>
          <div className={styles.countdownRing}>
            <svg viewBox="0 0 96 96">
              <circle
                className={styles.ringBg}
                cx="48"
                cy="48"
                r={radius}
              />
              <circle
                className={styles.ringProgress}
                cx="48"
                cy="48"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className={styles.countdownText}>
              <span className={styles.countdownNumber}>{timeDisplay}</span>
              <span className={styles.countdownLabel}>{timeLabel}</span>
            </div>
          </div>
          <p className={styles.countdownMessage}>tersisa sebelum logout otomatis</p>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button
            id="session-extend-btn"
            className={styles.btnExtend}
            onClick={onExtend}
          >
            Lanjutkan Sesi
          </button>
          <button
            id="session-logout-btn"
            className={styles.btnLogout}
            onClick={onLogout}
          >
            Logout Sekarang
          </button>
        </div>
      </div>
    </div>
  );
}
