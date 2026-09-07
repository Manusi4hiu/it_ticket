import { Gauge, Send } from "lucide-react";
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

interface PriorityChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  /** Deskripsi perubahan, mis. "Prioritas: Medium → High" */
  changeLabel: string;
  ticketCode?: string;
}

export function PriorityChangeDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onSubmit,
  changeLabel,
  ticketCode,
}: PriorityChangeDialogProps) {
  const isReasonEmpty = reason.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle className={styles.dialogTitle}>
            <Gauge className={styles.dialogIcon} />
            Ubah Prioritas Tiket
          </DialogTitle>
          <DialogDescription className={styles.dialogDescription}>
            {"Anda mengubah prioritas tiket "}
            {ticketCode ? <strong>{ticketCode}</strong> : null}
            {": "}
            <strong>{changeLabel}</strong>. Alasan wajib diisi dan akan tercatat di Ticket History.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.dialogBody}>
          <Label htmlFor="priority-reason">Alasan Perubahan Prioritas *</Label>
          <Textarea
            id="priority-reason"
            placeholder="Contoh: Tiket ini menghambat operasional kasir, perlu dikerjakan lebih dulu..."
            rows={4}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
          {isReasonEmpty && (
            <p style={{ marginTop: 6, fontSize: "0.75rem", color: "#fca5a5", display: "flex", gap: 6 }}>
              <span style={{ fontWeight: 700 }}>!</span>
              Alasan wajib diisi — perubahan prioritas akan tercatat di Ticket History.
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
