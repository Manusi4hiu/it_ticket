from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.user_service import UserService
from app.models.user import User
from app.utils.permissions import admin_required, role_required, get_current_user
from app.utils.report_tz import report_tz, report_today
from datetime import datetime, timezone, timedelta, date
import calendar
import logging

users_bp = Blueprint('users', __name__)
logger = logging.getLogger(__name__)


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
    from app.models.master_data import BreakLog
    from app.services.email_service import EmailService
    import logging
    
    current_user = get_current_user()

    # Guard: hanya bisa toggle break sendiri atau admin
    if current_user.id != user_id and current_user.role != 'Administrator':
        return jsonify({'error': 'Unauthorized'}), 403

    # Lock row untuk mencegah race condition (dua request simultan)
    user = User.query.filter_by(id=user_id).with_for_update().first()
    if not user:
        return jsonify({'error': 'User tidak ditemukan'}), 404

    # Reset harian: total milik hari lama -> nolkan dulu. Batas hari mengikuti
    # zona pelaporan (WIB) lewat report_tz, bukan offset manual.
    # NULL (data lama) dianggap milik hari ini agar riwayat tak terhapus.
    today_wib = report_today()
    if user.break_total_date is None:
        user.break_total_date = today_wib
    elif user.break_total_date != today_wib:
        user.total_break_seconds_today = 0
        user.break_total_date = today_wib

    from app.services.master_data_service import MasterDataService
    max_minutes = MasterDataService.get_break_setting().max_break_minutes or 60

    if user.is_on_break:
        # END break: akumulasi durasi AKTUAL (tanpa cap) agar user tahu
        # total waktu sebenarnya. Batas hanya dipakai untuk hitung sisa
        # + notifikasi overtime, bukan untuk memotong total.
        if user.break_started_at:
            break_start = user.break_started_at
            if break_start.tzinfo is None:
                break_start = break_start.replace(tzinfo=timezone.utc)
            duration = (datetime.now(timezone.utc) - break_start).total_seconds()
            actual = int(duration)
            user.total_break_seconds_today = (user.total_break_seconds_today or 0) + actual
            # Catat riwayat sesi (sumber agregasi harian/mingguan/bulanan).
            try:
                db.session.add(BreakLog(
                    user_id=user.id,
                    started_at=break_start,
                    ended_at=datetime.now(timezone.utc),
                    duration_seconds=actual,
                    log_date=today_wib,
                ))
                db.session.flush()  # Test insert sebelum commit
            except Exception as log_err:
                db.session.rollback()
                logger.error(f"Break log insert failed: {log_err}")
                # total_break_seconds_today tetap ter-update (best-effort tracking)
            # Notifikasi ke admin bila break melebihi batas (best-effort).
            if actual > max_minutes * 60:
                try:
                    from app.services.notification_service import NotificationService
                    admins = User.query.filter(
                        User.role == 'Administrator', User.id != user.id
                    ).all()
                    over_min = int(duration) // 60
                    for admin in admins:
                        NotificationService.push(
                            admin.id, None, 'break_overtime',
                            'Break Melebihi Batas',
                            f"{user.full_name} break {over_min} mnt (batas {max_minutes} mnt). "
                            f"Total hari ini {((user.total_break_seconds_today or 0) // 60)} mnt.",
                        )
                except Exception as notif_err:
                    logger.error("Break overtime notification failed: %s", notif_err, exc_info=True)
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
                logger.error("Email break notification failed: %s", e, exc_info=True)

    db.session.commit()
    payload = user.to_dict()
    payload['maxBreakMinutes'] = max_minutes
    return jsonify(payload), 200


def _break_period_range(period):
    """Rentang tanggal WIB untuk agregasi break (Senin–Minggu, tgl 1–akhir)."""
    today = report_today()
    p = (period or 'daily').lower()
    if p == 'weekly':
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
        return 'weekly', start, end
    if p == 'monthly':
        start = today.replace(day=1)
        end = today.replace(day=calendar.monthrange(today.year, today.month)[1])
        return 'monthly', start, end
    return 'daily', today, today


