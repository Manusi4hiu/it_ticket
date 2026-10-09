/**
 * TicketRow.tsx
 *
 * Komponen baris tabel (desktop) dan card (mobile) untuk dashboard.
 * Memisahkan logika baris/card dari loop utama di route.tsx agar
 * lebih terstruktur, maintainable, dan responsive.
 */

import { useNavigate } from "react-router";
import { Tag, Circle, UserCheck, Trash2, Clock } from "lucide-react";
import {
  assignTicket,
  type Ticket,
  type Agent,
} from "~/services/ticket.service";
import { formatDate } from "~/utils/date";
import {
  getStatusColor,
  getPriorityClass,
  formatStatus,
  canTakeTicket,
} from "~/utils/ticket-ui";
import type { Status, Priority } from "~/services/settings.service";
import styles from "../style.module.css";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface TicketRowProps {
  ticket: Ticket;
  agents: Agent[];
  statuses: Status[];
  priorities: Priority[];
  isAdministrator: boolean;
  /** Role dan userId dari session aktif */
  session: { userRole: string; userId: string };
  /** True jika user yang login saat ini sedang break */
  currentUserIsOnBreak?: boolean;
  /** Callback setelah ticket diupdate (assign/take) */
  onTicketUpdate: (updated: Ticket) => void;
  /** Callback setelah ticket dihapus */
  onTicketDelete: (id: number) => void;
}

// ─────────────────────────────────────────────
// Desktop Table Row
// ─────────────────────────────────────────────

export function TicketRow({
  ticket,
  statuses,
  isAdministrator,
  session,
  currentUserIsOnBreak,
  onTicketUpdate,
  onTicketDelete,
}: TicketRowProps) {
  const navigate = useNavigate();
  const ticketPath = `/ticket/${ticket.ticketCode || ticket.id}`;
  const statusColor = getStatusColor(ticket.status, statuses);

  const handleNavigate = () => navigate(ticketPath);

  return (
    <tr className={styles.tr}>
      {/* Ticket # */}
      <td className={styles.td} onClick={handleNavigate}>
        <span className={styles.ticketId}>{ticket.ticketCode || ticket.id}</span>
      </td>

      {/* Title */}
      <td className={styles.td} onClick={handleNavigate}>
        <span className={styles.ticketTitle} title={ticket.title}>
          {ticket.title}
        </span>
      </td>

      {/* Category */}
      <td className={styles.td}>
        <span className={styles.categoryBadge}>
          <Tag size={11} />
          {ticket.category || "General"}
        </span>
      </td>

      {/* Status */}
      <td className={styles.td}>
        <span
          className={styles.statusBadge}
          style={{
            backgroundColor: `${statusColor}15`,
            color: statusColor,
            borderColor: `${statusColor}35`,
          }}
        >
          <Circle size={8} fill={statusColor} stroke={statusColor} />
          {formatStatus(ticket.status)}
        </span>
      </td>

      {/* Priority */}
      <td className={styles.td}>
        <span
          className={`${styles.priorityBadge} ${getPriorityClass(
            ticket.priority,
            styles
          )}`}
        >
          {ticket.priority}
        </span>
      </td>

      {/* Submitter */}
      <td className={styles.td}>
        <span>{ticket.submitterName || "—"}</span>
      </td>

      {/* Assigned To */}
      <td className={styles.td}>
        <div className={styles.assigneeCell}>
          {ticket.assignedTo ? (
            <span className={styles.assignedName}>
              <UserCheck size={13} />
              {ticket.assignedTo}
            </span>
          ) : (
            <div className={styles.takeAction}>
              <span className={styles.unassignedText}>Unassigned</span>
              {(session.userRole === "Staff" ||
                session.userRole === "Administrator") &&
                canTakeTicket(ticket.status) && (
                  <button
                    type="button"
                    className={styles.takeBtn}
                    disabled={currentUserIsOnBreak}
                    title={
                      currentUserIsOnBreak
                        ? "Tidak bisa ambil tiket saat sedang break"
                        : "Ambil tiket ini"
                    }
                    style={
                      currentUserIsOnBreak
                        ? { opacity: 0.5, cursor: "not-allowed" }
                        : {}
                    }
                    onClick={async (e) => {
                      e.stopPropagation();
                      const updated = await assignTicket(
                        String(ticket.id),
                        session.userId
                      );
                      if (updated) onTicketUpdate(updated);
                    }}
                  >
                    Take
                  </button>
                )}
            </div>
          )}
        </div>
      </td>

      {/* Created At */}
      <td className={styles.td}>
        <span className={styles.createdDate}>{formatDate(ticket.createdAt)}</span>
      </td>

      {/* Actions (Admin Only) */}
      {isAdministrator && (
        <td className={styles.td} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={styles.actionDeleteBtn}
            title="Hapus Ticket"
            onClick={() => onTicketDelete(ticket.id)}
          >
            <Trash2 size={14} />
          </button>
        </td>
      )}
    </tr>
  );
}

