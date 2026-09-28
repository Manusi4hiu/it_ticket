"""Shared pytest fixtures for the backend test suite.

SAFETY CONTRACT — read before adding any fixture that touches the database
----------------------------------------------------------------------------
This suite MUST run entirely on an in-memory SQLite database. It must never
connect to the database named by the ``DATABASE_URL`` environment variable,
which is the development/production database.

Why this is enforced rather than merely documented: ``app/config.py`` calls
``load_dotenv()`` at import time and ``create_app()`` binds the SQLAlchemy
engine to that URI immediately. A fixture that ran ``db.drop_all()`` while
bound to the dev URI would erase the entire development database. That has
already happened once in this project.

The ``app`` fixture therefore overrides ``SQLALCHEMY_DATABASE_URI`` on the
config class *before* ``create_app()`` is called, and the resolved value is
asserted to be SQLite afterwards. ``DATABASE_URL`` is never read here.

There is intentionally no PostgreSQL fixture. Behaviour that genuinely
requires ``SELECT ... FOR UPDATE`` cannot be exercised on SQLite (the
dialect ignores row locking), so those tests assert against SQL compiled for
the PostgreSQL dialect instead. See ``test_toggle_break_race_condition.py``.
"""

import os
import sys

import pytest

# Make `app` importable regardless of the directory pytest is invoked from.
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

# Applied before `app.config` is imported so the config class never observes
# the developer database, not even transiently.
SQLITE_URI = 'sqlite:///:memory:'


@pytest.fixture
def app():
    """Flask app bound to in-memory SQLite, with schema created."""
    from app import create_app, db
    from app.config import DevelopmentConfig

    original_uri = DevelopmentConfig.SQLALCHEMY_DATABASE_URI
    original_echo = DevelopmentConfig.SQLALCHEMY_ECHO
    DevelopmentConfig.SQLALCHEMY_DATABASE_URI = SQLITE_URI
    DevelopmentConfig.SQLALCHEMY_ECHO = False

    try:
        application = create_app('development')
        application.config.update(
            TESTING=True,
            SQLALCHEMY_DATABASE_URI=SQLITE_URI,
            SQLALCHEMY_ECHO=False,
            JWT_SECRET_KEY='test-secret-key',
        )

        # Belt and braces: confirm before a single statement is executed.
        resolved = application.config['SQLALCHEMY_DATABASE_URI']
        assert resolved.startswith('sqlite'), (
            f'Refusing to run tests against {resolved!r}. The suite must stay '
            'on SQLite; a non-SQLite URI here can destroy real data.'
        )

        with application.app_context():
            db.create_all()
            _seed_master_data()
            yield application
            db.session.remove()
            db.drop_all()
    finally:
        DevelopmentConfig.SQLALCHEMY_DATABASE_URI = original_uri
        DevelopmentConfig.SQLALCHEMY_ECHO = original_echo


def _seed_master_data():
    """Insert the minimum rows that the code under test expects to exist."""
    from app import db
    from app.models.master_data import (
        BreakSetting, Category, Department, Priority, SLAPolicy, Status,
    )

    for name in ('New', 'In Progress', 'Pending', 'Resolved', 'Closed'):
        db.session.add(Status(name=name))
    db.session.add(Priority(
        name='Low', level=4, color='#10B981', sla_hours=72,
        response_time_minutes=240, is_active=True,
    ))
    db.session.add(Category(name='Development', is_active=True))
    db.session.add(Department(name='IT', code='IT', is_active=True))
    db.session.add(SLAPolicy(response_time_minutes=240, resolution_time_hours=72))
    db.session.add(BreakSetting(
        name='Default',
        max_break_minutes=60,
        daily_max_minutes=60,
        weekly_max_minutes=300,
        monthly_max_minutes=1200,
    ))
    db.session.commit()


@pytest.fixture
def db(app):
    """The SQLAlchemy instance, inside an app context."""
    from app import db as _db
    return _db


@pytest.fixture
def make_user(app):
    """Factory for users, so tests do not repeat password hashing."""
    from app import db
    from app.models.user import User

    def _make(username, role='Staff', full_name=None, **kwargs):
        user = User(
            username=username,
            full_name=full_name or username,
            role=role,
            department=kwargs.pop('department', 'IT'),
            is_active=kwargs.pop('is_active', True),
            **kwargs,
        )
        user.set_password('test-password-123')
        db.session.add(user)
        db.session.commit()
        return user

    return _make


@pytest.fixture
def auth_headers(app):
    """Return a callable that builds an Authorization header for a user.

    Issues the JWT directly instead of going through /api/auth/login, so the
    tests exercise the route under test rather than the login path.
    """
    from flask_jwt_extended import create_access_token

    def _headers(user):
        with app.app_context():
            token = create_access_token(identity=str(user.id))
        return {'Authorization': f'Bearer {token}'}

    return _headers
