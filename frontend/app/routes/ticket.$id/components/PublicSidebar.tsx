/**
 * PublicSidebar.tsx
 *
 * Sidebar minimal untuk mode public (akses tanpa login).
 * Hanya menampilkan status ticket saat ini — read-only.
 * Staff actions dan SLA card disembunyikan untuk public view.
 */

import { getStatusIconDetail } from "./TicketInfoCard";
import styles from "../style.module.css";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

import { formatDate } from "~/utils/date";

interface PublicSidebarProps {
  /** Status ticket saat ini */
  status: string;
  deadline?: Date | string;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

/**
 * PublicSidebar
 *
 * Ditampilkan di kolom kanan untuk pengunjung yang tidak login.
 * Berisi instruksi tracking dan status badge saat ini.
 *
 * @example
 * {isPublic && <PublicSidebar status={ticket.status} />}
 */
export function PublicSidebar({ status, deadline }: PublicSidebarProps) {
  return (
    <div className={styles.publicSidebar}>
      <div className={`${styles.slaCard} ${styles.slaInfoOnly}`}>
        <h3 className={styles.sidebarTitle}>Ticket Status</h3>
        <p>
          This is a read-only view of your ticket status. If you need to add
          more information, please reply to the confirmation email you received.
        </p>
        <div className={styles.statusBox}>
          <strong>Current Status</strong>
          <div
            className={`${styles.statusBadge} ${
              styles[`status${status.replace("-", "")}`]
            }`}
          >
            {getStatusIconDetail(status)}
            {status.replace("-", " ")}
          </div>
        </div>
        {deadline && (
          <div style={{ marginTop: '16px', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '12px' }}>
            <strong style={{ fontSize: '13px', color: '#4b5563', display: 'block', marginBottom: '4px' }}>Target Deadline</strong>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
              {formatDate(deadline)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
