/**
 * TicketActionsPanel.tsx
 *
 * Panel aksi untuk staff/administrator pada halaman ticket detail.
 * Berisi form untuk update status, priority, category, assignee,
 * collaborators, internal note, image documentation, dan tombol resolve.
 *
 * Hanya ditampilkan untuk user yang login. Management mendapat view-only.
 */

import {
  Settings,
  CheckCircle,
  Users,
  X,
  Image as ImageIcon,
  ArrowUpCircle,
} from "lucide-react";
import { Button } from "~/components/ui/button/button";
import { Label } from "~/components/ui/label/label";
import { Textarea } from "~/components/ui/textarea/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select/select";
import { Badge } from "~/components/ui/badge/badge";
import type { Agent, Ticket } from "~/services/ticket.service";
import type { Priority, Category, Status } from "~/services/settings.service";
import { sortStatusesByWorkflow, canTakeTicket } from "~/utils/ticket-ui";
import type { CurrentUser } from "../types";
import styles from "../style.module.css";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface TicketActionsPanelProps {
  ticket: Ticket;
  agents: Agent[];
  statuses: Status[];
  priorities: Priority[];
  categories: Category[];
  currentUser: CurrentUser | null;
  isAdministrator: boolean;
  isManagement: boolean;
  /** Apakah user login adalah pemilik/pengerja tiket (assignedTo)? Pemilik bisa mengoper. */
  isTicketOwner?: boolean;

  // Form state
  status: string;
  priority: string;
  category: string;
  assignedTo: string;
  collaborators: string[];
  collaboratorIds: string[];
  newNote: string;
  noteImage?: File | null;

  // Setters
  onStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onAssignedToChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onNoteImageChange?: (file: File | null) => void;
  onNoteImageClear: () => void;
  onAddNote: () => void;

  // Handlers
  onAddCollaborator: (id: string) => void;
  onRemoveCollaborator: (name: string) => void;
  onOpenResolveDialog: () => void;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

/**
 * TicketActionsPanel
 *
 * Form panel di kolom kanan untuk aksi-aksi ticket.
 * Management hanya bisa melihat, tidak bisa mengubah.
 *
 * @example
 * <TicketActionsPanel
 *   ticket={ticket}
 *   agents={agents}
 *   statuses={statuses}
 *   ... (semua state dan handler dari useTicketActions)
 * />
 */
export function TicketActionsPanel({
  ticket,
  agents,
  statuses,
  priorities,
  categories,
  currentUser,
  isAdministrator,
  isManagement,
  isTicketOwner = false,
  status,
  priority,
  category,
  assignedTo,
  collaborators,
  collaboratorIds,
  newNote,
  noteImage,
  onStatusChange,
  onPriorityChange,
  onCategoryChange,
  onAssignedToChange,
  onNoteChange,
  onNoteImageChange,
  onNoteImageClear,
  onAddNote,
  onAddCollaborator,
  onRemoveCollaborator,
  onOpenResolveDialog,
}: TicketActionsPanelProps) {
  const isResolved =
    ticket.status.toLowerCase() === "resolved" ||
    ticket.status.toLowerCase() === "closed";

  const canEditCollaborator =
    (isAdministrator || assignedTo === currentUser?.name) && !isManagement;

  // Otoritas mengubah tiket: hanya Admin, pemilik/pengerja tiket saat ini,
  // atau tiket yang belum dipegang siapa pun (assignedTo kosong).
  // Staff non-pemilik (mis. sudah mengoper ke orang lain) tidak bisa mengubah.
  const canEditTicket =
    !isManagement &&
    (isAdministrator || isTicketOwner || !ticket.assignedTo);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <Settings className={styles.sectionIcon} />
          Ticket Actions
        </h2>
      </div>

      <div className={styles.sectionContent}>
        <form className={styles.actionForm}>
          {/* Status */}
          <div className={styles.formGroup}>
            <Label htmlFor="status">Update Status</Label>
            <Select
              value={status}
              onValueChange={onStatusChange}
              disabled={!canEditTicket}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Tiket yang pernah diambil / di-assign / bukan New TIDAK bisa
                    kembali ke status default "New" — LOCK by backend,
                    opsi New disembunyikan dari dropdown */}
                {sortStatusesByWorkflow(statuses)
                  .filter((s) => {
                    const isNewStatus = s.isDefault || s.name.toLowerCase() === "new" || s.filterGroup === "new";
                    const isLockedFromNew = Boolean(ticket.takenAt || ticket.assignedToId || ticket.status.toLowerCase() !== "new");
                    return !(isLockedFromNew && isNewStatus);
                  })
                  .map((s) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {isManagement && (
              <p style={{ fontSize: "0.75rem", color: "var(--color-neutral-9)", marginTop: "var(--space-1)" }}>
                Management role has view-only access
              </p>
            )}
            {!isManagement && !canEditTicket && (
              <p style={{ fontSize: "0.75rem", color: "var(--color-neutral-9)", marginTop: "var(--space-1)" }}>
                Hanya pemilik tiket ({ticket.assignedTo}) atau Administrator yang bisa mengubah.
              </p>
            )}
          </div>

          {/* Priority — Admin + pemilik tiket (backend: Management view-only,
              staff non-pemilik ditolak untuk tiket taken) */}
          <div className={styles.formGroup}>
            <Label htmlFor="priority">Ticket Priority</Label>
            {canEditTicket ? (
              <Select value={priority} onValueChange={onPriorityChange}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.id} value={p.name.toLowerCase()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className={styles.priorityContainer}>
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
                    <ArrowUpCircle style={{ width: "14px", height: "14px", marginRight: "6px" }} />
                  )}
                  {ticket.priority}
                </span>
              </div>
            )}
          </div>

          {/* Category */}
          <div className={styles.formGroup}>
            <Label htmlFor="category">Ticket Category</Label>
            {canEditTicket ? (
              <Select value={category} onValueChange={onCategoryChange}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Uncategorized">Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className={styles.priorityContainer}>
                <span
                  className={styles.priorityBadge}
                  style={{
                    backgroundColor: "var(--color-neutral-2)",
                    color: "var(--color-neutral-11)",
                  }}
                >
                  {ticket.category}
                </span>
              </div>
            )}
          </div>

          {/* Assignee */}
          <div className={styles.formGroup}>
            <Label htmlFor="assignee">Assign To</Label>
            <Select
              value={assignedTo || "unassigned"}
              onValueChange={(value) =>
                onAssignedToChange(value === "unassigned" ? "" : value)
              }
              disabled={
                isManagement ||
                !(isAdministrator || isTicketOwner) ||
                !canTakeTicket(ticket.status)
              }
            >
              <SelectTrigger id="assignee">
                <SelectValue placeholder="Select agent..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.name}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(isAdministrator || isTicketOwner) && !canTakeTicket(ticket.status) && (
              <p style={{ fontSize: "0.75rem", color: "var(--color-neutral-9)", marginTop: "var(--space-1)" }}>
                Ticket {ticket.status} tidak bisa di-assign — ubah statusnya dulu ke status lain.
              </p>
            )}
          </div>

          {/* Collaborators */}
          <div className={styles.formGroup}>
            <Label>Collaborators</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {collaborators.length > 0 && (
                <div className={styles.collaboratorsList}>
                  {collaborators.map((collaborator) => (
                    <Badge
                      key={collaborator}
                      variant="secondary"
                      className={styles.collaboratorBadgeAction}
                    >
                      <Users style={{ width: "12px", height: "12px" }} />
                      {collaborator}
                      {canEditCollaborator && (
                        <button
                          type="button"
                          onClick={() => onRemoveCollaborator(collaborator)}
                          className={styles.removeCollaboratorBtn}
                        >
                          <X />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              )}

              {canEditCollaborator && (
                <Select onValueChange={onAddCollaborator}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add collaborator..." />
                  </SelectTrigger>
                  <SelectContent>
                    {agents
                      .filter(
                        (agent) =>
                          agent.name !== assignedTo &&
                          !collaboratorIds.includes(String(agent.id))
                      )
                      .map((agent) => (
                        <SelectItem key={agent.id} value={String(agent.id)}>
                          {agent.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Internal Note */}
          <div className={styles.formGroup}>
            <Label htmlFor="note">Add Internal Note</Label>
            <Textarea
              id="note"
              placeholder="Add notes about this ticket..."
              rows={4}
              value={newNote}
              onChange={(e) => onNoteChange(e.target.value)}
            />
          </div>

          {/* Documentation Image */}
          <div className={styles.formGroup}>
            <Label>Documentation (Image)</Label>
            <div className={styles.fileUploadContainer}>
              <input
                type="file"
                id="note-image"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && onNoteImageChange) {
                    onNoteImageChange(file);
                  }
                  e.target.value = '';
                }}
                className={styles.fileInput}
              />
              <Label htmlFor="note-image" className={styles.fileLabel}>
                <ImageIcon size={18} style={{ marginRight: 8 }} />
                {noteImage ? "Change Image" : "Select Image"}
              </Label>

              {noteImage && (
                <div style={{
                  position: "relative",
                  width: "fit-content",
                  marginTop: 8,
                  borderRadius: 6,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}>
                  <img
                    src={URL.createObjectURL(noteImage)}
                    alt={noteImage.name}
                    style={{ width: "100%", maxHeight: 120, objectFit: "cover" }}
                  />
                  <div style={{ padding: "2px 6px", fontSize: "0.72rem", background: "rgba(0,0,0,0.6)", color: "#fff" }}>
                    {noteImage.name} ({(noteImage.size / 1024).toFixed(0)} KB)
                  </div>
                  <button
                    type="button"
                    onClick={onNoteImageClear}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "50%",
                      width: 20,
                      height: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      zIndex: 5
                    }}
                    title="Remove image"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div style={{ marginTop: "var(--space-2)", marginBottom: "var(--space-6)" }}>
            <Button
              type="button"
              variant="outline"
              onClick={onAddNote}
              style={{ width: "100%" }}
            >
              Add Note Only
            </Button>
          </div>

          {/* Action Buttons */}
          {!isManagement && (
            <>
              <Button
                type="button"
                onClick={onOpenResolveDialog}
                variant="default"
                className={styles.resolveButton}
                disabled={
                  !ticket?.assignedTo ||
                  ticket?.assignedTo !== currentUser?.name ||
                  isResolved
                }
              >
                <CheckCircle />
                {isResolved ? "Ticket Resolved" : "Mark as Resolved"}
              </Button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
