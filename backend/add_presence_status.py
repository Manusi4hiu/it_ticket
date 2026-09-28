import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/ticket_it')
os.environ.setdefault('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')

from app import create_app, db
app = create_app()
with app.app_context():
    from sqlalchemy import text, inspect
    insp = inspect(db.engine)
    cols = [c['name'] for c in insp.get_columns('users')]
    print('Current cols:', cols)
    if 'presence_status' not in cols:
        with db.engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN presence_status VARCHAR(20) NOT NULL DEFAULT 'online'"))
            conn.commit()
        print('Column added!')
    else:
        print('Column already exists.')
