"""Regression for the main/dev SLA merge: paused IT versus live Corcom deadlines."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.ticket_service import TicketService


def test_pending_it_sla_freezes_without_warning_or_false_breach():
    now = datetime.now(timezone.utc)
    staff = SimpleNamespace(is_on_break=False, break_started_at=None)
    status = TicketService.calculate_sla_status
    common = {'assigned_user': staff, 'taken_at': now - timedelta(hours=3), 'status': 'Pending'}

    assert status(now + timedelta(minutes=30), sla_paused_at=now - timedelta(minutes=10), **common) == 'good'
    assert status(now - timedelta(hours=1), sla_paused_at=now - timedelta(hours=2), **common) == 'good'
    assert status(now - timedelta(hours=2), sla_paused_at=now - timedelta(hours=1), **common) == 'breached'
    assert status(now - timedelta(hours=1), sla_paused_at=now - timedelta(hours=2),
                  assigned_user=None, taken_at=None, status='New') == 'good'
    assert status(now - timedelta(hours=1), sla_paused_at=now - timedelta(hours=2),
                  assigned_user=staff, is_design=True) == 'breached'
