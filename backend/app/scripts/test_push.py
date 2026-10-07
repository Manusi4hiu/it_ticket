"""Runnable probe: kirim test push ke user_id tertentu.

Usage: python -m app.scripts.test_push <user_id>

Fails loud kalau VAPID missing / no subscription / webpush error.
"""
import sys
import os
import logging

from app import create_app
from app.services.push_service import send_push
from app.models.push_subscription import PushSubscription


def main():
    if len(sys.argv) < 2:
        print('Usage: python -m app.scripts.test_push <user_id>')
        sys.exit(1)

    user_id = sys.argv[1]
    logging.basicConfig(level=logging.INFO)

    app = create_app()
    with app.app_context():
        assert os.getenv('VAPID_PRIVATE_KEY'), 'VAPID_PRIVATE_KEY missing in .env'
        assert os.getenv('VAPID_SUBJECT'), 'VAPID_SUBJECT missing in .env'

        count = PushSubscription.query.filter_by(user_id=int(user_id)).count()
        assert count > 0, (
            f'No push subscription for user {user_id} — '
            'subscribe from frontend first (login → Enable Notifications)'
        )

        send_push(int(user_id), {
            'title': 'Test Push — IT Aero',
            'body': 'Verifikasi push infra jalan. Kalau kamu lihat ini, setup benar.',
            'tag': 'test-push',
            'url': '/it_ticket/frontend/dashboard',
        })
        print(f'Push sent to user {user_id} ({count} subscription(s))')


if __name__ == '__main__':
    main()
