"""Tests for break summary aggregation across daily / weekly / monthly periods
(code review suggestion #8).

These exercise the real endpoints (``GET /api/users/break-summary`` and
``GET /api/users/break-logs``) with a real JWT, so the period boundaries,
the SQL aggregation and the legacy fallback are all covered as shipped.

Review item #7
--------------
``break_summary`` adds ``users.total_break_seconds_today`` on top of the
``break_logs`` total for users whose data predates the ``break_logs`` table.
The module-level tests pin the anti-double-count arithmetic, including the
cross-midnight limitation that cannot be fixed without backfilling the legacy
column.
"""

import calendar
from datetime import date, datetime, time, timedelta, timezone

import pytest

from app.utils.report_tz import report_tz, report_today

UTC = timezone.utc


# ── helpers ───────────────────────────────────────────────────────────

def add_log(db, user, start, end, log_date=None, duration=None):
    """Insert a break_logs row the way the toggle endpoint would."""
    from app.models.master_data import BreakLog
    seconds = int((end - start).total_seconds()) if duration is None else duration
    row = BreakLog(
        user_id=user.id,
        started_at=start,
        ended_at=end,
        duration_seconds=seconds,
        log_date=log_date or report_today(),
    )
    db.session.add(row)
    db.session.commit()
    return row


def get_summary(client, headers, period):
    response = client.get(f'/api/users/break-summary?period={period}',
                          headers=headers)
    assert response.status_code == 200, response.get_data(as_text=True)
    body = response.get_json()
    assert body['success'] is True
    assert body['period'] == period
    return body


def entry_for(body, user_id):
    for row in body['summary']:
        if row['userId'] == user_id:
            return row
    raise AssertionError(f'user {user_id} missing from summary')


@pytest.fixture
def viewer(app, make_user, auth_headers):
    """An Administrator plus a ready test client and headers."""
    admin = make_user('admin_sum', role='Administrator', full_name='Sum Admin')
    return app.test_client(), auth_headers(admin)


# ── period boundaries ─────────────────────────────────────────────────

class TestPeriodRanges:
    """The ranges come from ``_break_period_range`` in routes/users.py."""

    def test_daily_range_is_a_single_day(self, app):
        from app.routes.users import _break_period_range
        period, start, end = _break_period_range('daily')
        assert period == 'daily'
        assert start == end == report_today()

    def test_weekly_range_starts_monday_and_spans_seven_days(self, app):
        from app.routes.users import _break_period_range
        period, start, end = _break_period_range('weekly')
        assert period == 'weekly'
        assert start.weekday() == 0, 'weekly must begin on Monday'
        assert (end - start).days == 6, 'Monday to Sunday inclusive'
        assert end >= report_today() or end < report_today()

    def test_weekly_range_contains_today(self, app):
        from app.routes.users import _break_period_range
        _period, start, end = _break_period_range('weekly')
        assert start <= report_today() <= end

    def test_monthly_range_covers_the_whole_month(self, app):
        from app.routes.users import _break_period_range
        period, start, end = _break_period_range('monthly')
        assert period == 'monthly'
        assert start.day == 1
        assert end.day == calendar.monthrange(end.year, end.month)[1]

    def test_monthly_range_contains_today(self, app):
        from app.routes.users import _break_period_range
        _period, start, end = _break_period_range('monthly')
        assert start <= report_today() <= end

    def test_unknown_period_falls_back_to_daily(self, app):
        from app.routes.users import _break_period_range
        period, start, end = _break_period_range('yearly')
        assert period == 'daily'
        assert start == end


# ── daily / weekly / monthly aggregation ──────────────────────────────

