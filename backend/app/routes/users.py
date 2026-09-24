from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.user_service import UserService
from app.models.user import User
from app.utils.permissions import admin_required, role_required, get_current_user
from datetime import datetime, timezone

users_bp = Blueprint('users', __name__)


@users_bp.route('', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users/agents"""
    role = request.args.get('role')
    users = UserService.get_users(role)
    
    return jsonify({
        'success': True,
        'users': [user.to_dict() for user in users],
        'total': len(users)
    }), 200


@users_bp.route('/agents', methods=['GET'])
@jwt_required()
def get_agents():
    """Get users who can be assigned to tickets (all staff)"""
    users = UserService.get_agents()
    
    return jsonify({
        'success': True,
        'agents': [{
            'id': u.id,
            'name': u.full_name,
            'username': u.username,
            'email': u.email,
            'phone': u.phone,
            'isOnBreak': u.is_on_break or False,
        } for u in users]
    }), 200


@users_bp.route('/<user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get a single user by ID"""
    user = UserService.get_user_by_id(user_id)
    
    if not user:
        return jsonify({'success': False, 'error': 'User tidak ditemukan'}), 404
    
    return jsonify({
        'success': True,
        'user': user.to_dict()
    }), 200


@users_bp.route('', methods=['POST'])
@admin_required
def create_user():
    """Create a new user (admin only — manage user roles adalah privilege Administrator)"""
    current_user_id = get_jwt_identity()
    current_user = UserService.get_user_by_id(current_user_id)
    
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    required_fields = ['username', 'password', 'full_name', 'role']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'{field} diperlukan'}), 400
    
    user, error = UserService.create_user(data)
    
    if error:
        return jsonify({'success': False, 'error': error}), 400
    
    return jsonify({
        'success': True,
        'user': user.to_dict(),
        'message': 'User berhasil dibuat'
    }), 201


@users_bp.route('/<user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Update a user"""
    current_user_id = get_jwt_identity()
    current_user = UserService.get_user_by_id(current_user_id)
    
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    user, error, status_code = UserService.update_user(user_id, data, current_user)
    
    if error:
        return jsonify({'success': False, 'error': error}), status_code
    
    return jsonify({
        'success': True,
        'user': user.to_dict(),
        'message': 'User berhasil diupdate'
    }), 200


@users_bp.route('/<user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete a user (admin only)"""
    current_user_id = get_jwt_identity()
    current_user = UserService.get_user_by_id(current_user_id)
    
    success, message, status_code = UserService.delete_user(user_id, current_user)
    
    if not success:
        return jsonify({'success': False, 'error': message}), status_code
    
    return jsonify({
        'success': True,
        'message': message
    }), 200


@users_bp.route('/<user_id>/performance', methods=['GET'])
@jwt_required()
def get_user_performance(user_id):
    """Get user performance statistics"""
    performance = UserService.get_user_performance(user_id)
    
    if not performance:
        return jsonify({'success': False, 'error': 'User tidak ditemukan'}), 404
    
    return jsonify({
        'success': True,
        'performance': performance
    }), 200


@users_bp.route('/performance', methods=['GET'])
@role_required('Administrator', 'Management', 'Staff')
def get_all_performance():
    """Get performance statistics for all staff members (reports/analytics: Admin/Management/Staff)"""
    from flask import request
    # Jendela opsional (ISO YYYY-MM-DD) untuk ranking periode Analytics.
    results = UserService.get_all_performance(
        start=request.args.get('start'), end=request.args.get('end'))

    return jsonify({
        'success': True,
        'performance': results
    }), 200


@users_bp.route('/<int:user_id>/toggle-active', methods=['PATCH'])
@jwt_required()
def toggle_active(user_id):
    """Toggle active/inactive status of a user (admin only)"""
    current_user_id = get_jwt_identity()
    current_user = UserService.get_user_by_id(current_user_id)

    user, message, status_code = UserService.toggle_active(user_id, current_user)

    if not user:
        return jsonify({'success': False, 'error': message}), status_code

    return jsonify({
        'success': True,
        'user': user.to_dict(),
        'message': message
    }), 200


@users_bp.route('/<int:user_id>/break', methods=['POST'])
@jwt_required()
def toggle_break(user_id):
    """Toggle break status untuk staff IT"""
    from app import db
    from app.models.ticket import Ticket
    from app.services.email_service import EmailService

    current_user = get_current_user()

    # Guard: hanya bisa toggle break sendiri atau admin
    if current_user.id != user_id and current_user.role != 'Administrator':
        return jsonify({'error': 'Unauthorized'}), 403

    user = User.query.get_or_404(user_id)

    if user.is_on_break:
        # END break: akumulasi durasi
        if user.break_started_at:
            break_start = user.break_started_at
            if break_start.tzinfo is None:
                break_start = break_start.replace(tzinfo=timezone.utc)
            duration = (datetime.now(timezone.utc) - break_start).total_seconds()
            user.total_break_seconds_today = (user.total_break_seconds_today or 0) + int(duration)
        user.is_on_break = False
        user.break_started_at = None
    else:
        # START break: catat waktu mulai + notifikasi tiket assigned
        user.is_on_break = True
        user.break_started_at = datetime.now(timezone.utc)

        # Kirim email ke submitter tiket yang sedang assigned ke staff ini
        assigned_tickets = Ticket.query.filter(
            Ticket.assigned_to_id == user.id,
            Ticket.status.notin_(['resolved', 'closed', 'completed']),
            Ticket.receive_updates == True,
            Ticket.submitter_email.isnot(None)
        ).all()

        for ticket in assigned_tickets:
            try:
                EmailService.send_staff_break_notification(ticket, user)
            except Exception as e:
                print(f"Email break notification failed: {e}")

    db.session.commit()
    return jsonify(user.to_dict()), 200
