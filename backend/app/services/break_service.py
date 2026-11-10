"""Aturan sesi break yang dipakai bersama oleh route dan background worker.

- Waktu sesi disimpan UTC; jam kerja dikonfigurasi dalam WIB.
- `finalize_break` menutup sesi dan mencatat BreakLog.
- `auto_end_expired_breaks` menutup sesi yang melewati jam selesai kerja.
"""
import logging
import os
import threading
import time
from datetime import datetime, timezone, timedelta

from app import db
from app.models.master_data import BreakLog
from app.models.user import User
from app.services.master_data_service import MasterDataService

WIB = timezone(timedelta(hours=7))
PRESENCE_VALID = ('online', 'idle', 'dnd', 'offline')
logger = logging.getLogger(__name__)


def _as_utc(value):
    """Normalisasi datetime DB (naive dianggap UTC) menjadi timezone-aware UTC."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def get_work_end_utc(moment, setting=None):
    """Jam selesai kerja (UTC) pada tanggal WIB dari `moment`."""
    setting = setting or MasterDataService.get_break_setting()
    moment = _as_utc(moment) or datetime.now(timezone.utc)
    day_wib = moment.astimezone(WIB).date()
    raw = setting.work_end_time or '17:00'
    try:
        hour, minute = (int(part) for part in raw.split(':')[:2])
    except (TypeError, ValueError):
        hour, minute = 17, 0
    return datetime(
        day_wib.year, day_wib.month, day_wib.day, hour, minute, tzinfo=WIB
    ).astimezone(timezone.utc)


def get_capped_break_end(now, started, setting=None):
    """Batas akhir sesi break: `now`, atau jam selesai kerja bila sudah lewat.

    Bila break baru dimulai setelah jam kerja berakhir, hasilnya sama dengan
    `started` sehingga durasi menjadi 0 (tidak pernah negatif).
    """
    setting = setting or MasterDataService.get_break_setting()
    now = _as_utc(now) or datetime.now(timezone.utc)
    started = _as_utc(started)
    if setting.auto_end_on_shift_end is False or started is None:
        return now
    shift_end = get_work_end_utc(started, setting)
    if now < shift_end:
        return now
    return shift_end if shift_end >= started else started


def finalize_break(user, ended_at, setting=None):
    """Tutup sesi break user dan catat log. Idempoten.

    Return `(closed, duration_seconds)`. Jika user tidak sedang break,
    return `(False, 0)`.
    """
    if not user or not user.is_on_break:
        return False, 0

    setting = setting or MasterDataService.get_break_setting()
    started = _as_utc(user.break_started_at)
    if started is None:
        # Data lama tanpa timestamp: tetap tutup agar status tidak macet.
        user.is_on_break = False
        user.presence_status = 'online'
        return True, 0

    ended = _as_utc(ended_at) or datetime.now(timezone.utc)
    if ended < started:
        ended = started
    duration = int((ended - started).total_seconds())

    end_wib_date = ended.astimezone(WIB).date()
    today_wib = datetime.now(WIB).date()

    # Sesi lintas hari tetap dicatat di tanggal selesainya, tetapi tidak
    # mencampuri total "hari ini".
    if end_wib_date == today_wib:
        if user.break_total_date != today_wib:
            user.total_break_seconds_today = 0
            user.break_total_date = today_wib
        user.total_break_seconds_today = (user.total_break_seconds_today or 0) + duration

    try:
        with db.session.begin_nested():
            db.session.add(BreakLog(
                user_id=user.id,
                started_at=started,
                ended_at=ended,
                duration_seconds=duration,
                log_date=end_wib_date,
            ))
    except Exception as exc:
        logger.error("Break log insert failed: %s", exc)

    max_minutes = setting.max_break_minutes or 60
    if duration > max_minutes * 60:
        try:
            from app.services.notification_service import NotificationService
            admins = User.query.filter(
                User.role == 'Administrator', User.id != user.id
            ).all()
            over_min = duration // 60
            for admin in admins:
                NotificationService.push(
                    admin.id, None, 'break_overtime',
                    'Break Melebihi Batas',
                    f"{user.full_name} break {over_min} mnt (batas {max_minutes} mnt). "
                    f"Total hari ini {((user.total_break_seconds_today or 0) // 60)} mnt.",
                )
        except Exception as exc:
            logger.error("Break overtime notification failed: %s", exc)

    user.is_on_break = False
    user.break_started_at = None
    restored = getattr(user, 'break_pre_status', None) or 'online'
    user.presence_status = restored if restored in PRESENCE_VALID else 'online'
    return True, duration


def auto_end_expired_breaks():
    """Tutup semua break aktif yang sudah melewati jam selesai kerja.

    Durasi dipotong tepat di jam selesai kerja, bukan saat worker berjalan.
    Return jumlah sesi yang ditutup.
    """
    setting = MasterDataService.get_break_setting()
    if setting.auto_end_on_shift_end is False:
        return 0

    now = datetime.now(timezone.utc)
    candidate_ids = [
        row[0] for row in db.session.query(User.id).filter(
            User.is_on_break.is_(True),
            User.break_started_at.isnot(None),
        ).all()
    ]

    closed = 0
    for user_id in candidate_ids:
        try:
            # Lock baris agar tidak dobel dengan toggle manual / worker lain.
            user = User.query.filter_by(id=user_id).with_for_update().first()
            if not user or not user.is_on_break or not user.break_started_at:
                db.session.rollback()
                continue

            started = _as_utc(user.break_started_at)
            shift_end = get_work_end_utc(started, setting)
            if now < shift_end:
                db.session.rollback()
                continue

            # Break yang baru dimulai setelah jam kerja berakhir (data lama)
            # ditutup dengan durasi 0, bukan negatif.
            ended_at = get_capped_break_end(now, started, setting)
            did_close, _ = finalize_break(user, ended_at, setting)
            db.session.commit()
            if did_close:
                closed += 1
        except Exception as exc:
            db.session.rollback()
            logger.error("Auto-end break failed for user %s: %s", user_id, exc)

    if closed:
        logger.info("Auto-ended %s break session(s) at shift end", closed)
    return closed


def _auto_end_worker_loop(app):
    print("[BREAK] Auto-end scheduler aktif (cek tiap 60 detik).")
    while True:
        try:
            with app.app_context():
                auto_end_expired_breaks()
        except Exception as exc:
            logger.error("Break auto-end worker error: %s", exc)
        time.sleep(60)


def start_break_auto_end_scheduler(app):
    """Jalankan worker auto-end break (sekali per proses)."""
    if os.environ.get('DISABLE_BREAK_AUTO_END') == '1':
        return None
    # Hindari duplikasi saat Flask debug reloader menyalakan dua proses.
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true' and app.debug:
        return None

    thread = threading.Thread(target=_auto_end_worker_loop, args=(app,), daemon=True)
    thread.name = "BreakAutoEndThread"
    thread.start()
    return thread
