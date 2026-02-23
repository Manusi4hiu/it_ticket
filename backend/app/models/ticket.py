from datetime import datetime
import uuid
from app import db


# Association table for ticket collaborators (many-to-many)
ticket_collaborators = db.Table(
    'ticket_collaborators',
    db.Column('ticket_id', db.String(20), db.ForeignKey('tickets.id'), primary_key=True),
    db.Column('user_id', db.String(36), db.ForeignKey('users.id'), primary_key=True)
)


class Ticket(db.Model):
    """Ticket model for IT support tickets"""
    __tablename__ = 'tickets'
    
    id = db.Column(db.String(20), primary_key=True)  # e.g., "TKT-001"
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='new')  # new, triaged, assigned, in-progress, resolved, closed
    priority = db.Column(db.String(20), nullable=False, default='medium')  # low, medium, high, critical
    category = db.Column(db.String(50), nullable=False)  # Hardware, Software, Network, Other
    image_url = db.Column(db.String(255), nullable=True)
    
    # Submitter info
    submitter_name = db.Column(db.String(255), nullable=False)
    submitter_email = db.Column(db.String(255), nullable=True)
    submitter_phone = db.Column(db.String(50), nullable=True)
    submitter_department = db.Column(db.String(100), nullable=True)
    
    # Assignment
    assigned_to_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    assigned_user = db.relationship('User', back_populates='assigned_tickets', foreign_keys=[assigned_to_id])
    
    # Collaborators (many-to-many)
    collaborators = db.relationship('User', secondary=ticket_collaborators,
                                    backref=db.backref('collaborated_tickets', lazy='dynamic'))
    
    # SLA
    sla_deadline = db.Column(db.DateTime, nullable=True)
    sla_status = db.Column(db.String(20), default='good')  # good, warning, breached
    
    # Resolution
    resolution_summary = db.Column(db.Text, nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Notes relationship
    notes = db.relationship('TicketNote', back_populates='ticket', cascade='all, delete-orphan', order_by='TicketNote.created_at')
    
    def to_dict(self, include_notes=True):
        """Convert ticket to dictionary"""
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'priority': self.priority,
            'category': self.category,
            'submitterName': self.submitter_name,
            'submitterEmail': self.submitter_email,
            'submitterPhone': self.submitter_phone,
            'submitterDepartment': self.submitter_department,
            'imageUrl': self.image_url,
            'assignedTo': self.assigned_user.full_name if self.assigned_user else None,
            'assignedToId': self.assigned_to_id,
            'collaborators': [u.full_name for u in self.collaborators],
            'collaboratorIds': [u.id for u in self.collaborators],
            'slaDeadline': self.sla_deadline.isoformat() + "Z" if self.sla_deadline else None,
            'slaStatus': self.sla_status,
            'resolutionSummary': self.resolution_summary,
            'resolvedAt': self.resolved_at.isoformat() + "Z" if self.resolved_at else None,
            'createdAt': self.created_at.isoformat() + "Z" if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
        
        if include_notes:
            data['notes'] = [note.to_dict() for note in self.notes]
        
        return data
    
    def __repr__(self):
        return f'<Ticket {self.id}>'


class TicketNote(db.Model):
    """TicketNote model for ticket notes/comments"""
    __tablename__ = 'ticket_notes'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = db.Column(db.String(20), db.ForeignKey('tickets.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    author_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    image_url = db.Column(db.String(255), nullable=True)
    is_internal = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    ticket = db.relationship('Ticket', back_populates='notes')
    author = db.relationship('User', back_populates='notes', foreign_keys=[author_id])
    
    def to_dict(self):
        """Convert note to dictionary"""
        return {
            'id': self.id,
            'ticketId': self.ticket_id,
            'content': self.content,
            'author': self.author.full_name if self.author else 'Unknown',
            'authorId': self.author_id,
            'imageUrl': self.image_url,
            'isInternal': self.is_internal,
            'createdAt': self.created_at.isoformat() + "Z" if self.created_at else None,
        }
    
    def __repr__(self):
        return f'<TicketNote {self.id}>'
