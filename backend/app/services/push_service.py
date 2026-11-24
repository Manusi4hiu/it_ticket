"""Web Push dispatch service.

Sends push notifications to all subscribed devices for a user.
"""
import os
import json
import logging
import threading
from typing import Optional
from flask import current_app, has_app_context
from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid
from py_vapid.utils import b64urlencode
from pywebpush import webpush, WebPushException
from app.models.push_subscription import PushSubscription
from app import db

logger = logging.getLogger(__name__)

_DEFAULT_VAPID_SUBJECT = 'mailto:no-reply.it-ticket@ani.co.id'
_PUSH_TTL_SECONDS = 86400  # 24h so sleeping/dozing mobile devices still receive queued pushes
_PUSH_TIMEOUT_SECONDS = 10


def _read_config(key: str, default: str = '') -> str:
    """Read VAPID setting at runtime from Flask config first, then os.environ."""
    val = None
    if has_app_context():
        val = current_app.config.get(key)
    if not val:
        val = os.getenv(key, default)
    return str(val or default).strip()


def _load_vapid(raw_key: str) -> Vapid:
    """Parse VAPID private key from file path, PEM string, or raw base64url/DER string."""
    if os.path.isfile(raw_key):
        return Vapid.from_file(private_key_file=raw_key)
    if '-----BEGIN' in raw_key:
        pem = raw_key.replace('\\n', '\n').strip()
        return Vapid.from_pem(pem.encode('utf-8'))
    return Vapid.from_string(private_key=raw_key)


def get_vapid_public_key() -> str:
    """Return configured VAPID public key or derive base64url P-256 public key from private key."""
    pub = _read_config('VAPID_PUBLIC_KEY')
    if pub:
        return pub
    raw_private = _read_config('VAPID_PRIVATE_KEY')
    if not raw_private:
        return ''
    try:
        vapid = _load_vapid(raw_private)
        pub_bytes = vapid.public_key.public_bytes(
            serialization.Encoding.X962,
            serialization.PublicFormat.UncompressedPoint,
        )
        return b64urlencode(pub_bytes)
    except Exception as exc:
        logger.warning('Failed to derive VAPID public key: %s', exc)
        return ''


def send_push(user_id: int, payload: dict) -> dict:
    """Push payload to all subscriptions for user_id and clean up expired ones (404/410)."""
    raw_private = _read_config('VAPID_PRIVATE_KEY')
    vapid_subject = _read_config('VAPID_SUBJECT', _DEFAULT_VAPID_SUBJECT) or _DEFAULT_VAPID_SUBJECT
    if not raw_private:
        logger.warning('VAPID_PRIVATE_KEY not set — skipping push')
        return {'sent': 0, 'deleted': 0, 'failed': 0, 'skipped': True}

    try:
        vapid = _load_vapid(raw_private)
    except Exception as exc:
        logger.error('Invalid VAPID_PRIVATE_KEY configuration: %s', exc)
        return {'sent': 0, 'deleted': 0, 'failed': 0, 'skipped': True}

    subs = PushSubscription.query.filter_by(user_id=int(user_id)).all()
    if not subs:
        return {'sent': 0, 'deleted': 0, 'failed': 0, 'skipped': False}

    sent = 0
    failed = 0
    dead_subs = []
    serialized_payload = json.dumps(payload)

    for sub in subs:
        subscription_info = {
            'endpoint': sub.endpoint,
            'keys': {'p256dh': sub.p256dh, 'auth': sub.auth},
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=serialized_payload,
                vapid_private_key=vapid,
                vapid_claims={'sub': vapid_subject},
                ttl=_PUSH_TTL_SECONDS,
                timeout=_PUSH_TIMEOUT_SECONDS,
            )
            sent += 1
        except WebPushException as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (404, 410):
                dead_subs.append(sub)
            else:
                failed += 1
                logger.warning('Push failed for user %s (status=%s): %s', user_id, status, exc)
        except Exception as exc:
            failed += 1
            logger.warning('Push error for user %s: %s', user_id, exc)

    deleted = 0
    if dead_subs:
        try:
            for sub in dead_subs:
                db.session.delete(sub)
            db.session.commit()
            deleted = len(dead_subs)
        except Exception as exc:
            db.session.rollback()
            logger.warning('Failed to remove dead push subscriptions for user %s: %s', user_id, exc)

    return {'sent': sent, 'deleted': deleted, 'failed': failed, 'skipped': False}


def dispatch_push_async(app: Optional[object], user_id: int, payload: dict) -> None:
    """Run send_push outside the request/after_commit SQLAlchemy session lifecycle."""
    if app is None:
        logger.warning('Cannot dispatch push without Flask app context')
        return

    def _worker():
        with app.app_context():
            try:
                send_push(user_id, payload)
            except Exception as exc:
                logger.warning('Background web push dispatch failed for user %s: %s', user_id, exc)
            finally:
                db.session.remove()

    if app.config.get('TESTING'):
        return

    thread = threading.Thread(
        target=_worker,
        name=f'WebPush-{user_id}',
        daemon=True,
    )
    thread.start()