// ─────────────────────────────────────────────
// Refined Mobile Ticket Card (Mobile / APK View)
// ─────────────────────────────────────────────

export function MobileTicketCard({
  ticket,
  statuses,
  isAdministrator,
  session,
  currentUserIsOnBreak,
  onTicketUpdate,
  onTicketDelete,
}: TicketRowProps) {
  const navigate = useNavigate();
  const ticketPath = `/ticket/${ticket.ticketCode || ticket.id}`;
  const statusColor = getStatusColor(ticket.status, statuses);

  const handleNavigate = () => navigate(ticketPath);

  return (
    <div className={styles.mobileCard} onClick={handleNavigate}>
      {/* Top Row: Ticket Code Badge & Category & Priority & Status */}
      <div className={styles.mobileCardTop}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <span className={styles.mobileCardIdBadge}>
            {ticket.ticketCode || ticket.id}
          </span>
          <span className={styles.categoryBadge}>
            <Tag size={10} />
            {ticket.category || "General"}
          </span>
        </div>

        <div className={styles.mobileCardBadges}>
          <span
            className={`${styles.priorityBadge} ${getPriorityClass(
              ticket.priority,
              styles
            )}`}
          >
            {ticket.priority}
          </span>
          <span
            className={styles.statusBadge}
            style={{
              backgroundColor: `${statusColor}15`,
              color: statusColor,
              borderColor: `${statusColor}35`,
            }}
          >
            <Circle size={6} fill={statusColor} stroke={statusColor} />
            {formatStatus(ticket.status)}
          </span>
        </div>
      </div>

      {/* Middle Row: Title */}
      <h3 className={styles.mobileCardTitle}>{ticket.title}</h3>

      {/* Subtle Divider */}
      <div className={styles.mobileCardDivider} />

      {/* Bottom Row: Submitter/Date on left, Assignee/Actions on right */}
      <div
        className={styles.mobileCardBottom}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.mobileCardMeta}>
          <span>By: {ticket.submitterName || "—"}</span>
          <span>•</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
            <Clock size={10} />
            {formatDate(ticket.createdAt)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div className={styles.assigneeCell}>
            {ticket.assignedTo ? (
              <span className={styles.assignedName}>
                <UserCheck size={12} />
                {ticket.assignedTo}
              </span>
            ) : (
              <div className={styles.takeAction}>
                <span className={styles.unassignedText}>Unassigned</span>
                {(session.userRole === "Staff" ||
                  session.userRole === "Administrator") &&
                  canTakeTicket(ticket.status) && (
                    <button
                      type="button"
                      className={styles.takeBtn}
                      disabled={currentUserIsOnBreak}
                      title={
                        currentUserIsOnBreak
                          ? "Tidak bisa ambil tiket saat sedang break"
                          : "Ambil tiket ini"
                      }
                      style={
                        currentUserIsOnBreak
                          ? { opacity: 0.5, cursor: "not-allowed" }
                          : {}
                      }
                      onClick={async (e) => {
                        e.stopPropagation();
                        const updated = await assignTicket(
                          String(ticket.id),
                          session.userId
                        );
                        if (updated) onTicketUpdate(updated);
                      }}
                    >
                      Take
                    </button>
                  )}
              </div>
            )}
          </div>

          {isAdministrator && (
            <button
              type="button"
              className={styles.mobileActionDeleteBtn}
              title="Hapus Ticket"
              onClick={() => onTicketDelete(ticket.id)}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