class TestAggregation:
    def test_daily_counts_only_todays_logs(self, app, db, make_user, viewer):
        client, headers = viewer
        user = make_user('agg_daily', full_name='Daily User')
        today = report_today()

        add_log(db, user,
                datetime.combine(today, time(1, 0), tzinfo=UTC),
                datetime.combine(today, time(1, 30), tzinfo=UTC),
                log_date=today)
        add_log(db, user,
                datetime.combine(today - timedelta(days=1), time(1, 0), tzinfo=UTC),
                datetime.combine(today - timedelta(days=1), time(1, 15), tzinfo=UTC),
                log_date=today - timedelta(days=1))

        entry = entry_for(get_summary(client, headers, 'daily'), user.id)
        assert entry['usedSeconds'] == 1800, 'only the 30 minute log is today'
        assert entry['sessionsCount'] == 1
        assert entry['userName'] == 'Daily User'

    def test_weekly_includes_logs_from_the_same_week(self, app, db, make_user,
                                                     viewer):
        client, headers = viewer
        user = make_user('agg_weekly', full_name='Weekly User')

        from app.routes.users import _break_period_range
        _period, start, end = _break_period_range('weekly')
        mid = start + timedelta(days=2)

        add_log(db, user,
                datetime.combine(mid, time(2, 0), tzinfo=UTC),
                datetime.combine(mid, time(2, 20), tzinfo=UTC),
                log_date=mid)

        entry = entry_for(get_summary(client, headers, 'weekly'), user.id)
        assert entry['usedSeconds'] == 1200
        assert entry['sessionsCount'] == 1

    def test_weekly_excludes_logs_outside_the_range(self, app, db, make_user,
                                                    viewer):
        client, headers = viewer
        user = make_user('agg_weekly_out', full_name='Weekly Out')

        from app.routes.users import _break_period_range
        _period, start, end = _break_period_range('weekly')
        outside = start - timedelta(days=1)

        add_log(db, user,
                datetime.combine(outside, time(2, 0), tzinfo=UTC),
                datetime.combine(outside, time(2, 20), tzinfo=UTC),
                log_date=outside)

        entry = entry_for(get_summary(client, headers, 'weekly'), user.id)
        assert entry['usedSeconds'] == 0
        assert entry['sessionsCount'] == 0

    def test_monthly_sums_every_log_in_the_month(self, app, db, make_user,
                                                 viewer):
        client, headers = viewer
        user = make_user('agg_monthly', full_name='Monthly User')
        today = report_today()

        first = today.replace(day=1)
        second = min(first + timedelta(days=1), today)
        add_log(db, user,
                datetime.combine(first, time(1, 0), tzinfo=UTC),
                datetime.combine(first, time(1, 10), tzinfo=UTC),
                log_date=first)
        add_log(db, user,
                datetime.combine(second, time(1, 0), tzinfo=UTC),
                datetime.combine(second, time(1, 5), tzinfo=UTC),
                log_date=second)

        entry = entry_for(get_summary(client, headers, 'monthly'), user.id)
        assert entry['usedSeconds'] == 900
        assert entry['sessionsCount'] == 2

    def test_session_count_matches_row_count(self, app, db, make_user, viewer):
        client, headers = viewer
        user = make_user('agg_count', full_name='Count User')
        for index in range(4):
            add_log(db, user,
                    datetime.combine(report_today(), time(1 + index, 0), tzinfo=UTC),
                    datetime.combine(report_today(), time(1 + index, 5), tzinfo=UTC))
        entry = entry_for(get_summary(client, headers, 'daily'), user.id)
        assert entry['sessionsCount'] == 4
        assert entry['usedSeconds'] == 4 * 300

    def test_summary_is_sorted_by_usage_descending(self, app, db, make_user,
                                                   viewer):
        client, headers = viewer
        light = make_user('agg_light', full_name='Light User')
        heavy = make_user('agg_heavy', full_name='Heavy User')
        add_log(db, light,
                datetime.combine(report_today(), time(1, 0), tzinfo=UTC),
                datetime.combine(report_today(), time(1, 1), tzinfo=UTC))
        add_log(db, heavy,
                datetime.combine(report_today(), time(2, 0), tzinfo=UTC),
                datetime.combine(report_today(), time(2, 30), tzinfo=UTC))

        rows = get_summary(client, headers, 'daily')['summary']
        used = [row['usedSeconds'] for row in rows]
        assert used == sorted(used, reverse=True)

    def test_remaining_is_limit_minus_used(self, app, db, make_user, viewer):
        client, headers = viewer
        user = make_user('agg_remaining', full_name='Remaining User')
        add_log(db, user,
                datetime.combine(report_today(), time(1, 0), tzinfo=UTC),
                datetime.combine(report_today(), time(1, 10), tzinfo=UTC))

        body = get_summary(client, headers, 'daily')
        entry = entry_for(body, user.id)
        assert entry['remainingSeconds'] == entry['limitMinutes'] * 60 - entry['usedSeconds']

    def test_user_with_no_logs_reports_zero(self, app, make_user, viewer):
        client, headers = viewer
        user = make_user('agg_none', full_name='No Logs')
        entry = entry_for(get_summary(client, headers, 'daily'), user.id)
        assert entry['usedSeconds'] == 0
        assert entry['sessionsCount'] == 0
        assert entry['liveSeconds'] == 0
        assert entry['isOnBreak'] is False


