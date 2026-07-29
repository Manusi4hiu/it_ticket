from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        db.session.execute(text('ALTER TABLE statuses ADD COLUMN requires_reason BOOLEAN DEFAULT FALSE;'))
        db.session.commit()
        print("Added requires_reason to statuses.")
    except Exception as e:
        print("requires_reason might already exist:", e)
        db.session.rollback()
        
    try:
        db.session.execute(text('ALTER TABLE statuses ADD COLUMN pauses_sla BOOLEAN DEFAULT FALSE;'))
        db.session.commit()
        print("Added pauses_sla to statuses.")
    except Exception as e:
        print("pauses_sla might already exist:", e)
        db.session.rollback()
        
    try:
        db.session.execute(text('ALTER TABLE tickets ADD COLUMN sla_paused_at TIMESTAMP WITHOUT TIME ZONE;'))
        db.session.commit()
        print("Added sla_paused_at to tickets.")
    except Exception as e:
        print("sla_paused_at might already exist:", e)
        db.session.rollback()
        
    print("Migration finished.")
