import { useState } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "~/components/ui/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import styles from "./ticket-pagination.module.css";

interface TicketPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function TicketPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  isLoading = false,
}: TicketPaginationProps) {
  const [isJumpOpen, setIsJumpOpen] = useState(false);
  const [jumpPage, setJumpPage] = useState("");

  if (totalItems <= 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  const go = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage || isLoading) return;
    onPageChange(page);
  };

  const submitJump = () => {
    const p = parseInt(jumpPage, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      onPageChange(p);
      setIsJumpOpen(false);
      setJumpPage("");
    }
  };

  return (
    <>
      <div className={styles.pagination}>
        <div className={styles.info}>
          Showing {start} to {end} of {totalItems} tickets
        </div>
        <div className={styles.actions}>
          <Button
            variant="outline"
            size="sm"
            className={styles.pageButton}
            disabled={currentPage === 1 || isLoading}
            onClick={() => go(currentPage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </Button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
            if (
              pageNum === 1 ||
              pageNum === totalPages ||
              (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
            ) {
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? "default" : "outline"}
                  size="sm"
                  className={`${styles.pageButton} ${
                    pageNum === currentPage ? styles.active : ""
                  }`}
                  disabled={isLoading}
                  onClick={() => go(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            }
            if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
              return (
                <Button
                  key={pageNum}
                  variant="ghost"
                  size="sm"
                  className={`${styles.pageButton} ${styles.ellipsis}`}
                  onClick={() => setIsJumpOpen(true)}
                  title="Go to page"
                >
                  <MoreHorizontal size={14} />
                </Button>
              );
            }
            return null;
          })}

          <Button
            variant="outline"
            size="sm"
            className={styles.pageButton}
            disabled={currentPage === totalPages || isLoading}
            onClick={() => go(currentPage + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <Dialog open={isJumpOpen} onOpenChange={setIsJumpOpen}>
        <DialogContent className={styles.dialog}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle className={styles.dialogTitle}>Go to page</DialogTitle>
            <DialogDescription className={styles.dialogDesc}>
              1 – {totalPages}
            </DialogDescription>
          </DialogHeader>
          <div className={styles.dialogBody}>
            <div className={styles.jumpRow}>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitJump();
                }}
                placeholder={`${currentPage}`}
                autoFocus
                className={styles.jumpInput}
              />
              <span className={styles.jumpTotal}>/ {totalPages}</span>
            </div>
          </div>
          <DialogFooter className={styles.dialogFooter}>
            <Button
              variant="outline"
              size="sm"
              className={styles.dialogCancel}
              onClick={() => {
                setIsJumpOpen(false);
                setJumpPage("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className={styles.dialogGo}
              disabled={
                !jumpPage ||
                isNaN(parseInt(jumpPage, 10)) ||
                parseInt(jumpPage, 10) < 1 ||
                parseInt(jumpPage, 10) > totalPages
              }
              onClick={submitJump}
            >
              Go
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
