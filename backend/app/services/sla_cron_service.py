"""Background SLA monitor scheduler for closed-app mobile Web Push notifications.

Evaluates active tickets periodically on the server so SLA Warning (30/20/10/5m)
and SLA Breached notifications + Web Push alerts are dispatched 24/7 even when no
desktop or mobile client tab is open polling ``GET /api/notifications``.
"""
import logging
import os
import sys
import threading

from app import db

logger = logging.getLogger(__name__)

DEFAULT_SLA_INTERVAL_SECONDS = 30
DEFAULT_STARTUP_DELAY_SECONDS = 5

_scheduler_lock = threading.Lock()
_scheduler_thread = None
_stop_event = threading.Event()


def _get_sla_interval_seconds() -> int:
    raw = os.getenv('SLA_CHECK_INTERVAL_SECONDS', str(DEFAULT_SLA_INTERVAL_SECONDS))
    try:
        return max(1, int(raw))
    except (TypeError, ValueError):
        return DEFAULT_SLA_INTERVAL_SECONDS


def _get_startup_delay_seconds() -> int:
    raw = os.getenv('SLA_STARTUP_DELAY_SECONDS', str(DEFAULT_STARTUP_DELAY_SECONDS))
    try:
        return max(0, int(raw))
    except (TypeError, ValueError):
        return DEFAULT_STARTUP_DELAY_SECONDS


def should_start_sla_scheduler(app) -> bool:
    """Return True only when running inside an actual HTTP server worker process."""
    override = os.getenv('ENABLE_SLA_SCHEDULER', '').strip().lower()
    if override in ('0', 'false', 'no', 'off'):
        return False

    if app.config.get('TESTING') or 'pytest' in sys.modules:
        return False

    exe_name = os.path.basename(sys.argv[0]).lower() if sys.argv else ''
    args = [a.lower() for a in sys.argv[1:]]
    if 'alembic' in exe_name:
        return False
    if 'flask' in exe_name and 'run' not in args:
        return False
    if args and args[0] in ('db', 'shell', 'routes'):
        return False

    # Avoid spawning twice in Flask/Werkzeug development reloader outer parent process
    if app.debug and os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        return False

    return True


def run_sla_check_once(app, force: bool = False, cooldown_seconds: int = 25) -> int:
    """Execute one SLA notification scan inside an isolated Flask app context."""
    from app.services.notification_service import NotificationService

    with app.app_context():
        try:
            return NotificationService.check_and_generate_sla_notifications(
                user_id=None,
                force=force,
                cooldown_seconds=cooldown_seconds,
            )
        except Exception as exc:
            logger.warning('[SLA CRON] SLA check tick failed: %s', exc)
            try:
                db.session.rollback()
            except Exception:
                pass
            return 0
        finally:
            db.session.remove()


def _sla_worker_loop(app, interval_seconds: int, startup_delay_seconds: int) -> None:
    logger.info(
        '[SLA CRON] Background SLA push scheduler active (interval=%ss).',
        interval_seconds,
    )
    if startup_delay_seconds > 0 and _stop_event.wait(startup_delay_seconds):
        return

    cooldown = max(5, interval_seconds - 5)
    while not _stop_event.is_set():
        run_sla_check_once(app, force=False, cooldown_seconds=cooldown)
        if _stop_event.wait(interval_seconds):
            break


def start_sla_cron_scheduler(app):
    """Start the background daemon thread evaluating SLA warnings/breaches."""
    global _scheduler_thread

    if not should_start_sla_scheduler(app):
        return None

    with _scheduler_lock:
        if _scheduler_thread is not None and _scheduler_thread.is_alive():
            return _scheduler_thread

        _stop_event.clear()
        interval = _get_sla_interval_seconds()
        startup_delay = _get_startup_delay_seconds()
        thread = threading.Thread(
            target=_sla_worker_loop,
            args=(app, interval, startup_delay),
            name='SlaPushMonitorThread',
            daemon=True,
        )
        thread.start()
        _scheduler_thread = thread
        return thread


def stop_sla_cron_scheduler(timeout: float = 2.0) -> None:
    """Signal the background SLA scheduler to stop (mainly for clean shutdown/tests)."""
    global _scheduler_thread

    _stop_event.set()
    with _scheduler_lock:
        thread = _scheduler_thread
        _scheduler_thread = None

    if thread is not None and thread.is_alive():
        thread.join(timeout=timeout)
