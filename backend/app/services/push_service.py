"""Web Push dispatch service.

Sends push notifications to all subscribed devices for a user.
Called from NotificationService.push() via after_commit hook.
"""
import os
import json
import logging
from pywebpush import webpush, WebPushException
from app.models.push_subscription import PushSubscription
from app import db

logger = logging.getLogger(__name__)

_VAPID_PRIVATE = os.getenv('VAPID_PRIVATE_KEY', '')
_VAPID_SUBJECT = os.getenv('VAPID_SUBJECT', 'mailto:no-reply.it-ticket@ani.co.id')


def send_push(user_id: int, payload: dict) -> None:
    """Push payload to all subscriptions for user_id.

    Cleans up dead subscriptions (410/404). Silent on failure — push is best-effort.
    # ponytail: synchronous in after_commit, offload to Celery/RQ if assign latency > 1s
    """
    if not _VAPID_PRIVATE:
        logger.warning('VAPID_PRIVATE_KEY not set — skipping push')
        return

    subs = PushSubscription.query.filter_by(user_id=int(user_id)).all()
    if not subs:
        return

    for sub in subs:
        subscription_info = {
            'endpoint': sub.endpoint,
            'keys': {'p256dh': sub.p256dh, 'auth': sub.auth},
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(payload),
                vapid_private_key=_VAPID_PRIVATE,
                vapid_claims={'sub': _VAPID_SUBJECT},
            )
        except WebPushException as e:
            status = e.response.status_code if e.response is not None else None
            if status in (410, 404):
                db.session.delete(sub)  # subscription expired/gone — cleanup
            else:
                logger.warning('Push failed for user %s: %s', user_id, e)
        except Exception as e:
            logger.warning('Push error for user %s: %s', user_id, e)

    db.session.commit()
