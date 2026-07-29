/**
 * SlaCard.tsx
 *
 * Komponen card untuk menampilkan status SLA ticket:
 * - SLA on track / warning / breached
 * - Untuk ticket resolved: menampilkan total working time dan waktu resolve
 * - Untuk Administrator/assignee: bisa mengedit waktu resolved
 */

import { CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button/button";
import { formatDate, formatDuration, formatTimeRemaining } from "~/utils/date";
import type { Ticket } from "~/services/ticket.service";
import type { CurrentUser } from "../types";
import styles from "../style.module.css";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface SlaCardProps {
  ticket: Ticket;
  currentUser: CurrentUser | null;
  isAdministrator: boolean;
  isManagement: boolean;
  /** Apakah sedang dalam mode edit resolved time */
  isEditingResolvedAt: boolean;
  /** Nilai input datetime-local untuk edit resolved time */
  editResolvedAtValue: string;
  onEditResolvedAtChange: (value: string) => void;
  onOpenEditResolvedAt: () => void;
  onSaveResolvedAt: () => void;
  onCancelEditResolvedAt: () => void;
}

// ─────────────────────────────────────────────
// Helpers (internal)
// ─────────────────────────────────────────────

/** Return CSS class berdasarkan SLA status dan kondisi deadline. */
function getSLAStatusClass(ticket: Ticket, stylesObj: Record<string, string>): string {
  const hasNoDeadline =
    !ticket.slaDeadline &&
    ticket.status.toLowerCase() !== "resolved" &&
    ticket.status.toLowerCase() !== "closed";

  if (hasNoDeadline) return stylesObj.slaPending ?? "";

  switch (ticket.slaStatus) {
    case "good": return stylesObj.slaGood ?? "";
    case "warning": return stylesObj.slaWarning ?? "";
    case "breached": return stylesObj.slaBreached ?? "";
    default: return stylesObj.slaGood ?? "";
  }
}

/** Return icon JSX berdasarkan SLA status. */
function getSLAIcon(ticket: Ticket) {
  const hasNoDeadline =
    !ticket.slaDeadline &&
    ticket.status.toLowerCase() !== "resolved" &&
    ticket.status.toLowerCase() !== "closed";

  if (hasNoDeadline) return <Clock className={`${styles.slaIcon} ${styles.slaIconWarning}`} />;

  switch (ticket.slaStatus) {
    case "good": return <CheckCircle className={`${styles.slaIcon} ${styles.slaIconGood}`} />;
    case "warning": return <Clock className={`${styles.slaIcon} ${styles.slaIconWarning}`} />;
    case "breached": return <AlertTriangle className={`${styles.slaIcon} ${styles.slaIconBreached}`} />;
  }
}

/** Return label judul SLA card. */
function getSLATitle(ticket: Ticket): React.ReactNode {
  const isResolved =
    ticket.status.toLowerCase() === "resolved" ||
    ticket.status.toLowerCase() === "closed";

  if (isResolved) return "Resolution Time";
  if (!ticket.slaDeadline) return "SLA Pending";
  if (ticket.slaPausedAt) return "SLA Paused";

  return (
    <>
      {ticket.slaStatus === "good" && "SLA On Track"}
      {ticket.slaStatus === "warning" && "SLA Warning"}
      {ticket.slaStatus === "breached" && "SLA Breached"}
    </>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

/**
 * SlaCard
 *
 * Menampilkan informasi SLA ticket. Untuk ticket yang sudah resolved,
 * menampilkan total working time dan waktu resolve aktual.
 * Administrator dan assignee bisa mengedit waktu resolved.
 *
 * @example
 * <SlaCard
 *   ticket={ticket}
 *   currentUser={currentUser}
 *   isAdministrator={isAdministrator}
 *   isManagement={isManagement}
 *   isEditingResolvedAt={isEditingResolvedAt}
 *   editResolvedAtValue={editResolvedAtValue}
 *   onEditResolvedAtChange={setEditResolvedAtValue}
 *   onOpenEditResolvedAt={handleOpenEditResolvedAt}
 *   onSaveResolvedAt={handleSaveResolvedAt}
 *   onCancelEditResolvedAt={() => setIsEditingResolvedAt(false)}
 * />
 */
export function SlaCard({
  ticket,
  currentUser,
  isAdministrator,
  isManagement,
  isEditingResolvedAt,
  editResolvedAtValue,
  onEditResolvedAtChange,
  onOpenEditResolvedAt,
  onSaveResolvedAt,
  onCancelEditResolvedAt,
}: SlaCardProps) {
  const isResolved =
    ticket.status.toLowerCase() === "resolved" ||
    ticket.status.toLowerCase() === "closed";

  const canEditResolvedAt =
    (isAdministrator || ticket.assignedTo === currentUser?.name) && !isManagement;

  const slaStatusKey =
    ticket.slaStatus.charAt(0).toUpperCase() + ticket.slaStatus.slice(1);

  return (
    <div className={`${styles.slaCard} ${getSLAStatusClass(ticket, styles)}`}>
      {/* Header */}
      <div className={styles.slaHeader}>
        {getSLAIcon(ticket)}
        <h3
          className={`${styles.slaTitle} ${
            styles[`slaTitle${slaStatusKey}`] ?? ""
          }`}
        >
          {getSLATitle(ticket)}
        </h3>
      </div>

      {/* Time Remaining / Duration */}
      <div
        className={`${styles.slaTime} ${styles[`slaTime${slaStatusKey}`] ?? ""}`}
      >
        {isResolved
          ? formatDuration(ticket.createdAt, ticket.resolvedAt || ticket.updatedAt)
          : formatTimeRemaining(ticket.slaDeadline, ticket.slaPausedAt)}
      </div>

      {/* Deadline / Working Time Detail */}
      <div
        className={`${styles.slaDeadline} ${
          styles[`slaDeadline${slaStatusKey}`] ?? ""
        }`}
      >
        {isResolved ? (
          <ResolvedTimeSection
            ticket={ticket}
            canEditResolvedAt={canEditResolvedAt}
            isEditingResolvedAt={isEditingResolvedAt}
            editResolvedAtValue={editResolvedAtValue}
            onEditResolvedAtChange={onEditResolvedAtChange}
            onOpenEditResolvedAt={onOpenEditResolvedAt}
            onSaveResolvedAt={onSaveResolvedAt}
            onCancelEditResolvedAt={onCancelEditResolvedAt}
          />
        ) : !ticket.slaDeadline ? (
          <>Awaiting IT User Assignment</>
        ) : (
          <>Deadline: {formatDate(ticket.slaDeadline)}</>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-component: Resolved Time Section
// ─────────────────────────────────────────────

interface ResolvedTimeSectionProps {
  ticket: Ticket;
  canEditResolvedAt: boolean;
  isEditingResolvedAt: boolean;
  editResolvedAtValue: string;
  onEditResolvedAtChange: (value: string) => void;
  onOpenEditResolvedAt: () => void;
  onSaveResolvedAt: () => void;
  onCancelEditResolvedAt: () => void;
}

/** Detail waktu resolve untuk ticket yang sudah selesai. */
function ResolvedTimeSection({
  ticket,
  canEditResolvedAt,
  isEditingResolvedAt,
  editResolvedAtValue,
  onEditResolvedAtChange,
  onOpenEditResolvedAt,
  onSaveResolvedAt,
  onCancelEditResolvedAt,
}: ResolvedTimeSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div>
        Total working time:{" "}
        {formatDuration(
          ticket.createdAt,
          ticket.resolvedAt || ticket.updatedAt
        )}
      </div>

      {isEditingResolvedAt ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            marginTop: "var(--space-1)",
          }}
        >
          <input
            type="datetime-local"
            value={editResolvedAtValue}
            onChange={(e) => onEditResolvedAtChange(e.target.value)}
            className={styles.input}
            style={{
              padding: "var(--space-1)",
              fontSize: "0.8rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-neutral-4)",
            }}
          />
          <Button
            size="sm"
            onClick={onSaveResolvedAt}
            style={{ padding: "0 8px", height: "28px" }}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancelEditResolvedAt}
            style={{ padding: "0 8px", height: "28px" }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          Resolved at:{" "}
          {formatDate(ticket.resolvedAt || ticket.updatedAt)}
          {canEditResolvedAt && (
            <button
              type="button"
              className={styles.removeCollaboratorBtn}
              title="Edit Resolved Time"
              style={{
                background: "var(--color-neutral-2)",
                color: "var(--color-neutral-11)",
                border: "1px solid var(--color-neutral-4)",
                borderRadius: "4px",
                padding: "2px 6px",
                cursor: "pointer",
                fontSize: "0.7rem",
              }}
              onClick={onOpenEditResolvedAt}
            >
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
