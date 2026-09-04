/**
 * ResolveDialog.tsx
 *
 * Dialog modal untuk proses resolve ticket.
 * Ditampilkan ketika staff menekan tombol "Mark as Resolved".
 * Membutuhkan resolution summary minimal 20 karakter dan waktu aktual resolve.
 */

import { CheckCircle, X, Image as ImageIcon } from "lucide-react";
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
import { toDatetimeLocalString } from "~/utils/date";
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
  /** File gambar bukti resolusi (opsional) */
  resolutionImage?: File | null;
  /** Callback saat file gambar dipilih */
  onResolutionImageChange?: (file: File | null) => void;
  /** Callback submit form resolve */
  onSubmit: () => void;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

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
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (onResolutionImageChange) {
      onResolutionImageChange(file);
    }
  };

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
              max={toDatetimeLocalString(new Date())}
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
            <ImageIcon size={14} style={{ display: "inline", marginRight: 6 }} />
            Resolution Image (optional)
          </Label>
          <input
            type="file"
            id="resolution-image"
            accept="image/jpeg,image/png,image/gif,image/webp"
            style={{
              width: "100%",
              padding: "var(--space-1)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-neutral-4)",
              marginTop: "var(--space-1)",
            }}
            onChange={handleFileChange}
          />

          {resolutionImage && (
            <div style={{
              position: "relative",
              width: "fit-content",
              marginTop: 8,
              borderRadius: 6,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.15)",
            }}>
              <img
                src={URL.createObjectURL(resolutionImage)}
                alt={resolutionImage.name}
                style={{ width: "100%", maxHeight: 120, objectFit: "cover" }}
              />
              <div style={{ padding: "2px 6px", fontSize: "0.72rem", background: "rgba(0,0,0,0.6)", color: "#fff" }}>
                {resolutionImage.name} ({(resolutionImage.size / 1024).toFixed(0)} KB)
              </div>
              {onResolutionImageChange && (
                <button
                  type="button"
                  onClick={() => onResolutionImageChange(null)}
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
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!resolutionSummary.trim() || !resolveDate}>
            Resolve Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
