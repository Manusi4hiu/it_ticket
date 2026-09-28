"""Tests for SLA freezing while the assigned staff member is on break
(code review suggestion #8).

``TicketService.calculate_sla_status`` is the single place where the break
pause is applied. When the assignee is on break it compares the deadline
against ``break_started_at`` rather than ``now``, so elapsed break time does
not consume the SLA budget.

Thresholds implemented in the code under test:
    remaining < 0            -> 'breached'
    remaining < 2h, unresolved -> 'warning'
    otherwise                -> 'good'
    no deadline              -> 'good'
"""

from datetime import datetime, timedelta, timezone

import pytest

UTC = timezone.utc


@pytest.fixture
def staff_on_break(app, db, make_user):
    """An assignee currently on break, started ``minutes`` ago."""
    def _make(username, minutes=45):
        user = make_user(username, role='Staff', full_name=username)
        user.is_on_break = True
        user.break_started_at = datetime.now(UTC) - timedelta(minutes=minutes)
        db.session.commit()
        return user
    return _make


@pytest.fixture
def staff_off_break(app, db, make_user):
    def _make(username):
        user = make_user(username, role='Staff', full_name=username)
        user.is_on_break = False
        user.break_started_at = None
        db.session.commit()
        return user
    return _make


def sla_for(deadline_in, user, resolved_at=None):
    from app.services.ticket_service import TicketService
    return TicketService.calculate_sla_status(
        sla_deadline=(
            datetime.now(UTC) + timedelta(**deadline_in)
            if deadline_in is not None else None
        ),
        resolved_at=resolved_at,
        sla_paused_at=user.break_started_at,
        assigned_user=user,
    )


class TestSlaIsFrozenDuringBreak:
    def test_break_promotes_warning_to_good(self, staff_on_break):
        """The core assertion: break time is not charged against the SLA.

        Deadline is 90 minutes out, which is a 'warning' against the clock.
        The user broke off 45 minutes ago, so the frozen comparison point
        leaves 135 minutes, which clears the 2 hour warning threshold.
        """
        user = staff_on_break('sla_frozen', minutes=45)
        assert sla_for({'hours': 0, 'minutes': 90}, user) == 'good'

    def test_same_deadline_without_break_is_a_warning(self, staff_off_break):
        """Control proving the previous result comes from the pause, not luck."""
        user = staff_off_break('sla_nobreak')
        assert sla_for({'hours': 0, 'minutes': 90}, user) == 'warning'

    def test_long_break_prevents_a_breach(self, staff_on_break):
        """A pause long enough to cover the overrun keeps the ticket alive.

        The deadline passed 4 hours ago, but the user broke off 5 hours ago
        and is still on break. Measured against ``break_started_at`` only 1
        hour of the deadline window was actually consumed, so the ticket is
        'warning' rather than 'breached'.
        """
        user = staff_on_break('sla_longbreak', minutes=300)
        assert sla_for({'hours': -4}, user) == 'warning'

    def test_control_same_deadline_without_break_is_breached(self,
                                                             staff_off_break):
        """Proves the rescue above comes from the pause and nothing else."""
        user = staff_off_break('sla_longbreak_control')
        assert sla_for({'hours': -4}, user) == 'breached'

    def test_short_break_leaves_status_unchanged(self, staff_on_break):
        """A 2 minute pause must not flip a comfortable ticket."""
        user = staff_on_break('sla_short', minutes=2)
        assert sla_for({'hours': 5}, user) == 'good'


class TestBreachStillApplies:
    def test_deadline_already_passed_is_breached_while_on_break(self,
                                                                staff_on_break):
        user = staff_on_break('sla_breached', minutes=5)
        assert sla_for({'minutes': -10}, user) == 'breached'

    def test_breach_when_break_is_not_counted_at_all(self, staff_off_break):
        user = staff_off_break('sla_breached_nobreak')
        assert sla_for({'minutes': -10}, user) == 'breached'

    def test_resolved_ignores_the_warning_band(self, staff_off_break):
        """A resolved ticket is never 'warning' regardless of remaining time."""
        user = staff_off_break('sla_resolved')
        assert sla_for({'minutes': 30}, user,
                       resolved_at=datetime.now(UTC)) == 'good'


class TestEdgeCases:
    def test_missing_deadline_is_good(self, staff_off_break):
        user = staff_off_break('sla_nodeadline')
        assert sla_for(None, user) == 'good'

    def test_no_user_assigned_is_good(self, app):
        from app.services.ticket_service import TicketService
        assert TicketService.calculate_sla_status(
            sla_deadline=datetime.now(UTC) + timedelta(hours=3),
            resolved_at=None,
            sla_paused_at=None,
            assigned_user=None,
        ) == 'good'

    def test_on_break_without_start_time_uses_the_clock(self, app, db, make_user):
        """is_on_break but no timestamp: must not raise, must fall back to now."""
        user = make_user('sla_nostart', role='Staff', full_name='No Start')
        user.is_on_break = True
        user.break_started_at = None
        db.session.commit()
        assert sla_for({'minutes': 30}, user) == 'warning'

    def test_naive_deadline_is_treated_as_utc(self, staff_off_break):
        """Naive datetimes are coerced rather than raising a TypeError."""
        from app.services.ticket_service import TicketService
        user = staff_off_break('sla_naive')
        naive_deadline = (datetime.now(UTC) + timedelta(hours=3)).replace(
            tzinfo=None
        )
        assert TicketService.calculate_sla_status(
            sla_deadline=naive_deadline,
            resolved_at=None,
            sla_paused_at=None,
            assigned_user=user,
        ) == 'good'

    def test_exactly_at_deadline_is_breached(self, staff_off_break):
        """remaining == 0 must breach, not warn."""
        user = staff_off_break('sla_exact')
        assert sla_for({'seconds': -1}, user) == 'breached'

    def test_warning_boundary_is_two_hours(self, staff_off_break):
        """Just under 2h warns, comfortably over does not."""
        user = staff_off_break('sla_boundary')
        assert sla_for({'hours': 1, 'minutes': 59}, user) == 'warning'
        assert sla_for({'hours': 2, 'minutes': 1}, user) == 'good'
