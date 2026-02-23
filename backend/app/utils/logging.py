from flask import request
from app import db
from app.models.system_log import SystemLog
import json

def log_activity(action, details=None, user_id=None, target_id=None, metadata=None):
    """
    Log a system activity
    :param action: Name of the action (e.g., "Ticket Created")
    :param details: Description of the action
    :param user_id: ID of the user performing the action
    :param target_id: ID of the object being acted upon
    :param metadata: Dictionary of additional metadata
    """
    try:
        ip_address = request.remote_addr
        
        # If behind a proxy, try to get the real IP
        if request.headers.get('X-Forwarded-For'):
            ip_address = request.headers.get('X-Forwarded-For').split(',')[0].strip()
        
        metadata_json = json.dumps(metadata) if metadata else None
        
        log = SystemLog(
            action=action,
            details=details,
            ip_address=ip_address,
            user_id=user_id,
            target_id=target_id,
            metadata_json=metadata_json
        )
        
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        # Don't let logging failures crash the main process
        print(f"Failed to log activity: {str(e)}")
        db.session.rollback()
