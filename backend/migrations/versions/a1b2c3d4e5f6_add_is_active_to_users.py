"""Add is_active to users

Revision ID: a1b2c3d4e5f6
Revises: e5f8a2b4c6d7
Create Date: 2026-09-09

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = 'e5f8a2b4c6d7'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]
    if 'is_active' not in columns:
        op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')))
    op.execute("UPDATE users SET is_active = true WHERE is_active IS NULL")


def downgrade():
    op.drop_column('users', 'is_active')
