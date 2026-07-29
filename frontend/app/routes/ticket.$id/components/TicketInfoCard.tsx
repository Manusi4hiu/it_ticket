/**
 * TicketInfoCard.tsx
 *
 * Komponen untuk menampilkan informasi utama sebuah ticket:
 * title, status, priority, info submitter, deskripsi, attachment, dan staff assigned.
 *
 * Mendukung dua mode tampilan:
 * - Public: info minimal (title, status, submitter, deskripsi)
 * - Staff/Admin: info lengkap termasuk email, telepon, department, collaborators
 */

import {
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  CheckCircle,
  FileText,
  Tag,
  Users,
  Building,
  ArrowUpCircle,
  Inbox,
  Eye,
  UserCheck,
  XCircle,
  Circle,
  Image as ImageIcon,
} from "lucide-react";
import { Badge } from "~/components/ui/badge/badge";
import { formatDate } from "~/utils/date";
import { getStatusColor } from "~/utils/ticket-ui";
import type { Ticket } from "~/services/ticket.service";
import type { Status } from "~/services/settings.service";
import type { StaffInfo } from "../types";
import styles from "../style.module.css";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// ─────────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────────
function parseStatusChangeNote(html: string) {
  const matchFromTo = html.match(/Status changed from (.*?) to (.*?)<\/strong>/);
  const matchTo = html.match(/Status changed to (.*?)<\/strong>/);
  const matchReason = html.match(/Reason: (.*?)<\/p>/);
  
  let from = "-";
  let to = "-";
  
  if (matchFromTo) {
      from = matchFromTo[1];
      to = matchFromTo[2];
  } else if (matchTo) {
      to = matchTo[1];
  } else {
      return null;
  }
  
  return {
      from,
      to,
      reason: matchReason ? matchReason[1] : "-"
  };
}

// ─────────────────────────────────────────────
// Exported Helper (dipakai juga di PublicSidebar)
// ─────────────────────────────────────────────

/**
 * Return icon JSX berdasarkan status ticket.
 *
 * @param statusName - Nama status (case-insensitive)
 */
