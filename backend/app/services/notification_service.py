from datetime import datetime, timezone
from app import db
from app.models.notification import Notification
from app.models.ticket import Ticket
from app.models.user import User


class NotificationService:
    """Service notifikasi in-app.

    Notifikasi masuk ke:
    - assignee baru saat take/assign/oper
    - pemilik lama + assignee baru saat Admin mengubah assignee tiket yang sudah diambil
    - pemilik tiket saat Admin mengubah status/kategori tiketnya
    """

    @staticmethod
    def push(user_id, ticket, ntype, title, message, reason=None):
        """Buat notifikasi untuk seorang user terkait sebuah tiket."""
        if not user_id:
            return None
        notif = Notification(
            user_id=int(user_id),
            ticket_id=ticket.id if ticket else None,
            ticket_code=ticket.ticket_code if ticket else None,
            type=ntype,
            title=title,
            message=message,
            reason=reason,
        )
        db.session.add(notif)
        return notif

    # ── Take / oper biasa (oleh staff) ──
    @staticmethod
    def notify_assigned(ticket, actor_user, reason=None):
        """Assignee baru menerima 'Ticket Assigned/Transferred to You'."""
        if not ticket.assigned_to_id:
            return
        is_transfer = bool(getattr(ticket, 'transferred_at', None))
        if is_transfer and reason:
            NotificationService.push(
                ticket.assigned_to_id, ticket, 'transferred',
                'Ticket Transferred to You',
                f"{ticket.ticket_code or ticket.id}: {ticket.title}",
                reason=reason,
            )
        else:
            NotificationService.push(
                ticket.assigned_to_id, ticket, 'assigned',
                'Ticket Assigned to You',
                f"{ticket.ticket_code or ticket.id}: {ticket.title}",
            )

    # ── Admin override ──
    @staticmethod
    def notify_admin_assignee_change(ticket, admin_user, prev_assignee_id, new_assignee_id, reason):
        """
        Admin mengubah assignee tiket yang sudah diambil/assigned.
        Notifikasi + alasan WAJIB ke DUA pihak:
        - pemilik lama (staff sebelumnya)
        - assignee baru (staff pengganti)
        """
        reason_clean = str(reason or '').strip()
        admin_name = admin_user.full_name if admin_user else 'Administrator'
        tcode = ticket.ticket_code or str(ticket.id)

        # Pemilik lama
        if prev_assignee_id and int(prev_assignee_id) != int(new_assignee_id or 0):
            NotificationService.push(
                prev_assignee_id, ticket, 'admin_override',
                'Admin Mengoper Tiket Anda ke Staff Lain',
                f"{tcode}: {ticket.title} — pekerjaan dialihkan oleh Admin ({admin_name}) ke staff lain.",
                reason=reason_clean or '(tanpa alasan)',
            )

        # Assignee baru
        if new_assignee_id and int(new_assignee_id) != int(prev_assignee_id or 0):
            NotificationService.push(
                new_assignee_id, ticket, 'admin_override',
                'Admin Menugaskan Tiket Operan ke Anda',
                f"{tcode}: {ticket.title} — dialihkan oleh Admin ({admin_name}) untuk Anda kerjakan.",
                reason=reason_clean or '(tanpa alasan)',
            )

    @staticmethod
    def notify_admin_field_change(ticket, admin_user, field_label, old_value, new_value, reason, target_user_id=None):
        """
        Admin mengubah status/kategori (atau field lain) tiket milik staff.
        Notifikasi + alasan ke PEMILIK tiket saja.
        """
        reason_clean = str(reason or '').strip()
        admin_name = admin_user.full_name if admin_user else 'Administrator'
        tcode = ticket.ticket_code or str(ticket.id)
        recipient = target_user_id or ticket.assigned_to_id
        if not recipient:
            return
        NotificationService.push(
            recipient, ticket, 'admin_override',
            f'Admin Mengubah {field_label} Tiket Anda',
            f"{tcode}: {field_label} diganti dari '{old_value}' menjadi '{new_value}' oleh Admin ({admin_name})",
            reason=reason_clean or '(tanpa alasan)',
        )

    # ── Query helpers ──
    @staticmethod
    def get_for_user(user_id, unread_only=False, limit=50):
        q = Notification.query.filter_by(user_id=int(user_id))
        if unread_only:
            q = q.filter_by(is_read=False)
        return q.order_by(Notification.created_at.desc()).limit(limit).all()

    @staticmethod
    def mark_read(user_id, notification_ids=None):
        """Tandai notifikasi terbaca. Jika ids None → semua milik user."""
        q = Notification.query.filter_by(user_id=int(user_id))
        if notification_ids:
            q = q.filter(Notification.id.in_(notification_ids))
        q = q.filter_by(is_read=False)
        updated = 0
        for n in q.all():
            n.is_read = True
            updated += 1
        db.session.commit()
        return updated

    @staticmethod
    def unread_count(user_id):
        return Notification.query.filter_by(user_id=int(user_id), is_read=False).count()

    @staticmethod
    def delete_for_user(user_id, notification_ids):
        """Hapus notifikasi milik user (validasi ownership per baris)."""
        if not notification_ids:
            return 0
        try:
            id_list = [int(i) for i in notification_ids]
        except (TypeError, ValueError):
            return 0
        q = Notification.query.filter(
            Notification.user_id == int(user_id),
            Notification.id.in_(id_list),
        )
        deleted = 0
        for n in q.all():
            db.session.delete(n)
            deleted += 1
        db.session.commit()
        return deleted
