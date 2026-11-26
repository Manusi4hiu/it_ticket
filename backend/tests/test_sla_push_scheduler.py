"""Tests for background closed-app SLA warning/breach evaluation & Web Push dispatch."""
import os
import sys
import tempfile
import threading
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from py_vapid import Vapid
from py_vapid.utils import b64urlencode

from app import create_app, db
from app.models.notification import Notification
from app.models.push_subscription import PushSubscription
from app.models.ticket import Ticket
from app.models.user import User
from app.services.notification_service import NotificationService
from app.services.sla_cron_service import (
    run_sla_check_once,
    should_start_sla_scheduler,
    start_sla_cron_scheduler,
    stop_sla_cron_scheduler,
)


def _generate_test_sub_keys():
    priv = ec.generate_private_key(ec.SECP256R1())
    pub_bytes = priv.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    return b64urlencode(pub_bytes), b64urlencode(os.urandom(16))


@pytest.fixture
def isolated_app(monkeypatch):
    """Create an isolated SQLite file DB app (never touches PostgreSQL)."""
    tmp = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
    tmp_path = tmp.name
    tmp.close()

    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path}')
    monkeypatch.setenv('FLASK_DEBUG', '0')
    monkeypatch.setenv('ENABLE_SLA_SCHEDULER', '0')

    vapid = Vapid()
    vapid.generate_keys()
    priv_int = vapid.private_key.private_numbers().private_value
    priv_b64 = b64urlencode(priv_int.to_bytes(32, 'big'))
    pub_bytes = vapid.public_key.public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    pub_b64 = b64urlencode(pub_bytes)
    monkeypatch.setenv('VAPID_PRIVATE_KEY', priv_b64)
    monkeypatch.setenv('VAPID_PUBLIC_KEY', pub_b64)
    monkeypatch.setenv('VAPID_SUBJECT', 'mailto:no-reply.it-ticket@ani.co.id')

    app = create_app(
        'development',
        config_overrides={
            'SQLALCHEMY_DATABASE_URI': f'sqlite:///{tmp_path}',
            'SQLALCHEMY_ECHO': False,
            'TESTING': True,
        },
    )

    NotificationService._last_sla_check_time = 0.0

    with app.app_context():
        assert db.engine.url.drivername == 'sqlite'
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

    stop_sla_cron_scheduler()
    try:
        os.remove(tmp_path)
    except OSError:
        pass


def test_should_start_sla_scheduler_guards(monkeypatch):
    app = MagicMock()
    app.config = {'TESTING': True}
    app.debug = False
    assert should_start_sla_scheduler(app) is False

    app.config = {'TESTING': False}
    monkeypatch.delitem(sys.modules, 'pytest', raising=False)
    monkeypatch.setenv('ENABLE_SLA_SCHEDULER', '0')
    assert should_start_sla_scheduler(app) is False

    monkeypatch.delenv('ENABLE_SLA_SCHEDULER', raising=False)
    monkeypatch.setattr(sys, 'argv', ['flask', 'db', 'upgrade'])
    assert should_start_sla_scheduler(app) is False

    monkeypatch.setattr(sys, 'argv', ['run.py'])
    app.debug = True
    monkeypatch.delenv('WERKZEUG_RUN_MAIN', raising=False)
    assert should_start_sla_scheduler(app) is False

    monkeypatch.setenv('WERKZEUG_RUN_MAIN', 'true')
    assert should_start_sla_scheduler(app) is True

    app.debug = False
    monkeypatch.delenv('WERKZEUG_RUN_MAIN', raising=False)
    assert should_start_sla_scheduler(app) is True


