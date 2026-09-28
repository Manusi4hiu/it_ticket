"""Zona waktu pelaporan (WIB) untuk seluruh agregasi break & analytics.

Sebelumnya setiap modul menulis ``timezone(timedelta(hours=7))`` sendiri-sendiri
(users.py thrice, ticket_service.py sekali), sehingga definisi "hari ini" bisa
berbeda antar-endpoint kalau ada yang lupa. Semua pemanggilan kini lewat helper
ini supaya satu sumber kebenaran.

Memakai :class:`zoneinfo.ZoneInfo` supaya zona ikut aturan IANA (terutama DST
kalau suatu saat diganti ke zona lain), bukan offset mati. ``tzdata`` ada di
requirements sebagai fallback untuk Windows yang tidak punya database zona.
"""

from datetime import date, datetime, timedelta, timezone

try:  # Python 3.9+
    from zoneinfo import ZoneInfo

    REPORT_TZ = ZoneInfo("Asia/Jakarta")
except Exception:  # pragma: no cover - hanya kena di tanpa tzdata / IANA rusak
    REPORT_TZ = timezone(timedelta(hours=7), "WIB")


def report_tz():
    """Kembalikan ``tzinfo`` zona pelaporan (WIB / UTC+7)."""
    return REPORT_TZ


def report_today(moment=None):
    """Tanggal "hari ini" menurut zona pelaporan.

    ``moment`` opsional (default: sekarang) untuk keperluan test.
    """
    if moment is None:
        return datetime.now(REPORT_TZ).date()
    if isinstance(moment, datetime):
        return moment.astimezone(REPORT_TZ).date()
    if isinstance(moment, date):
        return moment
    raise TypeError(f"moment harus datetime atau date, dapat {type(moment).__name__}")
