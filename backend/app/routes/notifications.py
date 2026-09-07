from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.notification_service import NotificationService

notifications_bp = Blueprint('notifications', __name__)


@notifications_bp.route('', methods=['GET'])
@jwt_required()
def list_notifications():
    """List notifikasi milik user login (unread_only optional)."""
    user_id = int(get_jwt_identity())
    unread_only = request.args.get('unread_only', default=False, type=lambda v: v.lower() == 'true')
    limit = request.args.get('limit', default=50, type=int)
    limit = max(1, min(limit, 200))

    items = NotificationService.get_for_user(user_id, unread_only=unread_only, limit=limit)
    unread = NotificationService.unread_count(user_id)
    return jsonify({
        'success': True,
        'notifications': [n.to_dict() for n in items],
        'unreadCount': unread,
    }), 200


@notifications_bp.route('/read', methods=['PUT'])
@jwt_required()
def mark_read():
    """Tandai notifikasi terbaca. Body: {"ids": [1,2,..]} (opsional — kosong = semua).
    Tidak menghapus notifikasi — tetap tampil di inbox dgn indikator sudah-dibaca."""
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    ids = data.get('ids')
    updated = NotificationService.mark_read(user_id, ids)
    return jsonify({
        'success': True,
        'updated': updated,
        'unreadCount': NotificationService.unread_count(user_id),
    }), 200


@notifications_bp.route('/delete', methods=['PUT'])
@jwt_required()
def delete_notifications():
    """Hapus notifikasi milik user. Body: {"ids": [1,2,..]} (WAJIB).
    Dipakai fitur hapus single/multi-select di notification bell."""
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    ids = data.get('ids')
    if not ids or not isinstance(ids, list) or len(ids) == 0:
        return jsonify({'success': False, 'error': 'ids array wajib diisi'}), 400

    deleted = NotificationService.delete_for_user(user_id, ids)
    return jsonify({
        'success': True,
        'deleted': deleted,
        'unreadCount': NotificationService.unread_count(user_id),
    }), 200
