from app import db
from app.models.ticket import Ticket, TicketNote
from app.models.user import User
from app.models.master_data import Department, Status
from app.utils.logging import log_activity
from app.utils.security import sanitize_html
from datetime import datetime, timedelta, timezone
from app.constants import DEV_CATEGORY, RESOLVED_STATUSES
import uuid

class TicketService:
    # Removed get_next_ticket_id as IDs are now auto-incrementing integers

    @staticmethod
    def calculate_sla_status(sla_deadline, resolved_at=None):
        """Calculate SLA status based on deadline and resolution time"""
        if not sla_deadline:
            return 'good'
            
        # Ensure sla_deadline is timezone-aware
        if sla_deadline.tzinfo is None:
            sla_deadline = sla_deadline.replace(tzinfo=timezone.utc)
        
        # If resolved, compare deadline with resolution time instead of current time
        comparison_time = resolved_at if resolved_at else datetime.now(timezone.utc)
        
        # Ensure comparison_time is timezone-aware
        if comparison_time.tzinfo is None:
            comparison_time = comparison_time.replace(tzinfo=timezone.utc)
            
        time_remaining = sla_deadline - comparison_time
        
        if time_remaining.total_seconds() < 0:
            return 'breached'
        elif not resolved_at and time_remaining.total_seconds() < 2 * 60 * 60:  # Warning only for active tickets
            return 'warning'
        else:
            return 'good'

    @staticmethod
    def get_sla_hours_for_ticket(priority_name, category_name=None):
        """Get SLA hours dynamically from Priority or SLAPolicy, falling back to defaults"""
        try:
            from app.models.master_data import Priority, Category, SLAPolicy
            
            p_obj = Priority.query.filter(Priority.name.ilike(priority_name)).first() if priority_name else None
            c_obj = Category.query.filter(Category.name.ilike(category_name)).first() if category_name else None
            
            if p_obj and c_obj:
                policy = SLAPolicy.query.filter_by(priority_id=p_obj.id, category_id=c_obj.id).first()
                if policy:
                    return policy.resolution_time_hours
            
            if p_obj:
                policy = SLAPolicy.query.filter_by(priority_id=p_obj.id, category_id=None).first()
                if policy:
                    return policy.resolution_time_hours
            
            if c_obj:
                policy = SLAPolicy.query.filter_by(priority_id=None, category_id=c_obj.id).first()
                if policy:
                    return policy.resolution_time_hours
            
            if p_obj and p_obj.sla_hours:
                return p_obj.sla_hours
        except Exception as e:
            print(f"Error resolving dynamic SLA hours: {e}")
            
        # Hardcoded defaults fallback
        sla_hours_map = {'critical': 4, 'high': 8, 'medium': 24, 'low': 48}
        return sla_hours_map.get(priority_name.lower() if priority_name else 'medium', 24)

    @staticmethod
    def create_ticket(data, image_url=None, idempotency_key=None):
        """
        Create a new ticket using the provided data and optional image URL.
        Implements ACID principles:
        - Atomicity: All operations (ticket + log) succeed or fail together.
        - Consistency: Validates data and uses transactions.
        - Isolation: Prevents duplicate creations via idempotency key.
        - Durability: Committed data is persistent.
        """
        # 1. Isolation: Check for existing ticket with same idempotency key
        if idempotency_key:
            existing = Ticket.query.filter_by(idempotency_key=idempotency_key).first()
            if existing:
                return existing

        # 2. Transaction for Atomicity
        try:
            # SLA only runs when the ticket is claimed/assigned
            priority = data.get('priority', 'medium')
            assigned_to_id = data.get('assignedToId')
            sla_deadline = None
            if assigned_to_id:
                hours = TicketService.get_sla_hours_for_ticket(priority, data.get('category'))
                sla_deadline = datetime.now(timezone.utc) + timedelta(hours=hours)
            
            # Fetch department info
            dept_code = "TKT"
            dept_name = data.get('submitterDepartment')
            if dept_name:
                dept = Department.query.filter_by(name=dept_name).first()
                if dept and dept.code:
                    dept_code = dept.code
            
            # Generate ticket code (per department counter)
            # Find the latest ticket for this specific department
            last_ticket = Ticket.query.filter(Ticket.ticket_code.like(f"{dept_code}-%"))\
                .order_by(Ticket.code_counter.desc())\
                .first()
            
            new_counter = 1
            if last_ticket and last_ticket.code_counter:
                new_counter = last_ticket.code_counter + 1
            
            ticket_code = f"{dept_code}-{str(new_counter).zfill(3)}"

            # Fetch default status from master data
            default_status = Status.query.filter_by(is_default=True).first()
            status_name = default_status.name if default_status else 'New'

            ticket = Ticket(
                title=sanitize_html(data['title']),
                description=sanitize_html(data['description']),
                status=status_name,
                priority=priority,
                category=data['category'],
                submitter_name=sanitize_html(data['submitterName']),
                submitter_email=sanitize_html(data.get('submitterEmail')),
                submitter_phone=sanitize_html(data.get('submitterPhone')),
                submitter_department=sanitize_html(data.get('submitterDepartment')),
                image_url=image_url,
                idempotency_key=idempotency_key,
                sla_deadline=sla_deadline,
                sla_status='good',
                ticket_code=ticket_code,
                code_counter=new_counter,
                assigned_to_id=assigned_to_id
            )
            
            db.session.add(ticket)
            
            # Note: We need to flush to get the ticket ID for the log, 
            # but we don't commit yet to maintain Atomicity.
            db.session.flush()

            # Log the activity (using a version that doesn't commit internally)
            from app.utils.logging import log_activity
            log_activity(
                action="Ticket Created",
                details=f"Ticket {ticket.id} created by {ticket.submitter_name}",
                target_id=ticket.id,
                metadata={
                    "title": ticket.title,
                    "category": ticket.category,
                    "priority": ticket.priority,
                    "submitter": ticket.submitter_name
                },
                auto_commit=False
            )
            
            # If everything succeeded, commit the whole transaction
            db.session.commit()
            return ticket

        except Exception as e:
            db.session.rollback()
            # Handle specific database constraint errors
            error_msg = str(e).lower()
            if 'unique' in error_msg or 'duplicate' in error_msg:
                # If it's a duplicate, check if the ticket was actually created by a parallel request
                if idempotency_key:
                    existing = Ticket.query.filter_by(idempotency_key=idempotency_key).first()
                    if existing:
                        return existing
                print(f"Duplicate entry detected: {error_msg}")
            
            print(f"Transaction failed: {str(e)}")
            raise e
    @staticmethod
    def update_ticket(ticket_id, data):
        """Update a ticket's details"""
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return None
        
        priority_changed = False
        category_changed = False
        
        # Update fields if provided
        if 'title' in data:
            ticket.title = sanitize_html(data['title'])
        if 'description' in data:
            ticket.description = sanitize_html(data['description'])
        if 'status' in data:
            ticket.status = data['status']
            if data['status'].lower() in ['resolved', 'closed']:
                ticket.resolved_at = datetime.now(timezone.utc)
        if 'priority' in data:
            ticket.priority = data['priority']
            priority_changed = True
        if 'category' in data:
            ticket.category = data['category']
            category_changed = True
        if 'resolutionSummary' in data:
            ticket.resolution_summary = sanitize_html(data['resolutionSummary'])
        if 'resolvedAt' in data and data['resolvedAt']:
            try:
                clean_str = data['resolvedAt'].replace('Z', '+00:00')
                ticket.resolved_at = datetime.fromisoformat(clean_str).replace(tzinfo=None)
            except ValueError:
                pass
        if 'assignedToId' in data:
            prev_assigned_id = ticket.assigned_to_id
            new_assigned_id = data['assignedToId']
            ticket.assigned_to_id = new_assigned_id
            
            # If assigned, change status from 'new' to 'assigned'
            if ticket.assigned_to_id and ticket.status.lower() == 'new':
                ticket.status = 'assigned'
                
            if ticket.assigned_to_id:
                if not prev_assigned_id or not ticket.sla_deadline:
                    hours = TicketService.get_sla_hours_for_ticket(ticket.priority, ticket.category)
                    ticket.sla_deadline = datetime.now(timezone.utc) + timedelta(hours=hours)
            else:
                ticket.sla_deadline = None
        elif (priority_changed or category_changed) and ticket.assigned_to_id:
            # If priority/category changed and ticket is assigned, recalculate deadline
            hours = TicketService.get_sla_hours_for_ticket(ticket.priority, ticket.category)
            ticket.sla_deadline = datetime.now(timezone.utc) + timedelta(hours=hours)
            
        if 'collaboratorIds' in data:
            # Clear existing collaborators and add new ones
            ticket.collaborators = []
            for user_id in data['collaboratorIds']:
                user = User.query.get(user_id)
                if user:
                    ticket.collaborators.append(user)
        
        ticket.updated_at = datetime.now(timezone.utc)
        ticket.sla_status = TicketService.calculate_sla_status(ticket.sla_deadline, ticket.resolved_at)
        db.session.commit()
        
        return ticket

    @staticmethod
    def delete_ticket(ticket_id, user_id=None):
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return False
            
        # Log the activity before deletion
        from app.utils.logging import log_activity
        log_activity(
            action="Ticket Deleted",
            details=f"Ticket {ticket.ticket_code} ({ticket.title}) was deleted",
            user_id=user_id,
            target_id=ticket.id,
            metadata={
                "ticket_code": ticket.ticket_code,
                "title": ticket.title,
                "submitter": ticket.submitter_name
            }
        )

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
            
            # Postpone SLA deadline calculation until it is assigned (taken)
            if not ticket.sla_deadline:
                hours = TicketService.get_sla_hours_for_ticket(ticket.priority, ticket.category)
                ticket.sla_deadline = datetime.now(timezone.utc) + timedelta(hours=hours)
            
            # Try to find an "Assigned" status in master data, otherwise use 'Assigned'
            assigned_status = Status.query.filter(Status.name.ilike('%assigned%')).first()
            if assigned_status:
                ticket.status = assigned_status.name
            else:
                ticket.status = 'Assigned'
        else:
            ticket.assigned_to_id = None
            ticket.sla_deadline = None
            ticket.sla_status = 'good'
            # Revert to default status
            default_status = Status.query.filter_by(is_default=True).first()
            ticket.status = default_status.name if default_status else 'New'
        
        ticket.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        return ticket, None

    @staticmethod
    def update_ticket_status(ticket_id, status, resolution_summary=None, resolved_at_str=None):
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return None
            
        ticket.status = status
        
        # Check if status is resolved (case-insensitive)
        if status.lower() == 'resolved':
            if resolved_at_str:
                try:
                    # Handle Z suffix for UTC
                    clean_str = resolved_at_str.replace('Z', '+00:00')
                    ticket.resolved_at = datetime.fromisoformat(clean_str).replace(tzinfo=None)
                except ValueError:
                    ticket.resolved_at = datetime.now(timezone.utc)
            else:
                ticket.resolved_at = datetime.now(timezone.utc)
                
            if resolution_summary:
                ticket.resolution_summary = resolution_summary
        
        ticket.updated_at = datetime.now(timezone.utc)
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
            content=sanitize_html(content),
            author_id=author_id,
            image_url=image_url,
            is_internal=is_internal
        )
        
        db.session.add(note)
        ticket.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        return note

    @staticmethod
    def get_stats(user_id=None):
        """Get ticket statistics for dashboard, optionally filtered by user"""
        base_query = Ticket.query.filter(Ticket.category != DEV_CATEGORY)
        if user_id:
            base_query = base_query.filter(Ticket.assigned_to_id == user_id)
            
        total = base_query.count()
        # To make it dynamic, we use the master data if possible
        all_statuses = Status.query.all()
        
        new_status_names = [s.name.lower() for s in all_statuses if s.is_default] or ['new']
        resolved_status_names = [s.name.lower() for s in all_statuses if 'resolve' in s.name.lower() or 'close' in s.name.lower()] or ['resolved', 'closed']
        
        new = base_query.filter(db.func.lower(Ticket.status).in_(new_status_names)).count()
        resolved = base_query.filter(db.func.lower(Ticket.status).in_(resolved_status_names)).count()
        assigned = total - new - resolved
        worked_on = total - new
        
        open_status_names = ['new', 'assign', 'assigned', 'inprogress', 'in progress']
        open_count = base_query.filter(db.func.lower(Ticket.status).in_(open_status_names)).count()
        
        # SLA stats
        breached = base_query.filter_by(sla_status='breached').count()
        warning = base_query.filter_by(sla_status='warning').count()
        
        # Priority breakdown
        by_priority = {
            'critical': base_query.filter(db.func.lower(Ticket.priority) == 'critical').filter(db.func.lower(Ticket.status).notin_(resolved_status_names)).count(),
            'high': base_query.filter(db.func.lower(Ticket.priority) == 'high').filter(db.func.lower(Ticket.status).notin_(resolved_status_names)).count(),
            'medium': base_query.filter(db.func.lower(Ticket.priority) == 'medium').filter(db.func.lower(Ticket.status).notin_(resolved_status_names)).count(),
            'low': base_query.filter(db.func.lower(Ticket.priority) == 'low').filter(db.func.lower(Ticket.status).notin_(resolved_status_names)).count(),
        }
        
        # Category breakdown
        cats = db.session.query(Ticket.category, db.func.count(Ticket.id))\
            .filter(Ticket.category != DEV_CATEGORY)\
            .filter(Ticket.assigned_to_id == user_id if user_id else True)\
            .group_by(Ticket.category).all()
        by_category = {cat: count for cat, count in cats if cat}
        
        # Department breakdown
        depts = db.session.query(Ticket.submitter_department, db.func.count(Ticket.id))\
            .filter(Ticket.category != DEV_CATEGORY)\
            .filter(Ticket.assigned_to_id == user_id if user_id else True)\
            .group_by(Ticket.submitter_department).all()
        by_department = {dept: count for dept, count in depts if dept}
        
        # Trend data (last 7 days)
        trend = []
        for i in range(6, -1, -1):
            date = (datetime.now(timezone.utc) - timedelta(days=i)).date()
            date_str = date.strftime('%a')
            
            start_of_day = datetime.combine(date, datetime.min.time()).replace(tzinfo=timezone.utc)
            end_of_day = datetime.combine(date, datetime.max.time()).replace(tzinfo=timezone.utc)
            
            created_q = Ticket.query.filter(Ticket.category != DEV_CATEGORY).filter(
                Ticket.created_at >= start_of_day, Ticket.created_at <= end_of_day
            )
            resolved_q = Ticket.query.filter(Ticket.category != DEV_CATEGORY).filter(
                Ticket.resolved_at >= start_of_day, Ticket.resolved_at <= end_of_day
            )
            
            if user_id:
                created_q = created_q.filter(Ticket.assigned_to_id == user_id)
                resolved_q = resolved_q.filter(Ticket.assigned_to_id == user_id)
                
            created = created_q.count()
            resolved_on_day = resolved_q.count()
            
            trend.append({
                'day': date_str,
                'created': created,
                'resolved': resolved_on_day
            })
        
        # All resolved tickets (for compliance)
        resolved_all_q = Ticket.query.filter(Ticket.category != DEV_CATEGORY).filter(db.func.lower(Ticket.status).in_(resolved_status_names))
        if user_id:
            resolved_all_q = resolved_all_q.filter(Ticket.assigned_to_id == user_id)
        
        resolved_all = resolved_all_q.all()
        res_times = []
        for t in resolved_all:
            if t.resolved_at and t.created_at:
                diff = (t.resolved_at - t.created_at).total_seconds() / 3600
                res_times.append(diff)
        
        avg_res_time = sum(res_times) / len(res_times) if res_times else 0
        
        return {
            'total': total,
            'open': open_count,
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