@users_bp.route('/break-summary', methods=['GET'])
@role_required('Administrator', 'Management', 'Staff')
def break_summary():
    """Ringkasan pemakaian vs sisa break per staff per periode.

    Query: ?period=daily|weekly|monthly (default daily).
    - Admin/Management: semua user. Staff: hanya dirinya sendiri.
    - used = SUM(break_logs.duration dalam rentang) + sesi berjalan (live).
    - Fallback data lama: porsi hari ini dari total_break_seconds_today
      ditambahkan bila belum (penuh/sebagian) tercatat di break_logs
      (sesi sebelum tabel break_logs ada). Berlaku untuk SEMUA periode
      yang memuat hari ini — bukan cuma daily.
    """
    from app import db
    from app.models.master_data import BreakLog
    from app.services.master_data_service import MasterDataService

    current_user = get_current_user()
    period, start_d, end_d = _break_period_range(request.args.get('period', 'daily'))

    setting = MasterDataService.get_break_setting()
    limits = {
        'perSession': setting.max_break_minutes or 60,
        'daily': setting.daily_max_minutes or 60,
        'weekly': setting.weekly_max_minutes or 300,
        'monthly': setting.monthly_max_minutes or 1200,
    }
    limit_minutes = limits.get(period, limits['daily'])

    if current_user.role == 'Staff':
        users = [current_user]
    else:
        users = User.query.order_by(User.full_name).all()

    user_ids = [u.id for u in users]
    sums = {}
    counts = {}
    if user_ids:
        try:
            rows = db.session.query(
                BreakLog.user_id,
                db.func.coalesce(db.func.sum(BreakLog.duration_seconds), 0),
                db.func.count(BreakLog.id),
            ).filter(
                BreakLog.user_id.in_(user_ids),
                BreakLog.log_date >= start_d,
                BreakLog.log_date <= end_d,
            ).group_by(BreakLog.user_id).all()
            for uid, total, cnt in rows:
                sums[uid] = int(total or 0)
                counts[uid] = int(cnt or 0)
        except Exception as agg_err:
            logger.error("Break summary aggregate failed: %s", agg_err, exc_info=True)

    # Total tercatat hari ini per user (untuk fallback data lama).
    # Untuk weekly/monthly perlu query tambahan karena `sums` di atas
    # mencakup sepekan/sebulan, bukan khusus hari ini.
    today = report_today()
    if period == 'daily':
        today_sums = sums
    else:
        today_sums = {}
        if user_ids:
            try:
                trows = db.session.query(
                    BreakLog.user_id,
                    db.func.coalesce(db.func.sum(BreakLog.duration_seconds), 0),
                ).filter(
                    BreakLog.user_id.in_(user_ids),
                    BreakLog.log_date == today,
                ).group_by(BreakLog.user_id).all()
                for uid, total in trows:
                    today_sums[uid] = int(total or 0)
            except Exception as agg_err:
                logger.error("Break summary today-aggregate failed: %s", agg_err, exc_info=True)

    now_utc = datetime.now(timezone.utc)
    summary = []
    for u in users:
        used = sums.get(u.id, 0)
        # Fallback data lama: total hari ini (kolom users) memuat sesi-sesi
        # yang terjadi sebelum tabel break_logs ada. Tambahkan selisih yang
        # belum tercatat agar weekly/monthly tidak "reset" dan sinkron
        # dengan daily. (Bila log hari ini kosong → seluruh total; bila
        # hari campuran → hanya selisihnya, anti double-count.)
        #
        # PERINGATAN (lihat code review): kolom `users.total_break_seconds_today`
        # tidak menyimpan identitas sesi, hanya satu angka akumulatif per hari.
        # Edge case yang belum bisa ditangani di sini: sesi yang dimulai
        # sebelum tengah malam dan berakhir sesudahnya. Sesi itu di-log dengan
        # `log_date` = tanggal END, sementara nilai kolom users masih menyertakan
        # seluruh durasi sesi (dimulai di tanggal sebelumnya). Bila hari berikutnya
        # `total_break_seconds_today` di-reset ke 0, porsi sebelum tengah malam
        # ikut hilang dari laporan; bila tidak di-reset, hari itu bisa
        # terhitung dua kali. Steady state aman selama fallback ini dihapus.
        #
        # Mitigasi: jalankan backfill dari users ke break_logs lalu set
        # total_break_seconds_today = 0 (sudah dilakukan manual di DB dev s/d
        # 2026-09-17). Selama kolom ini masih dipakai, perlakukan angka di
        # kolom tersebut sebagai "perkiraan kasar", bukan sumber kebenaran.
        legacy_today = 0
        if (u.total_break_seconds_today or 0) > 0:
            if u.break_total_date is None or u.break_total_date == today:
                legacy_today = u.total_break_seconds_today or 0
        if legacy_today:
            today_logged = today_sums.get(u.id, 0)
            if today_logged == 0:
                used += legacy_today
            elif legacy_today > today_logged:
                used += legacy_today - today_logged
        # Tambah sesi berjalan agar sisa live (khusus bila start masih dalam rentang).
        live = 0
        if u.is_on_break and u.break_started_at:
            bs = u.break_started_at
            if bs.tzinfo is None:
                bs = bs.replace(tzinfo=timezone.utc)
            live = max(0, int((now_utc - bs).total_seconds()))
            bs_wib = bs.astimezone(report_tz()).date()
            if start_d <= bs_wib <= end_d:
                used += live
        summary.append({
            'userId': u.id,
            'userName': u.full_name,
            'username': u.username,
            'role': u.role,
            'isOnBreak': bool(u.is_on_break),
            'liveSeconds': live,
            'usedSeconds': used,
            'sessionsCount': counts.get(u.id, 0),
            'limitMinutes': limit_minutes,
            'remainingSeconds': limit_minutes * 60 - used,
        })

    summary.sort(key=lambda r: r['usedSeconds'], reverse=True)
    return jsonify({
        'success': True,
        'period': period,
        'range': {'start': start_d.isoformat(), 'end': end_d.isoformat()},
        'limits': limits,
        'limitMinutes': limit_minutes,
        'summary': summary,
    }), 200