# ── live session ──────────────────────────────────────────────────────

class TestLiveSession:
    def test_running_session_is_included_as_live_seconds(self, app, db,
                                                         make_user, viewer):
        client, headers = viewer
        user = make_user('live1', full_name='Live User')
        user.is_on_break = True
        user.break_started_at = datetime.now(UTC) - timedelta(minutes=4)
        db.session.commit()

        entry = entry_for(get_summary(client, headers, 'daily'), user.id)
        assert entry['isOnBreak'] is True
        assert entry['liveSeconds'] >= 240
        assert entry['usedSeconds'] >= entry['liveSeconds']

    def test_live_session_outside_the_period_is_not_counted(self, app, db,
                                                            make_user, viewer):
        """A session whose start falls outside the range is excluded."""
        from app.routes.users import _break_period_range
        client, headers = viewer
        user = make_user('live2', full_name='Live Outside')

        _period, _start, end = _break_period_range('monthly')
        outside = date(end.year, end.month, 1) - timedelta(days=1)
        user.is_on_break = True
        user.break_started_at = datetime.combine(
            outside, time(12, 0), tzinfo=UTC
        )
        db.session.commit()

        entry = entry_for(get_summary(client, headers, 'monthly'), user.id)
        assert entry['liveSeconds'] > 0, 'elapsed time is still reported'
        assert entry['usedSeconds'] == 0, 'but not added to the period total'


# ── legacy fallback (review item #7) ──────────────────────────────────

class TestLegacyFallback:
    def test_legacy_total_used_when_no_logs_exist(self, app, db, make_user,
                                                  viewer):
        client, headers = viewer
        user = make_user('legacy1', full_name='Legacy Only')
        user.total_break_seconds_today = 1200
        user.break_total_date = report_today()
        db.session.commit()

        entry = entry_for(get_summary(client, headers, 'daily'), user.id)
        assert entry['usedSeconds'] == 1200

    def test_legacy_total_ignored_once_it_belongs_to_a_stale_day(self, app, db,
                                                                 make_user, viewer):
        client, headers = viewer
        user = make_user('legacy2', full_name='Legacy Stale')
        user.total_break_seconds_today = 1200
        user.break_total_date = report_today() - timedelta(days=3)
        db.session.commit()

        entry = entry_for(get_summary(client, headers, 'daily'), user.id)
        assert entry['usedSeconds'] == 0, (
            'a counter from a previous day must not be added to today'
        )

    def test_legacy_null_date_is_treated_as_today(self, app, db, make_user,
                                                  viewer):
        client, headers = viewer
        user = make_user('legacy3', full_name='Legacy Null')
        user.total_break_seconds_today = 900
        user.break_total_date = None
        db.session.commit()

        entry = entry_for(get_summary(client, headers, 'daily'), user.id)
        assert entry['usedSeconds'] == 900, 'NULL date is read as today'

    def test_only_the_difference_is_added_when_logs_already_exist(self, app, db,
                                                                  make_user, viewer):
        """The anti-double-count rule from review item #7."""
        client, headers = viewer
        user = make_user('legacy4', full_name='Legacy Mixed')
        user.total_break_seconds_today = 1800
        user.break_total_date = report_today()
        db.session.commit()

        add_log(db, user,
                datetime.combine(report_today(), time(1, 0), tzinfo=UTC),
                datetime.combine(report_today(), time(1, 20), tzinfo=UTC),
                duration=1200)

        entry = entry_for(get_summary(client, headers, 'daily'), user.id)
        # 1200 logged + 600 difference, not 1200 + 1800.
        assert entry['usedSeconds'] == 1800

    def test_legacy_below_logged_total_is_not_subtracted(self, app, db,
                                                         make_user, viewer):
        client, headers = viewer
        user = make_user('legacy5', full_name='Legacy Behind')
        user.total_break_seconds_today = 300
        user.break_total_date = report_today()
        db.session.commit()

        add_log(db, user,
                datetime.combine(report_today(), time(1, 0), tzinfo=UTC),
                datetime.combine(report_today(), time(1, 40), tzinfo=UTC),
                duration=2400)

        entry = entry_for(get_summary(client, headers, 'daily'), user.id)
        assert entry['usedSeconds'] == 2400, (
            'the legacy value is a subset of what is already logged; it must '
            'never reduce the total'
        )


