"""
holiday_cron_service.py — Annual Cron Job Scheduler for Indonesian Holidays

Memastikan pemanggilan API eksternal (api.co.id) HANYA dilakukan sekali setahun
di akhir tahun (31 Desember pukul 23:59 WIB) untuk memperbarui kalender tahun depan.
Hasilnya langsung disimpan secara permanen di database PostgreSQL dan file project
`backend/app/data/holidays_indonesia.json`, sehingga operasional harian tidak perlu
dan tidak akan memanggil API eksternal sama sekali.
"""

import os
import time
import threading
from datetime import datetime, timezone, timedelta, date
from app import db
from app.models.system_log import SystemLog
from app.services.master_data_service import MasterDataService

WIB = timezone(timedelta(hours=7))


def run_annual_holiday_sync(app):
    """
    Eksekusi sinkronisasi tahunan hari libur dari api.co.id.
    Mengambil data libur tahun berjalan dan tahun depan, lalu menyimpannya
    ke database dan file backend/app/data/holidays_indonesia.json.
    """
    with app.app_context():
        now_wib = datetime.now(WIB)
        current_year = now_wib.year
        target_years = [current_year, current_year + 1]

        print(f"[CRON] Running Annual Indonesian Holiday Sync for {target_years} at {now_wib.isoformat()}...")
        count, error = MasterDataService.sync_holidays_from_api(target_years=target_years)

        if error:
            print(f"[CRON ERROR] Annual Holiday Sync failed: {error}")
            try:
                log = SystemLog(
                    action='CRON_HOLIDAY_SYNC_FAILED',
                    details=f"Annual cron job failed to sync holidays from api.co.id: {error}",
                    ip_address='127.0.0.1',
                    target_id='HOLIDAYS_CRON'
                )
                db.session.add(log)
                db.session.commit()
            except Exception as e:
                print(f"[CRON] Failed to write error log: {e}")
            return False, error

        print(f"[CRON SUCCESS] Synced {count} holidays for {target_years} to server & project JSON file.")
        try:
            log = SystemLog(
                action='CRON_ANNUAL_HOLIDAY_SYNC',
                details=f"Annual cron job successfully synced {count} holidays from api.co.id for years {target_years}.",
                ip_address='127.0.0.1',
                target_id='HOLIDAYS_CRON'
            )
            db.session.add(log)
            db.session.commit()
        except Exception as e:
            print(f"[CRON] Failed to write success log: {e}")

        return True, count


def _cron_worker_loop(app):
    """
    Background worker thread yang mengecek jadwal akhir tahun (31 Desember).
    Cek berjalan tiap jam. Jika hari ini 31 Desember dan belum dijalankan tahun ini,
    jalankan sinkronisasi tahunan.
    """
    last_synced_year = None

    # Load tahun terakhir tersinkron jika ada
    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'holidays_indonesia.json')
    if os.path.exists(data_path):
        try:
            import json
            with open(data_path, 'r', encoding='utf-8') as f:
                d = json.load(f)
                ts = d.get('last_synced_at')
                if ts:
                    last_synced_year = datetime.fromisoformat(ts).year
        except Exception:
            pass

    print(f"[CRON] Indonesian Holiday Annual Cron Scheduler initialized. Last synced year: {last_synced_year}. Active schedule: 31 December.")

    # Catch-up check saat startup: jika server mati saat 31 Desember atau data tahun berjalan kosong
    try:
        now_wib = datetime.now(WIB)
        current_year = now_wib.year
        need_catchup = False

        with app.app_context():
            from app.models.master_data import Holiday
            current_year_count = Holiday.query.filter(
                Holiday.holiday_date >= date(current_year, 1, 1),
                Holiday.holiday_date <= date(current_year, 12, 31)
            ).count()

            if current_year_count == 0:
                need_catchup = True
            elif last_synced_year is not None and last_synced_year < current_year:
                need_catchup = True

        if need_catchup:
            print(f"[CRON CATCHUP] Data libur tahun {current_year} belum ada atau tertinggal. Menjalankan catch-up sync otomatis...")
            success, _ = run_annual_holiday_sync(app)
            if success:
                last_synced_year = current_year
    except Exception as e:
        print(f"[CRON CATCHUP ERROR] {e}")

    while True:
        try:
            now_wib = datetime.now(WIB)

            # Cek apakah tanggal 31 Desember
            is_dec_31 = (now_wib.month == 12 and now_wib.day == 31)

            if is_dec_31 and last_synced_year != now_wib.year:
                print(f"[CRON TRIGGER] Today is December 31 ({now_wib.year}). Triggering annual holiday sync...")
                success, _ = run_annual_holiday_sync(app)
                if success:
                    last_synced_year = now_wib.year

        except Exception as e:
            print(f"[CRON WORKER ERROR] {e}")

        # Sleep 1 jam sebelum cek berikutnya (3600 detik)
        time.sleep(1800)


def start_holiday_cron_scheduler(app):
    """Mulai background scheduler thread untuk Flask server"""
    # Hindari duplikasi saat Flask running dengan Werkzeug reloader di development
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true' and app.debug:
        return

    thread = threading.Thread(target=_cron_worker_loop, args=(app,), daemon=True)
    thread.name = "HolidayAnnualCronThread"
    thread.start()
    return thread


if __name__ == '__main__':
    # Memungkinkan dijalankan via Linux crontab: 59 23 31 12 * /path/to/python -m app.services.holiday_cron_service
    # atau Windows Task Scheduler tahunan
    import sys
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
    from app import create_app

    app = create_app()
    print("Executing manual / crontab run of Annual Holiday Sync...")
    success, result = run_annual_holiday_sync(app)
    if success:
        print(f"Cron finished successfully. Synced {result} holidays.")
    else:
        print(f"Cron finished with error: {result}")
        sys.exit(1)
