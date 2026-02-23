import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "~/components/ui/button/button";
import { Badge } from "~/components/ui/badge/badge";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover/popover";
import { getTickets } from "~/services/ticket.service";
import styles from "./notification-bell.module.css";
import { useNavigate } from "react-router";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: Date;
  read: boolean;
  ticketId?: string;
}

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  // Load read notification IDs from localStorage
  useEffect(() => {
    const savedReadIds = localStorage.getItem(`read_notifications_${userId}`);
    if (savedReadIds) {
      try {
        setReadIds(new Set(JSON.parse(savedReadIds)));
      } catch (e) {
        console.error("Failed to parse read notifications", e);
      }
    }
  }, [userId]);

  // Save read notification IDs to localStorage whenever it changes
  useEffect(() => {
    if (userId) {
      localStorage.setItem(`read_notifications_${userId}`, JSON.stringify(Array.from(readIds)));
    }
  }, [readIds, userId]);

  // Initialize notifications from assigned tickets (Real Data)
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // PERF: Only fetch tickets assigned to this user from the backend
        const tickets = await getTickets({ assignedTo: userId });

        // Final frontend filter for status
        const assignedTickets = tickets.filter(
          (t) => t.status !== "resolved" && t.status !== "closed"
        );

        const initialNotifications: Notification[] = assignedTickets
          .map((ticket) => ({
            id: `notif-${ticket.id}`,
            title: "Ticket Assigned to You",
            message: `${ticket.id}: ${ticket.title}`,
            time: new Date(ticket.updatedAt || ticket.createdAt),
            read: false,
            ticketId: ticket.id,
          }))
          // Filter out those already read/dismissed
          .filter(notif => !readIds.has(notif.id));

        setNotifications(initialNotifications);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    };

    if (userId) {
      fetchNotifications();
    }

    // Optional: Poll every 60 seconds (increased from 30s for better performance)
    const interval = setInterval(() => {
      if (userId) fetchNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, [userId, readIds]);

  const unreadCount = notifications.length; // All notifications in state are unread/not-dismissed

  const markAsRead = (notificationId: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(notificationId);
      return next;
    });
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.ticketId) {
      navigate(`/ticket/${notification.ticketId}`);
      setIsOpen(false);
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadIds((prev) => {
      const next = new Set(prev);
      allIds.forEach(id => next.add(id));
      return next;
    });
    setNotifications([]);
  };

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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
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
          <h3 className={styles.notificationTitle}>Notifications</h3>
          {unreadCount > 0 && (
            <button className={styles.markReadBtn} onClick={markAllAsRead}>
              Mark all as read
            </button>
          )}
        </div>
        <div className={styles.notificationList}>
          {notifications.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconContainer}>
                <Bell className={styles.emptyIcon} />
              </div>
              <p className={styles.emptyText}>All caught up!</p>
              <p style={{ fontSize: '12px', opacity: 0.6 }}>No new notifications for you.</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`${styles.notificationItem} ${!notification.read ? styles.unread : ""}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className={styles.notificationIcon}>
                  <div style={{ position: 'relative' }}>
                    <Bell style={{ width: "18px", height: "18px" }} />
                    {!notification.read && <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, background: '#ef4444', borderRadius: '50%', border: '2px solid #111827' }} />}
                  </div>
                </div>
                <div className={styles.notificationContent}>
                  <div className={styles.notificationTitleRow}>
                    <span className={styles.notificationItemTitle}>{notification.title}</span>
                    <span className={styles.notificationTime}>{formatTime(notification.time)}</span>
                  </div>
                  <p className={styles.notificationMessage}>{notification.message}</p>
                  <div className={styles.notificationFooter}>
                    <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 700 }}>VIEW TICKET →</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