def test_closed_app_background_sla_scheduler_sends_warning_and_breach_webpush(isolated_app, monkeypatch):
    """Even with zero client tabs open (no GET /api/notifications), the background
    scheduler evaluates active tickets, logs deductions, and dispatches valid Web Push."""
    with isolated_app.app_context():
        admin = User(
            username='adm_sla',
            email='adm_sla@ani.co.id',
            full_name='Admin SLA',
            role='Administrator',
            is_active=True,
        )
        admin.set_password('Pass123!')
        staff = User(
            username='stf_sla',
            email='stf_sla@ani.co.id',
            full_name='Staff SLA',
            role='Staff',
            is_active=True,
        )
        staff.set_password('Pass123!')
        db.session.add_all([admin, staff])
        db.session.commit()

        p256_s, auth_s = _generate_test_sub_keys()
        p256_a, auth_a = _generate_test_sub_keys()
        db.session.add_all([
            PushSubscription(
                user_id=staff.id,
                endpoint='https://fcm.googleapis.com/fcm/send/staff-phone',
                p256dh=p256_s,
                auth=auth_s,
            ),
            PushSubscription(
                user_id=admin.id,
                endpoint='https://fcm.googleapis.com/fcm/send/admin-phone',
                p256dh=p256_a,
                auth=auth_a,
            ),
        ])

        now_utc = datetime.now(timezone.utc)
        ticket = Ticket(
            title='VPN Server Down',
            description='Need urgent fix',
            priority='high',
            category='Network',
            submitter_name='Budi',
            ticket_code='ITD-100',
            status='In Progress',
            assigned_to_id=staff.id,
            taken_at=now_utc - timedelta(hours=1),
            sla_deadline=now_utc + timedelta(minutes=25),  # inside 30-min milestone
        )
        db.session.add(ticket)
        db.session.commit()
        staff_id = staff.id
        admin_id = admin.id
        ticket_id = ticket.id

    sent_pushes = []
    push_done = threading.Event()

    def fake_post(url, **kwargs):
        if 'fcm.googleapis.com' in str(url):
            sent_pushes.append({
                'url': str(url),
                'headers': {k.lower(): v for k, v in (kwargs.get('headers') or {}).items()},
            })
            push_done.set()
            return MagicMock(status_code=201, text='', reason='Created')
        raise AssertionError(f'Unexpected URL: {url}')

    # Enable live daemon scheduler for closed-app background execution (bypass TESTING flag briefly)
    isolated_app.config['TESTING'] = False
    monkeypatch.setenv('ENABLE_SLA_SCHEDULER', '1')
    monkeypatch.setenv('SLA_CHECK_INTERVAL_SECONDS', '1')
    monkeypatch.setenv('SLA_STARTUP_DELAY_SECONDS', '0')
    monkeypatch.setenv('WERKZEUG_RUN_MAIN', 'true')
    monkeypatch.delitem(sys.modules, 'pytest', raising=False)

    with patch('requests.post', side_effect=fake_post):
        monkeypatch.setattr(sys, 'argv', ['run.py'])
        thread = start_sla_cron_scheduler(isolated_app)
        assert thread is not None
        try:
            assert push_done.wait(timeout=5.0), 'Background SLA scheduler did not fire warning push!'
        finally:
            stop_sla_cron_scheduler()
            isolated_app.config['TESTING'] = True

    assert len(sent_pushes) == 1
    assert 'staff-phone' in sent_pushes[0]['url']
    assert sent_pushes[0]['headers']['ttl'] == '86400'
    assert Vapid.verify(sent_pushes[0]['headers']['authorization'])

    with isolated_app.app_context():
        warn_notifs = Notification.query.filter_by(user_id=staff_id, type='sla_warning').all()
        assert len(warn_notifs) == 1
        assert 'SLA 30 menit: ITD-100' in warn_notifs[0].title

        # Second check at same milestone produces zero duplicates
        NotificationService._last_sla_check_time = 0.0
        assert run_sla_check_once(isolated_app, force=True, cooldown_seconds=0) == 0

        # Move deadline into the past -> triggers breached push for both assignee AND Admin
        t = db.session.get(Ticket, ticket_id)
        t.sla_deadline = datetime.now(timezone.utc) - timedelta(minutes=2)
        db.session.commit()

    sent_pushes.clear()
    two_pushes = threading.Event()

    def fake_post_breach(url, **kwargs):
        if 'fcm.googleapis.com' in str(url):
            sent_pushes.append(str(url))
            if len(sent_pushes) >= 2:
                two_pushes.set()
            return MagicMock(status_code=201, text='', reason='Created')
        raise AssertionError(f'Unexpected URL: {url}')

    isolated_app.config['TESTING'] = False
    with patch('requests.post', side_effect=fake_post_breach):
        NotificationService._last_sla_check_time = 0.0
        created = run_sla_check_once(isolated_app, force=True, cooldown_seconds=0)
        assert created == 2
        assert two_pushes.wait(timeout=5.0), 'Breached pushes did not dispatch for staff + admin!'
    isolated_app.config['TESTING'] = True

    with isolated_app.app_context():
        assert Notification.query.filter_by(user_id=staff_id, type='sla_breached').count() == 1
        assert Notification.query.filter_by(user_id=admin_id, type='sla_breached').count() == 1


def test_break_frozen_sla_does_not_fire_false_warnings_or_breaches(isolated_app):
    """When assigned staff is on break, countdown freezes at break_started_at."""
    with isolated_app.app_context():
        now_utc = datetime.now(timezone.utc)
        staff = User(
            username='stf_brk',
            email='stf_brk@ani.co.id',
            full_name='Staff Break',
            role='Staff',
            is_active=True,
            is_on_break=True,
            break_started_at=now_utc - timedelta(minutes=45),
        )
        staff.set_password('Pass123!')
        db.session.add(staff)
        db.session.commit()

        # At break_started_at (-45m), deadline (-5m from now) was still +40m in future (>30m threshold)
        ticket = Ticket(
            title='Break Frozen Ticket',
            description='Frozen during break',
            priority='medium',
            category='Software',
            submitter_name='Ani',
            ticket_code='ITD-200',
            status='In Progress',
            assigned_to_id=staff.id,
            taken_at=now_utc - timedelta(hours=1),
            sla_deadline=now_utc - timedelta(minutes=5),
        )
        db.session.add(ticket)
        db.session.commit()

    created = run_sla_check_once(isolated_app, force=True, cooldown_seconds=0)
    assert created == 0

    with isolated_app.app_context():
        assert Notification.query.count() == 0
