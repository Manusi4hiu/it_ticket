from datetime import datetime, timezone
from app import db
from app.models.ticket import format_iso_date


class Notification(db.Model):
    """Notifikasi in-app untuk user.

    Tipe notifikasi (type):
    - 'assigned'  : tiket baru di-assign / di-take
    - 'transferred': tiket dioper ke user ini (staff baru)
    - 'admin_override': Admin mengubah tiket milik (assignee lama) / dipindah ke user ini (assignee baru)
    - 'status_changed': Admin mengubah status tiket milik user
    - 'category_changed': Admin mengubah kategori tiket milik user
    """
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id', ondelete='CASCADE'), nullable=True)
    ticket_code = db.Column(db.String(20), nullable=True)
    type = db.Column(db.String(30), nullable=False, default='assigned')
    title = db.Column(db.String(150), nullable=False)
    message = db.Column(db.Text, nullable=False)
    reason = db.Column(db.Text, nullable=True)  # alasan dari admin/staff pengoper
    is_read = db.Column(db.Boolean, default=False, index=True)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    user = db.relationship('User', backref=db.backref('notifications', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'ticketId': self.ticket_id,
            'ticketCode': self.ticket_code,
            'type': self.type,
            'title': self.title,
            'message': self.message,
            'reason': self.reason,
            'isRead': self.is_read,
            # PAKAI helper bersama app/models/ticket.py. Sebelumnya kode ini
            # melakukan `isoformat() + 'Z'`, yang menghasilkan string TIDAK valid
            # seperti '2026-09-29T13:35:23.382533+07:00Z' (suffix 'Z' ditumpuk
            # setelah offset). JS `new Date(...)` lalu mengembalikan Invalid Date,
            # sehingga formatTime() di frontend menghitung NaN dan lonceng
            # menampilkan "NaNd ago" untuk SETIAP notifikasi.
            'createdAt': format_iso_date(self.created_at),
        }
