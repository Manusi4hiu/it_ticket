import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Trash2, CheckCheck, Circle } from "lucide-react";
import { Button } from "~/components/ui/button/button";
import { Badge } from "~/components/ui/badge/badge";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover/popover";
import { getTickets } from "~/services/ticket.service";
import { getAuthToken } from "~/services/api.service";
import styles from "./notification-bell.module.css";
import { useNavigate, useLocation } from "react-router";

interface Notification {
  id: number;            // id DB asli (untuk mark read / delete)
  key: string;           // react key unik
  title: string;
  message: string;
  time: Date;
  read: boolean;
  type?: string;
  ticketId?: string;
}

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const navigate = useNavigate();
  const location = useLocation();

  // Legacy read-dismiss ids (untuk fallback mode) — lazy dari localStorage
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`read_notifications_${userId}`);
      if (saved) {
        try { return new Set(JSON.parse(saved)); } catch { /* ignore */ }
      }
    }
    return new Set();
  });
  const readIdsRef = useRef(readIds);
  useEffect(() => { readIdsRef.current = readIds; }, [readIds]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?limit=50`, {
        headers: getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {},
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "failed");

      // Notifikasi dipertahankan SEMUA (read + unread) — dibedakan via indikator.
      const items: Notification[] = (data.notifications || []).map((n: any) => ({
        id: n.id,
        key: `notifdb-${n.id}`,
        title: n.title,
        message: n.reason ? `${n.message} — Alasan: ${n.reason}` : n.message,
        time: new Date(n.createdAt),
        read: Boolean(n.isRead),
        type: n.type,
        ticketId: n.ticketCode || (n.ticketId ? String(n.ticketId) : undefined),
      }));
      setNotifications(items);
    } catch {
      // Fallback lama: list tiket assigned
      try {
        const { tickets } = await getTickets({ assignedTo: userId });
        const assignedTickets = tickets.filter(
          (t) => t.status !== "resolved" && t.status !== "closed"
        );
        const fallback: Notification[] = assignedTickets
          .map((ticket) => {
            const isTransferred = Boolean((ticket as any).transferredAt);
            return {
              id: -(ticket.id), // negatif = legacy, tidak ada di DB notif
              key: `notif-${ticket.id}`,
              title: isTransferred ? "Ticket Transferred to You" : "Ticket Assigned to You",
              message: `${ticket.ticketCode || ticket.id}: ${ticket.title}`,
              time: new Date(isTransferred ? (ticket as any).transferredAt : ticket.updatedAt || ticket.createdAt),
              read: false,
              type: isTransferred ? "transferred" : "assigned",
              ticketId: ticket.ticketCode || ticket.id?.toString(),
            };
          })
          .filter(notif => !readIdsRef.current.has(notif.key));
        setNotifications(fallback);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchNotifications();
    const interval = setInterval(() => { if (userId) fetchNotifications(); }, 60000);
    return () => clearInterval(interval);
  }, [userId, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Mark as read (tidak menghapus dari inbox — hanya toggle indikator) ──
  const markAsRead = (notificationId: number, isLegacy: boolean, legacyKey?: string) => {
    // Update state lokal: tetap tampil, tapi read=true
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
    if (isLegacy && legacyKey) {
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(legacyKey);
        localStorage.setItem(`read_notifications_${userId}`, JSON.stringify(Array.from(next)));
        return next;
      });
      return;
    }
    // Sync ke backend
    fetch("/api/notifications/read", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      },
      body: JSON.stringify({ ids: [notificationId] }),
    }).catch(() => {});
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    fetch("/api/notifications/read", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      },
      body: JSON.stringify({ ids: [] }),
    }).catch(() => {});
  };

  // ── Delete mode: multi/single select lalu hapus ──
  const toggleDeleteMode = () => {
    setIsDeleteMode((v) => !v);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds).filter((id) => id > 0); // hanya id DB
    // Optimistic: hapus lokal (termasuk legacy)
    setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)));
    setSelectedIds(new Set());
    setIsDeleteMode(false);
    if (ids.length === 0) return;
    try {
      await fetch("/api/notifications/delete", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
        },
        body: JSON.stringify({ ids }),
      });
      fetchNotifications(); // sync ulang
    } catch { /* silent */ }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (isDeleteMode) {
      toggleSelect(notification.id);
      return;
    }
    // Klik notif -> tandai read (tetap tampil di inbox) lalu navigasi
    markAsRead(notification.id, notification.id < 0, notification.key);
    if (notification.ticketId) {
      navigate(`/ticket/${notification.ticketId}`);
      setIsOpen(false);
    }
  };

  // Auto-mark read saat user membuka halaman tiket terkait
  useEffect(() => {
    const match = location.pathname.match(/\/ticket\/([^/]+)/);
    if (match) {
      const currentTicketId = match[1].toLowerCase();
      const matching = notifications.find(
        (n) => !n.read && n.ticketId?.toLowerCase() === currentTicketId
      );
      if (matching) markAsRead(matching.id, matching.id < 0, matching.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, notifications]);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setIsDeleteMode(false); setSelectedIds(new Set()); } }}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={styles.notificationButton}>
          <Bell style={{ width: "20px", height: "20px" }} />
          {unreadCount > 0 && (
            <div className={styles.notificationBadge}>
              {unreadCount}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={styles.notificationPopover} align="end">
        <div className={styles.notificationHeader}>
          <h3 className={styles.notificationTitle}>
            Notifications {unreadCount > 0 && <Badge variant="secondary">{unreadCount} new</Badge>}
          </h3>
          <div style={{ display: "flex", gap: 6 }}>
            {!isDeleteMode ? (
              <>
                {unreadCount > 0 && (
                  <button className={styles.markReadBtn} onClick={markAllAsRead} title="Tandai semua sudah dibaca (tidak menghapus)">
                    <CheckCheck size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                    Mark all read
                  </button>
                )}
                <button className={styles.markReadBtn} onClick={toggleDeleteMode} title="Mode hapus notifikasi">
                  <Trash2 size={14} style={{ verticalAlign: -2 }} />
                </button>
              </>
            ) : (
              <>
                <button className={styles.markReadBtn} onClick={toggleDeleteMode}>
                  Cancel
                </button>
                <button
                  className={styles.markReadBtn}
                  onClick={deleteSelected}
                  style={{ color: selectedIds.size > 0 ? "#fca5a5" : undefined }}
                  title="Hapus notifikasi terpilih"
                >
                  <Trash2 size={14} style={{ verticalAlign: -2 }} />
                  {selectedIds.size > 0 ? ` Delete (${selectedIds.size})` : " Delete"}
                </button>
              </>
            )}
          </div>
        </div>
        <div className={styles.notificationList}>
          {notifications.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconContainer}>
                <Bell className={styles.emptyIcon} />
              </div>
              <p className={styles.emptyText}>All caught up!</p>
              <p style={{ fontSize: "12px", opacity: 0.6 }}>No notifications for you.</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const isSelected = selectedIds.has(notification.id);
              return (
                <div
                  key={notification.key}
                  className={`${styles.notificationItem} ${!notification.read ? styles.unread : ""} ${isDeleteMode ? styles.selectable : ""} ${isSelected ? styles.selected : ""}`}
                  onClick={() => handleNotificationClick(notification)}
                  style={isSelected ? { background: "rgba(239, 68, 68, 0.12)", outline: "1px solid rgba(239, 68, 68, 0.35)" } : undefined}
                >
                  <div className={styles.notificationIcon}>
                    <div style={{ position: "relative" }}>
                      <Bell style={{ width: "18px", height: "18px", opacity: notification.read ? 0.45 : 1 }} />
                      {/* Indikator belum-dibaca: titik merah menyala; sudah-dibaca: redup */}
                      {!notification.read && (
                        <div style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, background: "#ef4444", borderRadius: "50%", border: "2px solid #111827" }} />
                      )}
                      {isDeleteMode && (
                        <div style={{
                          position: "absolute", top: -4, right: -4,
                          width: 16, height: 16, borderRadius: 4,
                          border: isSelected ? "none" : "1.5px solid rgba(255,255,255,0.4)",
                          background: isSelected ? "#ef4444" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {isSelected && <Circle size={8} fill="#fff" stroke="none" style={{ background: "#fff", borderRadius: "50%" }} />}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.notificationContent} style={{ opacity: notification.read ? 0.65 : 1 }}>
                    <div className={styles.notificationTitleRow}>
                      <span className={styles.notificationItemTitle}>{notification.title}</span>
                      <span className={styles.notificationTime}>{formatTime(notification.time)}</span>
                    </div>
                    <p className={styles.notificationMessage}>{notification.message}</p>
                    {!isDeleteMode && (
                      <div className={styles.notificationFooter}>
                        <span style={{ fontSize: "11px", color: "#60a5fa", fontWeight: 700 }}>
                          {notification.read ? "OPENED" : "VIEW TICKET →"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
