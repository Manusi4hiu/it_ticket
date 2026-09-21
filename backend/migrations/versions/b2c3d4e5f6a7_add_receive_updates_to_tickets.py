"""Add receive_updates to tickets

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-15

"""
from alembic import op
import sqlalchemy as sa


revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('tickets')]
    if 'receive_updates' not in columns:
        op.add_column('tickets', sa.Column('receive_updates', sa.Boolean(), nullable=True, server_default=sa.text('false')))
    op.execute("UPDATE tickets SET receive_updates = false WHERE receive_updates IS NULL")


def downgrade():
    op.drop_column('tickets', 'receive_updates')
