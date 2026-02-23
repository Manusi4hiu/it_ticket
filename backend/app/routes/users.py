from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.user_service import UserService
from app.models.user import User

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
def get_agents():
    """Get users who can be assigned to tickets (all staff)"""
    users = UserService.get_agents()
    
    return jsonify({
        'success': True,
        'agents': [{'id': u.id, 'name': u.full_name, 'username': u.username, 'email': u.email, 'phone': u.phone} for u in users]
    }), 200


@users_bp.route('/<user_id>', methods=['GET'])
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
@jwt_required()
def create_user():
    """Create a new user (admin only)"""
    current_user_id = get_jwt_identity()
    current_user = UserService.get_user_by_id(current_user_id)
    
    if not current_user or current_user.role != 'Administrator':
        return jsonify({'success': False, 'error': 'Unauthorized. Admin only.'}), 403
    
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
@jwt_required()
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
@jwt_required()
def get_all_performance():
    """Get performance statistics for all staff members"""
    results = UserService.get_all_performance()
    
    return jsonify({
        'success': True,
        'performance': results
    }), 200
