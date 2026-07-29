import { MessageSquare } from "lucide-react";
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

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  targetStatus: string;
}

export function ReasonDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onSubmit,
  targetStatus,
}: ReasonDialogProps) {
  const isReasonEmpty = reason.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle className={styles.dialogTitle}>
            <MessageSquare className={styles.dialogIcon} />
            Reason Required
          </DialogTitle>
          <DialogDescription className={styles.dialogDescription}>
            Please provide a reason for changing the ticket status to <strong>{targetStatus}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.dialogBody}>
          <Label htmlFor="status-reason">Reason *</Label>
          <Textarea
            id="status-reason"
            placeholder="Enter reason..."
            rows={4}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isReasonEmpty}>
            Submit Reason
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
