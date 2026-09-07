import { Repeat, Send } from "lucide-react";
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

interface CategoryChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  /** Deskripsi perubahan, mis. "Kategori: Hardware → Software" */
  changeLabel: string;
  ticketCode?: string;
}

export function CategoryChangeDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onSubmit,
  changeLabel,
  ticketCode,
}: CategoryChangeDialogProps) {
  const isReasonEmpty = reason.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle className={styles.dialogTitle}>
            <Repeat className={styles.dialogIcon} />
            Ubah Kategori Tiket
          </DialogTitle>
          <DialogDescription className={styles.dialogDescription}>
            {"Anda mengubah kategori tiket "}
            {ticketCode ? <strong>{ticketCode}</strong> : null}
            {": "}
            <strong>{changeLabel}</strong>. Alasan wajib diisi dan akan tercatat di Ticket History.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.dialogBody}>
          <Label htmlFor="category-reason">Alasan Perubahan Kategori *</Label>
          <Textarea
            id="category-reason"
            placeholder="Contoh: Setelah dicek langsung, masalahnya adalah perangkat fisik, bukan software..."
            rows={4}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
          {isReasonEmpty && (
            <p style={{ marginTop: 6, fontSize: "0.75rem", color: "#fca5a5", display: "flex", gap: 6 }}>
              <span style={{ fontWeight: 700 }}>!</span>
              Alasan wajib diisi — perubahan kategori akan tercatat di Ticket History.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isReasonEmpty}>
            <Send style={{ width: "16px", height: "16px", marginRight: 6 }} />
            Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
