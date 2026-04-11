from app import create_app, db
from sqlalchemy import text

app = create_app()
with app.app_context():
    print("Wiping public schema...")
    db.session.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    db.session.commit()
    
    print("Creating new tables with Integer IDs...")
    db.create_all()
    
    print("Database reset complete.")
