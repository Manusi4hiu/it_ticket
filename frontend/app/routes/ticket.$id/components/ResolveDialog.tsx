/**
 * ResolveDialog.tsx
 *
 * Dialog modal untuk proses resolve ticket.
 * Ditampilkan ketika staff menekan tombol "Mark as Resolved".
 * Membutuhkan resolution summary minimal 20 karakter dan waktu aktual resolve.
 */

import { CheckCircle, Upload } from "lucide-react";
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
import type { Category } from "~/services/settings.service";
import styles from "../style.module.css";

// ─────────────────────────────────────────────
// Shared field style (dark-theme aware)
// ─────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "6px",
  padding: "9px 12px",
  borderRadius: "8px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  fontSize: "0.875rem",
  lineHeight: "1.5",
  outline: "none",
  transition: "border-color 0.2s",
  boxSizing: "border-box" as const,
};

const fieldErrorStyle: React.CSSProperties = {
  ...fieldStyle,
  border: "1px solid #ef4444",
};

const fieldGroup: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  marginBottom: "16px",
};

const errorTextStyle: React.CSSProperties = {
  marginTop: "5px",
  fontSize: "0.75rem",
  color: "#ef4444",
};

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface ResolveDialogProps {
  /** Apakah dialog terbuka */
  open: boolean;
  /** Callback saat dialog ditutup (cancel atau setelah submit) */
  onOpenChange: (open: boolean) => void;
  /** Daftar kategori dari settings */
  categories: Category[];
  /** Kategori yang dipilih saat resolve */
  resolveCategory: string;
  /** Setter untuk resolveCategory */
  onResolveCategoryChange: (value: string) => void;
  /** Error validasi kategori */
  resolveCategoryError: string;
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
 */
export function ResolveDialog({
  open,
  onOpenChange,
  categories,
  resolveCategory,
  onResolveCategoryChange,
  resolveCategoryError,
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
      <DialogContent
        className={styles.dialogContent}
        style={{ maxWidth: "min(520px, 95vw)" }}
      >
        {/* ── Header ── */}
        <DialogHeader>
          <DialogTitle
            className={styles.dialogTitle}
            style={{ display: "flex", alignItems: "center", gap: "10px" }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "rgba(16,185,129,0.15)",
                flexShrink: 0,
              }}
            >
              <CheckCircle size={18} color="#10b981" />
            </span>
            Resolve Ticket
          </DialogTitle>
          <DialogDescription
            className={styles.dialogDescription}
            style={{ marginTop: "4px" }}
          >
            Please provide a detailed summary of how this issue was resolved.
          </DialogDescription>
        </DialogHeader>

        {/* ── Scrollable Body ── */}
        <div
          style={{
            maxHeight: "calc(90vh - 200px)",
            overflowY: "auto",
            paddingRight: "8px",
          }}
        >
          {/* Grid Layout for Category & Date */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
            {/* Ticket Category */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "200px" }}>
              <Label htmlFor="resolve-category" style={{ fontWeight: 500 }}>
                Ticket Category{" "}
                <span style={{ color: "#ef4444" }}>*</span>
              </Label>
              <select
                id="resolve-category"
                value={resolveCategory}
                onChange={(e) => onResolveCategoryChange(e.target.value)}
                required
                style={resolveCategoryError ? fieldErrorStyle : fieldStyle}
              >
                <option value="" style={{ background: "#1e293b" }}>
                  Select Category
                </option>
                {(categories || [])
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c.id} value={c.name} style={{ background: "#1e293b" }}>
                      {c.name}
                    </option>
                  ))}
              </select>
              {resolveCategoryError && (
                <p style={errorTextStyle}>{resolveCategoryError}</p>
              )}
            </div>

            {/* Actual Time Resolve */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "200px" }}>
              <Label htmlFor="resolve-date" style={{ fontWeight: 500 }}>
                Actual Time Resolve{" "}
                <span style={{ color: "#ef4444" }}>*</span>
              </Label>
              <input
                type="datetime-local"
                id="resolve-date"
                value={resolveDate}
                onChange={(e) => onResolveDateChange(e.target.value)}
                required
                style={{ ...fieldStyle, colorScheme: "dark" }}
              />
            </div>
          </div>

          {/* Resolution Summary */}
          <div style={fieldGroup}>
            <Label htmlFor="resolution-summary" style={{ fontWeight: 500 }}>
              Resolution Summary{" "}
              <span style={{ color: "#ef4444" }}>*</span>
            </Label>
            <Textarea
              id="resolution-summary"
              placeholder="Describe the steps taken to resolve this issue..."
              rows={5}
              value={resolutionSummary}
              onChange={(e) => onSummaryChange(e.target.value)}
              className={resolutionError ? styles.textareaError : ""}
              style={{ marginTop: "6px", resize: "vertical", minHeight: "110px" }}
            />
            {resolutionError && (
              <p style={errorTextStyle}>{resolutionError}</p>
            )}
          </div>

          {/* Resolution Image */}
          <div style={{ ...fieldGroup, marginBottom: 0 }}>
            <Label htmlFor="resolution-image" style={{ fontWeight: 500 }}>
              Resolution Image{" "}
              <span
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: "0.8rem",
                  fontWeight: 400,
                }}
              >
                (optional)
              </span>
            </Label>
            <label
              htmlFor="resolution-image"
              style={{
                marginTop: "6px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px dashed rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.03)",
                cursor: "pointer",
                fontSize: "0.875rem",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <Upload size={16} style={{ flexShrink: 0 }} />
              {resolutionImage ? (
                <span
                  style={{
                    color: "rgba(255,255,255,0.85)",
                    wordBreak: "break-all",
                  }}
                >
                  {resolutionImage.name}
                </span>
              ) : (
                "Click to upload image (JPG, PNG, GIF)"
              )}
              <input
                type="file"
                id="resolution-image"
                accept="image/jpeg,image/png,image/gif"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  onResolutionImageChange(file);
                }}
              />
            </label>
          </div>
        </div>

        {/* ── Footer ── */}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <CheckCircle size={16} />
            Resolve Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
