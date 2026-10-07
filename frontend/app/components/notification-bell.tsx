import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Trash2, CheckCheck, Circle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button/button";
import { Badge } from "~/components/ui/badge/badge";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover/popover";
import { getTickets } from "~/services/ticket.service";
import { getAuthToken } from "~/services/api.service";
import { subscribePush, isPushSupported } from "~/services/push.service";
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
  const [pushEnabled, setPushEnabled] = useState(false);
  const pushSupported = isPushSupported();
  // Dialog konfirmasi hapus: 'selected' = hapus yang dicentang,
  // 'all' = hapus seluruh inbox. null = dialog tertutup.
  // Alasan: penghapusan tidak bisa dibatalkan, jadi klik Delete
  // (baik terpilih maupun all) TIDAK BOLEH langsung menghapus.
  const [pendingDelete, setPendingDelete] = useState<"selected" | "all" | null>(null);
  // Ref cerminan pendingDelete, dibaca di onOpenChange Radix yang dibuat
  // ulang tiap render. Dipakai agar pemeriksaan "dialog sedang tampil"
  // selalu membaca nilai terbaru, bukan nilai usang dari render sebelumnya.
  const pendingDeleteRef = useRef<"selected" | "all" | null>(null);
  useEffect(() => { pendingDeleteRef.current = pendingDelete; }, [pendingDelete]);
  const [isDeleting, setIsDeleting] = useState(false);
  // Jumlah belum-dibaca ASLI dari server. Badge harus memakai angka ini:
  // kalau dihitung dari `notifications` (yang dibatasi limit=50), badge akan
  // mentok di 50 padahal user punya 137 notifikasi belum terbaca.
  const [unreadCount, setUnreadCount] = useState(0);
  // Pesan error singkat setelah aksi hapus gagal, tampil sebagai toast.
  const [actionError, setActionError] = useState<string | null>(null);
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

  // Sync push permission state on mount and when popover opens
  useEffect(() => {
    setPushEnabled(typeof Notification !== "undefined" && Notification.permission === "granted");
  }, [isOpen]);

  const handleEnablePush = async () => {
    const ok = await subscribePush();
    setPushEnabled(ok);
    if (ok) {
      toast.success("Notifications enabled", { description: "You'll receive push alerts even when app is closed." });
    } else {
      toast.error("Failed to enable notifications", { description: "Check browser permission settings." });
    }
  };

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
      // Pakang unreadCount dari server, bukan hasil hitung `items`: `items`
      // hanya 50 baris terbaru, jadi badge akan salah kalau dihitung sendiri.
      if (typeof data.unreadCount === "number") setUnreadCount(data.unreadCount);
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

  // CATATAN: `unreadCount` sengaja TIDAK dihitung dari `notifications`.
  // Daftar ini dibatasi 50 baris terbaru, sehingga hasil hitungnya mentok di
  // 50 walau user punya lebih dari 50 notifikasi belum terbaca. Nilai yang
  // dipakai badge berasal dari state `unreadCount` di atas (dari server).

  // ── Mark as read (tidak menghapus dari inbox — hanya toggle indikator) ──
  const markAsRead = (notificationId: number, isLegacy: boolean, legacyKey?: string) => {
    // hanya kurangi badge kalau notif ini memang belum terbaca
    const target = notifications.find((n) => n.id === notificationId);
    if (target && !target.read) setUnreadCount((c) => Math.max(0, c - 1));
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
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        // angka otoritatif dari server, jaga badge tetap sinkron
        if (data && typeof data.unreadCount === "number") setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    fetch("/api/notifications/read", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      },
      body: JSON.stringify({ ids: [] }),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && typeof data.unreadCount === "number") setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
  };

  // ── Delete mode: multi/single select lalu hapus via dialog konfirmasi ──
  const toggleDeleteMode = () => {
    setIsDeleteMode((v) => !v);
    setSelectedIds(new Set());
    setPendingDelete(null);
  };

  // Auto-batalkan dialog konfirmasi kalau user menutup panel atau keluar
  // dari mode hapus, supaya tidak ada dialog menggantung menanti klik.
  useEffect(() => {
    if (!isOpen || !isDeleteMode) setPendingDelete(null);
  }, [isOpen, isDeleteMode]);

  // Escape menutup dialog konfirmasi (batal hapus) TANPA menutup panel lonceng.
  //
  // Radix Popover juga mendengarkan Escape di document. Kalau handler kita di
  // fase bubble, keduanya bereaksi atas event yang sama: dialog tertutup
  // sekaligus panel ikut menutup. Menggunakan fase capture + stopPropagation
  // membuat handler kita jalan lebih dulu dan menghentikan Radix.
  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setPendingDelete(null);
    };
    // capture: true -> jalan sebelum handler Radix di document
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [pendingDelete]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Pilih / batal pilih semua — supaya user tidak perlu klik satu per satu
  // saat inbox panjang, tapi tetap bisa hapus sebagian via Delete terpilih.
  const allIds = notifications.map((n) => n.id);
  const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  };

  // Klik tombol Delete terpilih → buka dialog konfirmasi dulu,
  // JANGAN langsung hapus (tidak bisa dibatalkan).
  const requestDeleteSelected = () => {
    if (selectedIds.size === 0 || isDeleting) return;
    setPendingDelete("selected");
  };

  const requestDeleteAll = () => {
    if (notifications.length === 0 || isDeleting) return;
    setPendingDelete("all");
  };

  // Backup state sebelum optimistic update, dipakai untuk rollback saat
  // server menolak. Tanpa ini, notifikasi terlihat terhapus padahal tidak,
  // lalu muncul kembali diam-diam di polling berikutnya.
  const showError = (msg: string) => {
    setActionError(msg);
    window.setTimeout(() => setActionError(null), 4000);
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds).filter((id) => id > 0); // hanya id DB
    const snapshot = notifications;
    // Optimistic: hapus lokal (termasuk legacy)
    setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)));
    setSelectedIds(new Set());
    setIsDeleteMode(false);
    setPendingDelete(null);
    if (ids.length === 0) return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/notifications/delete", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
        },
        body: JSON.stringify({ ids }),
      });
      // WAJIB periksa res.ok: server mengirim 400 untuk id tidak valid, dan
      // tanpa pengecekan ini UI tetap menghapus notifikasi tanpa pesan apa pun.
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Server menolak (${res.status})`);
      }
      const data = await res.json().catch(() => null);
      if (typeof data?.unreadCount === "number") setUnreadCount(data.unreadCount);
      fetchNotifications(); // sync ulang
    } catch (e) {
      setNotifications(snapshot);           // rollback
      setSelectedIds(new Set(ids));
      showError(
        e instanceof Error && e.message
          ? `Gagal hapus: ${e.message}`
          : "Gagal hapus notifikasi. Coba lagi."
      );
    } finally { setIsDeleting(false); }
  };

  // ── Delete all: hapus seluruh inbox tanpa pilih satu per satu ──
  // Selalu lewat dialog konfirmasi (pendingDelete === "all"), karena
  // action ini tidak bisa dibatalkan — satu klik tak sengaja tidak boleh
  // menghapus puluhan notifikasi.
  const deleteAll = async () => {
    const snapshot = notifications;
    setIsDeleteMode(false);
    setSelectedIds(new Set());
    setPendingDelete(null);
    setNotifications([]); // optimistic
    setIsDeleting(true);
    try {
      const res = await fetch("/api/notifications/delete", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
        },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Server menolak (${res.status})`);
      }
      const data = await res.json().catch(() => null);
      if (typeof data?.unreadCount === "number") setUnreadCount(data.unreadCount);
    } catch (e) {
      setNotifications(snapshot);           // rollback
      showError(
        e instanceof Error && e.message
          ? `Gagal hapus semua: ${e.message}`
          : "Gagal hapus notifikasi. Coba lagi."
      );
    } finally {
      setIsDeleting(false);
      fetchNotifications(); // sync ulang (baik sukses maupun rollback)
    }
  };

  // Tombol "Hapus" di dalam dialog konfirmasi.
  const confirmPendingDelete = () => {
    if (isDeleting) return;
    if (pendingDelete === "selected") void deleteSelected();
    else if (pendingDelete === "all") void deleteAll();
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
    // Guard: backend dulu mengirim "…+07:00Z" (suffix 'Z' menumpuk setelah
    // offset) sehingga new Date() -> Invalid Date dan hasil hitungannya NaN,
    // yang tampil sebagai "NaNd ago". Akar masalahnya sudah diperbaiki di
    // backend (app/models/notification.py memakai format_iso_date), tapi
    // formatter ini tidak boleh pernah menampilkan NaN lagi walau data rusak.
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

    const diff = Date.now() - date.getTime();
    if (diff < 0) return "Just now"; // jam skewed / timestamp di masa depan

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        // Radix Popover ikut menutup saat Escape ditekan, padahal yang
        // seharusnya tertutup hanya dialog konfirmasi hapus. Kalau dialognya
        // sedang tampil, tolak permintaan tutup panel ini — panel lonceng
        // harus tetap terbuka supaya user bisa melanjutkan atau membatalkan.
        if (!open && pendingDeleteRef.current) return;
        setIsOpen(open);
        if (!open) {
          setIsDeleteMode(false);
          setSelectedIds(new Set());
          setPendingDelete(null);
        }
      }}
    >
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
            Notifications {!isDeleteMode && unreadCount > 0 && <Badge variant="secondary">{unreadCount} new</Badge>}
          </h3>
          <div className={styles.headerActions}>
            {!isDeleteMode ? (
              <>
                {pushSupported && !pushEnabled && (
                  <button className={styles.markReadBtn} onClick={handleEnablePush} title="Aktifkan push notification di device ini">
                    <Bell size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                    Enable
                  </button>
                )}
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
              <div className={styles.deleteActions}>
                {/* Mode hapus: SATU BARIS dengan judul, tidak boleh wrap ke
                    bawah. Tombol dibuat ringkas supaya header tidak membesar
                    saat masuk mode hapus. */}
                <button
                  className={`${styles.markReadBtn} ${styles.iconBtn}`}
                  onClick={toggleDeleteMode}
                  title="Batal / keluar mode hapus"
                  aria-label="Batal"
                >
                  <X size={15} />
                </button>
                {/* Select all: toggle pilih semua / kosongkan, tanpa menghapus. */}
                <button
                  className={styles.markReadBtn}
                  onClick={toggleSelectAll}
                  title={isAllSelected ? "Batalkan pilihan semua" : "Pilih semua notifikasi"}
                >
                  {isAllSelected ? "Clear" : "Select all"}
                </button>
                {/* Delete all: buka dialog konfirmasi, tanpa perlu select manual. */}
                <button
                  className={`${styles.markReadBtn} ${styles.deleteAllBtn}`}
                  onClick={requestDeleteAll}
                  disabled={notifications.length === 0}
                  title="Hapus semua notifikasi (minta konfirmasi dulu)"
                >
                  <Trash2 size={13} style={{ verticalAlign: -2 }} />
                  {" Delete all"}
                </button>
                <button
                  className={`${styles.markReadBtn} ${styles.deleteSelectedBtn}`}
                  onClick={requestDeleteSelected}
                  disabled={selectedIds.size === 0}
                  title={selectedIds.size > 0 ? `Hapus ${selectedIds.size} notifikasi terpilih (minta konfirmasi dulu)` : "Pilih dulu notifikasi yang mau dihapus"}
                >
                  <Trash2 size={13} style={{ verticalAlign: -2 }} />
                  {selectedIds.size > 0 ? ` (${selectedIds.size})` : " Delete"}
                </button>
              </div>
            )}
          </div>
        </div>
        {actionError && (
          <div className={styles.errorToast} role="alert">
            <span>{actionError}</span>
          </div>
        )}
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
                  role={isDeleteMode ? "checkbox" : undefined}
                  aria-checked={isDeleteMode ? isSelected : undefined}
                  tabIndex={0}
                  onKeyDown={(e) => { if (isDeleteMode && (e.key === " " || e.key === "Enter")) { e.preventDefault(); handleNotificationClick(notification); } }}
                  className={`${styles.notificationItem} ${!notification.read ? styles.unread : ""} ${isDeleteMode ? styles.selectable : ""} ${isSelected ? styles.selected : ""}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* Tanpa checkbox: tidak ada elemen tambahan di baris, jadi
                      ukuran card IDENTIK antara mode normal & mode hapus.
                      Seleksi cukup ditandai warna merah pada card (.selected)
                      + bar merah di tepi kiri — klik / Spasi / Enter toggle. */}
                  <div className={styles.notificationIcon}>
                    {/* Titik unread pindah ke CSS (.unread .notificationIcon::after)
                        supaya tidak pernah bertabrakan dengan elemen lain. */}
                    <Bell style={{ width: "18px", height: "18px", opacity: notification.read ? 0.45 : 1 }} />
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
        {/* Dialog konfirmasi hapus — overlay di dalam panel (bukan popup
            terpisah) supaya tidak ada konflik stacking/fokus dengan Popover
            dan tidak bisa terklik-tutup tanpa sengaja. Klik backdrop /
            Batal / Escape = batal, tidak ada yang terhapus. */}
        {pendingDelete && (
          <div
            className={styles.confirmOverlay}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="notif-delete-title"
            aria-describedby="notif-delete-desc"
            onClick={() => { if (!isDeleting) setPendingDelete(null); }}
          >
            <div
              className={styles.confirmCard}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.confirmIconWrap} aria-hidden="true">
                <Trash2 size={18} />
              </div>
              <p id="notif-delete-title" className={styles.confirmTitle}>
                {pendingDelete === "all"
                  ? `Hapus semua ${notifications.length} notifikasi?`
                  : selectedIds.size === 1
                    ? "Hapus 1 notifikasi?"
                    : `Hapus ${selectedIds.size} notifikasi terpilih?`}
              </p>
              <p id="notif-delete-desc" className={styles.confirmDesc}>
                Tindakan ini tidak bisa dibatalkan. Notifikasi yang sudah
                dihapus tidak dapat dikembalikan.
              </p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.confirmCancel}
                  autoFocus
                  disabled={isDeleting}
                  onClick={() => setPendingDelete(null)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className={styles.confirmDelete}
                  disabled={isDeleting}
                  onClick={confirmPendingDelete}
                >
                  <Trash2 size={14} style={{ verticalAlign: -2 }} />
                  {isDeleting
                    ? " Menghapus…"
                    : pendingDelete === "all"
                      ? " Ya, hapus semua"
                      : " Ya, hapus"}
                </button>
              </div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
