/**
 * ResolveDialog.tsx
 *
 * Dialog modal untuk proses resolve ticket.
 * Ditampilkan ketika staff menekan tombol "Mark as Resolved".
 * Membutuhkan resolution summary minimal 20 karakter dan waktu aktual resolve.
 */

import { CheckCircle } from "lucide-react";
import { Button } from "~/components/ui/button/button";
import { Label } from "~/components/ui/label/label";
import { Textarea } from "~/components/ui/textarea/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import styles from "../style.module.css";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface ResolveDialogProps {
  /** Apakah dialog terbuka */
  open: boolean;
  /** Callback saat dialog ditutup (cancel atau setelah submit) */
  onOpenChange: (open: boolean) => void;
  /** Nilai datetime-local untuk waktu resolve aktual */
  resolveDate: string;
  /** Setter untuk resolveDate */
  onResolveDateChange: (value: string) => void;
  /** Teks resolution summary */
  resolutionSummary: string;
  /** Setter untuk resolutionSummary */
  onSummaryChange: (value: string) => void;
  /** Pesan error validasi (kosong jika tidak ada error) */
  resolutionError: string;
  /** File gambar resolusi (opsional) */
  resolutionImage: File | null;
  /** Callback saat file gambar dipilih */
  onResolutionImageChange: (file: File | null) => void;
  /** Callback submit form resolve */
  onSubmit: () => void;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

/**
 * ResolveDialog
 *
 * Modal form untuk menutup ticket dengan resolution summary.
 * Validasi dilakukan di `useTicketActions.handleSubmitResolution`.
 *
 * @example
 * <ResolveDialog
 *   open={showResolveDialog}
 *   onOpenChange={setShowResolveDialog}
 *   resolveDate={resolveDate}
 *   onResolveDateChange={setResolveDate}
 *   resolutionSummary={resolutionSummary}
 *   onSummaryChange={setResolutionSummary}
 *   resolutionError={resolutionError}
 *   onSubmit={handleSubmitResolution}
 * />
 */
export function ResolveDialog({
  open,
  onOpenChange,
  resolveDate,
  onResolveDateChange,
  resolutionSummary,
  onSummaryChange,
  resolutionError,
  resolutionImage,
  onResolutionImageChange,
  onSubmit,
}: ResolveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle className={styles.dialogTitle}>
            <CheckCircle className={styles.dialogIcon} />
            Resolve Ticket
          </DialogTitle>
          <DialogDescription className={styles.dialogDescription}>
            Please provide a detailed summary of how this issue was resolved.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.dialogBody}>
          {/* Waktu resolve aktual */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <Label htmlFor="resolve-date">Actual Time Resolve *</Label>
            <input
              type="datetime-local"
              id="resolve-date"
              className={styles.input}
              style={{
                width: "100%",
                padding: "var(--space-2)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-neutral-4)",
                marginTop: "var(--space-1)",
              }}
              value={resolveDate}
              onChange={(e) => onResolveDateChange(e.target.value)}
              required
            />
          </div>

          {/* Resolution Summary */}
          <Label htmlFor="resolution-summary">Resolution Summary *</Label>
          <Textarea
            id="resolution-summary"
            placeholder="Describe the steps taken to resolve this issue..."
            rows={6}
            value={resolutionSummary}
            onChange={(e) => {
              onSummaryChange(e.target.value);
            }}
            className={resolutionError ? styles.textareaError : ""}
          />
          {resolutionError && (
            <p className={styles.errorText}>{resolutionError}</p>
          )}

          {/* Resolution Image */}
          <Label htmlFor="resolution-image" style={{ marginTop: "var(--space-3)", display: "block" }}>
            Resolution Image (optional)
          </Label>
          <input
            type="file"
            id="resolution-image"
            accept="image/jpeg,image/png,image/gif"
            style={{
              width: "100%",
              padding: "var(--space-1)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-neutral-4)",
              marginTop: "var(--space-1)",
            }}
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              onResolutionImageChange(file);
            }}
          />
          {resolutionImage && (
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
              Selected: {resolutionImage.name}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>Resolve Ticket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
