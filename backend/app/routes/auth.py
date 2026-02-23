from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.auth_service import AuthService
from app.utils.decorators import admin_required

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate user and return JWT token"""
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    result, error = AuthService.login(username, password)
    
    if error:
        return jsonify({'success': False, 'error': error}), 401
    
    return jsonify({
        'success': True,
        **result
    }), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current authenticated user info"""
    user_id = get_jwt_identity()
    user = AuthService.get_current_user(user_id)
    
    if not user:
        return jsonify({'success': False, 'error': 'User tidak ditemukan'}), 404
    
    return jsonify({
        'success': True,
        'user': user
    }), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user (client should discard token)"""
    # With JWT, logout is handled client-side by discarding the token
    # We can implement token blacklisting if needed
    return jsonify({
        'success': True,
        'message': 'Logout berhasil'
    }), 200