# ── break-logs endpoint ───────────────────────────────────────────────

class TestBreakLogsEndpoint:
    def test_lists_todays_logs_newest_first(self, app, db, make_user, viewer):
        client, headers = viewer
        user = make_user('logs1', full_name='Logs User')
        base = datetime.combine(report_today(), time(1, 0), tzinfo=UTC)
        add_log(db, user, base, base + timedelta(minutes=5), duration=300)
        add_log(db, user, base + timedelta(hours=2),
                base + timedelta(hours=2, minutes=7), duration=420)

        response = client.get('/api/users/break-logs?period=daily',
                              headers=headers)
        assert response.status_code == 200
        body = response.get_json()
        assert body['success'] is True
        assert body['total'] == 2
        ended = [log['endedAt'] for log in body['logs']]
        assert ended == sorted(ended, reverse=True), 'newest first'

    def test_invalid_user_id_is_rejected(self, app, viewer):
        client, headers = viewer
        response = client.get('/api/users/break-logs?user_id=abc', headers=headers)
        assert response.status_code == 400
        assert response.get_json()['success'] is False

    def test_staff_only_sees_own_logs(self, app, db, make_user, auth_headers):
        staff = make_user('staff_scope', role='Staff', full_name='Scoped Staff')
        other = make_user('staff_other', role='Staff', full_name='Other Staff')
        base = datetime.combine(report_today(), time(1, 0), tzinfo=UTC)
        add_log(db, other, base, base + timedelta(minutes=5), duration=300)

        client = app.test_client()
        response = client.get('/api/users/break-logs?period=daily',
                              headers=auth_headers(staff))
        body = response.get_json()
        assert body['total'] == 0, 'Staff must not see another user history'

    def test_staff_cannot_request_another_users_logs(self, app, make_user,
                                                     auth_headers):
        staff = make_user('staff_hack', role='Staff', full_name='Hack Staff')
        other = make_user('staff_target', role='Staff', full_name='Target')
        client = app.test_client()
        response = client.get(
            f'/api/users/break-logs?user_id={other.id}',
            headers=auth_headers(staff),
        )
        assert response.status_code == 403

    def test_limit_is_capped(self, app, db, make_user, viewer):
        client, headers = viewer
        user = make_user('logs_limit', full_name='Limit User')
        base = datetime.combine(report_today(), time(0, 0), tzinfo=UTC)
        for index in range(4):
            moment = base + timedelta(hours=index)
            add_log(db, user, moment, moment + timedelta(minutes=1), duration=60)

        response = client.get('/api/users/break-logs?period=daily&limit=2',
                              headers=headers)
        body = response.get_json()
        assert len(body['logs']) == 2
        assert body['total'] == 4, 'total reflects all matches, not the page'
