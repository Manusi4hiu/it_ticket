from app import db
from app.models.ticket import Ticket, TicketNote
from app.models.user import User
from app.models.master_data import Department
from app.utils.logging import log_activity
from datetime import datetime, timedelta
import uuid

class TicketService:
    @staticmethod
    def get_next_ticket_id(dept_code="TKT"):
        """Generate the next ticket ID with department prefix"""
        prefix = dept_code.upper() if dept_code else "TKT"
        
        # Simple logic: find last ticket with this prefix
        last_ticket = Ticket.query.filter(Ticket.id.like(f"{prefix}-%")).order_by(Ticket.id.desc()).first()
        
        if last_ticket:
            try:
                # Extract number from PREFIX-XXX
                parts = last_ticket.id.split('-')
                if len(parts) > 1:
                    num = int(parts[-1])
                    return f"{prefix}-{num + 1:03d}"
            except (ValueError, IndexError):
                pass
                
        return f"{prefix}-001"

    @staticmethod
    def calculate_sla_status(sla_deadline, resolved_at=None):
        """Calculate SLA status based on deadline and resolution time"""
        if not sla_deadline:
            return 'good'
        
        # If resolved, compare deadline with resolution time instead of current time
        comparison_time = resolved_at if resolved_at else datetime.utcnow()
        time_remaining = sla_deadline - comparison_time
        
        if time_remaining.total_seconds() < 0:
            return 'breached'
        elif not resolved_at and time_remaining.total_seconds() < 2 * 60 * 60:  # Warning only for active tickets
            return 'warning'
        else:
            return 'good'

    @staticmethod
    def create_ticket(data, image_url=None):
        """
        Create a new ticket using the provided data and optional image URL.
        """
        # Calculate SLA deadline based on priority
        priority = data.get('priority', 'medium')
        sla_hours = {'critical': 4, 'high': 8, 'medium': 24, 'low': 48}
        sla_deadline = datetime.utcnow() + timedelta(hours=sla_hours.get(priority, 24))
        
        # Fetch department code if available
        dept_code = "TKT"
        dept_name = data.get('submitterDepartment')
        if dept_name:
            dept = Department.query.filter_by(name=dept_name).first()
            if dept and dept.code:
                dept_code = dept.code
        
        ticket = Ticket(
            id=TicketService.get_next_ticket_id(dept_code),
            title=data['title'],
            description=data['description'],
            status='new',
            priority=priority,
            category=data['category'],
            submitter_name=data['submitterName'],
            submitter_email=data.get('submitterEmail'),
            submitter_phone=data.get('submitterPhone'),
            submitter_department=data.get('submitterDepartment'),
            image_url=image_url,
            sla_deadline=sla_deadline,
            sla_status='good'
        )
        
        db.session.add(ticket)
        db.session.commit()
        
        # Log the activity
        log_activity(
            action="Ticket Created",
            details=f"Ticket {ticket.id} created by {ticket.submitter_name}",
            target_id=ticket.id,
            metadata={
                "title": ticket.title,
                "category": ticket.category,
                "priority": ticket.priority,
                "submitter": ticket.submitter_name
            }
        )
        
        return ticket

    @staticmethod
    def update_ticket(ticket_id, data):
        """Update a ticket's details"""
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return None
        
        # Update fields if provided
        if 'title' in data:
            ticket.title = data['title']
        if 'description' in data:
            ticket.description = data['description']
        if 'status' in data:
            ticket.status = data['status']
            if data['status'] == 'resolved':
                ticket.resolved_at = datetime.utcnow()
        if 'priority' in data:
            ticket.priority = data['priority']
        if 'category' in data:
            ticket.category = data['category']
        if 'resolutionSummary' in data:
            ticket.resolution_summary = data['resolutionSummary']
        if 'assignedToId' in data:
            ticket.assigned_to_id = data['assignedToId']
            # If assigned, change status from 'new' to 'assigned'
            if ticket.assigned_to_id and ticket.status == 'new':
                ticket.status = 'assigned'
        if 'collaboratorIds' in data:
            # Clear existing collaborators and add new ones
            ticket.collaborators = []
            for user_id in data['collaboratorIds']:
                user = User.query.get(user_id)
                if user:
                    ticket.collaborators.append(user)
        
        ticket.updated_at = datetime.utcnow()
        ticket.sla_status = TicketService.calculate_sla_status(ticket.sla_deadline, ticket.resolved_at)
        db.session.commit()
        
        return ticket

    @staticmethod
    def delete_ticket(ticket_id):
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return False
            
        db.session.delete(ticket)
        db.session.commit()
        return True

    @staticmethod
    def assign_ticket(ticket_id, user_id):
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return None, 'Ticket tidak ditemukan'
            
        if user_id:
            user = User.query.get(user_id)
            if not user:
                return None, 'User tidak ditemukan'
            ticket.assigned_to_id = user_id
            ticket.status = 'assigned'
        else:
            ticket.assigned_to_id = None
            ticket.status = 'new'
        
        ticket.updated_at = datetime.utcnow()
        db.session.commit()
        return ticket, None

    @staticmethod
    def update_ticket_status(ticket_id, status, resolution_summary=None):
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return None
            
        ticket.status = status
        
        if status == 'resolved':
            ticket.resolved_at = datetime.utcnow()
            if resolution_summary:
                ticket.resolution_summary = resolution_summary
        
        ticket.updated_at = datetime.utcnow()
        ticket.sla_status = TicketService.calculate_sla_status(ticket.sla_deadline, ticket.resolved_at)
        db.session.commit()
        return ticket

    @staticmethod
    def add_note(ticket_id, content, author_id, is_internal=False, image_url=None):
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return None
            
        note = TicketNote(
            ticket_id=ticket_id,
            content=content,
            author_id=author_id,
            image_url=image_url,
            is_internal=is_internal
        )
        
        db.session.add(note)
        ticket.updated_at = datetime.utcnow()
        db.session.commit()
        return note

    @staticmethod
    def get_stats():
        """Get ticket statistics for dashboard"""
        total = Ticket.query.count()
        new = Ticket.query.filter_by(status='new').count()
        assigned = Ticket.query.filter(Ticket.status.in_(['assigned', 'in-progress'])).count()
        resolved = Ticket.query.filter(Ticket.status.in_(['resolved', 'closed'])).count()
        worked_on = Ticket.query.filter(Ticket.status != 'new').count()
        
        # SLA stats
        breached = Ticket.query.filter_by(sla_status='breached').count()
        warning = Ticket.query.filter_by(sla_status='warning').count()
        
        # Priority breakdown
        by_priority = {
            'critical': Ticket.query.filter(db.func.lower(Ticket.priority) == 'critical').filter(Ticket.status.notin_(['resolved', 'closed'])).count(),
            'high': Ticket.query.filter(db.func.lower(Ticket.priority) == 'high').filter(Ticket.status.notin_(['resolved', 'closed'])).count(),
            'medium': Ticket.query.filter(db.func.lower(Ticket.priority) == 'medium').filter(Ticket.status.notin_(['resolved', 'closed'])).count(),
            'low': Ticket.query.filter(db.func.lower(Ticket.priority) == 'low').filter(Ticket.status.notin_(['resolved', 'closed'])).count(),
        }
        
        # Category breakdown
        cats = db.session.query(Ticket.category, db.func.count(Ticket.id))\
            .group_by(Ticket.category).all()
        by_category = {cat: count for cat, count in cats if cat}
        
        # Department breakdown
        depts = db.session.query(Ticket.submitter_department, db.func.count(Ticket.id))\
            .group_by(Ticket.submitter_department).all()
        by_department = {dept: count for dept, count in depts if dept}
        
        # Trend data (last 7 days)
        trend = []
        for i in range(6, -1, -1):
            date = (datetime.utcnow() - timedelta(days=i)).date()
            date_str = date.strftime('%a')
            
            created = Ticket.query.filter(db.func.date(Ticket.created_at) == date).count()
            resolved_on_day = Ticket.query.filter(db.func.date(Ticket.resolved_at) == date).count()
            
            trend.append({
                'day': date_str,
                'created': created,
                'resolved': resolved_on_day
            })
        
        # Average resolution time
        resolved_all = Ticket.query.filter(Ticket.status.in_(['resolved', 'closed'])).all()
        res_times = []
        for t in resolved_all:
            if t.resolved_at and t.created_at:
                diff = (t.resolved_at - t.created_at).total_seconds() / 3600
                res_times.append(diff)
        
        avg_res_time = sum(res_times) / len(res_times) if res_times else 0
        
        return {
            'total': total,
            'new': new,
            'assigned': assigned,
            'resolved': resolved,
            'workedOn': worked_on,
            'avgResolutionTime': round(avg_res_time, 1),
            'sla': {
                'breached': breached,
                'warning': warning,
                'healthy': total - breached - warning
            },
            'byPriority': by_priority,
            'byCategory': by_category,
            'byDepartment': by_department,
            'trend': trend
        }
