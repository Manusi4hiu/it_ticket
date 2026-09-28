/**
 * StaffProfileModal.tsx
 *
 * Dialog modal yang menampilkan profil staff (nama, email, telepon)
 * beserta daftar ticket yang sedang "in progress" dikerjakan.
 * Ditrigger saat user mengklik nama staff/collaborator.
 */

import { useNavigate } from "react-router";
import { Mail, Phone, TicketPlus } from "lucide-react";
import { Badge } from "~/components/ui/badge/badge";
import { Button } from "~/components/ui/button/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import type { Ticket } from "~/services/ticket.service";
import type { StaffInfo } from "../types";
import styles from "../style.module.css";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface StaffProfileModalProps {
  /** Apakah modal terbuka */
  open: boolean;
  /** Callback saat modal ditutup */
  onOpenChange: (open: boolean) => void;
  /** Data staff yang ditampilkan (null jika belum dipilih) */
  staff: StaffInfo | null;
  /** Daftar ticket yang di-assign ke staff ini */
  tickets: Ticket[];
  /** True selama fetch tickets berlangsung */
  loading: boolean;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

/**
 * StaffProfileModal
 *
 * Menampilkan info kontak staff dan ticket yang sedang dikerjakan.
 * Hanya menampilkan ticket dengan status "in progress" atau "in-progress".
 *
 * @example
 * <StaffProfileModal
 *   open={isStaffModalOpen}
 *   onOpenChange={setIsStaffModalOpen}
 *   staff={selectedStaff}
 *   tickets={staffTickets}
 *   loading={loadingStaffTickets}
 * />
 */
export function StaffProfileModal({
  open,
  onOpenChange,
  staff,
  tickets,
  loading,
}: StaffProfileModalProps) {
  const navigate = useNavigate();

  /** Filter hanya ticket in-progress */
  const inProgressTickets = tickets.filter(
    (t) =>
      t.status.toLowerCase() === "in progress" ||
      t.status.toLowerCase() === "in-progress"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: "450px" }}>
        <DialogHeader>
          <DialogTitle>Staff Profile</DialogTitle>
        </DialogHeader>

        {staff && (
          <div style={{ padding: "var(--space-2) 0" }}>
            {/* Staff Info Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-4)",
                marginBottom: "var(--space-6)",
              }}
            >
              {/* Avatar with presence dot */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div className={styles.modalAvatar}>{staff.name.charAt(0)}</div>
                {(() => {
                  const COLOR_MAP: Record<string, string> = {
                    online: '#22c55e',
                    idle: '#f59e0b',
                    dnd: '#ef4444',
                    invisible: '#94a3b8',
                    break: '#fb923c',
                  };
                  const color = COLOR_MAP[staff.presenceStatus ?? 'online'] ?? '#22c55e';
                  const label = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', invisible: 'Invisible', break: 'Break' }[staff.presenceStatus ?? 'online'] ?? 'Online';
                  return (
                    <span
                      title={label}
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        right: 2,
                        width: 13,
                        height: 13,
                        borderRadius: '50%',
                        background: color,
                        border: '2px solid var(--color-surface-2, #1e293b)',
                        boxShadow: `0 0 5px ${color}99`,
                        display: 'block',
                      }}
                    />
                  );
                })()}
              </div>
              <div>
                <h3 className={styles.modalStaffName}>{staff.name}</h3>
                {/* Presence label */}
                {(() => {
                  const LABELS: Record<string, { label: string; color: string }> = {
                    online:    { label: 'Online',         color: '#22c55e' },
                    idle:      { label: 'Idle',           color: '#f59e0b' },
                    dnd:       { label: 'Do Not Disturb', color: '#ef4444' },
                    invisible: { label: 'Invisible',      color: '#94a3b8' },
                    break:     { label: 'Break',          color: '#fb923c' },
                  };
                  const info = LABELS[staff.presenceStatus ?? 'online'] ?? LABELS.online;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, marginTop: 2 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: info.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', color: info.color, fontWeight: 500 }}>{info.label}</span>
                    </div>
                  );
                })()}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    marginTop: "2px",
                  }}
                >
                  <div className={styles.infoLabel} style={{ fontSize: "0.75rem" }}>
                    <Mail size={12} style={{ marginRight: 6 }} />
                    {staff.email}
                  </div>
                  {staff.phone && (
                    <div className={styles.infoLabel} style={{ fontSize: "0.75rem" }}>
                      <Phone size={12} style={{ marginRight: 6 }} />
                      {staff.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>


            {/* In Progress Tickets */}
            <div className={styles.modalTicketsTitle}>
              <TicketPlus size={18} />
              In Progress Tickets
            </div>

            <div className={styles.modalTicketsList}>
              {loading ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px",
                    color: "var(--color-neutral-9)",
                  }}
                >
                  Loading tickets...
                </div>
              ) : inProgressTickets.length === 0 ? (
                <div className={styles.modalNoTickets}>
                  {tickets.length === 0
                    ? "No tickets found for this staff."
                    : "No tickets currently in progress."}
                </div>
              ) : (
                inProgressTickets.map((t) => (
                  <div
                    key={t.id}
                    className={styles.modalTicketItem}
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/ticket/${t.ticketCode || t.id}`);
                    }}
                  >
                    <div className={styles.modalTicketHeader}>
                      <span className={styles.modalTicketId}>
                        {t.ticketCode || t.id}
                      </span>
                      <Badge
                        variant="outline"
                        style={{ fontSize: "0.6rem", height: "18px" }}
                      >
                        {t.status}
                      </Badge>
                    </div>
                    <h4 className={styles.modalTicketTitle}>{t.title}</h4>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
