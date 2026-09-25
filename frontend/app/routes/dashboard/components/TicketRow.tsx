/**
 * TicketRow.tsx
 *
 * Satu baris `<tr>` dalam tabel dashboard ticket.
 * Memisahkan logika baris dari loop utama di route.tsx agar
 * lebih mudah dibaca dan dipelihara.
 *
 * Dashboard = "tiket yang sedang saya pegang": priority & assignee tampil
 * read-only untuk SEMUA role (termasuk Administrator) + tombol "Take" bila
 * unassigned + tombol delete khusus admin. Pengubahan priority/assignee
 * dengan dialog alasan hanya ada di halaman detail tiket — dropdown inline
 * di sini sengaja dihapus karena perubahan ke-2+ / oper tiket WAJIB alasan
 * di backend sehingga dropdown tanpa dialog selalu gagal diam-diam.
 */

import { useNavigate } from "react-router";
import { Tag, Circle, UserCheck, Trash2 } from "lucide-react";
import { Badge } from "~/components/ui/badge/badge";
import { Button } from "~/components/ui/button/button";
import {
  assignTicket,
  type Ticket,
  type Agent,
} from "~/services/ticket.service";
import { formatDate } from "~/utils/date";
import { getStatusColor, getPriorityClass, formatStatus, canTakeTicket } from "~/utils/ticket-ui";
import type { Status, Priority } from "~/services/settings.service";
import styles from "../style.module.css";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface TicketRowProps {
  ticket: Ticket;
  agents: Agent[];
  statuses: Status[];
  priorities: Priority[];
  isAdministrator: boolean;
  /** Role dan userId dari session aktif */
  session: { userRole: string; userId: string };
  /** Callback setelah ticket diupdate (assign/priority change) */
  onTicketUpdate: (updated: Ticket) => void;
  /** Callback setelah ticket dihapus */
  onTicketDelete: (id: number) => void;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

/**
 * TicketRow
 *
 * Render satu baris tabel ticket dengan semua aksi inline.
 * Click pada cell Ticket # atau Title menavigasi ke detail ticket.
 *
 * @example
 * tickets.map(ticket => (
 *   <TicketRow
 *     key={ticket.id}
 *     ticket={ticket}
 *     agents={agents}
 *     statuses={statuses}
 *     isAdministrator={isAdministrator}
 *     session={session}
 *     onTicketUpdate={updateTicketsState}
 *     onTicketDelete={handleDeleteConfirm}
 *   />
 * ))
 */
export function TicketRow({
  ticket,
  statuses,
  isAdministrator,
  session,
  onTicketUpdate,
  onTicketDelete,
}: TicketRowProps) {
  const navigate = useNavigate();
  const ticketPath = `/ticket/${ticket.ticketCode || ticket.id}`;
  const statusColor = getStatusColor(ticket.status, statuses);

  const handleNavigate = () => navigate(ticketPath);

  return (
    <tr className={styles.tableRow}>
      {/* Ticket # */}
      <td onClick={handleNavigate}>
        <span className={styles.ticketId}>{ticket.ticketCode || ticket.id}</span>
      </td>

      {/* Title */}
      <td onClick={handleNavigate}>
        <span className={styles.ticketTitle}>{ticket.title}</span>
      </td>

      {/* Category */}
      <td>
        <Badge variant="outline" style={{ gap: "var(--space-1)" }}>
          <Tag style={{ width: "12px", height: "12px" }} />
          {ticket.category || "General"}
        </Badge>
      </td>

      {/* Status — pakai CSS class + dynamic color dari statuses list */}
      <td>
        <span
          className={styles.statusBadgeDynamic}
          style={{
            backgroundColor: `${statusColor}15`,
            color: statusColor,
            borderColor: `${statusColor}30`,
          }}
        >
          <Circle
            size={10}
            fill={statusColor}
            stroke={statusColor}
          />
          {formatStatus(ticket.status)}
        </span>
      </td>

      {/* Priority — read-only untuk semua role (ubah via halaman detail) */}
      <td>
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
      <td>{ticket.submitterName}</td>

      {/* Assigned To — read-only + tombol Take bila unassigned */}
      <td>
        <div className={styles.assigneeCell}>
          {ticket.assignedTo ? (
            <span className={styles.assignedName}>
              <UserCheck style={{ width: "14px", height: "14px" }} />
              {ticket.assignedTo}
            </span>
          ) : (
            <div className={styles.takeAction}>
              <span className={styles.unassignedText}>Unassigned</span>
              {(session.userRole === "Staff" ||
                session.userRole === "Administrator") &&
                canTakeTicket(ticket.status) && (
                <Button
                  size="sm"
                  className={styles.miniTakeButton}
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
                </Button>
              )}
            </div>
          )}
        </div>
      </td>

      {/* Created At */}
      <td>{formatDate(ticket.createdAt)}</td>

      {/* Actions (admin only) */}
      {isAdministrator && (
        <td onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className={styles.miniDeleteButton}
            onClick={() => onTicketDelete(ticket.id)}
          >
            <Trash2 size={14} />
          </Button>
        </td>
      )}
    </tr>
  );
}
