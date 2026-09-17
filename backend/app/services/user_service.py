from app import db
from app.models.user import User
from app.models.ticket import Ticket
from app.constants import DEV_CATEGORY
from sqlalchemy import or_

class UserService:
    @staticmethod
    def _status_groups():
        """Kelompok nama status (lowercase) dari master Status.filter_group.

        Sinkron dengan TicketService.get_stats: dinamis mengikuti master data,
        fallback infer dari nama. Mengembalikan dict grup -> list nama.
        """
        from app.models.master_data import Status
        from app.services.master_data_service import _infer_filter_group
        groups = {'new': [], 'progress': [], 'done': [], 'pending': []}
        for s in Status.query.all():
            group = s.filter_group or _infer_filter_group(s.name, s.is_default)
            groups.setdefault(group, groups['progress']).append(s.name.lower())
        return groups

    @staticmethod
    def _resolution_hours(resolved_at, fallback_end, taken_at, fallback_start):
        """Durasi penyelesaian (jam) dengan normalisasi timezone.

        resolved_at naive (UTC) vs created_at/updated_at aware — samakan ke naive UTC.
        Kembalikan None bila tidak valid (None atau negatif).
        """
        from datetime import timezone
        end = resolved_at or fallback_end
        start = taken_at or fallback_start
        if not end or not start:
            return None
        if getattr(end, 'tzinfo', None) is not None:
            end = end.astimezone(timezone.utc).replace(tzinfo=None)
        if getattr(start, 'tzinfo', None) is not None:
            start = start.astimezone(timezone.utc).replace(tzinfo=None)
        diff = (end - start).total_seconds() / 3600
        return diff if diff >= 0 else None

    @staticmethod
    def get_users(role=None):
        query = User.query
        if role:
            query = query.filter_by(role=role)
        return query.order_by(User.full_name).all()

    @staticmethod
    def get_agents():
        """Get users who can be assigned to tickets: Staff & Administrator saja.
        Role Management TIDAK termasuk — view-only, tidak mengerjakan tiket."""
        return User.query.filter(User.role.in_(['Staff', 'Administrator'])).order_by(User.full_name).all()

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
        if 'full_name' in data and data['full_name']:
            user.full_name = str(data['full_name']).strip()
        if 'username' in data and data['username']:
            new_username = str(data['username']).strip()
            if new_username != user.username:
                existing_user = User.query.filter_by(username=new_username).first()
                if existing_user:
                    return None, 'Username sudah digunakan', 409
                user.username = new_username
        if 'email' in data:
            # Check uniqueness if email is being changed
            if data['email'] and data['email'] != user.email:
                existing_email = User.query.filter_by(email=data['email']).first()
                if existing_email:
                    return None, 'Email sudah terdaftar', 409
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
        
        # Only admin can change is_active
        if 'is_active' in data and current_user.role == 'Administrator':
            user.is_active = bool(data['is_active'])
        
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
    def toggle_active(user_id, current_user):
        """Toggle is_active status of a user (admin only)"""
        try:
            user_id = int(user_id)
        except (ValueError, TypeError):
            pass

        if not current_user or current_user.role != 'Administrator':
            return None, 'Unauthorized. Admin only.', 403

        if current_user.id == user_id:
            return None, 'Tidak bisa mengubah status akun sendiri', 400

        user = User.query.get(user_id)
        if not user:
            return None, 'User tidak ditemukan', 404

        user.is_active = not user.is_active
        db.session.commit()
        status_label = 'diaktifkan' if user.is_active else 'dinonaktifkan'
        return user, f'User berhasil {status_label}', 200

    @staticmethod
    def _window_bounds(start, end):
        """Batas jendela start/end (ISO YYYY-MM-DD) sebagai naive UTC.

        Mengembalikan (mulai, akhir) atau (None, None) bila tak valid —
        pemanggil memperlakukan itu sebagai tanpa jendela (all-time).
        """
        from datetime import datetime, timedelta, timezone
        if not start and not end:
            return None, None
        try:
            today = datetime.now(timezone.utc).date()
            start_d = datetime.strptime(start, '%Y-%m-%d').date() if start else today
            end_d = datetime.strptime(end, '%Y-%m-%d').date() if end else today
        except (TypeError, ValueError):
            return None, None
        if end_d < start_d:
            return None, None
        WIB = timezone(timedelta(hours=7))
        lo = datetime.combine(start_d, datetime.min.time()).replace(tzinfo=WIB).astimezone(timezone.utc).replace(tzinfo=None)
        hi = datetime.combine(end_d, datetime.max.time()).replace(tzinfo=WIB).astimezone(timezone.utc).replace(tzinfo=None)
        return lo, hi

    @staticmethod
    def _naive_utc(dt):
        """Samakan datetime aware/naive campuran ke naive UTC untuk perbandingan."""
        from datetime import timezone
        if dt is None:
            return None
        if getattr(dt, 'tzinfo', None) is not None:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt

    @staticmethod
    def get_user_performance(user_id):
        user = User.query.get(user_id)
        if not user:
            return None
        
        # Get ticket stats for this user (Assigned or Collaborator)
        user_tickets_query = Ticket.query.filter(Ticket.category != DEV_CATEGORY).filter(
            (Ticket.assigned_to_id == user_id) | 
            (Ticket.collaborators.any(User.id == user_id))
        )
        
        total_involved = user_tickets_query.count()
        resolved = user_tickets_query.filter(db.func.lower(Ticket.status) == 'resolved').count()
        closed = user_tickets_query.filter(db.func.lower(Ticket.status) == 'closed').count()
        # Grup progress dinamis dari master Status (dulu hardcode 'in-progress' hyphen
        # yang tak pernah cocok dengan "In Progress" sehingga selalu 0)
        progress_names = UserService._status_groups()['progress']
        if progress_names:
            in_progress = user_tickets_query.filter(db.func.lower(Ticket.status).in_(progress_names)).count()
        else:
            in_progress = 0
        
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
    def get_all_performance(start=None, end=None):
        """Performansi seluruh user aktif (Staff/Administrator/Management).

        Definisi tiket yang dihitung disamakan dengan halaman Team (get_user_performance):
        assigned + collaborator, exclude kategori Development. Sebelumnya hanya
        assigned dan rolenya terbatas Staff+Administrator, sehingga angka di
        Analytics tidak cocok dengan halaman Team.

        Bila start/end (ISO YYYY-MM-DD) diberikan: involved = tiket DIBUAT dalam
        jendela, resolved = tiket SELESAI (resolved_at fallback updated_at) dalam
        jendela — untuk ranking periode Analytics. Tanpa jendela = all-time.
        """
        users = User.query.filter(
            User.role.in_(['Staff', 'Administrator', 'Management']),
            User.is_active == True
        ).all()

        w_lo, w_hi = UserService._window_bounds(start, end)
        windowed = w_lo is not None

        def in_window(dt):
            n = UserService._naive_utc(dt)
            return n is not None and w_lo <= n <= w_hi

        results = []
        for user in users:
            # Get ticket stats for this user (Assigned or Collaborator)
            # — definisi sama dengan get_user_performance (halaman Team/Profile).
            involved_tickets = Ticket.query.filter(Ticket.category != DEV_CATEGORY).filter(
                (Ticket.assigned_to_id == user.id) |
                (Ticket.collaborators.any(User.id == user.id))
            ).all()

            if windowed:
                involved_tickets = [t for t in involved_tickets if in_window(t.created_at)]

            total_involved = len(involved_tickets)

            # Definisi status dinamis dari master Status.filter_group —
            # sinkron dengan TicketService.get_stats (dulu hardcode:
            # resolved/closed saja, 'in-progress' hyphen selalu 0,
            # pending diisi status 'assigned' yang salah).
            groups = UserService._status_groups()
            done_names = groups['done']
            progress_names = groups['progress']
            pending_names = groups['pending']

            if windowed:
                resolved_tickets = [
                    t for t in involved_tickets
                    if t.status.lower() in done_names and in_window(t.resolved_at or t.updated_at)
                ]
            else:
                resolved_tickets = [t for t in involved_tickets if t.status.lower() in done_names]
            resolved_count = len(resolved_tickets)
            
            in_progress = len([t for t in involved_tickets if t.status.lower() in progress_names])
            pending = len([t for t in involved_tickets if t.status.lower() in pending_names])
            
            # SLA compliance
            breached = len([t for t in involved_tickets if t.sla_status == 'breached'])
            sla_compliance = ((total_involved - breached) / total_involved * 100) if total_involved > 0 else 100
            
            # Calculate resolution times — basis taken_at (mulai dikerjakan),
            # fallback created_at; akhir resolved_at fallback updated_at.
            # Sinkron dengan TicketService.get_stats (dulu created_at saja).
            resolution_times = []
            for t in resolved_tickets:
                hours = UserService._resolution_hours(t.resolved_at, t.updated_at, t.taken_at, t.created_at)
                if hours is not None:
                    resolution_times.append(hours)
            
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
