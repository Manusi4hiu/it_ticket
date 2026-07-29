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

  // Form state
  status: string;
  priority: string;
  category: string;
  assignedTo: string;
  collaborators: string[];
  collaboratorIds: string[];
  newNote: string;
  noteImage: File | null;

  // Setters
  onStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onAssignedToChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onNoteImageChange: (file: File) => void;
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
              disabled={isManagement}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
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
          </div>

          {/* Priority */}
          <div className={styles.formGroup}>
            <Label htmlFor="priority">Ticket Priority</Label>
            {isAdministrator ? (
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
            {!isManagement ? (
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
              disabled={isManagement || !isAdministrator}
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
                  if (e.target.files && e.target.files[0]) {
                    onNoteImageChange(e.target.files[0]);
                  }
                }}
                className={styles.fileInput}
              />
              <Label htmlFor="note-image" className={styles.fileLabel}>
                <ImageIcon size={18} style={{ marginRight: 8 }} />
                {noteImage ? "Change Image" : "Select Image"}
              </Label>

              {noteImage && (
                <div className={styles.filePreview}>
                  <div className={styles.previewInfo}>
                    <ImageIcon size={14} style={{ marginRight: 6 }} />
                    <span className={styles.fileName}>{noteImage.name}</span>
                    <button
                      type="button"
                      onClick={onNoteImageClear}
                      className={styles.removeFile}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <img
                    src={URL.createObjectURL(noteImage)}
                    alt="Preview"
                    className={styles.imagePreviewThumb}
                  />
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
