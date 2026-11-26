"""Tests for user phone number persistence, normalization, and validation."""
import os
import tempfile

import pytest
from flask_jwt_extended import create_access_token

from app import create_app, db
from app.models.user import User


@pytest.fixture
def isolated_app(monkeypatch):
    """Create an isolated SQLite temp DB app for user phone CRUD tests."""
    tmp = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
    tmp_path = tmp.name
    tmp.close()

    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path}')
    monkeypatch.setenv('FLASK_DEBUG', '0')
    monkeypatch.setenv('ENABLE_SLA_SCHEDULER', '0')

    app = create_app(
        'development',
        config_overrides={
            'SQLALCHEMY_DATABASE_URI': f'sqlite:///{tmp_path}',
            'SQLALCHEMY_ECHO': False,
            'TESTING': True,
        },
    )

    with app.app_context():
        assert db.engine.url.drivername == 'sqlite'
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()
        db.engine.dispose()

    if os.path.exists(tmp_path):
        os.unlink(tmp_path)


def _create_admin_headers(app):
    with app.app_context():
        admin = User(
            username='admin_test',
            email='admin_test@example.com',
            full_name='Admin Test',
            role='Administrator',
            is_active=True,
        )
        admin.set_password('secret123')
        db.session.add(admin)
        db.session.commit()
        token = create_access_token(identity=str(admin.id))
        return {'Authorization': f'Bearer {token}'}, admin.id


def test_create_get_update_and_clear_user_phone(isolated_app):
    """Creating, listing, updating, and clearing user phone persists cleanly."""
    client = isolated_app.test_client()
    headers, _ = _create_admin_headers(isolated_app)

    # 1. Create user with leading/trailing whitespace around phone
    res_create = client.post(
        '/api/users',
        headers=headers,
        json={
            'username': 'phone_user',
            'full_name': 'Phone User',
            'email': '  phone_user@example.com  ',
            'phone': '  +62 812-3456-7890  ',
            'password': 'password123',
            'role': 'Staff',
        },
    )
    assert res_create.status_code == 201
    created = res_create.get_json()['user']
    assert created['phone'] == '+62 812-3456-7890'
    assert created['email'] == 'phone_user@example.com'
    user_id = created['id']

    # 2. GET /api/users returns saved phone
    res_list = client.get('/api/users', headers=headers)
    assert res_list.status_code == 200
    listed = next(u for u in res_list.get_json()['users'] if u['id'] == user_id)
    assert listed['phone'] == '+62 812-3456-7890'

    # 3. PUT /api/users/<id> updates phone & preserves password when password=''
    res_update = client.put(
        f'/api/users/{user_id}',
        headers=headers,
        json={
            'full_name': 'Phone User Updated',
            'username': 'phone_user',
            'email': 'phone_user@example.com',
            'phone': '08991234567',
            'password': '',
        },
    )
    assert res_update.status_code == 200
    updated = res_update.get_json()['user']
    assert updated['phone'] == '08991234567'
    assert updated['full_name'] == 'Phone User Updated'

    with isolated_app.app_context():
        db_user = User.query.get(int(user_id))
        assert db_user.phone == '08991234567'
        assert db_user.check_password('password123') is True

    # 4. Updating another field without sending 'phone' keeps existing phone
    res_partial = client.put(
        f'/api/users/{user_id}',
        headers=headers,
        json={'full_name': 'Phone User Renamed'},
    )
    assert res_partial.status_code == 200
    assert res_partial.get_json()['user']['phone'] == '08991234567'

    # 5. Explicitly sending empty/whitespace phone clears it to None
    res_clear = client.put(
        f'/api/users/{user_id}',
        headers=headers,
        json={'phone': '   '},
    )
    assert res_clear.status_code == 200
    assert res_clear.get_json()['user']['phone'] is None


def test_phone_validation_and_empty_email_normalization(isolated_app):
    """Overlong or invalid phones return 400; multiple users can have empty email."""
    client = isolated_app.test_client()
    headers, _ = _create_admin_headers(isolated_app)

    # Overlong phone (>50 chars) returns 400 rather than DB truncation 500
    res_long = client.post(
        '/api/users',
        headers=headers,
        json={
            'username': 'bad_long',
            'full_name': 'Bad Long',
            'phone': '0' * 55,
            'password': 'password123',
            'role': 'Staff',
        },
    )
    assert res_long.status_code == 400

    # Invalid characters return 400
    res_alpha = client.post(
        '/api/users',
        headers=headers,
        json={
            'username': 'bad_alpha',
            'full_name': 'Bad Alpha',
            'phone': 'abc-invalid',
            'password': 'password123',
            'role': 'Staff',
        },
    )
    assert res_alpha.status_code == 400

    # Two users with empty-string email normalize to NULL without UNIQUE collision
    for idx in (1, 2):
        res_empty_email = client.post(
            '/api/users',
            headers=headers,
            json={
                'username': f'no_email_{idx}',
                'full_name': f'No Email {idx}',
                'email': '   ',
                'phone': f'0812000000{idx}',
                'password': 'password123',
                'role': 'Staff',
            },
        )
        assert res_empty_email.status_code == 201
        assert res_empty_email.get_json()['user']['email'] is None

    # Update with invalid phone returns 400 and leaves phone intact
    res_list = client.get('/api/users', headers=headers)
    target = next(u for u in res_list.get_json()['users'] if u['username'] == 'no_email_1')
    res_bad_update = client.put(
        f"/api/users/{target['id']}",
        headers=headers,
        json={'phone': '------'},
    )
    assert res_bad_update.status_code == 400
    with isolated_app.app_context():
        assert User.query.get(int(target['id'])).phone == '08120000001'
