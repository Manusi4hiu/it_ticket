"""Regression tests for the break toggle race condition (code review critical #1).

Original finding
----------------
``POST /users/<user_id>/break`` had no database lock, so two simultaneous
requests could each observe ``is_on_break = True``, both compute a duration
and both insert a ``break_logs`` row. The visible symptoms were a
double-counted total and duplicate history.

Fix under test
--------------
``User.query.filter_by(id=user_id).with_for_update().first()`` acquires a row
lock that is held until the enclosing transaction commits.

What these tests can and cannot prove
-------------------------------------
``SELECT ... FOR UPDATE`` is a PostgreSQL feature. SQLite parses and ignores
it, so a suite running on SQLite cannot demonstrate real lock contention.
Writing a test that appears to prove concurrency but runs on SQLite would be
misleading, so this module does not pretend to. It asserts what is
genuinely verifiable without a live PostgreSQL server:

1. ``with_for_update()`` is applied to the user lookup in ``toggle_break``,
   and it is applied *before* any read or write of ``is_on_break``.
2. The construct emits a real ``FOR UPDATE`` clause under the PostgreSQL
   dialect, i.e. it is not silently dropped as a no-op.
3. The corruption the race produced is absent for sequential requests and
   the session state stays consistent.

Item 1 guards against regression. None of this proves the absence of a race
under true parallelism -- that would need a dedicated PostgreSQL test
database, which is deliberately not wired up here (see ``conftest.py``).
"""

import inspect
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.dialects import postgresql

UTC = timezone.utc


def start_break(client, headers, user_id):
    response = client.post(f'/api/users/{user_id}/break', headers=headers)
    assert response.status_code == 200, response.get_data(as_text=True)
    return response.get_json()


def end_break(client, headers, user_id):
    response = client.post(f'/api/users/{user_id}/break', headers=headers)
    assert response.status_code == 200, response.get_data(as_text=True)
    return response.get_json()


def backdate_break_start(db, user, minutes):
    """Move break_started_at into the past so duration is observable."""
    from app.models.user import User
    db.session.expire_all()
    row = db.session.get(User, user.id)
    row.break_started_at = datetime.now(UTC) - timedelta(minutes=minutes)
    db.session.commit()
    return row


def reload_user(db, user):
    from app.models.user import User
    db.session.expire_all()
    return db.session.get(User, user.id)


class TestRowLockIsDeclared:
    """The lock must survive future refactors."""

    def test_with_for_update_emits_a_real_clause_on_postgres(self, app):
        """`with_for_update()` must reach the emitted SQL, not be a no-op."""
        from app.models.user import User

        stmt = select(User).where(User.id == 1).with_for_update()
        compiled = str(stmt.compile(dialect=postgresql.dialect()))
        assert 'FOR UPDATE' in compiled, compiled

    def test_same_construct_without_the_lock_has_no_clause(self, app):
        """Control: the assertion above is actually detecting the lock."""
        from app.models.user import User

        stmt = select(User).where(User.id == 1)
        compiled = str(stmt.compile(dialect=postgresql.dialect()))
        assert 'FOR UPDATE' not in compiled, compiled

    def test_toggle_break_locks_the_target_user_row(self, app):
        from app.routes.users import toggle_break

        source = inspect.getsource(toggle_break)
        assert 'with_for_update()' in source, (
            'toggle_break no longer acquires a row lock; the critical race '
            'condition from the code review would be reintroduced'
        )
        # The lock must be on the user query, not on an unrelated query.
        lock_line = next(
            line for line in source.splitlines() if 'with_for_update()' in line
        )
        assert 'User.query.filter_by(id=user_id)' in lock_line, lock_line

    def test_lock_precedes_every_is_on_break_access(self, app):
        """Reading or writing is_on_break before the lock defeats the lock."""
        from app.routes.users import toggle_break

        source = inspect.getsource(toggle_break)
        lock_at = source.find('with_for_update()')
        first_access = source.find('user.is_on_break')
        assert lock_at != -1
        assert first_access != -1
        assert lock_at < first_access, (
            'row lock must be acquired before is_on_break is read or written; '
            'otherwise a concurrent request can still read a stale value'
        )

    def test_lock_precedes_break_started_at_write(self, app):
        from app.routes.users import toggle_break

        source = inspect.getsource(toggle_break)
        lock_at = source.find('with_for_update()')
        first_write = source.find('user.break_started_at =')
        assert lock_at != -1
        assert first_write != -1
        assert lock_at < first_write


