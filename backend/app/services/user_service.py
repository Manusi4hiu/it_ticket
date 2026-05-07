from app import db
from app.models.user import User
from app.models.ticket import Ticket
from sqlalchemy import or_

class UserService:
    @staticmethod
    def get_users(role=None):
        query = User.query
        if role:
            query = query.filter_by(role=role)
        return query.order_by(User.full_name).all()

    @staticmethod
    def get_agents():
        """Get users who can be assigned to tickets (all staff)"""
        return User.query.order_by(User.full_name).all()

    @staticmethod
    def get_user_by_id(user_id):
        return User.query.get(user_id)

    @staticmethod
    def create_user(data):
        # Check if email or username already exists
        if data.get('email'):
            existing_email = User.query.filter_by(email=data['email']).first()
            if existing_email:
                return None, 'Email sudah terdaftar'
            
        existing_username = User.query.filter_by(username=data['username']).first()
        if existing_username:
            return None, 'Username sudah terdaftar'
        
        user = User(
            email=data.get('email'),
            username=data['username'],
            full_name=data['full_name'],
            role=data['role'],
            department=data.get('department'),
            phone=data.get('phone'),
            avatar_url=data.get('avatar_url')
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        return user, None

    @staticmethod
    def update_user(user_id, data, current_user):
        # Convert user_id to int if it's a string
        try:
            user_id = int(user_id)
        except (ValueError, TypeError):
            pass

        # Users can only update themselves, admins can update anyone
        if current_user.id != user_id and current_user.role != 'Administrator':
            return None, 'Unauthorized', 403
        
        user = User.query.get(user_id)
        if not user:
            return None, 'User tidak ditemukan', 404
        
        # Update fields if provided
        if 'full_name' in data:
            user.full_name = data['full_name']
        if 'username' in data:
            user.username = data['username']
        if 'email' in data:
            # Check uniqueness if email is being changed
            if data['email'] and data['email'] != user.email:
                existing_email = User.query.filter_by(email=data['email']).first()
                if existing_email:
                    return None, 'Email sudah terdaftar', 400
            user.email = data['email'] if data['email'] else None
        if 'department' in data:
            user.department = data['department']
        if 'phone' in data:
            user.phone = data['phone']
        if 'avatar_url' in data:
            user.avatar_url = data['avatar_url']
        
        # Only admin can change role
        if 'role' in data and current_user.role == 'Administrator':
            user.role = data['role']
        
        # Password change
        if 'password' in data:
            user.set_password(data['password'])
        
        db.session.commit()
        return user, None, 200

    @staticmethod
    def delete_user(user_id, current_user):
        try:
            user_id = int(user_id)
        except (ValueError, TypeError):
            pass

        if not current_user or current_user.role != 'Administrator':
            return False, 'Unauthorized. Admin only.', 403
        
        if current_user.id == user_id:
            return False, 'Tidak bisa menghapus akun sendiri', 400
        
        user = User.query.get(user_id)
        if not user:
            return False, 'User tidak ditemukan', 404
        
        db.session.delete(user)
        db.session.commit()
        return True, 'User berhasil dihapus', 200

    @staticmethod
    def get_user_performance(user_id):
        user = User.query.get(user_id)
        if not user:
            return None
        
        # Get ticket stats for this user (Assigned or Collaborator)
        user_tickets_query = Ticket.query.filter(
            (Ticket.assigned_to_id == user_id) | 
            (Ticket.collaborators.any(User.id == user_id))
        )
        
        total_involved = user_tickets_query.count()
        resolved = user_tickets_query.filter(db.func.lower(Ticket.status) == 'resolved').count()
        closed = user_tickets_query.filter(db.func.lower(Ticket.status) == 'closed').count()
        in_progress = user_tickets_query.filter(db.func.lower(Ticket.status) == 'in-progress').count()
        
        # SLA compliance
        breached = user_tickets_query.filter(Ticket.sla_status == 'breached').count()
        sla_compliance = ((total_involved - breached) / total_involved * 100) if total_involved > 0 else 100
        
        # Recent tickets
        recent_tickets = user_tickets_query\
            .order_by(Ticket.updated_at.desc())\
            .limit(5)\
            .all()
        
        # Calculate assists
        assists_count = user_tickets_query.filter(Ticket.assigned_to_id != user_id).count()
        
        return {
            'user': user.to_dict(),
            'totalAssigned': total_involved,
            'totalAssists': assists_count,
            'resolved': resolved,
            'closed': closed,
            'inProgress': in_progress,
            'slaCompliance': round(sla_compliance, 1),
            'slaBreach': breached,
            'recentTickets': [t.to_dict(include_notes=False) for t in recent_tickets]
        }

    @staticmethod
    def get_all_performance():
        users = User.query.filter(User.role.in_(['Staff', 'Administrator'])).all()
        
        results = []
        for user in users:
            # Get ticket stats for this user (Assigned or Collaborator)
            involved_tickets = Ticket.query.filter(
                (Ticket.assigned_to_id == user.id) | 
                (Ticket.collaborators.any(User.id == user.id))
            ).all()
            
            total_involved = len(involved_tickets)
            
            resolved_tickets = [t for t in involved_tickets if t.status.lower() in ['resolved', 'closed']]
            resolved_count = len(resolved_tickets)
            
            in_progress = len([t for t in involved_tickets if t.status.lower() == 'in-progress'])
            pending = len([t for t in involved_tickets if t.status.lower() == 'assigned'])
            
            # SLA compliance
            breached = len([t for t in involved_tickets if t.sla_status == 'breached'])
            sla_compliance = ((total_involved - breached) / total_involved * 100) if total_involved > 0 else 100
            
            # Calculate resolution times
            resolution_times = []
            for t in resolved_tickets:
                if t.resolved_at and t.created_at:
                    diff = (t.resolved_at - t.created_at).total_seconds() / 3600 # hours
                    resolution_times.append(diff)
            
            avg_resolution_time = sum(resolution_times) / len(resolution_times) if resolution_times else 0
            
            # Priority breakdown 
            priority_breakdown = {
                'critical': len([t for t in resolved_tickets if t.priority.lower() == 'critical']),
                'high': len([t for t in resolved_tickets if t.priority.lower() == 'high']),
                'medium': len([t for t in resolved_tickets if t.priority.lower() == 'medium']),
                'low': len([t for t in resolved_tickets if t.priority.lower() == 'low']),
            }
            
            # Calculate assists (tickets where user is collaborator but NOT primary assignee)
            assists_count = len([t for t in involved_tickets if t.assigned_to_id != user.id])

            results.append({
                'id': user.id,
                'name': user.full_name,
                'username': user.username,
                'email': user.email,
                'totalAssigned': total_involved,
                'totalAssists': assists_count,
                'resolved': resolved_count,
                'inProgress': in_progress,
                'pending': pending,
                'avgResolutionTime': round(avg_resolution_time, 1),
                'slaCompliance': round(sla_compliance, 1),
                'priorityBreakdown': priority_breakdown
            })
        
        return results
