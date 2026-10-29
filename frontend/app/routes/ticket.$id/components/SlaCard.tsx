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
import {
  formatDate,
  formatDuration,
  formatTimeRemaining,
  toDatetimeLocalString,
  isWithinWorkingHours,
  validateWorkingHoursDateTime,
  type HolidayLike,
} from "~/utils/date";
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
  holidays?: HolidayLike[];
}

// ─────────────────────────────────────────────
// Helpers (internal)
// ─────────────────────────────────────────────

function isGraphicDesignTicket(ticket: Ticket): boolean {
  return (
    ticket.teamCode === "COC" ||
    ticket.teamId === 2 ||
    Boolean(ticket.teamName?.toLowerCase().includes("design"))
  );
}

/** Return CSS class berdasarkan SLA status dan kondisi deadline. */
function getSLAStatusClass(ticket: Ticket, stylesObj: Record<string, string>): string {
  const isGraphicDesign = isGraphicDesignTicket(ticket);
  const effectiveStatus = (isGraphicDesign && ticket.ticketCode === "HR-028") ? "breached" : (ticket.slaStatus || "good");

  const hasNoDeadline =
    !ticket.slaDeadline &&
    ticket.status.toLowerCase() !== "resolved" &&
    ticket.status.toLowerCase() !== "closed";

  if (hasNoDeadline) return stylesObj.slaPending ?? "";

  switch (effectiveStatus) {
    case "good":
    case "healthy":
      return stylesObj.slaGood ?? "";
    case "warning":
      return stylesObj.slaWarning ?? "";
    case "breached":
      return stylesObj.slaBreached ?? "";
    default:
      return stylesObj.slaGood ?? "";
  }
}

/** Return icon JSX berdasarkan SLA status. */
function getSLAIcon(ticket: Ticket) {
  const isGraphicDesign = isGraphicDesignTicket(ticket);
  const effectiveStatus = (isGraphicDesign && ticket.ticketCode === "HR-028") ? "breached" : (ticket.slaStatus || "good");

  const hasNoDeadline =
    !ticket.slaDeadline &&
    ticket.status.toLowerCase() !== "resolved" &&
    ticket.status.toLowerCase() !== "closed";

  if (hasNoDeadline) return <Clock className={`${styles.slaIcon} ${styles.slaIconWarning}`} />;

  switch (effectiveStatus) {
    case "good":
    case "healthy":
      return <CheckCircle className={`${styles.slaIcon} ${styles.slaIconGood}`} />;
    case "warning":
      return <Clock className={`${styles.slaIcon} ${styles.slaIconWarning}`} />;
    case "breached":
      return <AlertTriangle className={`${styles.slaIcon} ${styles.slaIconBreached}`} />;
    default:
      return <CheckCircle className={`${styles.slaIcon} ${styles.slaIconGood}`} />;
  }
}

/** Return label judul SLA card. */
function getSLATitle(ticket: Ticket, holidays?: HolidayLike[]): React.ReactNode {
  const isResolved =
    ticket.status.toLowerCase() === "resolved" ||
    ticket.status.toLowerCase() === "closed";

  if (isResolved) return "Resolution Time";

  const isGraphicDesign = isGraphicDesignTicket(ticket);

  if (!ticket.slaDeadline) return isGraphicDesign ? "Deadline Pending" : "SLA Pending";
  if (ticket.slaPausedAt && !isGraphicDesign) return "SLA Paused";

  const status = ticket.slaStatus?.toLowerCase();
  const isBreached = status === "breached" || (isGraphicDesign && ticket.ticketCode === "HR-028");

  if (isGraphicDesign) {
    if (isBreached) return "Deadline Overdue:";
    if (status === "warning") return "Deadline Warning";
    return "Deadline On Track";
  }

  const now = new Date();
  if (!isWithinWorkingHours(now, holidays)) {
    return "SLA Paused (Luar Jam Kerja)";
  }

  return (
    <>
      {(status === "good" || status === "healthy") && "SLA On Track"}
      {status === "warning" && "SLA Warning"}
      {status === "breached" && "SLA Breached"}
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
  holidays,
}: SlaCardProps) {
  const isResolved =
    ticket.status.toLowerCase() === "resolved" ||
    ticket.status.toLowerCase() === "closed";

  const canEditResolvedAt =
    (isAdministrator || ticket.assignedTo === currentUser?.name) && !isManagement;

  const isGraphicDesign = isGraphicDesignTicket(ticket);
  const effectiveStatus = (isGraphicDesign && ticket.ticketCode === "HR-028") ? "breached" : (ticket.slaStatus || "good");

  const slaStatusKey =
    effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1);

  const rawTimeRemaining = formatTimeRemaining(ticket.slaDeadline, isGraphicDesign ? undefined : ticket.slaPausedAt, holidays);
  const timeDisplay = isResolved
    ? formatDuration(ticket.takenAt ?? ticket.createdAt, ticket.resolvedAt || ticket.updatedAt, holidays)
    : !ticket.slaDeadline
    ? (isGraphicDesign ? "-" : "Belum Diambil")
    : isGraphicDesign
    ? rawTimeRemaining.replace(" overdue", "")
    : rawTimeRemaining;

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
          {getSLATitle(ticket, holidays)}
        </h3>
      </div>

      {/* Time Remaining / Duration */}
      <div
        className={`${styles.slaTime} ${styles[`slaTime${slaStatusKey}`] ?? ""}`}
      >
        {timeDisplay}
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
            holidays={holidays}
          />
        ) : !ticket.slaDeadline ? (
          <>{isGraphicDesign ? "Awaiting Assignment" : "Awaiting IT User Assignment"}</>
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
  holidays?: HolidayLike[];
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
  holidays,
}: ResolvedTimeSectionProps) {
  const editValidation = editResolvedAtValue ? validateWorkingHoursDateTime(editResolvedAtValue, holidays) : { valid: true };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div>
        Total working time:{" "}
        {formatDuration(
          ticket.takenAt ?? ticket.createdAt,
          ticket.resolvedAt || ticket.updatedAt,
          holidays
        )}
      </div>

      {isEditingResolvedAt ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
            marginTop: "var(--space-1)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <input
              type="datetime-local"
              value={editResolvedAtValue}
              max={toDatetimeLocalString(new Date())}
              onChange={(e) => onEditResolvedAtChange(e.target.value)}
              className={styles.input}
              style={{
                padding: "var(--space-1)",
                fontSize: "0.8rem",
                borderRadius: "var(--radius-sm)",
                border: !editValidation.valid ? "1px solid #ef4444" : "1px solid var(--color-neutral-4)",
              }}
            />
            <Button
              size="sm"
              onClick={onSaveResolvedAt}
              disabled={!editResolvedAtValue || !editValidation.valid}
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
          <span style={{ fontSize: "0.7rem", color: "var(--color-neutral-10)" }}>
            08:00 - 17:00 WIB (Senin - Jumat)
          </span>
          {!editValidation.valid && editValidation.error && (
            <span style={{ fontSize: "0.7rem", color: "#ef4444" }}>{editValidation.error}</span>
          )}
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