class TestNoDoubleCountOnSequentialRequests:
    """The user-visible damage the race produced must not reappear."""

    def test_single_session_writes_exactly_one_log(self, app, db, make_user,
                                                   auth_headers):
        from app.models.master_data import BreakLog

        user = make_user('race1', full_name='Race One')
        headers = auth_headers(user)
        client = app.test_client()

        start_break(client, headers, user.id)
        backdate_break_start(db, user, 10)
        end_break(client, headers, user.id)

        logs = BreakLog.query.filter_by(user_id=user.id).all()
        assert len(logs) == 1
        assert logs[0].duration_seconds >= 590
        assert logs[0].started_at is not None
        assert logs[0].ended_at is not None

    def test_extra_toggles_never_produce_a_second_log_for_one_session(
        self, app, db, make_user, auth_headers
    ):
        """An END must never be counted twice for a single session.

        ``toggle_break`` is state-driven: with the session already closed, a
        further request opens a new session rather than re-closing the old
        one. So after START, END, END the user is on a fresh break and only
        one log exists.
        """
        from app.models.master_data import BreakLog

        user = make_user('race2', full_name='Race Two')
        headers = auth_headers(user)
        client = app.test_client()

        start_break(client, headers, user.id)
        backdate_break_start(db, user, 5)
        end_break(client, headers, user.id)
        # Third request: the session is already closed, so this starts a new
        # one. It must not add a second log for the session that just ended.
        reopened = start_break(client, headers, user.id)

        logs = BreakLog.query.filter_by(user_id=user.id).all()
        assert len(logs) == 1, (
            f'expected exactly 1 break log, found {len(logs)}; a repeated '
            'request closed the same session twice'
        )
        assert reopened['isOnBreak'] is True

    def test_log_count_equals_number_of_completed_sessions(
        self, app, db, make_user, auth_headers
    ):
        """Four toggles complete two sessions and must yield two logs."""
        from app.models.master_data import BreakLog

        user = make_user('race5', full_name='Race Five')
        headers = auth_headers(user)
        client = app.test_client()

        start_break(client, headers, user.id)
        backdate_break_start(db, user, 2)
        end_break(client, headers, user.id)

        start_break(client, headers, user.id)
        backdate_break_start(db, user, 4)
        end_break(client, headers, user.id)

        logs = BreakLog.query.filter_by(user_id=user.id).all()
        assert len(logs) == 2
        # Durations must not be summed into a single entry.
        assert all(log.duration_seconds > 0 for log in logs)

        row = reload_user(db, user)
        assert row.is_on_break is False
        total_logged = db.session.query(
            db.func.sum(BreakLog.duration_seconds)
        ).filter(BreakLog.user_id == user.id).scalar()
        assert (row.total_break_seconds_today or 0) == int(total_logged)

    def test_state_flags_are_consistent_across_the_session(self, app, db,
                                                            make_user, auth_headers):
        user = make_user('race3', full_name='Race Three')
        headers = auth_headers(user)
        client = app.test_client()

        started = start_break(client, headers, user.id)
        assert started['isOnBreak'] is True
        assert started['breakStartedAt'] is not None

        backdate_break_start(db, user, 1)
        ended = end_break(client, headers, user.id)
        assert ended['isOnBreak'] is False
        assert ended['breakStartedAt'] is None

        row = reload_user(db, user)
        assert row.is_on_break is False
        assert row.break_started_at is None
        assert (row.total_break_seconds_today or 0) > 0

    def test_daily_total_equals_the_summed_log(self, app, db, make_user,
                                               auth_headers):
        """The legacy counter and the log must agree after a session."""
        from app.models.master_data import BreakLog

        user = make_user('race4', full_name='Race Four')
        headers = auth_headers(user)
        client = app.test_client()

        start_break(client, headers, user.id)
        backdate_break_start(db, user, 3)
        end_break(client, headers, user.id)

        row = reload_user(db, user)
        logged = db.session.query(db.func.sum(BreakLog.duration_seconds)).filter(
            BreakLog.user_id == user.id
        ).scalar()
        assert (row.total_break_seconds_today or 0) == int(logged)


class TestAtomicityOfBreakSession:
    """The END branch must not persist a half-applied session."""

    def test_failed_log_insert_never_commits_total_without_a_log(
        self, app, db, make_user, auth_headers, monkeypatch
    ):
        """A failing log insert must not leave total updated and log empty.

        This is the exact inconsistency from review item #3: the route used
        to catch the insert error, keep the updated total, and commit.
        """
        from app.models import master_data
        from app.models.master_data import BreakLog

        user = make_user('atomic1', full_name='Atomic One')
        headers = auth_headers(user)
        client = app.test_client()

        start_break(client, headers, user.id)
        backdate_break_start(db, user, 2)

        def boom(*args, **kwargs):
            raise RuntimeError('simulated break_logs insert failure')

        monkeypatch.setattr(BreakLog, '__init__', boom)
        try:
            response = client.post(f'/api/users/{user.id}/break', headers=headers)
        finally:
            monkeypatch.undo()

        assert response.status_code in (200, 500)
        assert response.content_type.startswith('application/json'), (
            'an unexpected exception type would return a non-JSON body, which '
            'the frontend surfaces as "Server returned 500 (Non-JSON)"'
        )

        row = reload_user(db, user)
        log_count = BreakLog.query.filter_by(user_id=user.id).count()
        total = row.total_break_seconds_today or 0

        if log_count == 0:
            assert total == 0, (
                f'total_break_seconds_today={total} was committed while the '
                'break_logs insert had failed -- inconsistent state'
            )
        else:
            assert total > 0
