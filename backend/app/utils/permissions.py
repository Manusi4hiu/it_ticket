"""
Role-based permission helpers.

Single source of truth untuk aturan role (RBAC):

Administrator:
  - Full access ke semua fitur
  - Bisa manage user roles
  - Bisa assign & take tickets
  - Bisa view semua reports & analytics

Management:
  - View-only dashboard & tickets
  - TIDAK bisa assign/take tickets
  - TIDAK bisa mengubah status ticket
  - Full access reports & analytics

Staff:
  - Bisa view & manage tickets
  - Bisa take & di-assign tickets
  - Bisa mengubah status ticket
  - Bisa view reports & analytics
"""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.constants import (
    ROLE_ADMINISTRATOR,
    ROLE_MANAGEMENT,
    ROLE_STAFF,
)


def get_current_user():
    """Return User object dari JWT identity, atau None."""
    user_id = get_jwt_identity()
    if user_id is None:
        return None
    try:
        return User.query.get(int(user_id))
    except (TypeError, ValueError):
        return User.query.get(user_id)


def get_user_team_ids(user):
    """Set team id milik user (membership user_teams)."""
    if not user:
        return set()
    return {t.id for t in user.teams}


def is_admin(user):
    return is_administrator(user)


# ── Team scoping ────────────────────────────────────────────────────
# Single source of truth untuk pemisahan workspace (team).
# Admin lintas team; Staff/Management hanya team tempat mereka anggota.

def scoped_ticket_query(user, base_query):
    """Batasi query Ticket ke team yang boleh diakses user.

    Admin -> semua team. Non-admin -> hanya ticket di team membership user.
    """
    if is_administrator(user):
        return base_query
    team_ids = get_user_team_ids(user)
    from app.models.ticket import Ticket
    if team_ids:
        return base_query.filter(Ticket.team_id.in_(team_ids))
    # Non-admin tanpa team: tidak melihat apa pun.
    return base_query.filter(Ticket.team_id == -1)


def can_access_ticket(user, ticket):
    """Apakah user boleh melihat/mengelola ticket ini."""
    if not user or not ticket:
        return False
    if is_administrator(user):
        return True
    return ticket.team_id in get_user_team_ids(user)


def has_role(user, *roles):
    return bool(user) and user.role in roles


def is_administrator(user):
    return has_role(user, ROLE_ADMINISTRATOR)


def is_management(user):
    return has_role(user, ROLE_MANAGEMENT)


def is_staff(user):
    return has_role(user, ROLE_STAFF)


# ── Capability checks ──────────────────────────────────────────────
# Assign/take ticket: Administrator & Staff (Management DILARANG)
CAN_ASSIGN_TICKETS = (ROLE_ADMINISTRATOR, ROLE_STAFF)
# Ubah status ticket: Administrator & Staff (Management DILARANG)
CAN_CHANGE_STATUS = (ROLE_ADMINISTRATOR, ROLE_STAFF)
# Manage users/roles: Administrator saja
CAN_MANAGE_USERS = (ROLE_ADMINISTRATOR,)
# Full reports/analytics: Administrator & Management & Staff (Staff view-only reports)
CAN_VIEW_REPORTS = (ROLE_ADMINISTRATOR, ROLE_MANAGEMENT, ROLE_STAFF)


def can_assign_tickets(user):
    return has_role(user, *CAN_ASSIGN_TICKETS)


def can_change_ticket_status(user):
    return has_role(user, *CAN_CHANGE_STATUS)


def can_manage_users(user):
    return has_role(user, *CAN_MANAGE_USERS)


def can_view_reports(user):
    return has_role(user, *CAN_VIEW_REPORTS)


# ── Decorators ─────────────────────────────────────────────────────

def admin_required(fn):
    """Administrator saja (manage users/roles, settings, delete ticket)."""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not is_administrator(user):
            return jsonify({'success': False, 'error': 'Admin privileges required'}), 403
        return fn(*args, **kwargs)
    return wrapper


def role_required(*allowed_roles):
    """Batasi endpoint ke role tertentu saja."""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if not user or user.role not in allowed_roles:
                return jsonify({
                    'success': False,
                    'error': f'Unauthorized. Role yang diizinkan: {", ".join(allowed_roles)}'
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def assign_permission_required(fn):
    """Assign/take ticket — Administrator & Staff. Management DILARANG."""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not can_assign_tickets(user):
            return jsonify({
                'success': False,
                'error': 'Unauthorized. Role Management tidak dapat assign/take ticket.'
            }), 403
        return fn(*args, **kwargs)
    return wrapper


def status_change_permission_required(fn):
    """Ubah status ticket — Administrator & Staff. Management DILARANG."""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not can_change_ticket_status(user):
            return jsonify({
                'success': False,
                'error': 'Unauthorized. Role Management tidak dapat mengubah status ticket.'
            }), 403
        return fn(*args, **kwargs)
    return wrapper