export function getStatusIconDetail(statusName: string) {
  const lower = statusName.toLowerCase();
  const iconStyle = { width: "16px", height: "16px" };
  if (lower.includes("new")) return <Inbox style={iconStyle} />;
  if (lower.includes("triaged")) return <Eye style={iconStyle} />;
  if (lower.includes("assigned")) return <UserCheck style={iconStyle} />;
  if (lower.includes("progress")) return <Clock style={iconStyle} />;
  if (lower.includes("resolve")) return <CheckCircle style={iconStyle} />;
  if (lower.includes("close")) return <XCircle style={iconStyle} />;
  return <Circle style={iconStyle} />;
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface TicketInfoCardProps {
  ticket: Ticket;
  statuses: Status[];
  /** True jika diakses tanpa login */
  isPublic: boolean;
  /** Callback saat nama staff/collaborator diklik */
  onStaffClick: (staffId: string) => void;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

/**
 * TicketInfoCard
 *
 * Menampilkan informasi detail sebuah ticket dalam card.
 * Mode public hanya menampilkan subset info (tanpa email, telepon, department).
 *
 * @example
 * <TicketInfoCard
 *   ticket={ticket}
 *   statuses={statuses}
 *   isPublic={!session}
 *   onStaffClick={handleStaffClick}
 * />
 */
export function TicketInfoCard({
  ticket,
  statuses,
  isPublic,
  onStaffClick,
}: TicketInfoCardProps) {
  const statusColor = getStatusColor(ticket.status, statuses);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <FileText className={styles.sectionIcon} />
          Ticket Information
        </h2>
      </div>

      <div className={styles.sectionContent}>
        {/* Ticket Header: ID, Title, Status, Priority */}
        <div className={styles.ticketHeader}>
          <div className={styles.ticketId}>{ticket.ticketCode || ticket.id}</div>
          <h1 className={styles.ticketTitle}>{ticket.title}</h1>

          <div className={styles.ticketMeta}>
            {/* Status Badge */}
            <span
              className={styles.statusBadge}
              style={{
                backgroundColor: `${statusColor}15`,
                color: statusColor,
                borderColor: `${statusColor}30`,
              }}
            >
              {getStatusIconDetail(ticket.status)}
              {ticket.status}
            </span>

            {/* Priority Badge — disembunyikan untuk public */}
            {!isPublic && (
              <span
                className={`${styles.priorityBadge} ${
                  styles[
                    `priority${
                      ticket.priority.charAt(0).toUpperCase() +
                      ticket.priority.slice(1)
                    }`
                  ]
                }`}
              >
                {ticket.priority === "critical" && (
                  <ArrowUpCircle style={{ width: "14px", height: "14px" }} />
                )}
                {ticket.priority}
              </span>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className={styles.infoGrid}>
          <InfoItem icon={<User />} label="Submitter" value={ticket.submitterName} />
          <InfoItem icon={<Calendar />} label="Created" value={formatDate(ticket.createdAt)} />

          {/* Info tambahan — hanya untuk logged-in user */}
          {!isPublic && (
            <>
              <InfoItem icon={<Mail />} label="Email" value={ticket.submitterEmail} />
              {ticket.submitterPhone && (
                <InfoItem icon={<Phone />} label="Phone" value={ticket.submitterPhone} />
              )}
              {ticket.submitterDepartment && (
                <InfoItem icon={<Building />} label="Department" value={ticket.submitterDepartment} />
              )}
            </>
          )}

          <InfoItem
            icon={<Tag />}
            label="Category"
            value={<Badge variant="outline">{ticket.category}</Badge>}
          />
          <InfoItem
            icon={<Clock />}
            label="Last Updated"
            value={formatDate(ticket.updatedAt)}
          />
        </div>

        {/* Description */}
        <div className={styles.description}>
          <h3>Description</h3>
          <p className={styles.descriptionText}>{ticket.description}</p>
        </div>

        {/* Attachment Image */}
        {ticket.imageUrl && (
          <div className={styles.attachmentSection}>
            <h3>
              <ImageIcon
                size={14}
                style={{ display: "inline", marginRight: 6, opacity: 0.7 }}
              />
              Attachment
            </h3>
            <div className={styles.imageAttachment}>
              <a
                href={`${BACKEND_URL}${ticket.imageUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.imageLink}
              >
                <img
                  src={`${BACKEND_URL}${ticket.imageUrl}`}
                  alt="Ticket Attachment"
                />
              </a>
            </div>
          </div>
        )}

        {/* Staff Assigned & Collaborators */}
        <div className={styles.staffGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>
              <User />
              Staff Assigned
            </span>
            <span className={styles.infoValue}>
              {ticket.assignedToId ? (
                <span
                  className={styles.profileLink}
                  onClick={() => onStaffClick(String(ticket.assignedToId))}
                >
                  {ticket.assignedTo}
                </span>
              ) : (
                ticket.assignedTo || "Waiting for Assignment"
              )}
            </span>
          </div>

          {ticket.collaborators && ticket.collaborators.length > 0 && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>
                <Users />
                Collaborators
              </span>
              <div className={styles.collaboratorsList}>
                {ticket.collaborators.map((c, i) => {
                  const collaboratorId = ticket.collaboratorIds[i];
                  return (
                    <Badge key={i} variant="secondary" className={styles.collaboratorBadge}>
                      {collaboratorId ? (
                        <span
                          className={styles.profileLinkBadge}
                          onClick={() => onStaffClick(String(collaboratorId))}
                        >
                          {c}
                        </span>
                      ) : (
                        c
                      )}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Status History Tracking Timeline */}
        {ticket.notes && ticket.notes.some(n => n.content.includes('Status changed')) && (
          <div className={styles.trackingTimelineSection} style={{ marginTop: 'var(--space-6)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', fontSize: '1rem', marginBottom: 'var(--space-4)' }}>
              <Clock size={16} style={{ marginRight: 8, opacity: 0.7 }} />
              Status History
            </h3>
            
            <div className={styles.trackingTimeline}>
              {ticket.notes
                .filter(n => n.content.includes('Status changed'))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((note, index) => {
                   const parsed = parseStatusChangeNote(note.content);
                   if (!parsed) return null;
                   
                   const isFirst = index === 0;
                   const dateObj = new Date(note.createdAt);
                   const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                   const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                   
                   return (
                     <div key={note.id} className={`${styles.trackingItem} ${isFirst ? styles.trackingItemActive : ''}`}>
                       <div className={styles.trackingTime}>
                         <span className={styles.trackingDate}>{dateStr}</span>
                         <span className={styles.trackingHour}>{timeStr}</span>
                       </div>
                       
                       <div className={styles.trackingNode}>
                         <div className={styles.trackingDot}></div>
                         <div className={styles.trackingLine}></div>
                       </div>
                       
                       <div className={styles.trackingContent}>
                         <p className={styles.trackingStatus}>
                           Status changed to <strong>{parsed.to}</strong>
                         </p>
                         {parsed.reason && parsed.reason !== "-" && (
                           <p className={styles.trackingReason}>{parsed.reason}</p>
                         )}
                         <p className={styles.trackingStaff}>by {note.author}</p>
                       </div>
                     </div>
                   );
                })}
            </div>
          </div>
        )}

        {/* Resolution Summary (ditampilkan jika sudah resolved) */}
        {ticket.resolutionSummary && (
          <div className={styles.resolutionSection}>
            <h3 className={styles.resolutionTitle}>
              <CheckCircle className={styles.resolutionIcon} />
              Resolution Summary
            </h3>
            <p className={styles.resolutionText}>{ticket.resolutionSummary}</p>
            {ticket.resolutionImageUrl && (
              <div style={{ marginTop: "var(--space-3)" }}>
                <a
                  href={`${BACKEND_URL}${ticket.resolutionImageUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={`${BACKEND_URL}${ticket.resolutionImageUrl}`}
                    alt="Resolution Attachment"
                    style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: "var(--radius-sm)", objectFit: "contain" }}
                  />
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Internal Helper
// ─────────────────────────────────────────────

/** Satu baris info label+value dalam grid. */
function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className={styles.infoItem}>
      <span className={styles.infoLabel}>
        {icon}
        {label}
      </span>
      <span className={styles.infoValue}>{value}</span>
    </div>
  );
}
