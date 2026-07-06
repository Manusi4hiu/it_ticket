"""
Database Migration Script for Performance Optimizations

This script adds indexes (B-Tree and GIN) to the database to support
heavy loads (e.g. 30k tickets/month) and optimized Full-Text Search.
"""
import os
import sys
from dotenv import load_dotenv

# Add the app path to sys.path so we can import the app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from sqlalchemy import text

def add_indexes():
    app = create_app('development')
    with app.app_context():
        print("Starting index creation...")
        
        indexes_to_create = [
            # Standard B-Tree Indexes
            "CREATE INDEX IF NOT EXISTS ix_tickets_status ON tickets (status);",
            "CREATE INDEX IF NOT EXISTS ix_tickets_priority ON tickets (priority);",
            "CREATE INDEX IF NOT EXISTS ix_tickets_category ON tickets (category);",
            "CREATE INDEX IF NOT EXISTS ix_tickets_assigned_to_id ON tickets (assigned_to_id);",
            "CREATE INDEX IF NOT EXISTS ix_tickets_created_at ON tickets (created_at);",
            "CREATE INDEX IF NOT EXISTS ix_tickets_resolved_at ON tickets (resolved_at);",
            
            # GIN Index for Full-Text Search
            # The expression here must match the expression used in routes/tickets.py
            """
            CREATE INDEX IF NOT EXISTS ix_tickets_fts 
            ON tickets USING GIN (
                to_tsvector('english', 
                    title || ' ' || 
                    description || ' ' || 
                    submitter_name
                )
            );
            """
        ]
        
        try:
            for sql in indexes_to_create:
                print(f"Executing: {sql.strip().splitlines()[0][:50]}...")
                db.session.execute(text(sql))
            
            db.session.commit()
            print("\n✅ Successfully created all indexes! The database is now optimized for scale.")
            
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Error creating indexes: {e}")
            print("\nNote: If you are using SQLite for development, GIN indexes are not supported.")
            print("These optimizations are intended for PostgreSQL deployments.")
            
if __name__ == '__main__':
    load_dotenv()
    add_indexes()