@users_bp.route('/break-logs', methods=['GET'])
@role_required('Administrator', 'Management', 'Staff')
def break_logs():
    """Daftar sesi break (terbaru dulu). Query: ?period=daily|weekly|monthly&user_id=&limit=50."""
    from app import db
    from app.models.master_data import BreakLog

    current_user = get_current_user()
    period, start_d, end_d = _break_period_range(request.args.get('period', 'daily'))
    try:
        limit = max(1, min(200, int(request.args.get('limit', 50))))
    except (TypeError, ValueError):
        limit = 50

    q = BreakLog.query.filter(BreakLog.log_date >= start_d, BreakLog.log_date <= end_d)
    user_id = request.args.get('user_id')
    if user_id:
        try:
            uid = int(user_id)
        except (TypeError, ValueError):
            return jsonify({'success': False, 'error': 'user_id tidak valid'}), 400
        if current_user.role == 'Staff' and uid != current_user.id:
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403
        q = q.filter(BreakLog.user_id == uid)
    elif current_user.role == 'Staff':
        q = q.filter(BreakLog.user_id == current_user.id)

    try:
        total = q.count()
        logs = q.order_by(BreakLog.ended_at.desc()).limit(limit).all()
        return jsonify({
            'success': True,
            'period': period,
            'range': {'start': start_d.isoformat(), 'end': end_d.isoformat()},
            'total': total,
            'logs': [l.to_dict() for l in logs],
        }), 200
    except Exception as e:
        logger.error("Break logs query failed: %s", e, exc_info=True)
        # Jangan balas 200 dengan daftar kosong: frontend akan menampilkan
        # "tidak ada riwayat" padahal query-nya yang gagal. Balas 500 supaya
        # masalah terlihat di log dan di UI.
        return jsonify({'success': False, 'error': 'Gagal memuat riwayat break'}), 500
