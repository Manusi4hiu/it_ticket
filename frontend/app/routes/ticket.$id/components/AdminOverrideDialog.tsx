import { ShieldCheck, Send } from "lucide-react";
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

interface AdminOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  /** Deskripsi perubahan, contoh: "Assignee: Staff A → Staff B" */
  changeLabel: string;
  ticketCode?: string;
}

export function AdminOverrideDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onSubmit,
  changeLabel,
  ticketCode,
}: AdminOverrideDialogProps) {
  const isReasonEmpty = reason.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle className={styles.dialogTitle}>
            <ShieldCheck className={styles.dialogIcon} />
            Admin Override — Alasan Wajib
          </DialogTitle>
          <DialogDescription className={styles.dialogDescription}>
            Anda mengubah tiket{ticketCode ? <> <strong>{ticketCode}</strong></> : null} yang sedang dipegang staff:{" "}
            <strong>{changeLabel}</strong>. Alasan wajib diisi dan akan dikirim
            sebagai notifikasi ke staff terkait.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.dialogBody}>
          <Label htmlFor="admin-reason">Alasan Perubahan *</Label>
          <Textarea
            id="admin-reason"
            placeholder="Contoh: Perlu dipercepat karena SLA hampir breach, jadi saya pindahkan ke staff yang lebih available..."
            rows={4}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
          {isReasonEmpty && (
            <p style={{ marginTop: 6, fontSize: "0.75rem", color: "#fca5a5", display: "flex", gap: 6 }}>
              <span style={{ fontWeight: 700 }}>!</span>
              Alasan wajib diisi — notifikasi dengan alasan ini akan dikirim ke pemilik tiket
              (dan assignee baru jika assignee diganti).
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isReasonEmpty}>
            <Send style={{ width: "16px", height: "16px", marginRight: 6 }} />
            Simpan & Kirim Alasan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
