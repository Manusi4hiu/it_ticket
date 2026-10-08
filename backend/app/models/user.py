from datetime import datetime, timezone, timedelta
import uuid
import bcrypt
from app import db


class User(db.Model):
    """User model for IT staff members"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(255), unique=True, nullable=True, index=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='Staff')  # Administrator, Management, Staff
    department = db.Column(db.String(100), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    avatar_url = db.Column(db.String(500), nullable=True)
    is_active = db.Column(db.Boolean, nullable=True, default=True)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Break management
    is_on_break = db.Column(db.Boolean, default=False)
    break_started_at = db.Column(db.DateTime(timezone=True), nullable=True)
    total_break_seconds_today = db.Column(db.Integer, default=0)
    break_total_date = db.Column(db.Date, nullable=True)  # hari milik total di atas (reset harian)

    # Presence / availability status (Discord-style)
    # Values: 'online' | 'idle' | 'dnd' | 'offline' | 'break'
    presence_status = db.Column(db.String(20), nullable=False, default='online')
    # Status sebelum break (untuk restore saat selesai break)
    break_pre_status = db.Column(db.String(20), nullable=True, default=None)
    # Custom status text (seperti Discord custom status) yang menggantikan quotes
    custom_status_message = db.Column(db.String(255), nullable=True, default=None)
    custom_status_expires_at = db.Column(db.DateTime(timezone=True), nullable=True, default=None)
    custom_status_pre_status = db.Column(db.String(20), nullable=True, default=None)
    
    # Relationships
    assigned_tickets = db.relationship('Ticket', back_populates='assigned_user', foreign_keys='Ticket.assigned_to_id')
    notes = db.relationship('TicketNote', back_populates='author', foreign_keys='TicketNote.author_id')
    
    def set_password(self, password: str):
        """Hash and set the user's password"""
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def check_password(self, password: str) -> bool:
        """Verify the password against the stored hash"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def get_break_seconds_today(self) -> int:
        """Ambil total detik break hari ini (WIB = UTC+7), auto-reset 0 jika ganti hari"""
        today_wib = (datetime.now(timezone.utc) + timedelta(hours=7)).date()
        if self.break_total_date != today_wib:
            return 0
        return self.total_break_seconds_today or 0

    def to_dict(self):
        """Convert user to dictionary"""
        now_utc = datetime.now(timezone.utc)
        is_expired = self.custom_status_expires_at and now_utc >= self.custom_status_expires_at

        presence_status = 'offline' if self.presence_status == 'invisible' else (self.presence_status or 'online')
        custom_message = self.custom_status_message

        if is_expired:
            custom_message = None
            if self.custom_status_pre_status:
                presence_status = 'offline' if self.custom_status_pre_status == 'invisible' else self.custom_status_pre_status

        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'full_name': self.full_name,
            'role': self.role,
            'department': self.department,
            'teams': [t.to_dict() for t in self.teams],
            'teamIds': [t.id for t in self.teams],
            'phone': self.phone,
            'avatar_url': self.avatar_url,
            'is_active': self.is_active if self.is_active is not None else True,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'isOnBreak': self.is_on_break or False,
            'breakStartedAt': self.break_started_at.isoformat() if self.break_started_at else None,
            'totalBreakSecondsToday': self.get_break_seconds_today(),
            'breakTotalDate': self.break_total_date.isoformat() if self.break_total_date else None,
            'presenceStatus': presence_status,
            'customStatusMessage': custom_message,
            'customStatusExpiresAt': self.custom_status_expires_at.isoformat() if self.custom_status_expires_at and not is_expired else None,
        }
    
    def __repr__(self):
        return f'<User {self.username}>'
