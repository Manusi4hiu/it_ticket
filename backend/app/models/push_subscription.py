from datetime import datetime, timezone
from app import db


class PushSubscription(db.Model):
    """Push subscription per device/browser. One user can have many (multi-device)."""
    __tablename__ = 'push_subscriptions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    endpoint = db.Column(db.Text, nullable=False)
    p256dh = db.Column(db.Text, nullable=False)
    auth = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = db.relationship('User', backref=db.backref('push_subscriptions', lazy='dynamic'))

    # Unique constraint so repeated subscribe calls are idempotent (same device + user)
    __table_args__ = (
        db.UniqueConstraint('user_id', 'endpoint', name='uq_user_endpoint'),
    )
