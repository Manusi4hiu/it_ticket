import json
import logging

from flask import has_request_context, request

from app import db
from app.models.system_log import SystemLog

logger = logging.getLogger(__name__)

# Batas aman sesuai kolom system_logs.ip_address (varchar(45)).
# 45 = panjang maksimum alamat IPv6 tekstual, jadi ini pas, bukan asal potong.
IP_MAX_LEN = 45


def _client_ip():
    """Ambil IP client secara aman.

    PERHATIAN: `X-Forwarded-For` adalah header yang dikirim klien dan bisa
    dikontrol siapa pun (proxy tepercaya umumnya hanya MENAMBAHKAN entri di
    belakang, entri pertama tetap milik klien). Aplikasi ini tidak memakai
    ProxyFix, jadi nilainya tidak boleh dipercaya tanpa pembatasan.
    """
    if not has_request_context():
        return None

    ip = request.remote_addr

    xff = request.headers.get('X-Forwarded-For')
    if xff:
        first = xff.split(',')[0].strip()
        if first:
            ip = first

    if not ip:
        return None
    # Potong ke batas kolom: string yang lebih panjang akan membuat Postgres
    # melempar DataError dan (sebelum fix ini) membatalkan seluruh transaksi.
    return ip[:IP_MAX_LEN]


def log_activity(action, details=None, user_id=None, target_id=None, metadata=None, auto_commit=True):
    """
    Log a system activity
    :param action: Name of the activity (e.g., "Ticket Created")
    :param details: Description of the activity
    :param user_id: ID of the user performing the activity
    :param target_id: ID of the object being acted upon
    :param metadata: Dictionary of additional metadata

    CATATAN PENTING (fix):
    Kegagalan menyimpan log TIDAK BOLEH membatalkan transaksi pemanggil.
    Sebelumnya error di sini memanggil `db.session.rollback()` yang membatalkan
    SELURUH transaksi - termasuk INSERT tiket yang baru dibuat, padahal route
    tetap membalas 201 "Tiket berhasil dibuat". Akibatnya tiket hilang tanpa
    jejak dan nomor tiket dipakai ulang.
    Sekarang log disimpan di dalam SAVEPOINT: kalau INSERT log gagal, hanya
    savepoint yang di-rollback, transaksi utama tetap utuh.
    """
    log = None
    nested = None

    try:
        metadata_json = json.dumps(metadata) if metadata else None

        log = SystemLog(
            action=action,
            details=details,
            ip_address=_client_ip(),
            user_id=user_id,
            target_id=target_id,
            metadata_json=metadata_json
        )

        # Savepoint: isolate kegagalan logging dari transaksi pemanggil.
        nested = db.session.begin_nested()
        db.session.add(log)
        db.session.flush()
        nested.commit()          # RELEASE SAVEPOINT
        nested = None
    except Exception as e:
        logger.warning("[log_activity] gagal menyimpan log '%s': %s", action, e)
        if nested is not None:
            # Savepoint sempat dibuat -> ROLLBACK TO SAVEPOINT, transaksi
            # pemanggil TIDAK tersentuh.
            try:
                nested.rollback()
            except Exception:
                pass
        else:
            # Savepoint belum sempat dibuat (mis. flush dari caller gagal)
            # -> transaksi memang sudah rusak, tidak ada pilihan lain.
            try:
                db.session.rollback()
            except Exception:
                pass
        # Buang objek log agar tidak ikut ter-flush lagi.
        try:
            if log is not None:
                db.session.expunge(log)
        except Exception:
            pass
        return

    # Log tersimpan. Commit hanya bila diminta; kegagalan di sini berarti
    # transaksi memang sudah tidak bisa dipulihkan, jadi rollback wajar.
    if auto_commit:
        try:
            db.session.commit()
        except Exception as e:
            logger.warning("[log_activity] commit log '%s' gagal: %s", action, e)
            try:
                db.session.rollback()
            except Exception:
                pass
