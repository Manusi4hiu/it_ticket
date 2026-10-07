from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.notification_service import NotificationService
from app.models.push_subscription import PushSubscription
from app import db

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


# ── Web Push subscription management ──────────────────────────────────────────

@notifications_bp.route('/subscribe', methods=['POST'])
@jwt_required()
def subscribe_push():
    """Register a push subscription for the logged-in user (multi-device OK).

    Body: PushSubscription JSON from browser PushManager.subscribe():
    { endpoint, keys: { p256dh, auth }, expirationTime? }
    Idempotent via unique(user_id, endpoint) — repeated calls safe.
    """
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    endpoint = data.get('endpoint')
    keys = data.get('keys') or {}

    # Trust boundary: validate required fields
    if not endpoint or not isinstance(endpoint, str) or not endpoint.startswith('https://'):
        return jsonify({'success': False, 'error': 'endpoint wajib valid HTTPS URL'}), 400
    if not keys.get('p256dh') or not keys.get('auth'):
        return jsonify({'success': False, 'error': 'keys.p256dh dan keys.auth wajib diisi'}), 400

    # Upsert — unique constraint on (user_id, endpoint) handles duplicates
    existing = PushSubscription.query.filter_by(
        user_id=user_id, endpoint=endpoint
    ).first()
    if existing:
        # Update keys in case browser rotated them
        existing.p256dh = keys['p256dh']
        existing.auth = keys['auth']
    else:
        sub = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=keys['p256dh'],
            auth=keys['auth'],
        )
        db.session.add(sub)
    db.session.commit()

    return jsonify({'success': True}), 200


@notifications_bp.route('/unsubscribe', methods=['POST'])
@jwt_required()
def unsubscribe_push():
    """Remove a push subscription (e.g. on logout / device switch).

    Body: { endpoint: "..." }
    """
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    endpoint = data.get('endpoint')

    if not endpoint or not isinstance(endpoint, str):
        return jsonify({'success': False, 'error': 'endpoint wajib diisi'}), 400

    sub = PushSubscription.query.filter_by(
        user_id=user_id, endpoint=endpoint
    ).first()
    if sub:
        db.session.delete(sub)
        db.session.commit()

    return jsonify({'success': True}), 200
