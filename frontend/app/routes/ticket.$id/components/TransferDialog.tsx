import { ArrowRightLeft, MessageSquare } from "lucide-react";
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

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  fromName: string;
  toName: string;
  ticketCode?: string;
}

export function TransferDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onSubmit,
  fromName,
  toName,
  ticketCode,
}: TransferDialogProps) {
  const isReasonEmpty = reason.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle className={styles.dialogTitle}>
            <ArrowRightLeft className={styles.dialogIcon} />
            Oper (Transfer) Tiket
          </DialogTitle>
          <DialogDescription className={styles.dialogDescription}>
            {ticketCode ? (
              <>Tiket <strong>{ticketCode}</strong> akan dioper dari <strong>{fromName}</strong> ke <strong>{toName}</strong>.</>
            ) : (
              <>Tiket akan dioper dari <strong>{fromName}</strong> ke <strong>{toName}</strong>.</>
            )}{" "}
            Alasan oper wajib diisi dan akan tercatat di status history.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.dialogBody}>
          <Label htmlFor="transfer-reason">Alasan Oper *</Label>
          <Textarea
            id="transfer-reason"
            placeholder="Contoh: Saya sedang mengerjakan tiket prioritas lain, jadi tiket ini saya oper ke Anda yang lebih paham topiknya..."
            rows={4}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
          {isReasonEmpty && (
            <p style={{ marginTop: 6, fontSize: "0.75rem", color: "#fca5a5", display: "flex", gap: 6 }}>
              <span style={{ fontWeight: 700 }}>!</span>
              Alasan oper wajib diisi — jelaskan mengapa tiket ini dipindahkan ke staff lain.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isReasonEmpty}>
            <MessageSquare style={{ width: "16px", height: "16px", marginRight: 6 }} />
            Oper Tiket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
