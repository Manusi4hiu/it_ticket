from datetime import datetime
import uuid
from app import db


class SystemLog(db.Model):
    """SystemLog model for tracking user activities and system events"""
    __tablename__ = 'system_logs'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    action = db.Column(db.String(100), nullable=False)  # e.g., "Ticket Created", "User Login", "Ticket Updated"
    details = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)  # IPv6 can be up to 45 chars
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    target_id = db.Column(db.String(100), nullable=True)  # ID of the object being acted upon (e.g., ticket ID)
    
    # Optional metadata (as JSON string)
    metadata_json = db.Column(db.Text, nullable=True)
    
    # Relationships
    user = db.relationship('User', backref=db.backref('system_logs', lazy='dynamic'))
    
    def to_dict(self):
        """Convert log to dictionary"""
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat() + "Z" if self.timestamp else None,
            'action': self.action,
            'details': self.details,
            'ipAddress': self.ip_address,
            'userId': self.user_id,
            'userName': self.user.full_name if self.user else 'Guest',
            'targetId': self.target_id,
            'metadata': self.metadata_json
        }
    
    def __repr__(self):
        return f'<SystemLog {self.action} at {self.timestamp}>'
