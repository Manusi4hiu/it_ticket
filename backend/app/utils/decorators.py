from functools import wraps
from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User

def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        try:
            user = User.query.get(int(user_id))
        except (TypeError, ValueError):
            user = User.query.get(user_id)
        # Akun nonaktif/dihapus tidak boleh punya akses admin sama sekali.
        if not user or not user.is_active or user.role != 'Administrator':
            return jsonify({'success': False, 'error': 'Admin privileges required'}), 403
        return fn(*args, **kwargs)
    return wrapper
