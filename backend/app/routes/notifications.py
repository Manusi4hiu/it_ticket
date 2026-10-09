from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.notification_service import NotificationService

notifications_bp = Blueprint('notifications', __name__)


@notifications_bp.route('', methods=['GET'])
@jwt_required()
def list_notifications():
    """List notifikasi milik user login (unread_only optional).
    Otomatis menyinkronkan status SLA tiket aktif dan memicu notifikasi jika ada
    tiket mendekati (< 2 jam) atau melewati batas SLA.
    """
    user_id = int(get_jwt_identity())

    # Auto-evaluasi SLA tiket aktif secara real-time
    try:
        NotificationService.check_and_generate_sla_notifications(user_id=user_id)
    except Exception as exc:
        # Logging error tanpa menghentikan pemuatan notifikasi eksisting
        print(f"[WARN] check_and_generate_sla_notifications error: {exc}")

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
    """Hapus notifikasi milik user. Body: {"ids": [1,2,..]} atau {"all": true}.

    Dipakai fitur hapus single/multi-select dan tombol "Delete all" di
    notification bell. Keduanya tetap scoped ke user yang sedang login.
    """
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    if data.get('all') is True:
        deleted = NotificationService.delete_all_for_user(user_id)
        return jsonify({
            'success': True,
            'deleted': deleted,
            'unreadCount': NotificationService.unread_count(user_id),
        }), 200

    ids = data.get('ids')
    if not ids or not isinstance(ids, list) or len(ids) == 0:
        return jsonify({'success': False, 'error': 'ids array wajib diisi (atau kirim {"all": true})'}), 400

    # Id yang bukan bilangan bulat ditolak 400, bukan dilaporkan "sukses"
    # dengan deleted: 0. Frontend memakai status ini untuk rollback state
    # optimistic, jadi diam-diam mengembalikan 200 akan membuat notifikasi
    # tampak terhapus lalu muncul kembali 60 detik kemudian.
    try:
        deleted = NotificationService.delete_for_user(user_id, ids)
    except ValueError as exc:
        return jsonify({'success': False, 'error': str(exc)}), 400
    return jsonify({
        'success': True,
        'deleted': deleted,
        'unreadCount': NotificationService.unread_count(user_id),
    }), 200
