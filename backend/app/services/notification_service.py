import time
import threading
import json
from collections import defaultdict
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

    _last_sla_check_time = 0.0
    _sla_check_lock = threading.Lock()

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
        """Hapus notifikasi milik user (validasi ownership per baris).

        Id yang bukan bilangan bulat DITOLAK dengan ValueError, bukan
        diam-diam dilewati. Sebelumnya `except ValueError: return 0` membuat
        server membalas 200 `{"deleted": 0, "success": true}` untuk payload
        seperti {"ids": ["abc"]} — user mengera notifikasi terhapus padahal
        tidak ada yang berubah.
        """
        if not notification_ids:
            return 0
        id_list = []
        for raw in notification_ids:
            # bool adalah subclass int; True/False bukan id notifikasi.
            if isinstance(raw, bool) or not isinstance(raw, (int, str, float)):
                raise ValueError(f'notification id tidak valid: {raw!r}')
            try:
                value = int(raw)
            except (TypeError, ValueError):
                raise ValueError(f'notification id harus angka: {raw!r}')
            # menolak 1.5 / "1.5" — bukan id bulat yang sah
            if isinstance(raw, float) and not raw.is_integer():
                raise ValueError(f'notification id harus bilangan bulat: {raw!r}')
            if str(raw).strip() != str(value):
                raise ValueError(f'notification id harus angka bulat: {raw!r}')
            id_list.append(value)
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

    @staticmethod
    def delete_all_for_user(user_id):
        """Hapus SEMUA notifikasi milik satu user.

        Dipakai tombol "Delete all" di lonceng notifikasi supaya user tidak
        perlu memilih satu per satu saat inboxnya panjang. Tetap di-scope ke
        user yang login — tidak mungkin menyentuh notifikasi user lain.
        """
        deleted = Notification.query.filter(
            Notification.user_id == int(user_id)
        ).delete(synchronize_session=False)
        db.session.commit()
        return deleted

    # ── SLA Notification Engine ──
    @classmethod
    def check_and_generate_sla_notifications(cls, user_id=None, force=False, cooldown_seconds=45):
        """Pindai tiket aktif dan buat notifikasi SLA (Warning / Breached).

        - Proteksi Cooldown & Thread Lock: Mencegah multi-request polling dari
          banyak tab/klien memicu pemindaian duplikat ke database.
        - Warning (< 2 jam): dikirim ke Assignee (atau Admin jika tiket New unassigned).
        - Breached (> deadline): dikirim ke Assignee DAN semua Administrator.
        - Eliminasi N+1: Mem-batch query SystemLog seluruh tiket aktif sekaligus
          sehingga pemeriksaan deduplikasi dilakukan di memori O(1).
        - Proteksi Mutlak: Tiket dengan resolved_at atau status selesai tidak pernah dipindai.
        - Sinkronisasi real-time: otomatis memperbarui ticket.sla_status di database.
        """
        now_ts = time.time()
        if not force and (now_ts - cls._last_sla_check_time < cooldown_seconds):
            return 0

        with cls._sla_check_lock:
            now_ts = time.time()
            if not force and (now_ts - cls._last_sla_check_time < cooldown_seconds):
                return 0
            cls._last_sla_check_time = now_ts

            from app.models.system_log import SystemLog
            from app.models.master_data import Status
            from app.services.ticket_service import TicketService
            from app.services.master_data_service import _infer_filter_group

            now_utc = datetime.now(timezone.utc)

            # ── Himpun semua nama status yang tergolong "done" / selesai ──
            # Termasuk dari master data dinamis + default fallback guard
            done_status_names = {'resolved', 'closed', 'completed', 'done', 'selesai', 'finish', 'finished', 'cancelled', 'canceled'}
            try:
                for s in Status.query.all():
                    grp = s.filter_group or _infer_filter_group(s.name, s.is_default)
                    if grp == 'done':
                        done_status_names.add(str(s.name).strip().lower())
            except Exception:
                pass

            # ── MUTLAK: Hanya pindai tiket yang BELUM diselesaikan ──
            # 1. resolved_at IS NULL (belum pernah diselesaikan)
            # 2. status TIDAK termasuk dalam grup status done/resolved/closed
            # 3. sla_deadline IS NOT NULL
            active_tickets = Ticket.query.filter(
                Ticket.resolved_at.is_(None),
                Ticket.sla_deadline.isnot(None),
                db.func.lower(Ticket.status).notin_(list(done_status_names))
            ).all()

            if not active_tickets:
                return 0

            # ── ELIMINASI N+1 QUERY: Batch load existing SystemLog untuk semua tiket aktif ──
            target_ids = [str(t.id) for t in active_tickets]
            existing_logs = SystemLog.query.filter(
                SystemLog.action.in_(['SLA Warning Notification', 'SLA Breach Notification']),
                SystemLog.target_id.in_(target_ids)
            ).all()

            logs_by_target = defaultdict(list)
            for log in existing_logs:
                logs_by_target[(log.action, str(log.target_id))].append(log)

            admins = User.query.filter(User.role == 'Administrator', User.is_active != False).all()
            created_count = 0

            for ticket in active_tickets:
                # Double Defense Guard: Tolak mutlak jika tiket berstatus selesai atau resolved_at terisi
                if ticket.resolved_at is not None:
                    continue
                if str(ticket.status).strip().lower() in done_status_names:
                    continue

                current_sla = TicketService.calculate_sla_status(
                    ticket.sla_deadline,
                    resolved_at=None,  # Tiket aktif belum ada resolved_at
                    sla_paused_at=ticket.sla_paused_at,
                    assigned_user=ticket.assigned_user
                )

                # Sinkronkan sla_status di DB jika ada perubahan
                if ticket.sla_status != current_sla:
                    ticket.sla_status = current_sla

                if current_sla == 'good':
                    continue

                deadline_key = ticket.sla_deadline.isoformat()[:16] if ticket.sla_deadline else ""
                tcode = ticket.ticket_code or f"#{ticket.id}"
                target_id_str = str(ticket.id)

                sla_dl = ticket.sla_deadline
                if getattr(sla_dl, 'tzinfo', None) is None:
                    sla_dl = sla_dl.replace(tzinfo=timezone.utc)

                time_diff = sla_dl - now_utc

                # ── 1. SLA Warning (< 2 jam) ──
                if current_sla == 'warning':
                    secs = max(0, int(time_diff.total_seconds()))
                    hours = secs // 3600
                    mins = (secs % 3600) // 60
                    remaining_text = f"tersisa {hours}j {mins}m" if hours > 0 else f"tersisa {mins} menit"

                    existing_warn = logs_by_target.get(('SLA Warning Notification', target_id_str), [])
                    already_logged = any(
                        (deadline_key and deadline_key in (l.details or '')) or
                        (l.metadata_json and deadline_key and deadline_key in l.metadata_json)
                        for l in existing_warn
                    )

                    if not already_logged:
                        recipients = [ticket.assigned_to_id] if ticket.assigned_to_id else [a.id for a in admins]
                        for r_id in recipients:
                            if not r_id:
                                continue
                            NotificationService.push(
                                user_id=r_id,
                                ticket=ticket,
                                ntype='sla_warning',
                                title=f"SLA Warning: {tcode}",
                                message=f"Tiket '{ticket.title}' mendekati batas waktu SLA ({remaining_text}). Segera tindak lanjuti.",
                            )
                            created_count += 1

                        new_warn_log = SystemLog(
                            action='SLA Warning Notification',
                            target_id=target_id_str,
                            details=f"SLA Warning sent for ticket {tcode} (deadline: {deadline_key})",
                            metadata_json=json.dumps({'ticket_id': ticket.id, 'deadline': deadline_key})
                        )
                        db.session.add(new_warn_log)
                        logs_by_target[('SLA Warning Notification', target_id_str)].append(new_warn_log)

                # ── 2. SLA Breached (> deadline) ──
                elif current_sla == 'breached':
                    existing_breach = logs_by_target.get(('SLA Breach Notification', target_id_str), [])
                    already_logged = any(
                        (deadline_key and deadline_key in (l.details or '')) or
                        (l.metadata_json and deadline_key and deadline_key in l.metadata_json)
                        for l in existing_breach
                    )

                    if not already_logged:
                        assignee_name = ticket.assigned_user.full_name if ticket.assigned_user else "belum di-assign"

                        # 1. Kirim ke Assignee tiket (jika ada)
                        if ticket.assigned_to_id:
                            NotificationService.push(
                                user_id=ticket.assigned_to_id,
                                ticket=ticket,
                                ntype='sla_breached',
                                title=f"SLA Breached: {tcode}",
                                message=f"Tiket '{ticket.title}' telah melewati batas waktu SLA! Harap segera diselesaikan atau dieskalasi.",
                            )
                            created_count += 1

                        # 2. Kirim juga ke semua Administrator (eskalasi tim supervisor)
                        for admin in admins:
                            if ticket.assigned_to_id and admin.id == ticket.assigned_to_id:
                                continue
                            NotificationService.push(
                                user_id=admin.id,
                                ticket=ticket,
                                ntype='sla_breached',
                                title=f"SLA Breached: {tcode}",
                                message=f"Tiket '{ticket.title}' ({assignee_name}) telah melewati batas waktu SLA.",
                            )
                            created_count += 1

                        new_breach_log = SystemLog(
                            action='SLA Breach Notification',
                            target_id=target_id_str,
                            details=f"SLA Breach sent for ticket {tcode} (deadline: {deadline_key})",
                            metadata_json=json.dumps({'ticket_id': ticket.id, 'deadline': deadline_key})
                        )
                        db.session.add(new_breach_log)
                        logs_by_target[('SLA Breach Notification', target_id_str)].append(new_breach_log)

            db.session.commit()
            return created_count
